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

describe("web auth callbacks", () => {
  it("recognizes callback errors and PKCE links even without a verifier", async () => {
    const { parseWebAuthCallback } = await import("./client");
    expect(
      parseWebAuthCallback(
        "https://jlpt.test/tai-khoan?code=used&sb_flow_id=missing",
      ),
    ).toMatchObject({ code: "used" });
    expect(
      parseWebAuthCallback(
        "https://jlpt.test/tai-khoan#error=access_denied&error_description=private",
      ),
    ).toMatchObject({ code: null });
    expect(
      parseWebAuthCallback("https://jlpt.test/tu-vung?code=used"),
    ).toBeNull();
  });

  it("cleans auth parameters while preserving ordinary account parameters", async () => {
    const { parseWebAuthCallback } = await import("./client");
    expect(
      parseWebAuthCallback(
        "https://jlpt.test/tai-khoan?keep=1&code=used&sb_flow_id=missing#error=private&error_description=detail&provider_token=fixture&access_token=fixture",
      )?.cleanUrl,
    ).toBe("https://jlpt.test/tai-khoan?keep=1");
  });

  it("reports rejected exchanges, never borrowing a different verifier", async () => {
    const location = new URL(
      "https://jlpt.test/tai-khoan?code=used&sb_flow_id=unknown_flow#help",
    );
    const history = { state: { route: 1 }, replaceState: vi.fn() };
    vi.stubGlobal("window", { location, history });
    sdk.auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error("private detail"),
    });
    const { completeWebAuthCallback } = await import("./client");
    expect(await completeWebAuthCallback()).toBe(true);
    expect(sdk.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
      "used",
      { flowId: "unknown_flow" },
    );
    expect(history.replaceState).toHaveBeenCalledExactlyOnceWith(
      history.state,
      "",
      "https://jlpt.test/tai-khoan#help",
    );
  });

  it("normalizes trailing slash on /tai-khoan/ and rejects mixed error+fragment params", async () => {
    const { parseWebAuthCallback } = await import("./client");
    expect(
      parseWebAuthCallback("https://app.example.test/tai-khoan/?code=pkce123"),
    ).toEqual({
      code: "pkce123",
      flowId: undefined,
      cleanUrl: "https://app.example.test/tai-khoan/",
    });

    const bad = parseWebAuthCallback(
      "https://app.example.test/tai-khoan?code=fake&error=access_denied#access_token=leaked",
    );
    expect(bad?.code).toBeNull();
    expect(bad?.cleanUrl).toBe("https://app.example.test/tai-khoan");
  });

  it("calls exchangeCodeForSession without flowId when web callback omits sb_flow_id", async () => {
    const location = new URL("https://jlpt.test/tai-khoan/?code=pkce123");
    const history = { state: null, replaceState: vi.fn() };
    vi.stubGlobal("window", { location, history });
    sdk.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const { completeWebAuthCallback } = await import("./client");
    expect(await completeWebAuthCallback()).toBe(false);
    expect(sdk.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
      "pkce123",
    );
    expect(history.replaceState).toHaveBeenCalledExactlyOnceWith(
      null,
      "",
      "https://jlpt.test/tai-khoan/",
    );
  });

  it("does not crash module initialization when VITE_SUPABASE_URL is malformed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "not a valid url");
    const mod = await import("./client");
    expect(mod.supabase).toBeNull();
  });

  it.each([
    [false, "/tai-khoan"],
    [false, "/tai-khoan?type=recovery"],
    [false, "/tu-vung?code=unrelated"],
    [true, "/tai-khoan?code=native"],
  ])("ignores non-web callbacks (native=%s, path=%s)", async (tauri, path) => {
    native.isTauri.mockReturnValue(tauri);
    vi.stubGlobal("window", {
      location: new URL(String(path), "https://jlpt.test"),
    });
    const { completeWebAuthCallback } = await import("./client");
    expect(await completeWebAuthCallback()).toBe(false);
    expect(sdk.auth.exchangeCodeForSession).not.toHaveBeenCalled();
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
    const { AuthLoginError, LOGIN_ERROR, login } = await import("./client");
    sdk.functions.invoke.mockResolvedValue({
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({ error: "invalid_credentials" }),
          {
            status: 401,
          },
        ),
      },
    });
    sdk.auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", status: 400, message: "Invalid" },
    });
    await expect(login("unknown", "secret")).rejects.toMatchObject({
      kind: "invalid_credentials",
      message: LOGIN_ERROR,
    });
    await expect(login("learner@example.test", "wrong")).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AuthLoginError &&
        err.kind === "invalid_credentials" &&
        err.message === LOGIN_ERROR,
    );
    expect(sdk.auth.setSession).not.toHaveBeenCalled();
  });

  it("classifies email_not_confirmed, 429, 503/404, offline and storage_blocked separately", async () => {
    const { AuthLoginError, login } = await import("./client");

    sdk.auth.signInWithPassword.mockResolvedValueOnce({
      error: {
        code: "email_not_confirmed",
        status: 400,
        message: "Not confirmed",
      },
    });
    await expect(login("learner@example.test", "secret")).rejects.toMatchObject(
      {
        kind: "email_not_confirmed",
      },
    );

    sdk.functions.invoke.mockResolvedValueOnce({
      error: {
        name: "FunctionsHttpError",
        message: "Too many requests",
        context: new Response(null, { status: 429 }),
      },
    });
    await expect(login("learner", "secret")).rejects.toMatchObject({
      kind: "rate_limited",
    });

    sdk.functions.invoke.mockResolvedValueOnce({
      error: {
        name: "FunctionsHttpError",
        message: "Service unavailable",
        context: new Response(null, { status: 503 }),
      },
    });
    await expect(login("learner", "secret")).rejects.toMatchObject({
      kind: "service_unavailable",
    });

    sdk.functions.invoke.mockResolvedValueOnce({
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
    });
    await expect(login("learner", "secret")).rejects.toMatchObject({
      kind: "service_unavailable",
    });

    vi.stubGlobal("navigator", { onLine: false });
    await expect(login("learner@example.test", "secret")).rejects.toMatchObject(
      {
        kind: "network_offline",
      },
    );

    vi.stubGlobal("navigator", { onLine: true });
    const quotaError = Object.assign(new Error("Quota exceeded"), {
      name: "QuotaExceededError",
    });
    sdk.auth.signInWithPassword.mockRejectedValueOnce(quotaError);
    await expect(login("learner@example.test", "secret")).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AuthLoginError && err.kind === "storage_blocked",
    );
  });

  it("handles corrupted JSON in local session storage safely without crashing", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { sessionStorage, offlineSession, clearDeletedSession } =
      await import("./client");
    const key = "sb-127-auth-token";
    await expect(
      sessionStorage.setItem(key, "{not-valid-json"),
    ).resolves.toBeUndefined();
    expect(await offlineSession()).toBeNull();
    await expect(clearDeletedSession("owner-a")).resolves.toBeUndefined();
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
