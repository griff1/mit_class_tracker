import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CITIES, INDUSTRIES, OCEANS, type Profile } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProfileCard, type DirectoryRow } from "@/components/profile-card";
import { Input, Select } from "@/components/inputs";
import { Chip } from "@/components/chip";

type SearchParams = {
  q?: string | string[];
  industries?: string | string[];
  ocean?: string | string[];
  cities?: string | string[];
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
  const selectedIndustries = many(sp.industries).filter((s) =>
    (INDUSTRIES as readonly string[]).includes(s),
  );
  const selectedCities = many(sp.cities);

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

  // Cohort-known cities — union with seed list for filter chip options.
  const { data: cohort } = await supabase.from("profiles").select("cities");
  const knownCities = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.cities as string[] | null) ?? [])),
  );
  const cityOptionSet = new Map<string, string>();
  for (const v of [...CITIES, ...knownCities]) {
    const k = v.toLowerCase();
    if (!cityOptionSet.has(k)) cityOptionSet.set(k, v);
  }
  const cityOptions = Array.from(cityOptionSet.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  let query = supabase
    .from("profiles")
    .select("id, name, mit_email, company, title, industries, cities, linkedin_url, ocean")
    .order("name", { ascending: true, nullsFirst: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (selectedIndustries.length) query = query.overlaps("industries", selectedIndustries);
  if (ocean && (OCEANS as readonly string[]).includes(ocean)) query = query.eq("ocean", ocean);
  if (selectedCities.length) query = query.overlaps("cities", selectedCities);

  const { data: profiles, error } = await query.returns<DirectoryRow[]>();
  const hasFilters = !!(q || ocean || selectedIndustries.length || selectedCities.length);

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
            <FilterGroup label="Cities">
              <div className="flex flex-wrap gap-1.5">
                {cityOptions.map((c) => (
                  <Chip
                    key={c}
                    name="cities"
                    value={c}
                    defaultChecked={selectedCities.some(
                      (s) => s.toLowerCase() === c.toLowerCase(),
                    )}
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
