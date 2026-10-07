import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: allow the Cloudflare quick tunnel (M6) to load dev assets/HMR.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
