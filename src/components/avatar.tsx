type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; text: string; notch: string }> = {
  sm: { box: "h-8 w-8", text: "text-xs", notch: "h-2 w-2 -bottom-0.5 -right-0.5" },
  md: { box: "h-10 w-10", text: "text-sm", notch: "h-2.5 w-2.5 -bottom-0.5 -right-0.5" },
  lg: { box: "h-14 w-14", text: "text-lg", notch: "h-3 w-3 -bottom-1 -right-1" },
};

// Ocean → notch color. Tailwind defaults, no new tokens. Update freely; the
// values just need to be valid `bg-*` classes that Tailwind's content scanner
// picks up from this file.
const OCEAN_NOTCH: Record<string, string> = {
  Atlantic: "bg-indigo-700",
  Baltic: "bg-violet-600",
  Caribbean: "bg-teal-600",
  Indian: "bg-amber-600",
  Mediterranean: "bg-emerald-600",
  Pacific: "bg-sky-600",
};

export function Avatar({
  name,
  size = "md",
  photoUrl,
  ocean,
}: {
  name: string;
  size?: Size;
  photoUrl?: string | null;
  ocean?: string | null;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const s = SIZES[size];
  const notchClass = (ocean && OCEAN_NOTCH[ocean]) ?? "bg-brand-500";
  return (
    <div
      aria-hidden="true"
      className={`relative ${s.box} flex flex-none items-center justify-center rounded-md bg-ink ${s.text} font-semibold tracking-tight text-cream`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full rounded-md object-cover"
        />
      ) : (
        initial
      )}
      <span
        aria-hidden="true"
        className={`absolute ${s.notch} rounded-sm ${notchClass}`}
      />
    </div>
  );
}
