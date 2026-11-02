import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { supabaseIssuer } from "./config";

/**
 * Bearer tokens on /mcp are access tokens issued by Supabase Auth's OAuth
 * 2.1 server to an AI assistant (ES256, public JWKS). Only tokens that carry a
 * `client_id` are accepted: a user's own browser session token never is, so a
 * leaked cookie cannot drive the MCP server and every call is attributable to
 * one connected assistant.
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function keySet() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${supabaseIssuer()}/.well-known/jwks.json`), { cooldownDuration: 30_000, cacheMaxAge: 600_000 });
  return jwks;
}

export interface McpTokenClaims {
  userId: string;
  clientId: string;
  email: string | null;
  expiresAt: number | undefined;
  scopes: string[];
}

/** Verified claims, or null for anything that is not a valid assistant token. */
export async function verifyMcpToken(token: string): Promise<McpTokenClaims | null> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keySet(), { issuer: supabaseIssuer(), algorithms: ["ES256"] }));
  } catch {
    return null;
  }
  const clientId = typeof payload.client_id === "string" ? payload.client_id : null;
  if (!payload.sub || !clientId) return null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  return {
    userId: payload.sub,
    clientId,
    email: typeof payload.email === "string" ? payload.email : null,
    expiresAt: payload.exp,
    scopes: scope.split(" ").filter(Boolean),
  };
}

/** `withMcpAuth` callback: AuthInfo for a valid assistant token, undefined otherwise (→ 401 challenge). */
export async function verifyBearer(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const claims = await verifyMcpToken(bearerToken);
  if (!claims) return undefined;
  return {
    token: bearerToken,
    clientId: claims.clientId,
    scopes: claims.scopes,
    expiresAt: claims.expiresAt,
    extra: { userId: claims.userId, email: claims.email },
  };
}

/** The user and client behind a verified request (set by `verifyBearer`). */
export function principalOf(authInfo: AuthInfo | undefined): { userId: string; clientId: string } | null {
  const userId = authInfo?.extra?.userId;
  if (!authInfo || typeof userId !== "string") return null;
  return { userId, clientId: authInfo.clientId };
}
