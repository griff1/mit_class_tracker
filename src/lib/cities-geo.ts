/**
 * Approximate lat/lng for the seed cities in `CITIES` (lib/types.ts). User-
 * added cities won't appear in this map; the map page surfaces those counts
 * in a separate disclosure rather than placing them at the wrong location.
 *
 * Keys are case-folded to match the canonical-dedup pattern used elsewhere.
 * Look up with `CITY_COORDS[city.toLowerCase()]`.
 */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "atlanta, ga": { lat: 33.749, lng: -84.388 },
  "austin, tx": { lat: 30.2672, lng: -97.7431 },
  "bangalore, india": { lat: 12.9716, lng: 77.5946 },
  "beijing, china": { lat: 39.9042, lng: 116.4074 },
  "berlin, germany": { lat: 52.52, lng: 13.405 },
  "boston, ma": { lat: 42.3601, lng: -71.0589 },
  "chicago, il": { lat: 41.8781, lng: -87.6298 },
  "dubai, uae": { lat: 25.2048, lng: 55.2708 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  "london, uk": { lat: 51.5074, lng: -0.1278 },
  "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
  "mexico city, mexico": { lat: 19.4326, lng: -99.1332 },
  "miami, fl": { lat: 25.7617, lng: -80.1918 },
  "mumbai, india": { lat: 19.076, lng: 72.8777 },
  "new york, ny": { lat: 40.7128, lng: -74.006 },
  "paris, france": { lat: 48.8566, lng: 2.3522 },
  "san francisco, ca": { lat: 37.7749, lng: -122.4194 },
  "são paulo, brazil": { lat: -23.5505, lng: -46.6333 },
  "seattle, wa": { lat: 47.6062, lng: -122.3321 },
  "seoul, south korea": { lat: 37.5665, lng: 126.978 },
  "shanghai, china": { lat: 31.2304, lng: 121.4737 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  "sydney, australia": { lat: -33.8688, lng: 151.2093 },
  "tokyo, japan": { lat: 35.6762, lng: 139.6503 },
  "toronto, canada": { lat: 43.6532, lng: -79.3832 },
  "washington, dc": { lat: 38.9072, lng: -77.0369 },
};
