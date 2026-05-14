# Design System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the visual system across every page to the "Sharper, documented" aesthetic with a persistent top-nav app shell and side-rail directory filters.

**Architecture:** Light-mode only. Custom warm tokens (`cream`, `paper`, `ink`, `line`) layered on top of the existing `brand-*` coral palette in Tailwind v4's `@theme`. Geist Sans (already loaded) + JetBrains Mono for labels/eyebrows. Seven new presentation components in `src/components/` that compose into the four signed-in pages plus sign-in/sign-up. No data-model, route, or feature changes.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript · `@supabase/ssr` (unchanged).

**Spec:** `docs/superpowers/specs/2026-05-14-design-system-overhaul-design.md`

**No automated tests added.** Project has no test framework set up; adding one is scope creep. Verification per task is: `npx tsc --noEmit` clean, `npm run lint` clean, and a `curl` of the affected page returning 200 with expected markers (or a redirect for auth-gated pages — meaning the page compiled). The user does final visual verification in browser.

---

## Pre-flight

- Dev server (PID 31134) is running on `localhost:3000` from prior sessions. It hot-reloads. **Do not start a second dev server** — Next.js refuses, and the symptom is silent (`run dev` exits with code 1 + a "already running" warning). If verification needs a fresh start, kill the existing PID first.

---

## File structure (target)

**New files:**

- `src/components/avatar.tsx` — square avatar with coral notch; `size`, `name`, optional `photoUrl`
- `src/components/chip.tsx` — visually-styled checkbox: hidden `<input>` + visible `<span>` wrapped in `<label>`, toggling via `peer-checked:`. Works without JS.
- `src/components/section.tsx` — paper-panel wrapper with mono label + mono counter header
- `src/components/field-row.tsx` — single label-on-left / input-on-right row, separator below
- `src/components/inputs.tsx` — `Input`, `Select`, `ReadOnlyValue` shared styled inputs
- `src/components/page-header.tsx` — eyebrow + h1 + sub + optional right-aligned count
- `src/components/app-shell.tsx` — top nav (logo + section links + user avatar + sign-out form) + content container. Internal `TopNav`.
- `src/components/profile-card.tsx` — directory result row (Avatar + name/work/where/chips/LinkedIn)

**Modified:**

- `src/app/globals.css` — add custom warm tokens to `@theme`
- `src/app/layout.tsx` — load `JetBrains_Mono` via `next/font/google`; expose `--font-mono`
- `src/app/page.tsx` — rewrite both signed-out and signed-in branches
- `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` — rewrite using new primitives
- `src/app/profile/page.tsx` — rewrite using `<Section>`, `<FieldRow>`, `<Chip>`
- `src/app/directory/page.tsx` — rewrite using `<AppShell>`, side-rail layout, `<ProfileCard>`
- `CLAUDE.md` — update Design tokens section

---

## Task 1: Add design tokens and load JetBrains Mono

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  /* Warm coral / MIT-adjacent cardinal — primary accent. */
  --color-brand-50: #fff3ee;
  --color-brand-100: #ffe2d4;
  --color-brand-200: #ffc1a4;
  --color-brand-300: #ff9a73;
  --color-brand-400: #f87253;
  --color-brand-500: #e85d45;
  --color-brand-600: #c8412c;
  --color-brand-700: #a23420;
  --color-brand-800: #7a2818;
  --color-brand-900: #5a1d11;

  /* Warm neutrals used in place of Tailwind's cool zinc/gray. */
  --color-cream:   #fbf6ed;
  --color-paper:   #fffdf8;
  --color-ink:     #1f1814;
  --color-ink-2:   #5b4f44;
  --color-ink-3:   #8a7b6b;
  --color-line:    #e8ddc8;
  --color-line-2:  #d8c9ad;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-jetbrains-mono);
}

html,
body {
  background: var(--color-cream);
  color: var(--color-ink);
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MIT Sloan Class of 2026",
  description: "Private class directory for MIT Sloan Class of 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
```

(We previously loaded `Geist_Mono`; switch to `JetBrains_Mono` — slightly heavier, more "engineered" feel that we'll use for labels.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output (both clean).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "design: add warm tokens (cream/paper/ink/line) and JetBrains Mono font"
```

---

## Task 2: Avatar component

**Files:**
- Create: `src/components/avatar.tsx`

- [ ] **Step 1: Create `src/components/avatar.tsx`**

```tsx
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; text: string; notch: string }> = {
  sm: { box: "h-8 w-8", text: "text-xs", notch: "h-2 w-2 -bottom-0.5 -right-0.5" },
  md: { box: "h-10 w-10", text: "text-sm", notch: "h-2.5 w-2.5 -bottom-0.5 -right-0.5" },
  lg: { box: "h-14 w-14", text: "text-lg", notch: "h-3 w-3 -bottom-1 -right-1" },
};

export function Avatar({
  name,
  size = "md",
  photoUrl,
}: {
  name: string;
  size?: Size;
  photoUrl?: string | null;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const s = SIZES[size];
  return (
    <div
      aria-hidden="true"
      className={`relative ${s.box} flex flex-none items-center justify-center rounded-md bg-ink ${s.text} font-semibold tracking-tight text-cream`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full rounded-md object-cover"
        />
      ) : (
        initial
      )}
      <span
        aria-hidden="true"
        className={`absolute ${s.notch} rounded-sm bg-brand-500`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/avatar.tsx
git commit -m "design: add Avatar component (rounded-square ink with coral notch)"
```

---

## Task 3: Chip component

**Files:**
- Create: `src/components/chip.tsx`

The chip is a `<label>` wrapping a hidden checkbox and a styled `<span>`. The `<span>` uses Tailwind's `peer-checked:` variants to flip styling based on the hidden checkbox. This is the trick that lets the directory filter form stay JS-less.

- [ ] **Step 1: Create `src/components/chip.tsx`**

```tsx
export function Chip({
  name,
  value,
  defaultChecked,
  label,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className="inline-block select-none rounded-sm border border-line px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-2 transition lowercase peer-hover:border-brand-300 peer-checked:border-brand-100 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-200"
      >
        {label ?? value}
      </span>
    </label>
  );
}
```

Notes for the executor:
- `sr-only` hides the checkbox visually but keeps it in the form. Submitting the form sends the value normally.
- `peer-checked:` styles the next sibling when the checkbox is checked; `peer-hover:` ditto on hover.
- `lowercase` is a Tailwind class — applies CSS `text-transform: lowercase`. We keep the underlying value as the canonical form (e.g. "Tech") and display lowercase ("tech") to match the documented aesthetic.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/chip.tsx
git commit -m "design: add Chip component (label-wrapped checkbox with peer-checked styling)"
```

---

## Task 4: Section component

**Files:**
- Create: `src/components/section.tsx`

- [ ] **Step 1: Create `src/components/section.tsx`**

```tsx
export function Section({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  const indexStr = index.toString().padStart(2, "0");
  return (
    <section className="rounded-md border border-line bg-paper">
      <header className="flex items-baseline justify-between border-b border-dashed border-line-2 px-5 py-3">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-brand-700">
          {label}
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.05em] text-ink-3">
          section {indexStr}
        </span>
      </header>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/section.tsx
git commit -m "design: add Section component (numbered, paper panel with hairline header)"
```

---

## Task 5: FieldRow + ReadOnlyValue

**Files:**
- Create: `src/components/field-row.tsx`

- [ ] **Step 1: Create `src/components/field-row.tsx`**

```tsx
export function FieldRow({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-4 border-t border-line py-3 first:border-t-0">
      <span className="pt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className="flex flex-col gap-1">
        {children}
        {help && <span className="text-xs text-ink-3">{help}</span>}
      </div>
    </div>
  );
}

export function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-2 font-mono text-sm text-ink-2">{children}</div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/field-row.tsx
git commit -m "design: add FieldRow + ReadOnlyValue (label-on-left rows with hairline separators)"
```

---

## Task 6: Styled inputs

**Files:**
- Create: `src/components/inputs.tsx`

- [ ] **Step 1: Create `src/components/inputs.tsx`**

```tsx
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded border border-line bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/inputs.tsx
git commit -m "design: add styled Input and Select primitives"
```

---

## Task 7: PageHeader component

**Files:**
- Create: `src/components/page-header.tsx`

- [ ] **Step 1: Create `src/components/page-header.tsx`**

```tsx
export function PageHeader({
  eyebrow,
  title,
  sub,
  count,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  count?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-line pb-5">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="text-sm text-ink-2">{sub}</p>}
      </div>
      {count && (
        <span className="font-mono text-xs tracking-wider text-ink-3">{count}</span>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/page-header.tsx
git commit -m "design: add PageHeader (eyebrow + h1 + sub + right-aligned mono count)"
```

---

## Task 8: AppShell with top nav

**Files:**
- Create: `src/components/app-shell.tsx`

The shell is a Server Component so it can read the current path and the authed user via Supabase. `Avatar` and `signOut` action already exist by the time this runs.

- [ ] **Step 1: Create `src/components/app-shell.tsx`**

```tsx
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";

type SectionKey = "home" | "directory" | "map" | "stats" | "profile";

const SECTIONS: { key: SectionKey; href: string; label: string; available: boolean }[] = [
  { key: "home", href: "/", label: "Home", available: true },
  { key: "directory", href: "/directory", label: "Directory", available: true },
  { key: "map", href: "#", label: "Map", available: false },
  { key: "stats", href: "#", label: "Stats", available: false },
  { key: "profile", href: "/profile", label: "Profile", available: true },
];

export function AppShell({
  active,
  user,
  children,
}: {
  active: SectionKey;
  user: { name: string | null; email: string };
  children: React.ReactNode;
}) {
  const displayName = user.name?.trim() || user.email;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <nav className="flex items-center justify-between rounded-md border border-line bg-paper px-4 py-2.5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand-700">
            Sloan&apos;26
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Directory</span>
        </Link>
        <ul className="flex items-center gap-5 text-sm">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            const baseClass = isActive
              ? "relative font-medium text-ink after:absolute after:-bottom-3 after:left-0 after:right-0 after:h-0.5 after:bg-brand-500"
              : "text-ink-2 hover:text-ink";
            return (
              <li key={s.key}>
                {s.available ? (
                  <Link href={s.href} className={baseClass}>
                    {s.label}
                  </Link>
                ) : (
                  <span className="text-ink-3" title="Coming soon">
                    {s.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <form action={signOut} className="flex items-center gap-3">
          <Avatar name={displayName} size="sm" />
          <button
            type="submit"
            className="text-xs text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
          >
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "design: add AppShell with top nav, brand logo, active underline, sign-out form"
```

---

## Task 9: ProfileCard component

**Files:**
- Create: `src/components/profile-card.tsx`

Reuses `Avatar` and `Chip`. `Chip` here is purely visual (no checkbox needed — chips inside `ProfileCard` are display-only), so render the styled `<span>` directly rather than reusing the checkbox-based `Chip`.

- [ ] **Step 1: Create `src/components/profile-card.tsx`**

```tsx
import { Avatar } from "@/components/avatar";

export type DirectoryRow = {
  id: string;
  name: string | null;
  mit_email: string;
  company: string | null;
  title: string | null;
  industries: string[];
  city: string | null;
  linkedin_url: string | null;
  ocean: string | null;
};

export function ProfileCard({ profile }: { profile: DirectoryRow }) {
  const displayName = profile.name?.trim() || profile.mit_email;
  const work = [profile.title, profile.company].filter(Boolean).join(" at ");
  return (
    <li className="grid grid-cols-[44px_1fr] gap-4 rounded-md border border-line bg-paper p-4">
      <Avatar name={displayName} size="md" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">
            {profile.ocean ?? "—"} · &apos;26
          </span>
          {profile.linkedin_url && (
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-xs text-brand-700 underline-offset-4 hover:underline"
            >
              LinkedIn ↗
            </a>
          )}
        </div>
        <h2 className="truncate text-base font-semibold tracking-tight text-ink">
          {displayName}
        </h2>
        {work && <p className="text-sm text-ink-2">{work}</p>}
        {profile.city && (
          <p className="text-xs text-ink-2 before:mr-1 before:font-mono before:text-ink-3 before:content-['—']">
            {profile.city}
          </p>
        )}
        {profile.industries.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {profile.industries.map((ind) => (
              <li
                key={ind}
                className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-ink-2"
              >
                {ind}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile-card.tsx
git commit -m "design: add ProfileCard for directory results"
```

---

## Task 10: Rewrite home page

**Files:**
- Modify: `src/app/page.tsx`

Both branches (signed-out marketing + signed-in dashboard) rewritten with new primitives.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 p-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brand-700">
            MIT Sloan Class of 2026
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink">
            Stay in touch with your class.
          </h1>
          <p className="text-ink-2">
            A private directory for finding classmates, sharing where you landed,
            and keeping the cohort connected after graduation.
          </p>
        </header>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md border border-line-2 bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:border-brand-400"
          >
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, ocean")
    .eq("id", user.id)
    .maybeSingle();

  // Cheap aggregates for the stats strip.
  const { count: peopleCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { data: cityRows } = await supabase
    .from("profiles")
    .select("city")
    .not("city", "is", null);

  const cities = new Set((cityRows ?? []).map((r) => r.city)).size;

  const { data: indRows } = await supabase
    .from("profiles")
    .select("industries");

  const industries = new Set(
    (indRows ?? []).flatMap((r) => (r.industries as string[] | null) ?? []),
  ).size;

  const firstName = (profile?.name ?? user.email)?.split(" ")[0] ?? "there";
  const ocean = profile?.ocean ?? null;

  return (
    <AppShell active="home" user={{ name: profile?.name ?? null, email: user.email! }}>
      <PageHeader
        eyebrow={`Welcome back, ${firstName}`}
        title={ocean ? `Class of 2026 · ${ocean}` : "Class of 2026"}
        sub={`${peopleCount ?? 0} classmates, ${cities} ${cities === 1 ? "city" : "cities"}, ${industries} ${industries === 1 ? "industry" : "industries"} represented.`}
      />

      <section className="flex items-stretch gap-0 rounded-md border border-line bg-paper">
        <StatTile k="people" v={String(peopleCount ?? 0)} />
        <StatTile k="cities" v={String(cities)} />
        <StatTile k="industries" v={String(industries)} />
      </section>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NavTile
          num="01"
          label="Yourself"
          href="/profile"
          title="Your profile"
          description="Update company, title, city, LinkedIn."
        />
        <NavTile
          num="02"
          label="Browse"
          href="/directory"
          title="Directory"
          description={`Search ${peopleCount ?? 0} classmates by industry, role, city.`}
        />
        <NavTile num="03" label="Soon" title="Map" description="Where everyone landed, aggregated by city." soon />
        <NavTile num="04" label="Soon" title="Stats" description="Top cities and industries across the cohort." soon />
      </nav>
    </AppShell>
  );
}

function StatTile({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex-1 border-r border-line px-5 py-4 last:border-r-0">
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">{k}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{v}</div>
    </div>
  );
}

function NavTile({
  num,
  label,
  href,
  title,
  description,
  soon,
}: {
  num: string;
  label: string;
  href?: string;
  title: string;
  description: string;
  soon?: boolean;
}) {
  const inner = (
    <>
      <span className="absolute right-4 top-3 font-mono text-[0.6rem] tracking-wider text-ink-3">
        {num}
      </span>
      <span className={`font-mono text-[0.6rem] uppercase tracking-[0.18em] ${soon ? "text-ink-3" : "text-brand-700"}`}>
        {label}
      </span>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="text-sm text-ink-2">{description}</p>
    </>
  );
  const base = "relative flex flex-col rounded-md border border-line bg-paper px-5 py-4";
  if (soon) {
    return (
      <div className={`${base} cursor-not-allowed opacity-60`} aria-disabled="true">
        {inner}
      </div>
    );
  }
  return (
    <Link href={href!} className={`${base} transition hover:border-brand-400`}>
      {inner}
    </Link>
  );
}
```

- [ ] **Step 2: Verify (typecheck + lint)**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Verify (curl)**

Run: `curl -s -o /dev/null -L -w "HTTP %{http_code} | final %{url_effective}\n" http://localhost:3000/`
Expected: `HTTP 200 | final http://localhost:3000/sign-in` (you're not logged in via curl; auth gate redirects). To verify the signed-in branch, the user opens it in their browser.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "design: rewrite home page using AppShell, PageHeader, stats strip, numbered nav tiles"
```

---

## Task 11: Rewrite sign-in page

**Files:**
- Modify: `src/app/sign-in/page.tsx`

- [ ] **Step 1: Replace `src/app/sign-in/page.tsx`**

```tsx
import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signIn} className="rounded-md border border-line bg-paper px-5 py-4">
        <FieldRow label="MIT email">
          <Input name="email" type="email" required placeholder="you@mit.edu" />
        </FieldRow>
        <FieldRow label="Password">
          <Input name="password" type="password" required />
        </FieldRow>
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Sign in
          </button>
        </div>
      </form>
      <p className="text-sm text-ink-2">
        No account yet?{" "}
        <Link href="/sign-up" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/sign-in`
Expected: clean typecheck + lint, `HTTP 200`.

- [ ] **Step 3: Commit**

```bash
git add src/app/sign-in/page.tsx
git commit -m "design: rewrite sign-in page with FieldRow + Input primitives + ink primary"
```

---

## Task 12: Rewrite sign-up page

**Files:**
- Modify: `src/app/sign-up/page.tsx`

- [ ] **Step 1: Replace `src/app/sign-up/page.tsx`**

```tsx
import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { FieldRow } from "@/components/field-row";
import { Input } from "@/components/inputs";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string }>;
}) {
  const { error, check } = await searchParams;

  if (check === "email") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Check your email</h1>
        <p className="text-ink-2">
          We just sent a confirmation link to your MIT email. Open it to finish signing up.
        </p>
        <p className="text-sm text-ink-3">
          Didn&apos;t get it? Check spam, or{" "}
          <Link href="/sign-up" className="font-medium text-brand-700 underline-offset-4 hover:underline">
            try again
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          MIT Sloan Class of 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign up</h1>
        <p className="text-sm text-ink-2">
          Restricted to <code className="font-mono">@mit.edu</code> email addresses. You&apos;ll
          confirm your email before signing in.
        </p>
      </header>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={signUp} className="rounded-md border border-line bg-paper px-5 py-4">
        <FieldRow label="MIT email">
          <Input
            name="email"
            type="email"
            required
            placeholder="you@mit.edu"
            pattern="^[^@\s]+@mit\.edu$"
            title="Must be an @mit.edu address"
          />
        </FieldRow>
        <FieldRow label="Password">
          <Input name="password" type="password" required minLength={8} />
        </FieldRow>
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Sign up
          </button>
        </div>
      </form>
      <p className="text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/sign-up`
Expected: clean typecheck + lint, `HTTP 200`.

- [ ] **Step 3: Commit**

```bash
git add src/app/sign-up/page.tsx
git commit -m "design: rewrite sign-up page with new primitives; check-email screen restyled"
```

---

## Task 13: Rewrite profile page

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Replace `src/app/profile/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, OCEANS, type Profile } from "@/lib/types";
import { updateProfile } from "./actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { FieldRow, ReadOnlyValue } from "@/components/field-row";
import { Input, Select } from "@/components/inputs";
import { Chip } from "@/components/chip";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (fetchError) {
    return (
      <ErrorShell email={user.email!} title="Couldn't load your profile" message={fetchError.message} />
    );
  }
  if (!profile) {
    return (
      <ErrorShell
        email={user.email!}
        title="Profile not found"
        message="Your auth account exists but no profile row was created. Check that the schema migration ran."
      />
    );
  }

  return (
    <AppShell active="profile" user={{ name: profile.name, email: user.email! }}>
      <PageHeader
        eyebrow="Your profile"
        title={profile.name?.trim() || "Tell your class about yourself"}
        sub="Visible to other signed-in @mit.edu classmates."
      />

      {saved && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Profile saved.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <form action={updateProfile} className="flex flex-col gap-3">
        <Section label="Identity" index={1}>
          <FieldRow label="MIT email">
            <ReadOnlyValue>{profile.mit_email}</ReadOnlyValue>
          </FieldRow>
          <FieldRow label="Display name">
            <Input name="name" defaultValue={profile.name ?? ""} placeholder="Jane Doe" />
          </FieldRow>
          <FieldRow label="Personal email" help="Where to reach you after your MIT email expires.">
            <Input
              name="personal_email"
              type="email"
              defaultValue={profile.personal_email ?? ""}
              placeholder="jane@gmail.com"
            />
          </FieldRow>
        </Section>

        <Section label="Work" index={2}>
          <FieldRow label="Company">
            <Input name="company" defaultValue={profile.company ?? ""} placeholder="Acme Corp" />
          </FieldRow>
          <FieldRow label="Title">
            <Input name="title" defaultValue={profile.title ?? ""} placeholder="Product Manager" />
          </FieldRow>
          <FieldRow label="Industries" help="Pick all that apply.">
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map((ind) => (
                <Chip
                  key={ind}
                  name="industries"
                  value={ind}
                  defaultChecked={profile.industries.includes(ind)}
                />
              ))}
            </div>
          </FieldRow>
        </Section>

        <Section label="Place" index={3}>
          <FieldRow label="City" help="City only — we don't collect addresses.">
            <Input name="city" defaultValue={profile.city ?? ""} placeholder="New York, NY" />
          </FieldRow>
          <FieldRow label="Ocean">
            <Select name="ocean" defaultValue={profile.ocean ?? ""}>
              <option value="">— Select —</option>
              {OCEANS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="LinkedIn">
            <Input
              name="linkedin_url"
              type="url"
              defaultValue={profile.linkedin_url ?? ""}
              placeholder="https://www.linkedin.com/in/..."
            />
          </FieldRow>
        </Section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-md bg-ink px-5 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Save profile
          </button>
        </div>
      </form>
    </AppShell>
  );
}

function ErrorShell({
  email,
  title,
  message,
}: {
  email: string;
  title: string;
  message: string;
}) {
  return (
    <AppShell active="profile" user={{ name: null, email }}>
      <PageHeader eyebrow="Your profile" title={title} />
      <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
        {message}
      </p>
      <Link href="/" className="text-sm text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline">
        ← Home
      </Link>
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && curl -s -o /dev/null -L -w "HTTP %{http_code} | final %{url_effective}\n" http://localhost:3000/profile`
Expected: clean typecheck + lint; `HTTP 200 | final http://localhost:3000/sign-in` (auth gate redirects).

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "design: rewrite profile page with AppShell, numbered Sections, FieldRow + Chip"
```

---

## Task 14: Rewrite directory page

**Files:**
- Modify: `src/app/directory/page.tsx`

This is the largest page rewrite. The filter rail lives in the left column; results stack to the right. The chip filters use the new `Chip` (which is JS-less — a `<label>`-wrapped checkbox).

- [ ] **Step 1: Replace `src/app/directory/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, OCEANS, type Profile } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProfileCard, type DirectoryRow } from "@/components/profile-card";
import { Input, Select } from "@/components/inputs";
import { Chip } from "@/components/chip";

type SearchParams = {
  q?: string | string[];
  industries?: string | string[];
  ocean?: string | string[];
  city?: string | string[];
};

function single(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function many(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = single(sp.q).trim();
  const ocean = single(sp.ocean).trim();
  const city = single(sp.city).trim();
  const selectedIndustries = many(sp.industries).filter((s) =>
    (INDUSTRIES as readonly string[]).includes(s),
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "name">>();

  let query = supabase
    .from("profiles")
    .select("id, name, mit_email, company, title, industries, city, linkedin_url, ocean")
    .order("name", { ascending: true, nullsFirst: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (selectedIndustries.length) query = query.overlaps("industries", selectedIndustries);
  if (ocean && (OCEANS as readonly string[]).includes(ocean)) query = query.eq("ocean", ocean);
  if (city) query = query.ilike("city", `%${city}%`);

  const { data: profiles, error } = await query.returns<DirectoryRow[]>();
  const hasFilters = !!(q || ocean || city || selectedIndustries.length);

  return (
    <AppShell active="directory" user={{ name: me?.name ?? null, email: user.email! }}>
      <PageHeader
        eyebrow="Class of 2026"
        title="Directory"
        count={
          profiles
            ? `${profiles.length} ${profiles.length === 1 ? "person" : "people"}`
            : "—"
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <aside className="self-start rounded-md border border-line bg-paper p-4">
          <form action="/directory" method="get" className="flex flex-col gap-4">
            <FilterGroup label="Search">
              <Input type="text" name="q" defaultValue={q} placeholder="Name…" />
            </FilterGroup>
            <FilterGroup label="City">
              <Input type="text" name="city" defaultValue={city} placeholder="e.g. NYC" />
            </FilterGroup>
            <FilterGroup label="Ocean">
              <Select name="ocean" defaultValue={ocean}>
                <option value="">Any</option>
                {OCEANS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </FilterGroup>
            <FilterGroup label="Industries">
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map((ind) => (
                  <Chip
                    key={ind}
                    name="industries"
                    value={ind}
                    defaultChecked={selectedIndustries.includes(ind)}
                  />
                ))}
              </div>
            </FilterGroup>
            <div className="flex items-center gap-3 border-t border-dashed border-line-2 pt-3">
              <button
                type="submit"
                className="rounded-md bg-ink px-3.5 py-1.5 text-xs font-medium text-cream transition hover:bg-ink-2"
              >
                Apply
              </button>
              {hasFilters && (
                <Link
                  href="/directory"
                  className="text-xs text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </aside>

        <div className="flex flex-col gap-3">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
              {error.message}
            </p>
          )}

          {profiles && profiles.length === 0 && (
            <p className="rounded-md border border-line bg-paper px-4 py-8 text-center text-sm text-ink-3">
              No classmates match these filters.{" "}
              {hasFilters && (
                <Link
                  href="/directory"
                  className="font-medium text-brand-700 underline-offset-4 hover:underline"
                >
                  Clear filters
                </Link>
              )}
            </p>
          )}

          {profiles && profiles.length > 0 && (
            <ul className="flex flex-col gap-3">
              {profiles.map((p) => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && curl -s -o /dev/null -L -w "HTTP %{http_code} | final %{url_effective}\n" "http://localhost:3000/directory?industries=Tech&industries=Finance&ocean=Pacific&city=NYC"`
Expected: clean typecheck + lint; `HTTP 200 | final http://localhost:3000/sign-in` (auth-gated). The complex URL exercises the searchParams parsing without crashing.

- [ ] **Step 3: Commit**

```bash
git add src/app/directory/page.tsx
git commit -m "design: rewrite directory with AppShell, side-rail filters, ProfileCard results"
```

---

## Task 15: Update CLAUDE.md design tokens section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Design tokens" section in `CLAUDE.md`**

Find the section starting with `## Design tokens` and replace its body (the section header stays). Replace from the line `Light-mode only.` through the line before the next `##` heading. New body:

```markdown
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
```

- [ ] **Step 2: Verify**

Run: `git diff --stat CLAUDE.md`
Expected: one file changed, both insertions and deletions (rewriting one section).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): update Design tokens section for new system"
```

---

## Task 16: Final visual verification

No code changes — purely confirming the redesign holds together.

- [ ] **Step 1: Confirm dev server is still running**

Run: `lsof -i:3000 -P 2>/dev/null | head -3`
Expected: a `node` process listening on port 3000. If absent, run `npm run dev > /tmp/mct-dev.log 2>&1 &` and wait for "Ready in" in the log.

- [ ] **Step 2: Curl all routes**

Run:
```bash
for path in / /sign-in /sign-up /profile /directory; do
  printf "GET %-12s → " "$path"
  curl -s -o /dev/null -L -w "HTTP %{http_code} | final %{url_effective}\n" "http://localhost:3000${path}"
done
```

Expected (logged out via curl):
- `/` → `HTTP 200 | final http://localhost:3000/` (marketing branch)
- `/sign-in`, `/sign-up` → `HTTP 200`
- `/profile`, `/directory` → `HTTP 200 | final http://localhost:3000/sign-in` (auth-gated)

If any route returns a 500, read `/tmp/mct-dev.log` (or `.next/dev/logs/next-development.log`) for the error and fix it inline before continuing.

- [ ] **Step 3: User visual review**

Hand off to the user: "Open `http://localhost:3000` and walk through home (signed-out), sign-in, sign-up, home (signed-in), profile, directory. Tell me what's off."

Visual review is the last verification; tweaks land as follow-up commits.

---

## Self-review summary

- **Spec coverage:** Every section of the spec maps to a task. Design tokens → Task 1. Each component in the spec → Tasks 2–9. Each page in the spec → Tasks 10–14. Doc update → Task 15. Verification → Task 16. The "out of scope" items (photo upload, map, stats, dark mode) are not in any task — that's intended.
- **Placeholder scan:** No TBDs, no "add appropriate error handling" hand-waves. Every step has the exact code to write.
- **Type consistency:** `DirectoryRow` is defined in `profile-card.tsx` (Task 9) and imported by `directory/page.tsx` (Task 14). `Profile` is imported from `@/lib/types`. `signOut` is imported from `@/app/auth/actions` (already exists, untouched).
- **Cross-task coupling:** Tasks 2–9 can run in any order (no dependencies between leaf components). Task 10 onwards depend on the components existing. Task 1 (tokens) must be first because every other task uses `bg-ink`, `text-cream`, etc.
