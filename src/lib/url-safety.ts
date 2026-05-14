/**
 * Normalizes a user-supplied URL and rejects anything that isn't `http:` or
 * `https:`. Used on save (`linkedin_url`) and on render (defense in depth).
 *
 * Scheme-less input like "linkedin.com/in/jane" is coerced to https. A
 * malicious "javascript:..." or "data:..." input returns null because the
 * resulting URL either has the wrong protocol or fails to parse.
 *
 * Returns the normalized URL string, or null if the input can't be parsed
 * as a safe http(s) URL.
 */
export function safeHttpUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
