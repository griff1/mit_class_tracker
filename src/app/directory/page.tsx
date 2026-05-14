import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, OCEANS, type Profile } from "@/lib/types";

type SearchParams = {
  q?: string | string[];
  industries?: string | string[];
  ocean?: string | string[];
  city?: string | string[];
};

type DirectoryRow = Pick<
  Profile,
  | "id"
  | "name"
  | "mit_email"
  | "company"
  | "title"
  | "industries"
  | "city"
  | "linkedin_url"
  | "ocean"
>;

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

  let query = supabase
    .from("profiles")
    .select(
      "id, name, mit_email, company, title, industries, city, linkedin_url, ocean",
    )
    .order("name", { ascending: true, nullsFirst: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (selectedIndustries.length)
    query = query.overlaps("industries", selectedIndustries);
  if (ocean && (OCEANS as readonly string[]).includes(ocean))
    query = query.eq("ocean", ocean);
  if (city) query = query.ilike("city", `%${city}%`);

  const { data: profiles, error } = await query.returns<DirectoryRow[]>();
  const hasFilters = !!(q || ocean || city || selectedIndustries.length);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <nav className="text-sm">
        <Link
          href="/"
          className="text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline"
        >
          ← Home
        </Link>
      </nav>

      <header className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
            Directory
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Class of 2026
          </h1>
        </div>
        <p className="text-sm text-stone-500">
          {profiles
            ? `${profiles.length} ${profiles.length === 1 ? "person" : "people"}`
            : "—"}
        </p>
      </header>

      <form
        action="/directory"
        method="get"
        className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-stone-800">City</span>
            <input
              type="text"
              name="city"
              defaultValue={city}
              placeholder="e.g. New York"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-stone-800">Ocean</span>
            <select
              name="ocean"
              defaultValue={ocean}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="">Any</option>
              {OCEANS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium text-stone-800">Industries</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <label
                key={ind}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-stone-100"
              >
                <input
                  type="checkbox"
                  name="industries"
                  value={ind}
                  defaultChecked={selectedIndustries.includes(ind)}
                  className="h-4 w-4 rounded border-stone-300 accent-brand-500"
                />
                <span className="text-stone-700">{ind}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            Apply filters
          </button>
          {hasFilters && (
            <Link
              href="/directory"
              className="text-sm text-stone-600 underline-offset-4 hover:text-brand-700 hover:underline"
            >
              Clear all
            </Link>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error.message}
        </p>
      )}

      {profiles && profiles.length === 0 && (
        <p className="rounded-md border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500">
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
    </main>
  );
}

function ProfileCard({ profile }: { profile: DirectoryRow }) {
  const displayName = profile.name?.trim() || profile.mit_email;
  const initial = (displayName[0] ?? "?").toUpperCase();
  const work = [profile.title, profile.company].filter(Boolean).join(" at ");
  const where = [profile.city, profile.ocean].filter(Boolean).join(" · ");

  return (
    <li className="flex gap-4 rounded-lg border border-stone-200 bg-white p-4">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700"
      >
        {initial}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-base font-semibold text-stone-900">
            {displayName}
          </h2>
          {profile.linkedin_url && (
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none text-xs font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              LinkedIn ↗
            </a>
          )}
        </div>
        {work && <p className="text-sm text-stone-700">{work}</p>}
        {where && <p className="text-sm text-stone-500">{where}</p>}
        {profile.industries.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-0.5">
            {profile.industries.map((ind) => (
              <li
                key={ind}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
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
