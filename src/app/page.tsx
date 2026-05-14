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
    .select("cities");

  const cities = new Set(
    (cityRows ?? []).flatMap((r) => (r.cities as string[] | null) ?? []),
  ).size;

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
