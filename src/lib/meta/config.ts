/**
 * Meta (Facebook) Pixel + Conversions API configuration. Everything is
 * optional: without `NEXT_PUBLIC_META_PIXEL_ID` the pixel is not rendered and
 * without `META_CAPI_ACCESS_TOKEN` no server event is sent, so a deployment
 * that lacks the keys behaves exactly as before.
 */

/** Pixel (dataset) id; public because the browser pixel needs it. */
export function metaPixelId(): string | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id ? id : null;
}

/** Conversions API system-user token (server only). */
export function metaAccessToken(): string | null {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  return token ? token : null;
}

/** Test event code from Events Manager › Test events; set on Preview/local only. */
export function metaTestEventCode(): string | null {
  const code = process.env.META_TEST_EVENT_CODE?.trim();
  return code ? code : null;
}

/** Graph API version the server events are posted to. */
export const META_GRAPH_VERSION = "v22.0";
