/**
 * Nominatim (OpenStreetMap) geocoder for free-text city strings the cohort
 * writes on their profile. Used by the post-response background task in
 * `updateProfile` to populate `public.city_coords` so the home map can pin
 * any new city without a code edit.
 *
 * Nominatim's usage policy requires a meaningful User-Agent identifying the
 * project + contact, and rate limits to 1 request/sec. The caller is
 * responsible for the 1s gap between requests (we serialize inside
 * `after()`); this module just makes the single call.
 *
 * Result is a discriminated union so the caller can distinguish:
 *   - ok:    write coords to the cache
 *   - miss:  geocoder definitively returned nothing (typo, ambiguous,
 *            uncovered place) -> write null lat/lng as a negative cache
 *   - transient: network error, 5xx, 429, etc. -> DON'T write the cache;
 *                next save retries naturally
 */

const NOMINATIM_USER_AGENT =
  "Sloanopedia/1.0 (https://sloanopedia.com; mailto:griff.potrock@gmail.com)";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: "miss" | "transient" };

export async function geocodeCity(city: string): Promise<GeocodeResult> {
  const trimmed = city.trim();
  if (!trimmed) return { ok: false, reason: "miss" };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    trimmed,
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, reason: "transient" };
    }
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, reason: "miss" };
    }
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: "miss" };
    }
    return { ok: true, lat, lng };
  } catch {
    return { ok: false, reason: "transient" };
  }
}
