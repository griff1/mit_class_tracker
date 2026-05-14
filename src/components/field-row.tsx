export function FieldRow({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-4 border-t border-line py-3 first:border-t-0">
      <span className="pt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className="flex flex-col gap-1">
        {children}
        {help && <span className="text-xs text-ink-3">{help}</span>}
      </div>
    </div>
  );
}

export function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-2 font-mono text-sm text-ink-2">{children}</div>
  );
}
