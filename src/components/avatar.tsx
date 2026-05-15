import { OCEAN_FLAG } from "@/lib/oceans";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; text: string; notch: string }> = {
  sm: { box: "h-8 w-8", text: "text-xs", notch: "h-3 w-3 -bottom-0.5 -right-0.5" },
  md: { box: "h-10 w-10", text: "text-sm", notch: "h-3.5 w-3.5 -bottom-1 -right-1" },
  lg: { box: "h-14 w-14", text: "text-lg", notch: "h-4 w-4 -bottom-1 -right-1" },
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
  const flagSrc = ocean ? OCEAN_FLAG[ocean] : undefined;
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
      {flagSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flagSrc}
          alt=""
          aria-hidden="true"
          className={`absolute ${s.notch} rounded-[2px] object-cover ring-2 ring-paper`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`absolute ${s.notch} rounded-sm bg-brand-500 ring-2 ring-paper`}
        />
      )}
    </div>
  );
}
