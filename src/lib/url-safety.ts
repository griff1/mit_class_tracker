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

/**
 * Server-side basic email format check. Forgiving (no RFC 5322), but enforces
 * `localpart@domain.tld` shape so we don't store obviously malformed values.
 * Lowercases on the way out so comparisons elsewhere don't need to re-case.
 * Returns null if the input doesn't look like an email.
 */
export function safeEmail(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/**
 * Same as `safeHttpUrl`, with an additional hostname constraint: the URL
 * must be `linkedin.com` or a subdomain of it (e.g. `www.linkedin.com`,
 * `uk.linkedin.com`). The check rejects look-alike domains like
 * `evilinkedin.com` by requiring the host to be `linkedin.com` exactly or
 * end in `.linkedin.com`.
 */
export function safeLinkedInUrl(v: string | null | undefined): string | null {
  const normalized = safeHttpUrl(v);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}
