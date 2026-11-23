import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    setSession: vi.fn(),
    getSession: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  },
  functions: { invoke: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => sdk }));
const native = vi.hoisted(() => ({ isTauri: vi.fn(), openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: native.isTauri }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: native.openUrl }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  vi.stubGlobal("window", { location: { origin: "https://jlpt.test" } });
});

describe("Google PKCE", () => {
  const base = "https://project.supabase.co";
  const authorize = `${base}/auth/v1/authorize?provider=google&code_challenge_method=s256`;

  it("preserves the Supabase browser redirect on the web", async () => {
    sdk.auth.signInWithOAuth.mockResolvedValue({ data: { url: authorize } });
    const { signInWithGoogle } = await import("./client");
    await signInWithGoogle();
    expect(sdk.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://jlpt.test/tai-khoan",
        skipBrowserRedirect: undefined,
      },
    });
    expect(native.openUrl).not.toHaveBeenCalled();
  });

  it("opens only the configured HTTPS authorization endpoint in the system browser", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", base);
    native.isTauri.mockReturnValue(true);
    sdk.auth.signInWithOAuth.mockResolvedValue({ data: { url: authorize } });
    const { signInWithGoogle } = await import("./client");
    await signInWithGoogle();
    expect(sdk.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "luyenjlpt://auth-callback",
        skipBrowserRedirect: true,
      },
    });
    expect(native.openUrl).toHaveBeenCalledExactlyOnceWith(authorize);
    for (const url of [
      authorize.replace("https", "http"),
      `${base}/wrong`,
      "https://other.test/auth/v1/authorize",
      authorize.replace("s256", "plain"),
    ]) {
      sdk.auth.signInWithOAuth.mockResolvedValue({ data: { url } });
      await expect(signInWithGoogle()).rejects.toThrow();
    }
    expect(native.openUrl).toHaveBeenCalledOnce();
  });

  it("passes the callback's flow id to Supabase instead of borrowing another verifier", async () => {
    const { completeNativeSignIn } = await import("./client");
    sdk.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    await completeNativeSignIn("code", "flow");
    expect(sdk.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
      "code",
      { flowId: "flow" },
    );
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("account deletion", () => {
  it("sends the current token of the confirmed owner, not a token captured earlier", async () => {
    const { deleteAccount } = await import("./client");
    sdk.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "refreshed", user: { id: "owner-a" } } },
      error: null,
    });
    sdk.functions.invoke.mockResolvedValue({ data: { deleted: true } });
    await deleteAccount("owner-a");
    expect(sdk.functions.invoke).toHaveBeenCalledWith("delete-account", {
      body: {},
      headers: {
        Authorization: "Bearer refreshed",
        "x-confirmed-owner": "owner-a",
      },
    });
  });

  it("refuses to delete when the stored session now belongs to another account", async () => {
    const { deleteAccount } = await import("./client");
    sdk.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "other", user: { id: "owner-b" } } },
      error: null,
    });
    await expect(deleteAccount("owner-a")).rejects.toThrow();
    expect(sdk.functions.invoke).not.toHaveBeenCalled();
  });
});

describe("account login", () => {
  it("authenticates an email directly and a username via the token-only endpoint", async () => {
    const { login } = await import("./client");
    sdk.auth.signInWithPassword.mockResolvedValue({ error: null });
    await login(" learner@example.test ", "secret");
    expect(sdk.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "learner@example.test",
      password: "secret",
    });
    const tokens = { access_token: "access", refresh_token: "refresh" };
    sdk.functions.invoke.mockResolvedValue({ data: tokens });
    sdk.auth.setSession.mockResolvedValue({ error: null });
    await login(" LEARNER ", "secret");
    expect(sdk.functions.invoke).toHaveBeenCalledWith("resolve-login", {
      body: { username: "learner", password: "secret" },
    });
    expect(sdk.auth.setSession).toHaveBeenCalledWith(tokens);
  });

  it("returns one error without exposing the failing credential", async () => {
    const { LOGIN_ERROR, login } = await import("./client");
    sdk.functions.invoke.mockResolvedValue({
      error: new Error("unknown username"),
    });
    sdk.auth.signInWithPassword.mockResolvedValue({
      error: new Error("wrong password"),
    });
    await expect(login("unknown", "secret")).rejects.toThrow(LOGIN_ERROR);
    await expect(login("learner@example.test", "wrong")).rejects.toThrow(
      LOGIN_ERROR,
    );
    expect(sdk.auth.setSession).not.toHaveBeenCalled();
  });

  it("persists and clears the session using namespaced IndexedDB keys", async () => {
    const { sessionStorage } = await import("./client");
    await sessionStorage.setItem("sample", "session");
    expect(await sessionStorage.getItem("sample")).toBe("session");
    await sessionStorage.removeItem("sample");
    expect(await sessionStorage.getItem("sample")).toBeNull();
  });

  it("does not clear the next account when deletion completes in another tab", async () => {
    const { sessionStorage, clearDeletedSession } = await import("./client");
    const key = "sb-127-auth-token";
    const next = JSON.stringify({ user: { id: "second" } });
    await sessionStorage.setItem(key, next);
    await clearDeletedSession("first");
    expect(await sessionStorage.getItem(key)).toBe(next);
    await clearDeletedSession("second");
    expect(await sessionStorage.getItem(key)).toBeNull();
  });

  it("restores the local owner offline but never revives a deleted session", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { sessionStorage, offlineSession, clearDeletedSession } =
      await import("./client");
    const { db } = await import("../local-store/db");
    const key = "sb-127-auth-token";
    const saved = JSON.stringify({ user: { id: "removed" }, expires_at: 1 });
    await sessionStorage.setItem(key, saved);
    expect((await offlineSession())?.user.id).toBe("removed");
    await db.settings.put({ key: "retired:removed", value: true });
    expect(await offlineSession()).toBeNull();
    await clearDeletedSession("removed");
    await sessionStorage.setItem(key, saved);
    expect(await sessionStorage.getItem(key)).toBeNull();
  });
});
