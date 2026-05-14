# Design Overhaul — "Sharper, Documented" Aesthetic

## Context

The current UI uses Tailwind defaults (Stone neutrals + warm coral `brand-*`) with no consistent visual identity. The user's feedback: "ugly, layouts a little broken." Cards are flat rectangles, the directory's filter form is dense and unstyled, the profile form has no visual hierarchy, and there is no persistent app shell — every page redoes its own header.

After brainstorming (three design directions × three page layouts), the chosen direction is:

- **Card style — Sharper, documented**: Inter-style sans for body and headings, JetBrains Mono for labels, eyebrows, system text, and pills; rounded-square avatars (6px corners) with a small coral notch on the bottom-right corner; hairline borders rather than shadows; ink-near-black primary buttons.
- **Page layout — Top nav + side-rail filters**: a persistent header bar across every signed-in page (logo + section links + user avatar). On the directory, filters live in a sticky narrow rail at the left so they stay visible while scanning results.
- **Profile form — Numbered sections**: each section has a mono uppercase label and a `section NN` counter; field labels run down a fixed left column in mono uppercase; field inputs occupy the rest of the row.

This is a visual / structural overhaul. No data model, no route, and no feature changes. Same flows, same content, better surface.

## Design tokens

Add custom warm tokens alongside the existing `brand-*` palette in `src/app/globals.css`. Keep them as `--color-*` so Tailwind v4's `@theme` picks them up as utilities (`bg-cream`, `text-ink`, `border-line`, etc.).

```
--color-cream:    #fbf6ed   /* page background */
--color-paper:    #fffdf8   /* card / surface background */
--color-ink:      #1f1814   /* primary text, ink primary button */
--color-ink-2:    #5b4f44   /* secondary text */
--color-ink-3:    #8a7b6b   /* tertiary text, mono captions */
--color-line:     #e8ddc8   /* primary hairline */
--color-line-2:   #d8c9ad   /* deeper hairline (section separators) */

/* brand-* coral palette stays as defined */
```

**Typography.** Geist Sans (already loaded in `layout.tsx`) for body and headings. Add **JetBrains Mono** via `next/font/google`; expose as `--font-mono`. Mono is used for:

- eyebrows above headings (`Class of 2026 · Atlantic`)
- field labels in forms (`MIT EMAIL`, `COMPANY`)
- section labels (`SECTION 01`)
- chip/pill text (`tech`, `consulting` — lowercase)
- the brand "logo" (`SLOAN'26`)
- numeric counts and metadata (`24 people`, `01 / 24`)

**Type sizes (Tailwind utilities):** page H1 `text-2xl font-semibold tracking-tight`; section/card heading `text-base font-semibold tracking-tight`; body `text-sm`; mono labels `text-[0.6rem] tracking-[0.15em] uppercase`; mono counts/eyebrows `text-xs tracking-wider`.

**Radii.** Cards 6px (`rounded-md`), avatar squares 6px, pills 3–4px, buttons 5px. No `rounded-xl`/`rounded-full` except on the (future) sign-out icon and possibly soft elements. Match the documented feel.

**Borders, not shadows.** All elevated surfaces use `border border-line` on a paper background. No `shadow-*` utilities. (Exception: maybe the top-nav has a subtle 1px bottom border to anchor it.)

## Components

A small set of shared primitives. New files under `src/components/`:

- **`app-shell.tsx`** — wraps every signed-in page. Renders top nav (logo + section links with coral active-underline + user avatar + sign-out form) and a content container (max-width 4xl, page padding). Active section determined from `usePathname()`. Server Component; sign-out is a form posting to the existing Server Action.
- **`page-header.tsx`** — eyebrow (mono) + h1 + optional sub paragraph + optional right-aligned mono count.
- **`section.tsx`** — wraps content in a `paper` panel with a header containing a mono section label on the left and a mono section counter on the right ("section 01"). Children render below a dashed hairline.
- **`field-row.tsx`** — used inside `Section`. Two-column layout: left is a mono uppercase label (fixed ~130px wide), right is the input slot. Adjacent rows separated by a thin solid line.
- **`form-controls.tsx`** — `<Input>`, `<Select>`, `<ReadOnlyValue>`, `<ChipGroup>` styled to the new system. The chip group renders the same chip primitive used in the directory filters, so toggling industries on the profile form and filtering by them on the directory look identical.
- **`avatar.tsx`** — square-rounded (6px) avatar. Background `ink`, text `cream`, font weight 600. Bottom-right has a small coral square notch (`::after`). Accepts `name` (computes initial) and an optional `photoUrl` (future). Three sizes via prop: `sm` (32px), `md` (40px), `lg` (56px).
- **`profile-card.tsx`** — used by the directory results. Grid: avatar in a 38px column, content in the rest. Top row: mono eyebrow (cohort) + optional LinkedIn link. Then h4 name, sub line for title-at-company, an em-dash–prefixed "where" line for city, and a row of mono chips for industries.

Each component is small and focused (~30–60 LOC). They compose; they don't take "variant" props beyond minimal sizing.

## Page-level layouts

**Home (signed-in)** — `src/app/page.tsx`

`<AppShell active="home">`. PageHeader: eyebrow "Welcome back, Jane", h1 "Class of 2026 · Atlantic", sub line "24 classmates, 11 cities, 8 industries represented" (compute counts at request time via cheap Supabase aggregates). Below: a single "stats strip" — four key/value tiles in a row inside one paper panel, hairline-separated (`people`, `cities`, `industries`, `your profile X%`). Then a 2×2 grid of numbered nav tiles (`Your profile`, `Directory`, `Map`, `Stats`); Map and Stats remain `Soon` (disabled visual).

**Home (signed-out)** — same file, alternate branch. Marketing-style: brand eyebrow, large display h1 ("Stay in touch with your class."), sub paragraph, ink-primary "Sign in" + outline "Sign up" buttons. No top nav.

**Directory** — `src/app/directory/page.tsx`

`<AppShell active="directory">`. PageHeader + count on the right. Below, a `grid grid-cols-[220px_1fr] gap-6`:

- **Left rail (sticky)** — paper panel with grouped filter sections (Search, City, Ocean, Industries). Each group has a mono label. Industries are vertical-stacked chips that toggle on click (still a plain GET form — chip "click" toggles a hidden checkbox via labelled wrapping; no JS needed). Bottom of the rail has the dark ink "Apply" button and a "clear" text link.
- **Right column** — list of `<ProfileCard>` items, vertical stack with thin separators. Empty state and error state inherit the same paper-panel look.

**Profile** — `src/app/profile/page.tsx`

`<AppShell active="profile">`. PageHeader uses the user's name as h1 ("Jane Doe") with eyebrow "Your profile" and a sub line about visibility. Three numbered `<Section>` panels:

1. **Identity** — MIT email (read-only mono value), Display name, Personal email.
2. **Work** — Company, Title, Industries (ChipGroup, same component as directory filters).
3. **Place** — City, Ocean, LinkedIn.

Saved / error banners render above section 01 inside the same paper-with-hairline style (mint for success, red for error — both desaturated to match the warm palette). Save button is the ink primary, right-aligned beneath the last section.

**Sign-in / Sign-up** — `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`

Centered narrow column (max-w-md), no app shell. Brand eyebrow + h1 + sub. Form uses `<FieldRow>` primitives so the mono label + input alignment matches the profile edit page (familiar). Ink-primary submit button. Error banner in the warm-desaturated red panel.

## Files affected

**New:**
- `src/components/app-shell.tsx`
- `src/components/page-header.tsx`
- `src/components/section.tsx`
- `src/components/field-row.tsx`
- `src/components/form-controls.tsx`
- `src/components/chip-group.tsx` (or co-located in form-controls.tsx)
- `src/components/avatar.tsx`
- `src/components/profile-card.tsx`

**Modified:**
- `src/app/globals.css` — add cream/paper/ink/line tokens
- `src/app/layout.tsx` — load JetBrains Mono via `next/font/google`, expose `--font-mono`; keep Geist
- `src/app/page.tsx` — rewrite to use AppShell + PageHeader + nav tiles + stats strip
- `src/app/sign-in/page.tsx` — rewrite using FieldRow + ink button
- `src/app/sign-up/page.tsx` — same
- `src/app/profile/page.tsx` — rewrite using Section + FieldRow + ChipGroup
- `src/app/directory/page.tsx` — rewrite using AppShell + side-rail layout + ProfileCard
- `CLAUDE.md` Design tokens section — update palette, typography, spacing rules to match the new system

**Unchanged (verified):** all auth Server Actions, Supabase clients, proxy, migrations, profile data model, query patterns. This is purely a presentation-layer overhaul.

## Verification

After implementation:

1. `npx tsc --noEmit` and `npm run lint` clean.
2. Dev server boots; visit each page in browser:
   - `/` logged out — marketing layout, ink + outline buttons
   - `/sign-in`, `/sign-up` — new form primitives, no app shell
   - `/` logged in — app shell, stats strip, 2×2 nav grid
   - `/profile` — numbered sections, mono labels, chip industries, save banner after submit
   - `/directory` — side rail filters, profile cards with coral-notch avatars, GET-form filtering still works (URL params survive refresh, back/forward works)
3. Compare against mockups in `.superpowers/brainstorm/35154-*/content/`.
4. Mobile sanity check at 375px width: side rail collapses to top-stacked, top nav becomes condensed.

## Out of scope (intentional)

- Profile photo upload (still deferred — `<Avatar>` accepts a future `photoUrl` prop, but the bucket + signed-URL plumbing is a separate effort).
- Map and Stats pages (still `Soon` on the home nav grid).
- Dark mode (light-mode only, as before).
- Client-side filter UI for the directory (we keep the JS-less GET form; chips are styled `<label>`-wrapped checkboxes).
