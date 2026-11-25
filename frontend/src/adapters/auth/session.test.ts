import "fake-indexeddb/auto";
import type { Session } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { authSessionReducer, isSessionReady, pendingSession } from "./session";

const account = (id: string) => ({ user: { id } }) as Session;
const old = account("old-account");
const restored = { type: "INITIAL_SESSION", session: old } as const;
const rejected = { type: "callback", failed: true } as const;

it("waits for both callback and restored session, in either SDK order", () => {
  for (const [first, second] of [
    [restored, rejected],
    [rejected, restored],
  ] as const) {
    const pending = authSessionReducer(pendingSession, first);
    expect(isSessionReady(pending)).toBe(false);
    const ready = authSessionReducer(pending, second);
    expect(isSessionReady(ready)).toBe(true);
    expect(ready.session).toBe(old);
    expect(ready.callbackFailed).toBe(true);
    expect(ready.recovering).toBe(false);
  }
});

it("keeps recovery through same-owner events but not an account switch", () => {
  let state = authSessionReducer(pendingSession, {
    type: "PASSWORD_RECOVERY",
    session: old,
  });
  for (const type of [
    "INITIAL_SESSION",
    "SIGNED_IN",
    "TOKEN_REFRESHED",
  ] as const) {
    state = authSessionReducer(state, { type, session: old });
    expect(state.recovering).toBe(true);
  }
  state = authSessionReducer(state, {
    type: "SIGNED_IN",
    session: account("other"),
  });
  expect(state.recovering).toBe(false);
  expect(
    authSessionReducer(state, { type: "SIGNED_IN", session: old }).recovering,
  ).toBe(false);
});

it.each([false, true])(
  "restores the prior account or accepts recovery according to its SDK verifier (valid=%s)",
  async (valid) => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://local-fixture.test");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fixture-public");
    const location = new URL("https://app.test/tai-khoan?code=fixture&keep=1");
    vi.stubGlobal("window", {
      location,
      history: {
        replaceState: (_state: unknown, _title: string, href: string) => {
          location.href = href;
        },
      },
    });
    const restored = {
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "existing-owner",
        email: "old@example.test",
        created_at: "2023-01-01T00:00:00Z",
        user_metadata: {},
      },
    };
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        expect(request.url).toBe(
          "https://local-fixture.test/auth/v1/token?grant_type=pkce",
        );
        expect(await request.json()).toMatchObject({
          auth_code: "fixture",
          code_verifier: "fixture-verifier",
        });
        return Response.json({
          ...restored,
          user: { ...restored.user, id: "recovered-owner" },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    const { db } = await import("../local-store/db");
    const key = "auth:sb-local-fixture-auth-token";
    await db.settings.put({ key, value: JSON.stringify(restored) });
    if (valid)
      await db.settings.put({
        key: `${key}-code-verifier`,
        value: JSON.stringify("fixture-verifier/recovery"),
      });
    const { completeWebAuthCallback, supabase } = await import("./client");
    if (!supabase) throw new Error("Missing local SDK fixture");
    let state = pendingSession;
    const events = supabase.auth.onAuthStateChange((type, session) => {
      state = authSessionReducer(state, { type, session });
    });
    try {
      const [failed, repeated] = await Promise.all([
        completeWebAuthCallback(),
        completeWebAuthCallback(),
      ]);
      expect(repeated).toBe(failed);
      state = authSessionReducer(state, { type: "callback", failed });
      await vi.waitFor(() => expect(isSessionReady(state)).toBe(true));
      expect(state.callbackFailed).toBe(!valid);
      expect(state.recovering).toBe(valid);
      expect(state.session?.user.id).toBe(
        valid ? "recovered-owner" : "existing-owner",
      );
      expect(location.href).toBe("https://app.test/tai-khoan?keep=1");
      expect(fetch).toHaveBeenCalledTimes(valid ? 1 : 0);
    } finally {
      events.data.subscription.unsubscribe();
      await supabase.auth.stopAutoRefresh();
      await db.delete();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  },
);
