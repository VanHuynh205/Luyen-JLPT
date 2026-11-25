import { isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

export const nativeAuthRedirect = "luyenjlpt://auth-callback";

type AuthCallback = { code: string; flowId: string } | { code?: never };

export function getAuthRedirectUrl(origin: string) {
  return isTauri() ? nativeAuthRedirect : `${origin}/tai-khoan`;
}

export function parseAuthCallback(raw: string): AuthCallback | null {
  if (raw.length > 4096) return null;
  const [address = ""] = raw.split(/[?#]/, 1);
  if (address !== nativeAuthRedirect && address !== `${nativeAuthRedirect}/`)
    return null;
  const [search, fragment] = raw.slice(address.length).split("#", 2);
  const params = new URLSearchParams(search);
  const [code, ...extraCodes] = params.getAll("code");
  const [flowId, ...extraFlows] = params.getAll("sb_flow_id");
  return code &&
    !extraCodes.length &&
    flowId &&
    /^[a-zA-Z0-9_-]{8,64}$/.test(flowId) &&
    !extraFlows.length &&
    !params.has("error") &&
    fragment === undefined
    ? { code, flowId }
    : {};
}

const SEEN_KEY = "luyenjlpt.handledAuthLinks";

function readSeen(): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function listenForNativeAuth(
  handler: (callback: AuthCallback) => void,
) {
  if (!isTauri()) return () => {};
  // getCurrent() keeps the launch link for the whole process, so remember handled links across webview reloads.
  const seen = readSeen();
  const consume = (urls: string[]) => {
    for (const raw of urls) {
      const callback = parseAuthCallback(raw);
      if (!callback) continue;
      const identity = callback.code
        ? `${callback.flowId}:${callback.code}`
        : raw;
      if (seen.includes(identity)) continue;
      seen.push(identity);
      if (seen.length > 16) seen.shift();
      try {
        sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      } catch {
        // Storage may be unavailable; duplicates in this page load are still skipped.
      }
      handler(callback);
    }
  };
  const unlisten = await onOpenUrl(consume);
  try {
    consume((await getCurrent()) ?? []);
  } catch (error) {
    unlisten();
    throw error;
  }
  return unlisten;
}
