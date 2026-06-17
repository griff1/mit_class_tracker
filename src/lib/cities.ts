/**
 * Shared city-canonicalization helpers, used at write time (`resolveCanonical`
 * in profile/actions.ts) and in the profile city typeahead.
 *
 * Two recurring failure modes motivated this:
 *  - Accent variants: "Sao Paulo" vs "São Paulo, Brazil" were stored as two
 *    distinct cities because the dedup key was a plain lowercase compare, which
 *    is accent-sensitive ("são" ≠ "sao").
 *  - Bare names: "Cambridge" / "Boston" / "Sao Paulo" lack the disambiguating
 *    state/country suffix, so they neither dedup against the canonical seed nor
 *    geocode correctly (Nominatim sends bare "Cambridge" to Cambridge, England).
 *
 * `canonKey` strips diacritics + case + redundant whitespace so accent/case
 * variants collapse to one key. `CITY_ALIASES` maps known bare/variant forms
 * onto the canonical seed string, so they converge on a single entry — which
 * then also geocodes correctly and groups on the map.
 */

/** Accent-, case-, and whitespace-insensitive comparison key. */
export function canonKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Known variant → canonical-display mappings for cities. Keys MUST be written
 * as `canonKey(variant)` (already accent-stripped, lowercased); values are the
 * exact canonical string we want stored (matching the CITIES seed entry).
 * Extend as new bare-name collisions surface.
 */
export const CITY_ALIASES: Record<string, string> = {
  // Greater Boston — bare forms that also fix the Cambridge-England geocode.
  boston: "Boston, MA",
  cambridge: "Cambridge, MA",
  "cambridge ma": "Cambridge, MA",
  "cambridge, ma": "Cambridge, MA",
  "cambridge, massachusetts": "Cambridge, MA",
  // São Paulo — accent/no-accent, with/without ", Brazil"/", Brasil", and the
  // common "Paolo" misspelling. (Keys are accent-stripped per canonKey.)
  "sao paulo": "São Paulo, Brazil",
  "sao paulo, brazil": "São Paulo, Brazil",
  "sao paulo, brasil": "São Paulo, Brazil",
  "sao paolo": "São Paulo, Brazil",
  "sao paolo, brazil": "São Paulo, Brazil",
  "sao paolo, brasil": "São Paulo, Brazil",
};

/**
 * Resolve a raw city string to its canonical display: an explicit alias wins,
 * otherwise the value is returned unchanged (callers layer their own cohort/seed
 * canonical map on top via canonKey).
 */
export function aliasCity(raw: string): string | undefined {
  return CITY_ALIASES[canonKey(raw)];
}
