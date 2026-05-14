export function PageHeader({
  eyebrow,
  title,
  sub,
  count,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  count?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-line pb-5">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-brand-700">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="text-sm text-ink-2">{sub}</p>}
      </div>
      {count && (
        <span className="font-mono text-xs tracking-wider text-ink-3">{count}</span>
      )}
    </header>
  );
}
