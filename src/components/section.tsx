export function Section({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  const indexStr = index.toString().padStart(2, "0");
  return (
    <section className="rounded-md border border-line bg-paper">
      <header className="flex items-baseline justify-between border-b border-dashed border-line-2 px-5 py-3">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-brand-700">
          {label}
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.05em] text-ink-3">
          section {indexStr}
        </span>
      </header>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}
