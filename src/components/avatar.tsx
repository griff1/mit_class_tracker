import Image from "next/image";
import { OCEAN_FLAG } from "@/lib/oceans";

type Size = "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { box: string; text: string; notch: string; px: string }
> = {
  sm: { box: "h-8 w-8", text: "text-xs", notch: "h-3 w-3 -bottom-0.5 -right-0.5", px: "32px" },
  md: { box: "h-10 w-10", text: "text-sm", notch: "h-3.5 w-3.5 -bottom-1 -right-1", px: "40px" },
  lg: { box: "h-14 w-14", text: "text-lg", notch: "h-4 w-4 -bottom-1 -right-1", px: "56px" },
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
        // `unoptimized`: the source is the auth-gated /avatar proxy, already
        // sized + WebP-encoded at upload. The Vercel image optimizer fetches
        // sources server-side without the user's cookies and would 401, so we
        // skip it and let the browser fetch the proxy directly. next/image
        // still gives us lazy-loading (default) and no layout shift.
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={s.px}
          unoptimized
          className="rounded-md object-cover"
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
