import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Phone-camera JPEGs routinely run 3–4MB. The default 1MB cap rejects
      // those silently during profile photo upload.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
