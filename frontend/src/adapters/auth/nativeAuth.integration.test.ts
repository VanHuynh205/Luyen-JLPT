import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { db } from "../local-store/db";
import { getAuthRedirectUrl, parseAuthCallback } from "./nativeAuth";

const native = vi.hoisted(() => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: native.openUrl }));

const origin = "https://jlpt-fixture.test";
const user = {
  id: "523176f0-df04-4cd6-9e4c-e9cd575fa88d",
  email: "learner@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: "2026-11-22T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
};

afterEach(async () => {
  await db.delete();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function makeCallback(redirect: string, code: string) {
  const url = new URL(redirect);
  url.searchParams.set("code", code);
  const callback = parseAuthCallback(url.href);
  if (!callback?.code) throw new Error("Invalid native PKCE callback fixture");
  return callback;
}

it("exchanges simultaneous Google, confirmation and recovery flows with each original Dexie verifier", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", origin);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
  const location = new URL("https://tauri.localhost/#/tai-khoan");
  vi.stubGlobal("window", { location });

  const redirects = new Map<string, string>();
  const challenges = new Map<string, string>();
  const exchanges: string[] = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      expect(url.origin).toBe(origin);
      expect(request.method).toBe("POST");
      const payload = await request.json();
      if (
        url.pathname === "/auth/v1/signup" ||
        url.pathname === "/auth/v1/recover"
      ) {
        const flow = url.pathname.endsWith("signup")
          ? "confirmation"
          : "recovery";
        expect(payload.code_challenge_method).toBe("s256");
        redirects.set(flow, url.searchParams.get("redirect_to") ?? "");
        challenges.set(flow, payload.code_challenge);
        return Response.json(flow === "confirmation" ? { user } : {});
      }
      if (
        url.pathname === "/auth/v1/token" &&
        url.searchParams.get("grant_type") === "pkce"
      ) {
        const { auth_code: code, code_verifier: verifier } = payload;
        expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
          challenges.get(code),
        );
        exchanges.push(code);
        return Response.json({
          access_token: "test-only-access-token",
          refresh_token: "test-only-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user,
        });
      }
      throw new Error(`Unexpected fixture request: ${url.pathname}`);
    },
  );

  const { supabase, completeNativeSignIn, signInWithGoogle } = await import(
    "./client"
  );
  if (!supabase) throw new Error("Supabase fixture was not initialized");
  const events: string[] = [];
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session) events.push(event);
  });
  try {
    await signInWithGoogle();
    const [authorizeUrl] = native.openUrl.mock.calls[0] ?? [];
    const authorize = new URL(authorizeUrl);
    expect(authorize.origin).toBe(origin);
    expect(authorize.pathname).toBe("/auth/v1/authorize");
    expect(authorize.searchParams.get("provider")).toBe("google");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
    redirects.set("google", authorize.searchParams.get("redirect_to") ?? "");
    challenges.set(
      "google",
      authorize.searchParams.get("code_challenge") ?? "",
    );

    const redirectTo = getAuthRedirectUrl(location.origin);
    const signup = await supabase.auth.signUp({
      email: user.email,
      password: crypto.randomUUID(),
      options: {
        data: { username: "learner_fixture" },
        emailRedirectTo: redirectTo,
      },
    });
    expect(signup.error).toBeNull();
    expect(signup.data.session).toBeNull();
    const recovery = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });
    expect(recovery.error).toBeNull();

    const callbacks = ["confirmation", "recovery", "google"].map((flow) =>
      makeCallback(redirects.get(flow) ?? "", flow),
    );
    expect(new Set(callbacks.map(({ flowId }) => flowId)).size).toBe(3);
    await expect(
      completeNativeSignIn("google", "unknown_flow_id"),
    ).rejects.toThrow();
    expect(exchanges).toEqual([]);

    for (const { code, flowId } of callbacks) {
      await completeNativeSignIn(code, flowId);
    }
    expect(exchanges).toEqual(["confirmation", "recovery", "google"]);
    expect(events).toEqual(["SIGNED_IN", "PASSWORD_RECOVERY", "SIGNED_IN"]);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    expect(session?.user.id).toBe(user.id);

    const { code, flowId } = callbacks[0];
    await expect(completeNativeSignIn(code, flowId)).rejects.toThrow();
    expect(exchanges).toHaveLength(3);
  } finally {
    subscription.unsubscribe();
    await supabase.auth.stopAutoRefresh();
  }
});
