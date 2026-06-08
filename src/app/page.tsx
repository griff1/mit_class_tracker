import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ClassMap, type MapAggregate } from "@/components/class-map";

// Cities that should collapse onto a parent metro's pin on the home map.
// Keys are LOWERCASED city strings (matched case-insensitively against the raw
// values in `profiles.cities` / `visiting_cities`); values are the metro hub
// whose coords + label win. Only the map merges — the directory card and stats
// keep each member's own city. Extend as other metros (NY-area outer boroughs,
// etc.) start producing the same fragmentation.
//
// Both ", CA"-suffixed and bare write-in variants are listed for the common
// Bay Area names, since members type either form. The hub label "Bay Area, CA"
// is never itself a profile city, so its coords are seeded in
// city_coords (migration 20260608170000), the way "cambridge, ma" was.
const METRO_OF: Record<string, string> = {
  // Greater Boston.
  "cambridge, ma": "Boston, MA",
  // SF Bay Area — SF, Peninsula, South Bay, and East Bay all collapse to one pin.
  "san francisco, ca": "Bay Area, CA",
  "san francisco": "Bay Area, CA",
  "sf": "Bay Area, CA",
  "bay area": "Bay Area, CA",
  "bay area, ca": "Bay Area, CA",
  "sf bay area": "Bay Area, CA",
  "south san francisco, ca": "Bay Area, CA",
  "daly city, ca": "Bay Area, CA",
  "san bruno, ca": "Bay Area, CA",
  "burlingame, ca": "Bay Area, CA",
  "san mateo, ca": "Bay Area, CA",
  "foster city, ca": "Bay Area, CA",
  "belmont, ca": "Bay Area, CA",
  "san carlos, ca": "Bay Area, CA",
  "redwood city, ca": "Bay Area, CA",
  "redwood city": "Bay Area, CA",
  "menlo park, ca": "Bay Area, CA",
  "menlo park": "Bay Area, CA",
  "east palo alto, ca": "Bay Area, CA",
  "palo alto, ca": "Bay Area, CA",
  "palo alto": "Bay Area, CA",
  "mountain view, ca": "Bay Area, CA",
  "mountain view": "Bay Area, CA",
  "los altos, ca": "Bay Area, CA",
  "sunnyvale, ca": "Bay Area, CA",
  "sunnyvale": "Bay Area, CA",
  "cupertino, ca": "Bay Area, CA",
  "cupertino": "Bay Area, CA",
  "santa clara, ca": "Bay Area, CA",
  "santa clara": "Bay Area, CA",
  "san jose, ca": "Bay Area, CA",
  "san jose": "Bay Area, CA",
  "campbell, ca": "Bay Area, CA",
  "los gatos, ca": "Bay Area, CA",
  "milpitas, ca": "Bay Area, CA",
  "fremont, ca": "Bay Area, CA",
  "hayward, ca": "Bay Area, CA",
  "san leandro, ca": "Bay Area, CA",
  "alameda, ca": "Bay Area, CA",
  "oakland, ca": "Bay Area, CA",
  "oakland": "Bay Area, CA",
  "emeryville, ca": "Bay Area, CA",
  "berkeley, ca": "Bay Area, CA",
  "berkeley": "Bay Area, CA",
  "richmond, ca": "Bay Area, CA",
  "walnut creek, ca": "Bay Area, CA",
  "pleasanton, ca": "Bay Area, CA",
  "dublin, ca": "Bay Area, CA",
  "san ramon, ca": "Bay Area, CA",
  "novato, ca": "Bay Area, CA",
  "san rafael, ca": "Bay Area, CA",
  "sausalito, ca": "Bay Area, CA",
};

// Resolve a raw city string to its metro hub, or itself when unmapped.
// Case-insensitive so "san francisco, ca" and "San Francisco, CA" both collapse.
function metroOf(city: string): string {
  return METRO_OF[city.trim().toLowerCase()] ?? city;
}

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
        <div className="flex flex-col gap-2">
          <Link
            href="/sign-in"
            className="self-start rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Sign in
          </Link>
          <p className="text-xs text-ink-3">
            New here? Same button — we&apos;ll create your account from your{" "}
            <code className="font-mono">@mit.edu</code>,{" "}
            <code className="font-mono">@sloan.mit.edu</code>, or{" "}
            <code className="font-mono">@alum.mit.edu</code> address.
          </p>
        </div>
      </main>
    );
  }

  const viewer = await getViewer(supabase, user);

  // Cheap aggregates for the stats strip + map. One profile-row query feeds
  // both the distinct-city count and the per-city pin counts.
  const { count: peopleCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { data: cityRows } = await supabase
    .from("profiles")
    .select("name, mit_email, cities, visiting_cities");

  const cities = new Set(
    (cityRows ?? []).flatMap((r) => (r.cities as string[] | null) ?? []),
  ).size;

  // Pull cached coords from city_coords for every city that appears on a
  // profile (either layer). Newly-saved cities are geocoded in the
  // background by updateProfile -> Nominatim -> cache_city_coords, so they
  // pin themselves on a subsequent render. Anything still missing (genuine
  // geocoder miss or a brand-new city whose after() task has not landed
  // yet) falls into the per-layer "not yet pinned" disclosure below. The
  // try/catch keeps the home page rendering even if the table is missing
  // (e.g. the migration has not been applied yet).
  const allCityKeys = new Set<string>();
  for (const r of cityRows ?? []) {
    for (const c of [
      ...((r.cities as string[] | null) ?? []),
      ...((r.visiting_cities as string[] | null) ?? []),
    ]) {
      // Key by the metro hub the city collapses to, so a hub that is never a
      // raw profile city itself (e.g. "Bay Area, CA") still has its coords
      // fetched. For unmapped cities metroOf is the identity.
      const k = metroOf(c).trim().toLowerCase();
      if (k) allCityKeys.add(k);
    }
  }
  const coordsByKey = new Map<string, { lat: number; lng: number }>();
  if (allCityKeys.size > 0) {
    try {
      const { data: coordRows } = await supabase
        .from("city_coords")
        .select("city_key, lat, lng")
        .in("city_key", Array.from(allCityKeys));
      for (const row of coordRows ?? []) {
        const lat = row.lat as number | null;
        const lng = row.lng as number | null;
        if (lat !== null && lng !== null) {
          coordsByKey.set(row.city_key as string, { lat, lng });
        }
      }
    } catch {
      // Treat as no coords; everything falls to the unmapped disclosure.
    }
  }

  function geoAggregate(field: "cities" | "visiting_cities") {
    // Bucket by metro: nearby cities that share a metro area collapse to a
    // single pin (so e.g. Cambridge, MA + Boston, MA = one Boston pin).
    // The directory card still shows each member's actual answer; only the
    // map merges. Extend METRO_OF when other metros (NY/NJ, SF Bay, etc.)
    // start showing the same Boston/Cambridge pattern.
    //
    // Inner map keys by mit_email (unique per profile) so a profile that
    // lists multiple cities collapsing into the same metro -- e.g. both
    // "Boston, MA" and "Cambridge, MA" -- shows up ONCE on the merged
    // pin instead of N times. The Map.set is idempotent; subsequent
    // hits for the same profile just overwrite their slot.
    const byMetro = new Map<string, Map<string, string>>();
    for (const r of cityRows ?? []) {
      const email = (r.mit_email as string | null) ?? "";
      const display =
        ((r.name as string | null)?.trim() || email) || "Member";
      const dedupKey = email || display;
      for (const c of (r[field] as string[] | null) ?? []) {
        const metro = metroOf(c);
        const bucket = byMetro.get(metro) ?? new Map<string, string>();
        bucket.set(dedupKey, display);
        byMetro.set(metro, bucket);
      }
    }
    const mapped: MapAggregate[] = [];
    const unmapped: { city: string; count: number }[] = [];
    for (const [city, peopleMap] of byMetro.entries()) {
      const people = Array.from(peopleMap.values()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      const coords = coordsByKey.get(city.trim().toLowerCase());
      if (coords) mapped.push({ city, count: people.length, people, ...coords });
      else unmapped.push({ city, count: people.length });
    }
    unmapped.sort((a, b) => b.count - a.count);
    return { mapped, unmapped };
  }

  const liveLayer = geoAggregate("cities");
  const visitLayer = geoAggregate("visiting_cities");

  const { data: indRows } = await supabase
    .from("profiles")
    .select("industries");

  const industries = new Set(
    (indRows ?? []).flatMap((r) => (r.industries as string[] | null) ?? []),
  ).size;

  const firstName = (viewer.name ?? viewer.email).split(" ")[0] ?? "there";

  return (
    <AppShell active="home" user={viewer}>
      <PageHeader
        eyebrow={`Welcome back, ${firstName}`}
        title={viewer.ocean ? `Class of 2026 · ${viewer.ocean}` : "Class of 2026"}
        sub={`${peopleCount ?? 0} classmates, ${cities} ${cities === 1 ? "city" : "cities"}, ${industries} ${industries === 1 ? "industry" : "industries"} represented.`}
      />

      <section className="flex items-stretch gap-0 rounded-md border border-line bg-paper">
        <StatTile k="people" v={String(peopleCount ?? 0)} />
        <StatTile k="cities" v={String(cities)} />
        <StatTile k="industries" v={String(industries)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-brand-700">
          Where everyone is
        </h2>
        <div className="overflow-hidden rounded-md border border-line bg-paper">
          <ClassMap livesHere={liveLayer.mapped} visits={visitLayer.mapped} />
        </div>
        {liveLayer.unmapped.length > 0 && (
          <p className="text-xs text-ink-3">
            <span className="font-mono uppercase tracking-[0.1em]">
              Lives here
            </span>{" "}
            — not yet pinned:{" "}
            {liveLayer.unmapped.map((u) => `${u.city} (${u.count})`).join(", ")}
          </p>
        )}
        {visitLayer.unmapped.length > 0 && (
          <p className="text-xs text-ink-3">
            <span className="font-mono uppercase tracking-[0.1em]">
              Frequently visits
            </span>{" "}
            — not yet pinned:{" "}
            {visitLayer.unmapped
              .map((u) => `${u.city} (${u.count})`)
              .join(", ")}
          </p>
        )}
      </section>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <NavTile
          num="03"
          label="Aggregate"
          href="/stats"
          title="Stats"
          description="Top cities, industries, and activities across the cohort."
        />
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
}: {
  num: string;
  label: string;
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col rounded-md border border-line bg-paper px-5 py-4 transition hover:border-brand-400"
    >
      <span className="absolute right-4 top-3 font-mono text-[0.6rem] tracking-wider text-ink-3">
        {num}
      </span>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-brand-700">
        {label}
      </span>
      <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="text-sm text-ink-2">{description}</p>
    </Link>
  );
}
