import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
const { principalOf, verifyBearer, verifyMcpToken } = await import("./auth");
const { supabaseIssuer } = await import("./config");

/**
 * The MCP server trusts only ES256 tokens signed by Supabase Auth that carry
 * a `client_id` (issued to an OAuth client). A browser session token of the
 * same user, an expired token or a token from another issuer must be rejected.
 */
const issuer = supabaseIssuer();
const keys = await generateKeyPair("ES256", { extractable: true });
const other = await generateKeyPair("ES256", { extractable: true });
const jwk = { ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "ES256", use: "sig" };

const server = setupServer(http.get(`${issuer}/.well-known/jwks.json`, () => HttpResponse.json({ keys: [jwk] })));
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function sign(claims: Record<string, unknown>, opts: { key?: CryptoKey; issuer?: string; expiresIn?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setIssuer(opts.issuer ?? issuer)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(opts.key ?? keys.privateKey);
}

describe("verifyMcpToken", () => {
  it("accepts an OAuth client token and reads the user, client and scopes", async () => {
    const token = await sign({ sub: "user-1", client_id: "client-abc", email: "ada@acme.com", scope: "email profile", aud: "authenticated" });
    const claims = await verifyMcpToken(token);
    expect(claims).toMatchObject({ userId: "user-1", clientId: "client-abc", email: "ada@acme.com", scopes: ["email", "profile"] });
    expect(claims?.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects a plain session token (no client_id), so a leaked cookie cannot drive the server", async () => {
    expect(await verifyMcpToken(await sign({ sub: "user-1", aud: "authenticated" }))).toBeNull();
  });

  it("rejects expired tokens, foreign issuers, wrong keys and garbage", async () => {
    expect(await verifyMcpToken(await sign({ sub: "u", client_id: "c" }, { expiresIn: "-1m" }))).toBeNull();
    expect(await verifyMcpToken(await sign({ sub: "u", client_id: "c" }, { issuer: "https://evil.example/auth/v1" }))).toBeNull();
    expect(await verifyMcpToken(await sign({ sub: "u", client_id: "c" }, { key: other.privateKey }))).toBeNull();
    expect(await verifyMcpToken("not-a-jwt")).toBeNull();
    expect(await verifyMcpToken("")).toBeNull();
  });
});

describe("verifyBearer and principalOf", () => {
  it("maps a valid token to AuthInfo and back to a principal", async () => {
    const token = await sign({ sub: "user-2", client_id: "client-xyz" });
    const info = await verifyBearer(new Request("https://app.test/mcp"), token);
    expect(info?.clientId).toBe("client-xyz");
    expect(principalOf(info)).toEqual({ userId: "user-2", clientId: "client-xyz" });
  });

  it("returns undefined without a token, and no principal without auth info", async () => {
    expect(await verifyBearer(new Request("https://app.test/mcp"))).toBeUndefined();
    expect(principalOf(undefined)).toBeNull();
    expect(principalOf({ token: "t", clientId: "c", scopes: [] })).toBeNull();
  });
});
