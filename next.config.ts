import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: allow the Cloudflare quick tunnel (M6) to load dev assets/HMR.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

// Sentry runtime init lives in src/instrumentation.ts / instrumentation-client.ts.
// Source-map upload (withSentryConfig) is deliberately not wired: add it on
// day 7 together with SENTRY_AUTH_TOKEN if symbolicated stack traces are needed.
export default nextConfig;
