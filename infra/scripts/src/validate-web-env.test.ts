import { describe, expect, it } from "vitest";
import { validateWebEnv } from "./validate-web-env.mjs";

function makeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("validateWebEnv", () => {
  it("accepts valid https supabase url and sb_publishable key", () => {
    expect(
      validateWebEnv({
        VITE_SUPABASE_URL: " https://abcdefghijklmnopqrst.supabase.co/ ",
        VITE_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_valid_key_123 ",
      }),
    ).toEqual({
      url: "https://abcdefghijklmnopqrst.supabase.co",
      key: "sb_publishable_valid_key_123",
    });
  });

  it("accepts anon JWT and local loopback http urls for local testing", () => {
    const anonJwt = makeJwt({ role: "anon" });
    expect(
      validateWebEnv({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: anonJwt,
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      key: anonJwt,
    });
    expect(
      validateWebEnv({
        VITE_SUPABASE_URL: "http://localhost:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test",
      }).url,
    ).toBe("http://localhost:54321");
  });

  it("rejects missing, non-https remote, path-bearing, or credentialed urls", () => {
    const key = "sb_publishable_valid_key_123";
    for (const badUrl of [
      undefined,
      "",
      "   ",
      "not-a-url",
      "http://abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co/rest/v1",
      "https://user:pass@abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co?foo=bar",
      "https://abcdefghijklmnopqrst.supabase.co#hash",
    ]) {
      expect(() =>
        validateWebEnv({
          VITE_SUPABASE_URL: badUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow(/VITE_SUPABASE_URL/i);
    }
  });

  it("rejects missing publishable key, sb_secret, or service_role JWT", () => {
    const url = "https://abcdefghijklmnopqrst.supabase.co";
    const serviceJwt = makeJwt({ role: "service_role" });
    const authJwt = makeJwt({ role: "authenticated" });
    for (const badKey of [
      undefined,
      "",
      "sb_secret_not_allowed",
      "plain-random-key",
      serviceJwt,
      authJwt,
      "a.not-json.c",
    ]) {
      expect(() =>
        validateWebEnv({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: badKey,
        }),
      ).toThrow(/publishable|anon/i);
    }
  });
});
