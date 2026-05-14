import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CITY_COORDS } from "@/lib/cities-geo";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ClassMap, type MapAggregate } from "@/components/class-map";

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle<{ name: string | null }>();

  const { data: rows } = await supabase.from("profiles").select("cities");

  // Count members per city across all profile.cities arrays.
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const cities = (r.cities as string[] | null) ?? [];
    for (const city of cities) {
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
  }

  const aggregates: MapAggregate[] = [];
  const unmapped: { city: string; count: number }[] = [];
  for (const [city, count] of counts.entries()) {
    const coords = CITY_COORDS[city.toLowerCase()];
    if (coords) {
      aggregates.push({ city, count, ...coords });
    } else {
      unmapped.push({ city, count });
    }
  }
  unmapped.sort((a, b) => b.count - a.count);
  const unmappedTotal = unmapped.reduce((acc, u) => acc + u.count, 0);

  const subParts = [
    `${aggregates.length} ${aggregates.length === 1 ? "city" : "cities"} pinned`,
  ];
  if (unmappedTotal > 0) {
    subParts.push(
      `${unmappedTotal} ${unmappedTotal === 1 ? "person" : "people"} elsewhere`,
    );
  }

  return (
    <AppShell active="map" user={{ name: me?.name ?? null, email: user.email! }}>
      <PageHeader
        eyebrow="Class of 2026"
        title="Where everyone is"
        sub={subParts.join(" · ")}
      />

      <div className="overflow-hidden rounded-md border border-line bg-paper">
        <ClassMap aggregates={aggregates} />
      </div>

      {unmapped.length > 0 && (
        <details className="rounded-md border border-line bg-paper px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink">
            {unmappedTotal} {unmappedTotal === 1 ? "person" : "people"} in{" "}
            {unmapped.length} {unmapped.length === 1 ? "city" : "cities"} not
            yet pinned
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {unmapped.map((u) => (
              <li
                key={u.city}
                className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.1em] lowercase text-ink-2"
              >
                {u.city} · {u.count}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">
            These are user-added cities whose coordinates aren&apos;t in{" "}
            <code className="font-mono">lib/cities-geo.ts</code>. Add them
            there to put them on the map.
          </p>
        </details>
      )}
    </AppShell>
  );
}
