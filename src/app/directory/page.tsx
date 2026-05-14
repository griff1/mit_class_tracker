import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVITIES,
  CITIES,
  INDUSTRIES,
  OCEANS,
  ROLES,
  type Profile,
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
  cities?: string | string[];
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

function unionCanonical(seed: readonly string[], cohort: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of [...seed, ...cohort]) {
    const k = v.toLowerCase();
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
  const selectedIndustries = many(sp.industries);
  const selectedRoles = many(sp.roles);
  const selectedCities = many(sp.cities);
  const selectedActivities = many(sp.activities);

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

  // Build chip options as seed ∪ cohort, deduped case-insensitively.
  const { data: cohort } = await supabase
    .from("profiles")
    .select("industries, roles, cities, activities");
  const cohortIndustries = (cohort ?? []).flatMap(
    (r) => (r.industries as string[] | null) ?? [],
  );
  const cohortRoles = (cohort ?? []).flatMap(
    (r) => (r.roles as string[] | null) ?? [],
  );
  const cohortCities = (cohort ?? []).flatMap(
    (r) => (r.cities as string[] | null) ?? [],
  );
  const cohortActivities = (cohort ?? []).flatMap(
    (r) => (r.activities as string[] | null) ?? [],
  );
  const industryOptions = unionCanonical(INDUSTRIES, cohortIndustries);
  const roleOptions = unionCanonical(ROLES, cohortRoles);
  const cityOptions = unionCanonical(CITIES, cohortCities);
  const activityOptions = unionCanonical(ACTIVITIES, cohortActivities);

  let query = supabase
    .from("profiles")
    .select(
      "id, name, mit_email, company, title, industries, roles, cities, linkedin_url, ocean, profile_photo_url",
    )
    .order("name", { ascending: true, nullsFirst: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (selectedIndustries.length) query = query.overlaps("industries", selectedIndustries);
  if (selectedRoles.length) query = query.overlaps("roles", selectedRoles);
  if (ocean && (OCEANS as readonly string[]).includes(ocean))
    query = query.eq("ocean", ocean);
  if (selectedCities.length) query = query.overlaps("cities", selectedCities);
  if (selectedActivities.length) query = query.overlaps("activities", selectedActivities);

  const { data: profiles, error } = await query.returns<DirectoryRow[]>();

  // Batch-sign photo URLs for the visible profiles (one round trip instead of
  // N). createSignedUrls returns results in the same order as the input paths.
  const photoPaths = (profiles ?? [])
    .map((p) => p.profile_photo_url)
    .filter((p): p is string => !!p);
  const photoUrls = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("profile-photos")
      .createSignedUrls(photoPaths, 3600);
    if (signed) {
      for (let i = 0; i < photoPaths.length; i++) {
        const url = signed[i]?.signedUrl;
        if (url) photoUrls.set(photoPaths[i], url);
      }
    }
  }

  const hasFilters = !!(
    q ||
    ocean ||
    selectedIndustries.length ||
    selectedRoles.length ||
    selectedCities.length ||
    selectedActivities.length
  );

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside className="self-start rounded-md border border-line bg-paper p-4">
          <form action="/directory" method="get" className="flex flex-col gap-4">
            <FilterGroup label="Search">
              <Input type="text" name="q" defaultValue={q} placeholder="Name…" />
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
                  photoUrl={
                    p.profile_photo_url
                      ? photoUrls.get(p.profile_photo_url)
                      : null
                  }
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
