import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry (plan § Observability). No DSN → no-op, so local dev
 * and preview builds without the env var stay silent.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
