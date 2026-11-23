import { db } from "@/adapters/local-store/db";
import { isOwnerRetired } from "@/adapters/local-store/retirement";
import { type Session, createClient } from "@supabase/supabase-js";
import { isTauri } from "@tauri-apps/api/core";
import { getAuthRedirectUrl } from "./nativeAuth";

export const sessionStorage = {
  async getItem(key: string) {
    const value = (await db.settings.get(`auth:${key}`))?.value;
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string) {
    await db.transaction("rw", db.settings, async () => {
      if (key === storageKey) {
        const owner = JSON.parse(value)?.user?.id;
        if (owner && (await isOwnerRetired(owner))) return;
      }
      await db.settings.put({ key: `auth:${key}`, value });
    });
  },
  async removeItem(key: string) {
    await db.settings.delete(`auth:${key}`);
  },
};

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const storageKey = url
  ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token`
  : undefined;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          storage: sessionStorage,
          storageKey,
          detectSessionInUrl: !isTauri(),
          experimental: { appendPkceFlowIdToRedirects: isTauri() },
        },
      })
    : null;

export const LOGIN_ERROR = "Tên đăng nhập, email hoặc mật khẩu không đúng.";

export async function signInWithGoogle() {
  if (!supabase || !url) throw new Error("Chưa cấu hình Supabase.");
  const native = isTauri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(window.location.origin),
      skipBrowserRedirect: native ? true : undefined,
    },
  });
  if (error) throw error;
  if (!native) return;
  const authorize = new URL(data.url);
  if (
    authorize.protocol !== "https:" ||
    authorize.origin !== new URL(url).origin ||
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
  const cached = JSON.parse(value);
  if (!cached?.user?.id || (await isOwnerRetired(cached.user.id))) return null;
  return cached;
}

export async function clearDeletedSession(owner: string) {
  if (!storageKey) return;
  return db.transaction("rw", db.settings, async () => {
    const raw = await sessionStorage.getItem(storageKey);
    if (raw && JSON.parse(raw)?.user?.id === owner)
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
  const name = identifier.trim();
  if (name.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({
      email: name,
      password,
    });
    if (error) throw new Error(LOGIN_ERROR);
  } else {
    const { data, error } = await supabase.functions.invoke("resolve-login", {
      body: { username: name.toLowerCase(), password },
    });
    if (error || !data?.access_token || !data?.refresh_token)
      throw new Error(LOGIN_ERROR);
    const result = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (result.error) throw new Error(LOGIN_ERROR);
  }
}
