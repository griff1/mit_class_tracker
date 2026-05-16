import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { CITY_COORDS } from "@/lib/cities-geo";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ClassMap, type MapAggregate } from "@/components/class-map";

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
            <code className="font-mono">@mit.edu</code> or{" "}
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
    .select("cities");

  const cities = new Set(
    (cityRows ?? []).flatMap((r) => (r.cities as string[] | null) ?? []),
  ).size;

  const cityCounts = new Map<string, number>();
  for (const r of cityRows ?? []) {
    for (const c of (r.cities as string[] | null) ?? []) {
      cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
    }
  }
  const mapped: MapAggregate[] = [];
  const unmapped: { city: string; count: number }[] = [];
  for (const [city, count] of cityCounts.entries()) {
    const coords = CITY_COORDS[city.toLowerCase()];
    if (coords) {
      mapped.push({ city, count, ...coords });
    } else {
      unmapped.push({ city, count });
    }
  }
  unmapped.sort((a, b) => b.count - a.count);
  const unmappedTotal = unmapped.reduce((acc, u) => acc + u.count, 0);

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
          <ClassMap aggregates={mapped} />
        </div>
        {unmapped.length > 0 && (
          <p className="text-xs text-ink-3">
            {unmappedTotal} {unmappedTotal === 1 ? "person" : "people"} in{" "}
            {unmapped.length} {unmapped.length === 1 ? "city" : "cities"} not
            yet pinned —{" "}
            {unmapped.map((u) => `${u.city} (${u.count})`).join(", ")}
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
