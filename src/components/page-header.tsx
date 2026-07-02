export function PageHeader({
  eyebrow,
  title,
  sub,
  count,
  badge,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  count?: string;
  /** Optional small pill next to the title, e.g. "Beta". */
  badge?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-line pb-5">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          {eyebrow}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {badge && (
            <span className="rounded-sm border border-brand-200 bg-brand-50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-brand-700">
              {badge}
            </span>
          )}
        </div>
        {sub && <p className="text-sm text-ink-2">{sub}</p>}
      </div>
      {count && (
        <span className="font-mono text-xs tracking-wider text-ink-3">{count}</span>
      )}
    </header>
  );
}
