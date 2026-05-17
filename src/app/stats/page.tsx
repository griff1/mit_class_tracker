import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { OCEANS, type Profile } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

type Row = Pick<
  Profile,
  "cities" | "visiting_cities" | "industries" | "roles" | "activities" | "ocean"
>;

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const viewer = await getViewer(supabase, user);

  const { data: rows } = await supabase
    .from("profiles")
    .select("cities, visiting_cities, industries, roles, activities, ocean")
    .returns<Row[]>();

  const total = (rows ?? []).length;
  const cityCounts = aggregateArray(rows, "cities");
  const visitingCounts = aggregateArray(rows, "visiting_cities");
  const industryCounts = aggregateArray(rows, "industries");
  const roleCounts = aggregateArray(rows, "roles");
  const activityCounts = aggregateArray(rows, "activities");
  const oceanCounts = aggregateScalar(rows, "ocean");

  return (
    <AppShell active="stats" user={viewer}>
      <PageHeader
        eyebrow="Class of 2026"
        title="By the numbers"
        sub={`${total} ${total === 1 ? "classmate has" : "classmates have"} a profile.`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatBlock title="Top cities" rows={cityCounts.slice(0, 10)} total={total} />
        <StatBlock title="Top frequently-in cities" rows={visitingCounts.slice(0, 10)} total={total} />
        <StatBlock title="Top industries" rows={industryCounts.slice(0, 10)} total={total} />
        <StatBlock title="Top roles" rows={roleCounts.slice(0, 10)} total={total} />
        <StatBlock title="Top activities" rows={activityCounts.slice(0, 10)} total={total} />
        <StatBlock
          title="Oceans"
          rows={oceanCounts}
          total={total}
          ordered={OCEANS}
        />
      </div>
    </AppShell>
  );
}

function aggregateArray(
  rows: Row[] | null,
  key: "cities" | "visiting_cities" | "industries" | "roles" | "activities",
) {
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    for (const v of r[key] ?? []) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function aggregateScalar(rows: Row[] | null, key: "ocean") {
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const v = r[key];
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function StatBlock({
  title,
  rows,
  total,
  ordered,
}: {
  title: string;
  rows: { label: string; count: number }[];
  total: number;
  ordered?: readonly string[];
}) {
  // If `ordered` is supplied, force that order and include zero-count entries
  // (so all 6 oceans show up even when only some have members).
  const display = ordered
    ? ordered.map((label) => {
        const found = rows.find((r) => r.label === label);
        return { label, count: found?.count ?? 0 };
      })
    : rows;

  const max = Math.max(1, ...display.map((r) => r.count));

  return (
    <section className="rounded-md border border-line bg-paper p-4">
      <h2 className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-brand-700">
        {title}
      </h2>
      {display.length === 0 ? (
        <p className="text-sm text-ink-3">No data yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {display.map((r) => {
            const widthPct = (r.count / max) * 100;
            const sharePct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <li key={r.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{r.label}</span>
                  <span className="flex-none font-mono text-xs text-ink-3">
                    {r.count} · {sharePct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
