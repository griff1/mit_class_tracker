export function Chip({
  name,
  value,
  defaultChecked,
  label,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className="inline-block select-none rounded-sm border border-line px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-2 transition lowercase peer-hover:border-brand-300 peer-checked:border-brand-100 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-200"
      >
        {label ?? value}
      </span>
    </label>
  );
}
