// Per-ocean flag image (public/oceans/*.jpg) and accent colors. Single source
// of truth for anything ocean-visual. Keys match the OCEANS values in
// lib/types.ts exactly.

export const OCEAN_FLAG: Record<string, string> = {
  Atlantic: "/oceans/atlantic.jpg",
  Baltic: "/oceans/baltic.jpg",
  Caribbean: "/oceans/caribbean.jpg",
  Indian: "/oceans/indian.jpg",
  Mediterranean: "/oceans/mediterranean.jpg",
  Pacific: "/oceans/pacific.jpg",
};

// `text` for inline text accents, `bg` for fills (e.g. stats bars). Tailwind
// defaults — no custom tokens. Values chosen to read on the warm cream/paper
// background while staying recognizably "the ocean's color".
export const OCEAN_COLOR: Record<string, { text: string; bg: string }> = {
  Pacific: { text: "text-blue-700", bg: "bg-blue-600" },
  Mediterranean: { text: "text-green-700", bg: "bg-green-600" },
  Atlantic: { text: "text-sky-600", bg: "bg-sky-500" },
  Indian: { text: "text-yellow-600", bg: "bg-yellow-400" },
  Caribbean: { text: "text-orange-600", bg: "bg-orange-500" },
  Baltic: { text: "text-purple-700", bg: "bg-purple-600" },
};
