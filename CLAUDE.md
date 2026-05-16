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

- **Magic-link auth, `@mit.edu` / `@alum.mit.edu` gate on signup only.** No passwords. The single `requestMagicLink` Server Action calls `supabase.auth.signInWithOtp({ email })` with `shouldCreateUser: true` (the default), which means the same form handles both new signups and returning sign-ins. The `before_user_created` Supabase Auth Hook rejects addresses that don't end in `@mit.edu` or `@alum.mit.edu` on *initial signup* — it fires inside the auth.users INSERT, before the magic link is sent. (Both domains accepted because alumni who've already migrated to their `@alum.mit.edu` lifetime address still need to be able to sign up.) The hook does **not** fire on email change (see the alumni transition flow below), which is intentional. **Scope note:** there is no Sloan-specific email domain, so MIT-domain membership is the finest granularity we can enforce technically. Any active MIT email (alum, faculty, current students, other classes) can register. If finer scope ever becomes a requirement, the right shape is an invite-list table that the Auth Hook checks against.
- **Alumni email transition.** Users will eventually lose access to their MIT mailbox. The `transitionAuthEmail` Server Action on `/profile` calls `supabase.auth.updateUser({ email: profile.personal_email })`. Supabase emails a confirmation link to the new (personal) address; once clicked, `auth.users.email` updates and the user signs in via that address going forward. **`profile.mit_email` is never touched** — it remains the historical identity shown in the directory. The transition is **restricted to the user's already-saved `personal_email`** (server-side check), so a brief account takeover can't pivot the auth identity to a fresh attacker-controlled address.
- **Edge case worth knowing:** after a user transitions away from their MIT email, that address becomes "owned" by their profile row via the `mit_email` UNIQUE constraint. If someone else tries to register the same address later, the `handle_new_user` trigger's INSERT into `profiles` will fail with a UNIQUE violation, blocking the new signup. The magic-link email still gets dispatched (the trigger fires after confirmation, not before), but the new account never finishes provisioning. Mild UX wart for the would-be new registrant; net effect: former MIT addresses are permanently squatted by the original profile.
- **All data sits behind auth, enforced at the database.** Every read of profile data flows through an authenticated session. Use Supabase **RLS** policies as the source of truth — never rely on client-side route gating alone. This is the easiest invariant to silently break.
- **City-level location only.** We store the user-typed city string and aggregate on it. We do **not** collect street addresses or geolocate users. The map shows one marker per city, sized/labeled by count (e.g. "NYC — 12").
- **Self-service profile editing.** Any user can update their own row at any time. There is no admin-edit path.

## Data model (intended)

A single `profiles` table keyed by `auth.users.id`:

| field | notes |
|---|---|
| `name` | display name |
| `mit_email` | the auth identity; populated from `auth.users.email` on signup; `@mit.edu`-only |
| `personal_email` | optional secondary contact, any domain, user-editable, **not** used for auth |
| `company`, `title` | professional info |
| `industries` | `text[]`, multi-select. Seed in `INDUSTRIES` (`lib/types.ts`); same add-new + `resolveCanonical` dedup pattern as cities/activities/roles. GIN-indexed. |
| `roles` | `text[]`, multi-select of functional roles ("Product Manager", "Software Engineer", etc.). Seed in `ROLES`. Add-new + canonical dedup. GIN-indexed. Shown on profile cards as coral-tinted chips, distinct from the line-bordered industry chips. |
| `cities` | `text[]`, multi-select with **canonical case-insensitive dedup** at write time (see `resolveCanonical` in `src/app/profile/actions.ts`). Seeded with `CITIES` in `lib/types.ts`; members can add new entries which then appear as chips for everyone in the cohort. GIN-indexed. The map aggregates on this. |
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
- **Custom SMTP via Resend**: on (Authentication → SMTP Settings). All auth email (magic links, email-change confirmations) goes through Resend, **not** Supabase's built-in sender. This means Supabase's default 30-emails/hour project cap does **not** apply — the binding limit is Resend's plan (free tier: 100/day, 3000/mo). If you ever see "Email rate limit exceeded" again, check the per-address limit in Authentication → Rate Limits *and* the Resend dashboard logs, not the Supabase default. The Resend API key is stored in Supabase's SMTP config (dashboard only) — it is not in the repo or env files.

**Operational consequence:** a freshly created table is unreachable from the API until you do two things deliberately:

1. `GRANT SELECT/INSERT/UPDATE/DELETE ... ON <table> TO authenticated` (and `anon` only if you genuinely want anonymous access — for profile data, never).
2. Write at least one `CREATE POLICY` for each operation you want allowed.

If a query returns empty or an insert silently fails at the API layer, start here.

## Security postures

These were locked in after a pre-public-deploy review. Don't regress them silently:

- **Email domain gate is enforced by the `before_user_created` Auth Hook** (DB-side, fires on every new auth.users INSERT regardless of how the signup was initiated — magic link, password, REST API). The hook returns `{decision: "reject", message: ...}` for non-`@mit.edu` addresses; Supabase surfaces that message to the client. There is no longer an app-side `endsWith("@mit.edu")` check — the magic-link Server Action delegates entirely to the hook. **Pre-deploy verification:** run `supabase/health-check.sql` against the project (Dashboard SQL Editor or `psql`) — it asserts the function exists, has the right grants, and rejects/accepts as expected. The dashboard toggle (Authentication → Hooks) isn't queryable from SQL, so still spot-check that visually.
- **`personal_email` is server-validated** by `safeEmail` in `src/lib/url-safety.ts` — basic `localpart@domain.tld` format. Malformed input becomes `null` on save.
- **Profile rows only exist for confirmed users.** The `on_auth_user_confirmed` trigger fires only on `email_confirmed_at` NULL→non-NULL.
- **`/auth/confirm` `next` redirect is restricted to same-origin paths.** `safeNext` in the route handler rejects anything that doesn't start with `/`, plus protocol-relative `//`. Without this, `new URL(next, request.url)` silently drops the base when `next` is absolute — an open-redirect hole.
- **User-supplied URLs go through `safeHttpUrl` / `safeLinkedInUrl` in `src/lib/url-safety.ts`** before being saved AND before being rendered as `href`. `safeLinkedInUrl` also constrains the host to `linkedin.com` or a subdomain to block `evilinkedin.com`-style look-alikes. Defense in depth: even if a legacy bad row exists in the DB, the render-time guard prevents `javascript:` execution.
- **Profile-photo bucket has DB-level constraints**: 5MB file size + image-only MIME types (jpeg / png / webp / gif). The Server Action also validates, but the bucket constraint catches direct-`supabase-js` uploads that skip our action.
- **Storage RLS only allows writes to your own `<user_id>/` folder** via `(storage.foldername(name))[1] = auth.uid()::text`. Reads are intra-cohort visible (authenticated only).
- **Security headers in `next.config.ts`**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=() microphone=() geolocation=()`. Apply to every route via `source: "/(.*)"`. A strict CSP is deliberately not set yet — it'd need to allow leaflet tiles + Supabase signed URLs, which is its own audit.
- **All Supabase queries are parameterized** (no string interpolation in code). Don't introduce raw SQL via the client.
- **The service-role key is never present in the codebase or env.** All server-side operations use the anon-key client with the user's session cookies, so RLS still applies.

## Glossary

- **Ocean** — at MIT Sloan, first-year MBA students are divided into cohorts named after oceans (Atlantic, Pacific, etc.). This is the user's cohort, not a typo. Preserve the term in UI and schema.

## Features

1. **Auth** — Supabase email auth + MIT-domain check + email confirmation required.
2. **Profile** — view-and-edit screen covering every field above. Photo upload to Supabase Storage.
3. **Map** — embedded on the signed-in home page (not a separate route). Markers aggregated by `cities`, one per city, count-labeled. Uses `react-leaflet` with OpenStreetMap tiles.
4. **Directory** — filterable/searchable table. Filters: industries, cities, ocean, name search.
5. **Stats** — top cities, top industries, breakdowns by ocean, etc.

## Layout

- `src/app/page.tsx` — auth-aware home. Logged-out: marketing CTA. Logged-in: PageHeader + stats strip + **embedded class map** (was a separate `/map` route until we collapsed it) + nav tiles to Profile / Directory / Stats. `/map` redirects to `/` via `next.config.ts`.
- `src/app/sign-in/page.tsx` — single magic-link form (handles both new signups and returning sign-ins). `/sign-up` redirects here via `next.config.ts`.
- `src/app/profile/page.tsx` — view-and-edit your own profile (auth-gated, redirects to sign-in). Four numbered sections: Identity / Work / Place (cities, ocean, LinkedIn) / Sloan (activities).
- `src/app/profile/actions.ts` — `updateProfile` Server Action. `ocean` is allow-listed (no add-new). `industries`, `roles`, `cities`, `activities` all go through `resolveCanonical` — server-side case-insensitive dedup against the cohort's existing values plus the seed list, so user write-ins canonicalize to existing entries instead of duplicating. Also handles the optional `profile_photo` File entry: validates size (≤5MB) + MIME (jpeg/png/webp/gif), upserts to `profile-photos/<user_id>/avatar`, stores the path on the row.
- `src/app/directory/page.tsx` — auth-gated class directory. Filters in URL search params (bookmarkable): name (`ilike`), ocean (`eq`), and `industries` / `roles` / `cities` / `activities` (Postgres array `overlaps`). Plain GET form so back/forward and JS-disabled both work. The four array-filter groups are collapsible via `<details>` — they default to closed and auto-open when the URL has active selections so the user sees what's applied.
- `src/app/stats/page.tsx` — auth-gated stats grid: top 10 cities / top 10 industries / top 10 roles / top 10 activities / oceans (full ordered list including zeros). JS-side aggregation from one Supabase query; thin coral bars rendered with plain CSS (no chart library). (Map aggregation now lives in `page.tsx` — same pattern.)
- `src/components/class-map.tsx` — **Client Component** (`"use client"`) wrapping `react-leaflet`. Renders a `MapContainer` with OpenStreetMap tiles and a custom `divIcon` per city (coral circle sized by count, popup on click). Imports `leaflet/dist/leaflet.css` at the module level. **Don't add `dynamic({ ssr: false })` around this from a Server Component** — Next 16 rejects that combination. Direct import works because the `"use client"` boundary already excludes the module from server execution.
- `src/lib/cities-geo.ts` — lat/lng lookup keyed by lowercased city name. Only the seed `CITIES` are populated; user-added cities won't appear on the map unless their coordinates are added here.
- `src/components/editable-chip-group.tsx` — pairs a `Chip` multi-select with a "add new" `Input` for the same field. Used for cities and activities on the profile page.
- `src/app/auth/actions.ts` — `requestMagicLink` (handles signup + sign-in via `signInWithOtp`) and `signOut` Server Actions. No password actions — passwordless by design.
- `src/app/profile/actions.ts` (`transitionAuthEmail`) — separate Server Action for the alumni email transition. See the architecture invariant above.
- `src/app/auth/confirm/route.ts` — Route Handler that exchanges the email-confirmation token for a session. Handles BOTH the PKCE `?code=` flow (default Supabase template) and the `?token_hash=&type=` flow (custom template). Either works.
- `src/lib/supabase/client.ts` — browser Supabase client for Client Components
- `src/lib/supabase/server.ts` — server Supabase client (Server Components / Route Handlers / Server Actions); awaits `cookies()`
- `src/lib/supabase/proxy.ts` — `updateSession` helper that refreshes auth cookies on every request
- `src/lib/types.ts` — `Profile` row shape + seed lists for `INDUSTRIES`, `ROLES`, `OCEANS`, `CITIES`, `ACTIVITIES`. **`OCEANS` is the only strict allow-list** (the cohort name is a fixed set the user can't extend). The other four are seeds — write-ins allowed, canonicalized server-side.
- `src/lib/viewer.ts` — `getViewer(supabase, user)` loads the data the AppShell top nav needs (name, ocean, signed photo URL) for the current user. One profile-row query + one optional Storage signed-URL call. Every authed page calls this and hands the result to `<AppShell user={viewer}>`.
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
4. **Enable the Auth Hook in the Dashboard**: Authentication → Hooks → "Before User Created" → Postgres function → schema `public`, function `before_user_created_check_mit_domain`. Save. *This is the **only** domain gate — there is no app-side `endsWith` check anymore. If the toggle is off, the function exists but is never invoked and any email can sign up. Verify with `supabase/health-check.sql` + an eyeball of the dashboard toggle.*
5. Authentication → URL Configuration: set Site URL and add `/auth/confirm` to Additional Redirect URLs for every environment (localhost, Vercel preview, Vercel prod).
6. Authentication → Sign In/Up: confirm "Confirm email" is on (default).
7. Authentication → SMTP Settings: enable Custom SMTP with Resend (`smtp.resend.com:465`, user `resend`, password = a Resend API key). Without this you're capped at Supabase's 30 emails/hr and signups will rate-limit fast.

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
6. **First deploy** — push to `main`. Vercel builds, deploys, gives a URL. Sign up with a fresh `@mit.edu`, confirm via email, walk through `/profile` → `/directory` → `/map` → `/stats`. If the confirmation email lands you on `/sign-in?error=...`, that's almost always step 4 (redirect URL not whitelisted).
7. **(Optional) Custom domain** — Project Settings → Domains → add. After it's verified, update the `NEXT_PUBLIC_SITE_URL` Production env var AND the Supabase Site URL to the custom domain. Trigger a redeploy to pick up the new env var.
8. **(Optional) Email template polish** — Supabase Dashboard → Authentication → Email Templates → "Confirm signup". Replace the default link with `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">` to skip the Supabase verify endpoint round-trip and avoid the brief Supabase URL flash in the browser. Our handler already supports both flows.

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
