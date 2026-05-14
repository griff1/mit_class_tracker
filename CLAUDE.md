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

- **`@mit.edu`-only auth.** Signup/login is restricted to `@mit.edu` addresses (not `@sloan.mit.edu`, not aliases). Enforce server-side via a Supabase Auth Hook (`before_user_created`) so a malicious client can't bypass it. Use the email-confirmation flow so we verify both domain *and* ownership. The MIT email is the user's auth identity and is immutable from the user's perspective — to change it they'd have to re-register. Users can additionally set a separate optional `personal_email` (any domain) for post-grad contact; that field is profile data only and is **not** used for auth.
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
| `industries` | `text[]`, multi-select from a curated list (`INDUSTRIES` in `lib/types.ts`); GIN-indexed for `&&`/`@>` filters |
| `city` | user-typed string; aggregated for the map (no addresses stored) |
| `linkedin_url` | LinkedIn profile URL |
| `profile_photo_url` | Supabase Storage path/signed URL |
| `ocean` | Sloan cohort (see glossary) |

RLS shape (see `supabase/migrations/20260513180000_init.sql`):
- `select`: any authenticated user (the directory is intra-class-visible)
- `update`: only on rows where `id = auth.uid()`
- `insert`: no policy — rows are created exclusively by the `on_auth_user_confirmed` trigger, which fires only when `auth.users.email_confirmed_at` transitions from NULL to non-NULL. **Unconfirmed signups never become rows in `profiles`** — that's the safety net against `fake@mit.edu`-style accounts polluting the directory.
- `delete`: no policy — deletion happens via cascade when an `auth.users` row is removed

Profile photos live in a Supabase Storage bucket with public-read **disabled** — serve via signed URLs or an RLS-gated bucket so photos can't be enumerated without a session.

## Supabase project setup

These project-level dashboard settings are already applied:

- **Data API**: on (required for `@supabase/ssr`)
- **Automatically expose new tables**: **off** — no privileges granted to Data API roles by default
- **Enable automatic RLS**: **on** — event trigger turns on RLS for every new table in `public`

**Operational consequence:** a freshly created table is unreachable from the API until you do two things deliberately:

1. `GRANT SELECT/INSERT/UPDATE/DELETE ... ON <table> TO authenticated` (and `anon` only if you genuinely want anonymous access — for profile data, never).
2. Write at least one `CREATE POLICY` for each operation you want allowed.

If a query returns empty or an insert silently fails at the API layer, start here.

## Glossary

- **Ocean** — at MIT Sloan, first-year MBA students are divided into cohorts named after oceans (Atlantic, Pacific, etc.). This is the user's cohort, not a typo. Preserve the term in UI and schema.

## Features

1. **Auth** — Supabase email auth + MIT-domain check + email confirmation required.
2. **Profile** — view-and-edit screen covering every field above. Photo upload to Supabase Storage.
3. **Map** — markers aggregated by `city`, one per city, count-labeled. `react-leaflet` with free tiles is a fine default; reach for Mapbox only if styling needs it.
4. **Directory** — filterable/searchable table. Filters at minimum: industry, title/job type, city.
5. **Stats** — top cities, top industries, breakdowns by ocean, etc.

## Layout

- `src/app/page.tsx` — auth-aware home (logged-out → marketing/CTAs; logged-in → nav cards to feature areas + sign-out)
- `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` — auth forms posting to Server Actions
- `src/app/profile/page.tsx` — view-and-edit your own profile (auth-gated, redirects to sign-in); industries are checkboxes (multi)
- `src/app/profile/actions.ts` — `updateProfile` Server Action; sanitizes inputs and allow-lists `industries`/`ocean` against the curated lists in `lib/types.ts` (server-side, can't be bypassed by editing the form)
- `src/app/directory/page.tsx` — auth-gated class directory. Filters live in URL search params (bookmarkable); name search is `ilike`, industries use Postgres array overlap, ocean is `eq`, city is `ilike`. Plain GET form so back/forward and JS-disabled both work.
- `src/app/auth/actions.ts` — `signIn` / `signUp` / `signOut` Server Actions; sign-up applies the `@mit.edu` check before calling Supabase
- `src/app/auth/confirm/route.ts` — Route Handler that exchanges the email-confirmation token for a session. Handles BOTH the PKCE `?code=` flow (default Supabase template) and the `?token_hash=&type=` flow (custom template). Either works.
- `src/lib/supabase/client.ts` — browser Supabase client for Client Components
- `src/lib/supabase/server.ts` — server Supabase client (Server Components / Route Handlers / Server Actions); awaits `cookies()`
- `src/lib/supabase/proxy.ts` — `updateSession` helper that refreshes auth cookies on every request
- `src/lib/types.ts` — `Profile` row shape + curated `INDUSTRIES` / `OCEANS` lists used by both the form and the server-side allow-list check
- `src/proxy.ts` — Next.js 16 Proxy entry (was `middleware.ts` in v15 and earlier); delegates to `updateSession`
- `supabase/migrations/*.sql` — versioned schema and Auth Hook function. Apply via `supabase db push`, or paste into Dashboard → SQL Editor in filename order.
- `.env.example` — template for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Copy to `.env.local`.

## Design tokens

Light-mode only. Cool zinc and pure black/white are deliberately avoided in favor of warmer tones.

- **Neutrals**: Tailwind's `stone` palette (`bg-stone-50` page, `bg-white` cards, `text-stone-900` headings, `text-stone-600` body, `border-stone-200`). Don't use `zinc` or `gray` — they read cool against the brand color.
- **Brand**: custom `--color-brand-{50..900}` palette (warm coral, MIT-adjacent cardinal), defined in `src/app/globals.css` via Tailwind v4's `@theme` block. Primary CTAs are `bg-brand-500` → `hover:bg-brand-600`; accent links/eyebrows are `text-brand-700`; soft tinted backgrounds are `bg-brand-50`.
- **Status**: `border-red-200 bg-red-50 text-red-800` for errors; `border-emerald-200 bg-emerald-50 text-emerald-800` for success.
- **No `dark:` variants** anywhere. If we add dark mode later, do it via a class-toggled theme, not OS preference — the warm palette doesn't translate to a dark surface trivially.

## Bootstrap checklist (fresh Supabase project)

1. Apply project-level settings per `## Supabase project setup` (Data API on, auto-expose off, auto-RLS on).
2. Copy `.env.example` → `.env.local`; fill from Project Settings → API.
3. Apply `supabase/migrations/*.sql` in filename order — `supabase db push` if the CLI is linked, otherwise paste them into Dashboard → SQL Editor one by one.
4. **Enable the Auth Hook in the Dashboard**: Authentication → Hooks → "Before User Created" → Postgres function → schema `public`, function `before_user_created_check_mit_domain`. Save. *Without this toggle the function exists but is never invoked; the Server Action's `endsWith("@mit.edu")` check is the only domain enforcement, and an attacker calling Supabase's REST signup directly would bypass it.*
5. Authentication → URL Configuration: set Site URL and add `/auth/confirm` to Additional Redirect URLs for every environment (localhost, Vercel preview, Vercel prod).
6. Authentication → Sign In/Up: confirm "Confirm email" is on (default).

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
