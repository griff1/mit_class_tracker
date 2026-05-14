import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const FIELD_CLASSES =
  "w-full rounded border border-line bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${FIELD_CLASSES} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}
