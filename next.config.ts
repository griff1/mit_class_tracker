import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Block framing — prevents clickjacking of the authed UI.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let browsers guess the MIME type of responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Strip full URLs from cross-origin Referer headers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No camera / mic / geolocation — we don't ask for them, so deny.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Phone-camera JPEGs routinely run 3–4MB. The default 1MB cap rejects
      // those silently during profile photo upload.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // Sign-up and sign-in collapsed under magic-link auth — same form
      // handles both flows. Preserve the old URL for any existing bookmarks.
      { source: "/sign-up", destination: "/sign-in", permanent: true },
      // /map embedded into the home page. Preserve the old URL.
      { source: "/map", destination: "/", permanent: true },
      // The Jobs tab is labeled "Opportunities" in the UI, but the route
      // stays /jobs (all sent email links, /api/jobs/*, and the cron point
      // there). Let the label-matching URL resolve too. Non-permanent so we
      // keep the freedom to flip canonical later.
      { source: "/opportunities", destination: "/jobs", permanent: false },
    ];
  },
};

export default nextConfig;
