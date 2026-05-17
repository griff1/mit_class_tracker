# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A private directory app for the **MIT Sloan Class of 2026** to keep track of one another after graduation — profiles, a city-aggregated map, a searchable directory, and aggregate stats. Access is class-members-only.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — frontend, hosted on Vercel
- **Tailwind CSS v4** — styling
- **Supabase** (`@supabase/ssr` 0.10.x) — auth, Postgres, Storage, Row-Level Security

> **Heads-up: Next.js 16 has breaking renames from earlier versions.** See `## Next.js 16 quirks` below before writing anything that touches routing, cookies, or what-used-to-be-called middleware. The auto-generated `AGENTS.md` echoes this warning.

## Architecture invariants

Cross-cutting rules every feature must preserve.

- **Email 6-digit OTP-code auth, `@mit.edu` / `@alum.mit.edu` gate on signup only.** No passwords. The `requestLoginCode` Server Action calls `supabase.auth.signInWithOtp({ email })` with `shouldCreateUser: true` (the default) — same form for new signups and returning sign-ins — and `verifyEmailOtp` validates the typed code via `supabase.auth.verifyOtp` — trying `type: 'email'` (returning users) then `type: 'signup'` (brand-new signups), because GoTrue issues different token classes for each. **It is a 6-digit emailed code, not a clickable magic link, and that is load-bearing:** every user is on MIT Microsoft 365, whose Safe Links scanner pre-fetches inbound URLs and consumes a single-use magic link before the human clicks (Gmail didn't, MIT Outlook did — that asymmetry was the diagnosis). A typed code has no URL to pre-fetch. **Do not revert sign-in to a magic link.** `signInWithOtp` sends **two different templates**: returning users get **Magic Link**, brand-new signups (Confirm email is on) get **Confirm signup**. **Both** MUST render only `{{ .Token }}` with NO confirmation URL — link and code are the same OTP, so a prefetched link burns the code. (Overlooking the Confirm-signup one is exactly why new signups initially still received a link.) The `before_user_created` Supabase Auth Hook rejects addresses that don't end in `@mit.edu` or `@alum.mit.edu` on *initial signup* — it fires inside the auth.users INSERT, before the sign-in code is emailed. (Both domains accepted because alumni who've already migrated to their `@alum.mit.edu` lifetime address still need to be able to sign up.) The hook does **not** fire on email change (see the alumni transition flow below), which is intentional. **Scope note:** there is no Sloan-specific email domain, so MIT-domain membership is the finest granularity we can enforce technically. Any active MIT email (alum, faculty, current students, other classes) can register. If finer scope ever becomes a requirement, the right shape is an invite-list table that the Auth Hook checks against.
- **Alumni email transition is automatic on personal-email add/change — no opt-in.** Users will eventually lose their MIT mailbox; since sign-in is a code to that inbox, if their auth identity were still the MIT address they'd be permanently locked out. So `updateProfile` (not a separate action) calls `supabase.auth.updateUser({ email })` whenever the saved `personal_email` is newly set or changed and differs from the current `auth.users.email`. Supabase emails a confirmation **to the new (personal) address only** — which requires Supabase **"Secure email change" OFF** (see security postures); once clicked, `auth.users.email` becomes the personal email and codes go there. **`profile.mit_email` is never touched** — it stays the historical directory identity. Until a user adds a personal email, an AppShell banner nags them on every authed page. While a transition is pending (personal email set but `auth.users.email` not yet switched), a **persistent** notice on `/profile` offers **Resend confirmation email** — the `resendEmailTransition` action re-calls the same `supabase.auth.updateUser({ email })` as the auto-transition, **not** `auth.resend` (which only re-sends an *already-pending* change and silently no-ops when none is in progress — that bug made the button look dead). It is restricted server-side to the already-saved `personal_email` so it can't retarget the change (takeover surface stays identical to the automatic path) and is Supabase-rate-limited (no app-side throttle, same posture as the OTP code). Success → `?email_transition=resent`; `/profile` shows an explicit "Confirmation email sent" banner, which **also** renders for the initial `pending` (the missing acknowledgement that made sends look like nothing happened). **Accepted residual:** a user who never adds a personal email before losing MIT access is locked out and needs manual admin recovery — explicitly accepted as rare (the decision was simplicity + nagging over a service-role custom-OTP subsystem). Security note: auto-move means setting `personal_email` relocates the login identity once the new address confirms; an authenticated session could already do this via the old two-step flow, so it is not a new capability — binding controls remain session integrity and the new-address confirmation step (a transient attacker who can't receive mail at the address they set can't complete the move).
- **Edge case worth knowing:** after a user transitions away from their MIT email, that address becomes "owned" by their profile row via the `mit_email` UNIQUE constraint. If someone else tries to register the same address later, the `handle_new_user` trigger's INSERT into `profiles` will fail with a UNIQUE violation, blocking the new signup. The sign-in code email still gets dispatched (the trigger fires after confirmation, not before), but the new account never finishes provisioning. Mild UX wart for the would-be new registrant; net effect: former MIT addresses are permanently squatted by the original profile.
- **All data sits behind auth, enforced at the database.** Every read of profile data flows through an authenticated session. Use Supabase **RLS** policies as the source of truth — never rely on client-side route gating alone. This is the easiest invariant to silently break.
- **City-level location only.** We store the user-typed city string and aggregate on it. We do **not** collect street addresses or geolocate users. The map shows one marker per city, sized/labeled by count (e.g. "NYC — 12").
- **Self-service profile editing.** Any user can update their own row at any time. There is no admin-edit path.

## Data model (intended)

A single `profiles` table keyed by `auth.users.id`:

| field | notes |
|---|---|
| `name` | display name |
| `mit_email` | the auth identity; populated from `auth.users.email` on signup; `@mit.edu`-only |
| `personal_email` | secondary contact, any domain, user-editable. **Drives auth:** newly setting/changing it auto-initiates the sign-in transition (`updateProfile` → `updateUser`) — see the Alumni email transition invariant. Format-validated by `safeEmail`. |
| `company`, `title` | professional info |
| `industries` | `text[]`, multi-select. Seed in `INDUSTRIES` (`lib/types.ts`); same add-new + `resolveCanonical` dedup pattern as cities/activities/roles. GIN-indexed. |
| `roles` | `text[]`, multi-select of functional roles ("Product Manager", "Software Engineer", etc.). Seed in `ROLES`. Add-new + canonical dedup. GIN-indexed. Shown on profile cards as coral-tinted chips, distinct from the line-bordered industry chips. |
| `cities` | `text[]`, multi-select with **canonical case-insensitive dedup** at write time (see `resolveCanonical` in `src/app/profile/actions.ts`). Seeded with `CITIES` in `lib/types.ts`; members can add new entries which then appear as chips for everyone in the cohort. GIN-indexed. The map's "Lives here" layer aggregates on this. |
| `visiting_cities` | `text[]`, **cities the member frequently travels to** (work or otherwise) — distinct from `cities` (where they live). Identical mechanics to `cities`: shares the `CITIES` seed, same add-new + `resolveCanonical` dedup, GIN-indexed, mirrored in the directory filter / profile cards ("Often in") / stats. The map's "Frequently visits" toggle aggregates on this. |
| `linkedin_url` | LinkedIn profile URL |
| `profile_photo_url` | **Stores a Storage path** (e.g. `<user_id>/avatar`), not a URL — despite the column name. Signed URLs are generated at render time. `null` means "no photo, render initial." |
| `ocean` | Sloan cohort (see glossary) |
| `activities` | `text[]`, same add-new pattern as `cities`. Seeded with `ACTIVITIES` in `lib/types.ts`. |

RLS shape (see `supabase/migrations/20260513180000_init.sql`):
- `select`: any authenticated user (the directory is intra-class-visible)
- `update`: only on rows where `id = auth.uid()`
- `insert`: no policy — rows are created exclusively by the `on_auth_user_confirmed` trigger, which fires only when `auth.users.email_confirmed_at` transitions from NULL to non-NULL. **Unconfirmed signups never become rows in `profiles`** — that's the safety net against `fake@mit.edu`-style accounts polluting the directory.
- `delete`: no policy — deletion happens via cascade when an `auth.users` row is removed

Profile photos live in the private `profile-photos` Storage bucket (created by `supabase/migrations/20260514180400_profile_photos_bucket.sql`). RLS: any authenticated user reads, each user can only write to their own `<user_id>/` folder. Files always live at `<user_id>/avatar` (no extension — content-type is stored as metadata). The Server Action upserts so re-uploading replaces. The `next.config.ts` body-size limit is bumped to 5MB so phone-camera JPEGs don't get silently rejected. **Rendering:** generate signed URLs at request time — single `createSignedUrl(path, 3600)` on the profile page, batch `createSignedUrls([paths], 3600)` on the directory page (one round trip for all visible cards).

## Supabase project setup

These project-level dashboard settings are already applied:

- **Data API**: on (required for `@supabase/ssr`)
- **Automatically expose new tables**: **off** — no privileges granted to Data API roles by default
- **Enable automatic RLS**: **on** — event trigger turns on RLS for every new table in `public`
- **Custom SMTP via Resend**: on (Authentication → SMTP Settings). All auth email (sign-in codes, email-change confirmation links) goes through Resend, **not** Supabase's built-in sender. This means Supabase's default 30-emails/hour project cap does **not** apply — the binding limit is Resend's plan (free tier: 100/day, 3000/mo). If you ever see "Email rate limit exceeded" again, check the per-address limit in Authentication → Rate Limits *and* the Resend dashboard logs, not the Supabase default. The Resend API key is stored in Supabase's SMTP config (dashboard only) — it is not in the repo or env files.
  - **CRITICAL — why sign-in is a code, not a link (do not revert).** Enterprise mail scanners pre-fetch every inbound URL to threat-scan it. MIT's Microsoft 365 **Safe Links** does an automated GET that **consumes the single-use Supabase token before the human clicks**, so a magic link arrives already "invalid or expired" for essentially every MIT user. Diagnosis fingerprint: links worked to Gmail, failed to MIT Outlook, with Resend click-tracking already off — i.e. recipient-side, not sender-side. The fix in use is the **emailed 6-digit OTP code** (`{{ .Token }}`, verified by `verifyEmailOtp`): no URL, nothing to pre-fetch. **Both the "Magic Link" (returning users) and "Confirm signup" (new users) email templates MUST contain only `{{ .Token }}` and NO `{{ .ConfirmationURL }}`** — they are the same OTP, so a prefetched link still burns the code; `verifyEmailOtp` verifies with `type: 'email'` then `'signup'` to cover both. Separately, Resend's **Click Tracking** (URL rewrite) and **Open Tracking** (pixel/prefetch) independently consume links and must stay OFF on the sending domain (Resend → Domains → toggle both off): with the code flow they no longer affect sign-in, but the **alumni email-change confirmation is still a link** through `/auth/confirm`, so keep them off regardless. The auto email-change confirmation goes to the personal inbox only (Secure email change OFF), usually a non-Safe-Links inbox. Residual: if that personal inbox is *also* O365/Safe-Links the one-time link can still be eaten, and a user who never adds a personal email at all is locked out — both accepted as rare, manual-recovery (see the Alumni email transition invariant).

**Operational consequence:** a freshly created table is unreachable from the API until you do two things deliberately:

1. `GRANT SELECT/INSERT/UPDATE/DELETE ... ON <table> TO authenticated` (and `anon` only if you genuinely want anonymous access — for profile data, never).
2. Write at least one `CREATE POLICY` for each operation you want allowed.

If a query returns empty or an insert silently fails at the API layer, start here.

## Security postures

These were locked in after a pre-public-deploy review. Don't regress them silently:

- **Email domain gate is the `before_user_created` Auth Hook — single layer, by deliberate design.** It fires inside the `auth.users` INSERT and covers *every* signup path, including direct REST calls that skip the form (an app-side check never could). Its rejection message is surfaced to the user: `signInWithOtp` returns the hook's error, and `requestLoginCode` redirects to `/sign-in?error=<message>`. An app-side pre-check was tried as defense-in-depth but **deliberately removed**, and the primary reason is a security argument (not just the UX/alumni one). A frontend check *fails closed* — the UI keeps rejecting non-MIT emails no matter what the backend does — so it would **mask a fail-open hook**: the real boundary could be wide open while normal use looks completely fine, the hole invisible until someone hits the API directly, i.e. until it's an actual attack. Not hypothetical: the original `{"decision":...}` fail-open (see contract gotcha below) was caught *only because* the app-side check happened to be disabled for testing — with it active we'd have shipped an open gate to prod believing it worked, because the redundant layer hides the bug from the exact test that finds it. We want the boundary to **fail loudly**. Caveat: "loudly" still relies on someone exercising the non-MIT path through the UI, and in prod essentially everyone is MIT — so the real guarantee is not organic observation but the *deterministic* boundary test `supabase/health-check.sql` query 3 (must return an `{"error":...}` object, never `{}`), run every pre-deploy regardless of traffic. No masking layer keeps failure *observable*; the health-check is what makes it *observed*. (The app-side check also incorrectly blocked transitioned alumni from requesting a link — an independent second reason.) **Do not re-add an app-side domain check as "defense in depth."** Here it is the opposite of defense in depth: it destroys the property that makes boundary failure detectable. If you think one is needed, the actual problem is that the health-check gate isn't being run.
- **CRITICAL hook-contract gotcha.** The Before User Created hook's reject contract is **`{"error": {"http_code": <4xx>, "message": "..."}}`** and allow is **`{}`** — NOT the `{"decision": "reject"/"continue"}` shape used by the MFA/password hooks. We originally used `{"decision":...}`; Supabase didn't recognize it as a rejection and **created the user anyway (fail-open — any email could sign up)**. Fixed in `supabase/migrations/20260516182711_fix_before_user_created_contract.sql`. **Never** change this function back to a `decision` envelope. Authoritative spec: `https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook`. Real payload email path: `event->'user'->>'email'`.
- **Pre-deploy verification:** run `supabase/health-check.sql` (Dashboard SQL Editor / `psql`). It now tests with the REAL `{"user":{"email":...}}` payload shape and asserts reject = an `error` object, allow = `{}`. (The old health-check tested a different payload shape and only eyeballed "some JSON" — which is exactly how the fail-open hid. Don't weaken it back.) The dashboard toggle (Authentication → Hooks) isn't SQL-queryable — still eyeball it. (Migration trail: `…182711` fixed the contract; `…184752` was a temporary audit-logging probe that confirmed the hook fires for `signInWithOtp` (passwordless) signups; `…185515` reverts the probe — drops the `_auth_hook_audit` table and restores the clean function. The probe file is kept, not deleted, for append-only migration hygiene.)
- **`personal_email` is server-validated** by `safeEmail` in `src/lib/url-safety.ts` — basic `localpart@domain.tld` format. Malformed input becomes `null` on save.
- **Auto email-transition + "Secure email change" OFF is a deliberate posture, not an oversight.** Saving a new/changed `personal_email` relocates the login identity once the new address confirms. This is *not* a new capability — an authenticated session could already do the old two-step transition — so the binding controls are unchanged: session integrity + the new-address confirmation step (a transient attacker who can't receive mail where they pointed it can't finish the move). "Secure email change" is intentionally OFF so the confirmation skips the Safe-Links-eaten MIT inbox; the cost is no old-address confirmation, explicitly accepted. **Never silently flip "Secure email change" back ON** as "hardening": the MIT-side link can't be clicked (Safe Links burns it), so it adds zero usable defense and breaks the transition for every user — a false-security change of exactly the kind this section exists to prevent.
- **Profile rows only exist for confirmed users.** The `on_auth_user_confirmed` trigger fires only on `email_confirmed_at` NULL→non-NULL.
- **`/auth/confirm` `next` redirect is restricted to same-origin paths.** `safeNext` in the route handler rejects anything that doesn't start with `/`, plus protocol-relative `//`. Without this, `new URL(next, request.url)` silently drops the base when `next` is absolute — an open-redirect hole. (This route now serves **only** the alumni email-change confirmation link; code-based sign-in never touches it — but the guard stays, the route is still reachable.)
- **User-supplied URLs go through `safeHttpUrl` / `safeLinkedInUrl` in `src/lib/url-safety.ts`** before being saved AND before being rendered as `href`. `safeLinkedInUrl` also constrains the host to `linkedin.com` or a subdomain to block `evilinkedin.com`-style look-alikes. Defense in depth: even if a legacy bad row exists in the DB, the render-time guard prevents `javascript:` execution.
- **Profile-photo bucket has DB-level constraints**: 5MB file size + image-only MIME types (jpeg / png / webp / gif). The Server Action also validates, but the bucket constraint catches direct-`supabase-js` uploads that skip our action.
- **Storage RLS only allows writes to your own `<user_id>/` folder** via `(storage.foldername(name))[1] = auth.uid()::text`. Reads are intra-cohort visible (authenticated only).
- **Security headers in `next.config.ts`**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=() microphone=() geolocation=()`. Apply to every route via `source: "/(.*)"`. A strict CSP is deliberately not set yet — it'd need to allow leaflet tiles + Supabase signed URLs, which is its own audit.
- **All Supabase queries are parameterized** (no string interpolation in code). Don't introduce raw SQL via the client.
- **The service-role key is never present in the codebase or env.** All server-side operations use the anon-key client with the user's session cookies, so RLS still applies.

## Glossary

- **Ocean** — at MIT Sloan, first-year MBA students are divided into cohorts named after oceans (Atlantic, Pacific, etc.). This is the user's cohort, not a typo. Preserve the term in UI and schema.

## Features

1. **Auth** — Supabase passwordless **email 6-digit OTP code** + MIT-domain check (`before_user_created` Auth Hook). Code, not magic link — see the Safe Links rationale in Architecture invariants.
2. **Profile** — view-and-edit screen covering every field above. Photo upload to Supabase Storage.
3. **Map** — embedded on the signed-in home page (not a separate route). Markers aggregated by `cities`, one per city, count-labeled. Uses `react-leaflet` with OpenStreetMap tiles.
4. **Directory** — filterable/searchable table. Filters: industries, roles, cities, frequently-in, activities, ocean, name search.
5. **Stats** — top cities, top industries, breakdowns by ocean, etc.

## Layout

- `src/app/page.tsx` — auth-aware home. Logged-out: marketing CTA. Logged-in: PageHeader + stats strip + **embedded class map** (was a separate `/map` route until we collapsed it) + nav tiles to Profile / Directory / Stats. Builds **two** geo aggregations from one query (selects `name, mit_email, cities, visiting_cities`) — `cities` (Lives here) and `visiting_cities` (Frequently visits) — each carrying the per-city list of member display names (`name || mit_email`, sorted); passes both to `<ClassMap livesHere visits>`; an unmapped-city note is rendered per layer. Names are already cohort-visible (directory) and the map is auth-only, so the popup list is no new exposure. `/map` redirects to `/` via `next.config.ts`.
- `src/app/sign-in/page.tsx` — two-step email-OTP form: step 1 email → `requestLoginCode`; step 2 (`?step=verify&email=`) 6-digit code entry → `verifyEmailOtp`. Plain server-action forms, no client JS (the "send a new code" control is an inline form, not a GET link — never re-send an OTP on GET). Handles new signups and returning sign-ins. `/sign-up` redirects here via `next.config.ts`.
- `src/app/profile/page.tsx` — view-and-edit your own profile (auth-gated, redirects to sign-in). Four numbered sections: Identity / Work / Place (cities, ocean, LinkedIn) / Sloan (activities). Identity shows the read-only current sign-in email; there is **no** manual transition *initiate* button — saving a personal email triggers the move automatically. `?email_transition` drives the banners: `pending`/`resent` → emerald "Confirmation email sent", `error` → red failure. While the move is pending (personal email set, auth email not yet switched) a persistent amber notice also renders above the form with a **Resend confirmation email** button (its own form → `resendEmailTransition`, outside the `updateProfile` form so Enter can't hijack it).
- `src/app/profile/actions.ts` — `updateProfile` Server Action. `ocean` is allow-listed (no add-new). `industries`, `roles`, `cities`, `visiting_cities`, `activities` all go through `resolveCanonical` — server-side case-insensitive dedup against the cohort's existing values plus the seed list, so user write-ins canonicalize to existing entries instead of duplicating (`visiting_cities` reuses the `CITIES` seed). Also handles the optional `profile_photo` File entry: validates size (≤5MB) + MIME (jpeg/png/webp/gif), upserts to `profile-photos/<user_id>/avatar`, stores the path on the row. On save it also **auto-initiates the alumni email transition**: if `personal_email` is newly added/changed and differs from the current auth email, it calls `supabase.auth.updateUser({ email })`. Replaces the old standalone `transitionAuthEmail` action (removed). `resendEmailTransition` — separate user-invoked recovery action for a lost/never-received confirmation: re-calls `supabase.auth.updateUser({ email })` (same as the auto-transition; reliably re-sends regardless of pending state — `auth.resend` only re-sends an *already-pending* change), hard-restricted to the saved `personal_email`, Supabase-rate-limited; success → `?email_transition=resent`.
- `src/app/directory/page.tsx` — auth-gated class directory. Filters in URL search params (bookmarkable): name (`ilike`), ocean (`eq`), and `industries` / `roles` / `cities` / `visiting_cities` / `activities` (Postgres array `overlaps`). Plain GET form so back/forward and JS-disabled both work. The five array-filter groups are collapsible via `<details>` — they default to closed and auto-open when the URL has active selections so the user sees what's applied.
- `src/app/stats/page.tsx` — auth-gated stats grid: top 10 cities / top 10 frequently-in cities / top 10 industries / top 10 roles / top 10 activities / oceans (full ordered list including zeros). JS-side aggregation from one Supabase query; thin coral bars rendered with plain CSS (no chart library). (Map aggregation now lives in `page.tsx` — same pattern.)
- `src/components/class-map.tsx` — **Client Component** (`"use client"`) wrapping `react-leaflet`. Renders a `MapContainer` with OpenStreetMap tiles and a custom `divIcon` per city (circle sized by count). Holds a `useState` segmented toggle — **"Lives here"** (`cities`, coral `#e85d45`) vs **"Frequently visits"** (`visiting_cities`, blue `#2563eb`) — and renders one layer at a time; takes `livesHere` + `visits` aggregate arrays from `page.tsx`. Clicking a pin opens a popup that lists the member names in that city (scrollable, `maxHeight` ~160px, for big cities), not just a count. Imports `leaflet/dist/leaflet.css` at the module level. **Don't add `dynamic({ ssr: false })` around this from a Server Component** — Next 16 rejects that combination. Direct import works because the `"use client"` boundary already excludes the module from server execution.
- `src/lib/cities-geo.ts` — lat/lng lookup keyed by lowercased city name. Serves **both** map layers (`cities` and `visiting_cities`). Only the seed `CITIES` are populated; user-added cities won't appear on either map layer unless their coordinates are added here.
- `src/components/editable-chip-group.tsx` — pairs a `Chip` multi-select with a "add new" `Input` for the same field. Used for cities and activities on the profile page.
- `src/app/auth/actions.ts` — `requestLoginCode` (signup + sign-in via `signInWithOtp`; before_user_created hook gates new MIT addresses), `verifyEmailOtp` (validates the 6-digit code via `verifyOtp` — `type: 'email'` then fallback `'signup'` for brand-new-signup codes — then redirects to `/`), and `signOut`. No password actions — passwordless by design.
- `src/app/auth/confirm/route.ts` — Route Handler that exchanges an email-confirmation token for a session. **Now used only by the alumni email-change confirmation link** (`updateProfile` auto-initiates `updateUser({ email })` → Supabase "Change Email Address" template); code-based sign-in never hits this route. Still handles BOTH the PKCE `?code=` and `?token_hash=&type=` flows.
- `src/lib/supabase/client.ts` — browser Supabase client for Client Components
- `src/lib/supabase/server.ts` — server Supabase client (Server Components / Route Handlers / Server Actions); awaits `cookies()`
- `src/lib/supabase/proxy.ts` — `updateSession` helper that refreshes auth cookies on every request
- `src/lib/types.ts` — `Profile` row shape + seed lists for `INDUSTRIES`, `ROLES`, `OCEANS`, `CITIES`, `ACTIVITIES`. `CITIES` seeds **both** `cities` and `visiting_cities` (no separate seed). **`OCEANS` is the only strict allow-list** (the cohort name is a fixed set the user can't extend). The other four are seeds — write-ins allowed, canonicalized server-side.
- `src/lib/viewer.ts` — `getViewer(supabase, user)` loads the data the AppShell top nav needs (name, ocean, signed photo URL) **plus `personal_email`** — AppShell renders a lockout-prevention banner on every authed page when it's empty. One profile-row query + one optional Storage signed-URL call. Every authed page calls this and hands the result to `<AppShell user={viewer}>`.
- `src/lib/oceans.ts` — single source of truth for ocean visuals: `OCEAN_FLAG` (path to `public/oceans/*.jpg` per ocean) and `OCEAN_COLOR` (`{text,bg}` Tailwind classes per ocean). The `Avatar` notch renders the ocean flag (falls back to the coral square when no ocean is set); card eyebrows tint the ocean name with `OCEAN_COLOR[ocean].text`. Use this module for any new ocean-colored UI rather than redefining the mapping.
- `src/proxy.ts` — Next.js 16 Proxy entry (was `middleware.ts` in v15 and earlier); delegates to `updateSession`
- `supabase/migrations/*.sql` — versioned schema and Auth Hook function. Apply via `supabase db push`, or paste into Dashboard → SQL Editor in filename order.
- `.env.example` — template for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Copy to `.env.local`.

## Design tokens

Light-mode only. Cool zinc/gray and pure black/white are deliberately avoided in favor of warm tones plus a single coral accent.

- **Color tokens** — defined in `src/app/globals.css` via Tailwind v4's `@theme` block. Generated utilities:
  - `bg-cream` / `bg-paper` — page bg and card surface (warm off-whites)
  - `text-ink`, `text-ink-2`, `text-ink-3` — primary / secondary / tertiary text (warm dark-to-mid)
  - `border-line`, `border-line-2` — hairline rules
  - `brand-{50..900}` — coral accent (CTAs, eyebrows, hover, active underline)
- **Don't use** `zinc`, `gray`, `stone`, `slate`, `neutral`, or `bg-white`/`bg-black`/`text-black`/`text-white` directly. Always reach for the tokens above. The exception is `red-200`/`red-50`/`red-800` for error banners and `emerald-200`/`emerald-50`/`emerald-800` for success — those are intentionally cool to read as system-state alerts.
- **Typography** — Geist Sans (`font-sans`) for body and headings. JetBrains Mono (`font-mono`) for eyebrows above headings, field labels, section labels, chip text, brand logo, and numeric counts. Mono is what makes the system feel "documented."
- **Type sizes** — page H1 `text-2xl font-semibold tracking-tight`; card/section heading `text-base font-semibold tracking-tight`; mono labels `text-[0.6rem] uppercase tracking-[0.12em]` (or `[0.15em]`/`[0.18em]` for stronger emphasis); body `text-sm`.
- **Radii** — cards/sections `rounded-md` (6px); avatars `rounded-md`; chips/pills `rounded-sm`; buttons `rounded-md`. No `rounded-full` or `rounded-xl` anywhere — they read too soft for the documented feel.
- **Borders, not shadows.** All elevated surfaces are `border border-line` on `bg-paper`. No `shadow-*` utilities.
- **Active button is `bg-ink`** with `text-cream`. Outline button is `border-line-2 bg-paper`. Coral is the accent, not the primary CTA color — it shows up on eyebrows, active-link underlines, the chip-checked state, and the avatar notch.
- **Components** — shared primitives live in `src/components/` (`AppShell`, `PageHeader`, `Section`, `FieldRow`, `Input`/`Select`/`ReadOnlyValue`, `Chip`, `Avatar`, `ProfileCard`). Always compose new pages from these rather than re-styling raw HTML.
- **Chip filters are JS-less.** Each chip is a `<label>` wrapping a hidden checkbox plus a styled `<span>` that toggles via `peer-checked:`. This lets the directory's GET-form filter UI survive without client JS. Use `<Chip>` for any multi-select control.
- **No `dark:` variants** anywhere. If we add dark mode later, do it via a class-toggled theme, not OS preference.

## Bootstrap checklist (fresh Supabase project)

1. Apply project-level settings per `## Supabase project setup` (Data API on, auto-expose off, auto-RLS on).
2. Copy `.env.example` → `.env.local`; fill from Project Settings → API.
3. Apply `supabase/migrations/*.sql` in filename order — `supabase db push` if the CLI is linked, otherwise paste them into Dashboard → SQL Editor one by one.
4. **Enable the Auth Hook in the Dashboard**: Authentication → Hooks → "Before User Created" → Postgres function → schema `public`, function `before_user_created_check_mit_domain`. Save. *This hook is the **sole** email-domain gate (there is no app-side fallback by design — see Security postures). If it isn't enabled here, ANY email can sign up. After enabling, run `supabase/health-check.sql` and confirm query 3 returns an `{"error":...}` object (NOT `{}` — `{}` means the gate is open).*
5. Authentication → URL Configuration: set Site URL and add `/auth/confirm` to Additional Redirect URLs for every environment (localhost, Vercel preview, Vercel prod).
6. Authentication → Sign In/Up: confirm "Confirm email" is on (default).
7. Authentication → SMTP Settings: enable Custom SMTP with Resend (`smtp.resend.com:465`, user `resend`, password = a Resend API key). Without this you're capped at Supabase's 30 emails/hr and signups will rate-limit fast. **Then, in the Resend dashboard, turn OFF Click Tracking *and* Open Tracking for the sending domain** — otherwise Resend rewrites/consumes the single-use magic link and every signup fails with "Email link is invalid or has expired." See the CRITICAL Resend gotcha under `## Supabase project setup`.
8. **CRITICAL — make BOTH the "Magic Link" AND "Confirm signup" email templates code-only.** Authentication → Email Templates. `signInWithOtp` sends **Confirm signup** to brand-new users (Confirm email is on) and **Magic Link** to returning users — so *both* bodies MUST render the 6-digit code `{{ .Token }}` and contain **NO** `{{ .ConfirmationURL }}` / no clickable link. If either still has a link, MIT Microsoft 365 Safe Links pre-fetches it and burns the shared OTP, so the typed code *also* fails. (The separate **Change Email Address** template stays a link → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/`, used only by the alumni transition.) Verify by signing up with a fresh address **and** signing in with an existing one: both emails must contain digits and no URL.
9. **CRITICAL — set "Secure email change" OFF.** Authentication → Sign In / Providers → Email → uncheck **Secure email change**. With it ON, `updateUser({ email })` also sends a confirmation to the *old* (MIT) address — which Safe Links eats — and the change requires *both* confirmations, so the alumni auto-transition would silently never complete for anyone. OFF = only the new (personal) address must confirm. Tradeoff (no old-address confirmation) is documented in the Alumni email transition invariant + security postures; do not flip it back ON.

## Deploying to Vercel

Run through this once when wiring the GitHub repo to a Vercel project, then revisit when adding new environments (preview branches, staging, etc.).

1. **Local sanity** — `npm run build` succeeds locally. If it doesn't, Vercel won't either, and the failure mode there is slower to debug.
2. **Push to GitHub**, then in Vercel: New Project → import the repo. Framework auto-detects as Next.js; no extra build config needed.
3. **Environment variables** (Vercel → Project Settings → Environment Variables). Set per-environment as noted:
   - `NEXT_PUBLIC_SUPABASE_URL` — same value in **all three** environments (Production / Preview / Development).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same value in all three.
   - `NEXT_PUBLIC_SITE_URL` — **must differ per env** because it's the base for email-confirmation redirects:
     - Production: `https://<your-domain>` (no trailing slash)
     - Preview: leave unset and add a tiny shim that reads `process.env.VERCEL_URL` at runtime, OR just set the canonical preview URL and accept that branch previews will redirect to the canonical one
     - Development: `http://localhost:3000` (same as `.env.local`)
   - Note: if the project was provisioned via the **Vercel Marketplace Supabase integration** (check Project Settings → Integrations), the two `NEXT_PUBLIC_SUPABASE_*` vars are injected automatically — you only need to set `NEXT_PUBLIC_SITE_URL` manually.
4. **Update Supabase Authentication → URL Configuration** to know about the production domain:
   - **Site URL**: the production Vercel URL (e.g. `https://classof26.vercel.app`)
   - **Additional Redirect URLs**: add `https://<prod-domain>/auth/confirm`. To also support preview branches, add a wildcard pattern like `https://*-<vercel-team-slug>.vercel.app/auth/confirm` (Supabase supports `*` in redirect entries). Keep `http://localhost:3000/auth/confirm` in the list for local dev.
   - Without this, the confirmation email link returns "URL not allowed" and signups deadlock at the check-your-email screen.
5. **Migrations** apply to the same Supabase project the deployed app points at — there's no separate prod DB to migrate. If you ever clone for a staging environment, repeat the entire Bootstrap checklist on the new Supabase project.
6. **First deploy** — push to `main`. Vercel builds, deploys, gives a URL. Sign up with a fresh `@mit.edu`, enter the 6-digit code, walk through `/profile` → `/directory` → `/map` → `/stats`. If the code email never arrives, check Resend logs + Authentication → Rate Limits; if the code is rejected as "invalid or expired", the Magic Link template still contains a link (Bootstrap step 8) and Safe Links is burning the OTP.
7. **(Optional) Custom domain** — Project Settings → Domains → add. After it's verified, update the `NEXT_PUBLIC_SITE_URL` Production env var AND the Supabase Site URL to the custom domain. Trigger a redeploy to pick up the new env var.
8. **Email templates (NOT optional — mirror Bootstrap step 8).** **Both** "Magic Link" (returning users) **and** "Confirm signup" (brand-new users) templates = **code only** (`{{ .Token }}`, no URL); a link in *either* is silently consumed by MIT Safe Links and breaks that flow (Magic Link → sign-in; Confirm signup → first-ever signup). "Change Email Address" template = link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/` (deliberate, rarely-used, to a usually-personal inbox; `/auth/confirm` handles it).

## Next.js 16 quirks

These will bite if you write from training-data memory of v14/v15:

- **Middleware is now Proxy.** The file is `src/proxy.ts`, the exported function is `proxy` (not `middleware`). Behavior is unchanged; the rename is purely cosmetic. Authoritative reference: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **`cookies()` is async.** Always `const cookieStore = await cookies()`. The Supabase server client wrapper handles this for you; if you call `cookies()` directly anywhere else, don't forget the await.
- **Server Components can't write cookies.** The server-client `setAll` swallows write errors deliberately — session refresh happens in the proxy. Don't "fix" that try/catch.
- **`@supabase/ssr` uses `getAll`/`setAll`.** The older `get`/`set`/`remove` shape is deprecated and causes silent auth bugs. Don't switch back to it.
- **`NextResponse.next({ request })` no longer works.** In v16 the options shape narrowed: it's `NextResponse.next({ request: { headers: request.headers } })`. The `{ request }` form (still shown in Supabase's official Next.js guide as of writing) silently swallows the request and returns it as a 404 — no error in the log, just a bad route. We use the v16 form in `src/lib/supabase/proxy.ts`; do the same anywhere else you call `NextResponse.next()` with forwarded request state.
- Other things may also differ. When in doubt, read `node_modules/next/dist/docs/` before reaching for memory.

## Commands

```bash
npm run dev      # next dev (Turbopack by default in v16)
npm run build    # next build
npm run start    # next start (production server)
npm run lint     # eslint
npx tsc --noEmit # typecheck without emitting
```

For schema migrations, the Supabase CLI is the canonical tool: `supabase link --project-ref <ref>` once, then `supabase db push` to apply anything new under `supabase/migrations/`. Pasting SQL into the Dashboard editor also works but loses the migration history.
