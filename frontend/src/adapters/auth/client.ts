import { db } from "@/adapters/local-store/db";
import { isOwnerRetired } from "@/adapters/local-store/retirement";
import { type Session, createClient } from "@supabase/supabase-js";
import { isTauri } from "@tauri-apps/api/core";
import { getAuthRedirectUrl } from "./nativeAuth";

export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "service_unavailable"
  | "network_offline"
  | "storage_blocked";

export class AuthLoginError extends Error {
  readonly kind: AuthErrorKind;

  constructor(kind: AuthErrorKind, message: string) {
    super(message);
    this.name = "AuthLoginError";
    this.kind = kind;
  }
}

export const LOGIN_ERROR = "Tên đăng nhập, email hoặc mật khẩu không đúng.";
const EMAIL_NOT_CONFIRMED_ERROR =
  "Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư của bạn.";
const RATE_LIMITED_ERROR =
  "Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
const SERVICE_UNAVAILABLE_ERROR =
  "Dịch vụ đăng nhập tạm thời không phản hồi. Vui lòng thử lại sau.";
const NETWORK_OFFLINE_ERROR =
  "Thiết bị đang ngoại tuyến. Hãy kết nối mạng để đăng nhập.";
const STORAGE_BLOCKED_ERROR =
  "Trình duyệt đang chặn lưu phiên cục bộ (chế độ ẩn danh hoặc chặn cookie/storage).";

const STORAGE_ERROR_NAMES = new Set([
  "QuotaExceededError",
  "SecurityError",
  "DatabaseClosedError",
  "OpenFailedError",
  "InvalidStateError",
]);

function isStorageBlockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (
    STORAGE_ERROR_NAMES.has(name) ||
    /quota|indexeddb|storage.*(block|denied|disabled)|permission denied/i.test(
      message,
    )
  );
}

function parseSessionJson(raw: string): { user?: { id?: string } } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as { user?: { id?: string } })
      : null;
  } catch {
    return null;
  }
}

function parseSupabaseUrl(raw: string | undefined): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const sessionStorage = {
  async getItem(key: string) {
    const value = (await db.settings.get(`auth:${key}`))?.value;
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string) {
    try {
      await db.transaction("rw", db.settings, async () => {
        if (key === storageKey) {
          const owner = parseSessionJson(value)?.user?.id;
          if (owner && (await isOwnerRetired(owner))) return;
        }
        await db.settings.put({ key: `auth:${key}`, value });
      });
    } catch (error) {
      if (isStorageBlockedError(error)) {
        throw new AuthLoginError("storage_blocked", STORAGE_BLOCKED_ERROR);
      }
      throw error;
    }
  },
  async removeItem(key: string) {
    await db.settings.delete(`auth:${key}`);
  },
};

const supabaseUrl = parseSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const url = supabaseUrl?.origin;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;
const storageKey = supabaseUrl
  ? `sb-${supabaseUrl.hostname.split(".")[0]}-auth-token`
  : undefined;
const rejectedCallbackKeys = [
  "error",
  "error_code",
  "error_description",
  "error_reason",
  "error_uri",
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
];
const authCallbackKeys = ["code", "sb_flow_id", ...rejectedCallbackKeys];

export const AUTH_CALLBACK_ERROR =
  "Không mở được liên kết tài khoản. Hãy mở lại trên cùng trình duyệt hoặc yêu cầu liên kết mới.";

export function parseWebAuthCallback(href: string) {
  const parsed = new URL(href);
  if (parsed.pathname.replace(/\/+$/, "") !== "/tai-khoan") return null;
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const fragmentAuth = authCallbackKeys.some((name) => fragment.has(name));
  if (!fragmentAuth && !authCallbackKeys.some((name) => query.has(name)))
    return null;
  const codes = query.getAll("code");
  const flows = query.getAll("sb_flow_id");
  const valid =
    codes.length === 1 &&
    flows.length <= 1 &&
    !fragmentAuth &&
    !rejectedCallbackKeys.some((name) => query.has(name));
  for (const name of [
    ...authCallbackKeys,
    "type",
    "expires_in",
    "expires_at",
    "token_type",
  ]) {
    query.delete(name);
    fragment.delete(name);
  }
  if (fragmentAuth) parsed.hash = fragment.toString();
  return {
    code: valid ? codes[0] : null,
    flowId: flows[0],
    cleanUrl: parsed.href,
  };
}

const callback =
  url && key && !isTauri() && globalThis.window?.location?.href
    ? parseWebAuthCallback(window.location.href)
    : null;
if (callback)
  window.history.replaceState(window.history.state, "", callback.cleanUrl);

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          storage: sessionStorage,
          storageKey,
          detectSessionInUrl: false,
          experimental: { appendPkceFlowIdToRedirects: isTauri() },
        },
      })
    : null;

let callbackResult: Promise<boolean> | undefined;
export function completeWebAuthCallback(): Promise<boolean> {
  if (!callback || !supabase) return Promise.resolve(false);
  if (!callback.code) return Promise.resolve(true);
  if (!callbackResult) {
    const exchange =
      typeof callback.flowId === "string" && callback.flowId.length > 0
        ? supabase.auth.exchangeCodeForSession(callback.code, {
            flowId: callback.flowId,
          })
        : supabase.auth.exchangeCodeForSession(callback.code);
    callbackResult = exchange.then(
      ({ error }) => !!error,
      () => true,
    );
  }
  return callbackResult;
}

function readErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number")
    return error.status;
  if (
    "context" in error &&
    error.context &&
    typeof error.context === "object" &&
    "status" in error.context &&
    typeof error.context.status === "number"
  ) {
    return error.context.status;
  }
  return undefined;
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("error_code" in error && typeof error.error_code === "string") {
    return error.error_code;
  }
  return undefined;
}

function classifyLoginError(
  error: unknown,
  source: "password" | "resolve-login" | "session",
): AuthLoginError {
  if (error instanceof AuthLoginError) return error;
  if (isStorageBlockedError(error)) {
    return new AuthLoginError("storage_blocked", STORAGE_BLOCKED_ERROR);
  }
  if (globalThis.navigator?.onLine === false) {
    return new AuthLoginError("network_offline", NETWORK_OFFLINE_ERROR);
  }
  const code = readErrorCode(error);
  const status = readErrorStatus(error);
  const name =
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string"
      ? error.name
      : "";

  if (code === "email_not_confirmed") {
    return new AuthLoginError("email_not_confirmed", EMAIL_NOT_CONFIRMED_ERROR);
  }
  if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    return new AuthLoginError("rate_limited", RATE_LIMITED_ERROR);
  }
  if (
    source !== "session" &&
    (status === 404 ||
      (status !== undefined && status >= 500) ||
      name === "FunctionsFetchError" ||
      name === "FunctionsRelayError" ||
      name === "AuthRetryableFetchError" ||
      error instanceof TypeError)
  ) {
    return new AuthLoginError("service_unavailable", SERVICE_UNAVAILABLE_ERROR);
  }
  return new AuthLoginError("invalid_credentials", LOGIN_ERROR);
}

export async function signInWithGoogle() {
  if (!supabase || !supabaseUrl) throw new Error("Chưa cấu hình Supabase.");
  if (globalThis.navigator?.onLine === false) {
    throw new AuthLoginError("network_offline", NETWORK_OFFLINE_ERROR);
  }
  const native = isTauri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(window.location.origin),
      skipBrowserRedirect: native ? true : undefined,
    },
  });
  if (error) {
    const status = readErrorStatus(error);
    if (status === 429) {
      throw new AuthLoginError("rate_limited", RATE_LIMITED_ERROR);
    }
    if (status !== undefined && status >= 500) {
      throw new AuthLoginError(
        "service_unavailable",
        SERVICE_UNAVAILABLE_ERROR,
      );
    }
    throw error;
  }
  if (!native) return;
  const authorize = new URL(data.url);
  if (
    authorize.protocol !== "https:" ||
    authorize.origin !== supabaseUrl.origin ||
    authorize.pathname !== "/auth/v1/authorize" ||
    authorize.searchParams.get("code_challenge_method") !== "s256" ||
    authorize.username ||
    authorize.password
  ) {
    throw new Error("URL đăng nhập không hợp lệ.");
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(authorize.href);
}

export async function completeNativeSignIn(code: string, flowId: string) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  const { error } = await supabase.auth.exchangeCodeForSession(code, {
    flowId,
  });
  if (error) throw error;
}

export async function offlineSession(): Promise<Session | null> {
  if (!storageKey || navigator.onLine !== false) return null;
  const value = await sessionStorage.getItem(storageKey);
  if (!value) return null;
  const cached = parseSessionJson(value);
  if (!cached?.user?.id || (await isOwnerRetired(cached.user.id))) return null;
  return cached as Session;
}

export async function clearDeletedSession(owner: string) {
  if (!storageKey) return;
  return db.transaction("rw", db.settings, async () => {
    const raw = await sessionStorage.getItem(storageKey);
    if (raw && parseSessionJson(raw)?.user?.id === owner)
      await sessionStorage.removeItem(storageKey);
  });
}

// The token captured at confirmation can expire before the click; getSession
// refreshes it, and the owner check keeps the request bound to that account.
export async function deleteAccount(owner: string) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner)
    throw new Error("Account changed");
  const result = await supabase.functions.invoke("delete-account", {
    body: {},
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "x-confirmed-owner": owner,
    },
  });
  if (result.error) throw result.error;
}

export async function login(identifier: string, password: string) {
  if (!supabase) throw new Error("Chưa cấu hình Supabase.");
  if (globalThis.navigator?.onLine === false) {
    throw new AuthLoginError("network_offline", NETWORK_OFFLINE_ERROR);
  }
  const name = identifier.trim();
  if (name.includes("@")) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: name,
        password,
      });
      if (error) throw classifyLoginError(error, "password");
    } catch (error) {
      throw classifyLoginError(error, "password");
    }
  } else {
    let tokens: { access_token?: string; refresh_token?: string } | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("resolve-login", {
        body: { username: name.toLowerCase(), password },
      });
      if (error) throw classifyLoginError(error, "resolve-login");
      tokens = data;
    } catch (error) {
      throw classifyLoginError(error, "resolve-login");
    }
    if (!tokens?.access_token || !tokens?.refresh_token) {
      throw new AuthLoginError("invalid_credentials", LOGIN_ERROR);
    }
    try {
      const result = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (result.error) throw classifyLoginError(result.error, "session");
    } catch (error) {
      throw classifyLoginError(error, "session");
    }
  }
}
