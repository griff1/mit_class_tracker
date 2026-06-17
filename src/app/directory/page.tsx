import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avatarSrc } from "@/lib/avatar";
import { canonKey } from "@/lib/cities";
import { getViewer } from "@/lib/viewer";
import {
  ACTIVITIES,
  CITIES,
  INDUSTRIES,
  OCEANS,
  PROGRAMS,
  ROLES,
} from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProfileCard, type DirectoryRow } from "@/components/profile-card";
import { Input, Select } from "@/components/inputs";
import { Chip } from "@/components/chip";

type SearchParams = {
  q?: string | string[];
  industries?: string | string[];
  roles?: string | string[];
  ocean?: string | string[];
  program?: string | string[];
  cities?: string | string[];
  visiting_cities?: string | string[];
  activities?: string | string[];
};

function single(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function many(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Build a PostgREST array literal from string elements, quoting and
 * escaping each so values with commas / braces / quotes round-trip
 * correctly.
 *
 * Why this exists: supabase-js's `.overlaps(col, arr)` builds the URL
 * value as `ov.{${arr.join(",")}}` -- a plain comma join. PostgREST
 * then parses `{Boston, MA}` as a two-element array `[Boston, " MA"]`,
 * neither of which matches the literal "Boston, MA" stored in
 * `profiles.cities`. Every city with a comma (NYC, SF, Boston, ...)
 * silently returned zero matches. We sidestep that by constructing the
 * literal ourselves with `"..."` around every element and passing it
 * through the generic `.filter(col, "ov", ...)` escape hatch.
 *
 * Per PostgREST array-literal rules: wrap each element in double
 * quotes; inside, escape backslash as `\\\\` and double-quote as `\\"`.
 */
function pgArrayLiteral(values: readonly string[]): string {
  const escaped = values.map(
    (v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  );
  return `{${escaped.join(",")}}`;
}

function unionCanonical(seed: readonly string[], cohort: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of [...seed, ...cohort]) {
    const k = canonKey(v);
    if (!seen.has(k)) seen.set(k, v);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = single(sp.q).trim();
  const ocean = single(sp.ocean).trim();
  const program = single(sp.program).trim();
  const selectedIndustries = many(sp.industries);
  const selectedRoles = many(sp.roles);
  const selectedCities = many(sp.cities);
  const selectedVisitingCities = many(sp.visiting_cities);
  const selectedActivities = many(sp.activities);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const viewer = await getViewer(supabase, user);

  // Build chip options as seed ∪ cohort, deduped case-insensitively.
  const { data: cohort } = await supabase
    .from("profiles")
    .select("industries, roles, cities, visiting_cities, activities");
  const cohortIndustries = (cohort ?? []).flatMap(
    (r) => (r.industries as string[] | null) ?? [],
  );
  const cohortRoles = (cohort ?? []).flatMap(
    (r) => (r.roles as string[] | null) ?? [],
  );
  const cohortCities = (cohort ?? []).flatMap(
    (r) => (r.cities as string[] | null) ?? [],
  );
  const cohortVisitingCities = (cohort ?? []).flatMap(
    (r) => (r.visiting_cities as string[] | null) ?? [],
  );
  const cohortActivities = (cohort ?? []).flatMap(
    (r) => (r.activities as string[] | null) ?? [],
  );
  const industryOptions = unionCanonical(INDUSTRIES, cohortIndustries);
  const roleOptions = unionCanonical(ROLES, cohortRoles);
  const cityOptions = unionCanonical(CITIES, cohortCities);
  const visitingCityOptions = unionCanonical(CITIES, cohortVisitingCities);
  const activityOptions = unionCanonical(ACTIVITIES, cohortActivities);

  let query = supabase
    .from("profiles")
    .select(
      "id, name, mit_email, personal_email, company, title, industries, roles, cities, visiting_cities, linkedin_url, ocean, program, profile_photo_url, activities",
    )
    .order("name", { ascending: true, nullsFirst: false });

  if (q) query = query.ilike("name", `%${q}%`);
  // All array-overlaps filters use .filter("col", "ov", pgArrayLiteral(...))
  // instead of .overlaps(...) so values containing commas survive the
  // PostgREST array-literal round-trip. See pgArrayLiteral above.
  if (selectedIndustries.length)
    query = query.filter("industries", "ov", pgArrayLiteral(selectedIndustries));
  if (selectedRoles.length)
    query = query.filter("roles", "ov", pgArrayLiteral(selectedRoles));
  if (ocean && (OCEANS as readonly string[]).includes(ocean))
    query = query.eq("ocean", ocean);
  if (program && (PROGRAMS as readonly string[]).includes(program))
    query = query.eq("program", program);
  if (selectedCities.length)
    query = query.filter("cities", "ov", pgArrayLiteral(selectedCities));
  if (selectedVisitingCities.length)
    query = query.filter(
      "visiting_cities",
      "ov",
      pgArrayLiteral(selectedVisitingCities),
    );
  if (selectedActivities.length)
    query = query.filter("activities", "ov", pgArrayLiteral(selectedActivities));

  const { data: profiles, error } = await query.returns<DirectoryRow[]>();

  // Avatars are served via the stable, cacheable /avatar/[id] proxy (see
  // src/lib/avatar.ts). No Storage round trip here at all — we just build the
  // URL from the id + content-addressed path. This replaced per-render
  // createSignedUrls, whose rotating tokens defeated all caching and were the
  // main source of Supabase egress.

  const hasFilters = !!(
    q ||
    ocean ||
    program ||
    selectedIndustries.length ||
    selectedRoles.length ||
    selectedCities.length ||
    selectedVisitingCities.length ||
    selectedActivities.length
  );

  // Tie the form's React identity to the URL filter state. The chip
  // checkboxes / Selects use `defaultChecked` / `defaultValue` /
  // `<details open>`, which React applies ONLY on mount — when the user
  // clicks Clear (a soft Next.js navigation, not a reload) the existing
  // DOM is reused with fresh props that React deliberately ignores, so
  // previously-checked chips stay checked in the DOM and get submitted
  // with the next search. Changing this key on every URL state change
  // forces a full remount, so every chip reads its checked state from
  // the current URL.
  const filterKey = JSON.stringify({
    q,
    program,
    ocean,
    i: selectedIndustries,
    r: selectedRoles,
    c: selectedCities,
    v: selectedVisitingCities,
    a: selectedActivities,
  });

  return (
    <AppShell active="directory" user={viewer}>
      <PageHeader
        eyebrow="Class of 2026"
        title="Directory"
        count={
          profiles
            ? `${profiles.length} ${profiles.length === 1 ? "person" : "people"}`
            : "—"
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside className="self-start rounded-md border border-line bg-paper p-4">
          <form
            key={filterKey}
            action="/directory"
            method="get"
            className="flex flex-col gap-4"
          >
            <FilterGroup label="Search">
              <Input type="text" name="q" defaultValue={q} placeholder="Name…" />
            </FilterGroup>
            <FilterGroup label="Program">
              <Select name="program" defaultValue={program}>
                <option value="">Any</option>
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
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
            <ChipFilter
              label="Roles"
              name="roles"
              options={roleOptions}
              selected={selectedRoles}
            />
            <ChipFilter
              label="Industries"
              name="industries"
              options={industryOptions}
              selected={selectedIndustries}
            />
            <ChipFilter
              label="Cities"
              name="cities"
              options={cityOptions}
              selected={selectedCities}
            />
            <ChipFilter
              label="Frequently in"
              name="visiting_cities"
              options={visitingCityOptions}
              selected={selectedVisitingCities}
            />
            <ChipFilter
              label="Activities"
              name="activities"
              options={activityOptions}
              selected={selectedActivities}
            />
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
                <ProfileCard
                  key={p.id}
                  profile={p}
                  photoUrl={avatarSrc(p.id, p.profile_photo_url)}
                />
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

/**
 * Collapsible chip-multi-select filter. Defaults to expanded when there are
 * active selections (so the user sees what's applied), collapsed otherwise.
 */
function ChipFilter({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: readonly string[];
  selected: readonly string[];
}) {
  const selectedLower = new Set(selected.map((s) => s.toLowerCase()));
  return (
    <details className="group flex flex-col gap-1.5" open={selected.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-3">
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 rounded-sm bg-brand-50 px-1 text-brand-700">
              {selected.length}
            </span>
          )}
        </span>
        <span className="font-mono text-[0.6rem] text-ink-3 transition group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Chip
            key={opt}
            name={name}
            value={opt}
            defaultChecked={selectedLower.has(opt.toLowerCase())}
          />
        ))}
      </div>
    </details>
  );
}
