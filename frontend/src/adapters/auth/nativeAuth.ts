import { isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

export const nativeAuthRedirect = "luyenjlpt://auth-callback";

type AuthCallback = { code: string; flowId: string } | { code?: never };

export function getAuthRedirectUrl(origin: string) {
  return isTauri() ? nativeAuthRedirect : `${origin}/tai-khoan`;
}

export function parseAuthCallback(raw: string): AuthCallback | null {
  if (raw.length > 4096) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "luyenjlpt:" ||
    url.host !== "auth-callback" ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.username ||
    url.password
  ) {
    return null;
  }
  const [code, ...extraCodes] = url.searchParams.getAll("code");
  const [flowId, ...extraFlows] = url.searchParams.getAll("sb_flow_id");
  return code &&
    !extraCodes.length &&
    flowId &&
    /^[a-zA-Z0-9_-]{8,64}$/.test(flowId) &&
    !extraFlows.length &&
    !url.searchParams.has("error") &&
    !url.hash
    ? { code, flowId }
    : {};
}

export async function listenForNativeAuth(
  handler: (callback: AuthCallback) => void,
) {
  if (!isTauri()) return () => {};
  const seen: string[] = [];
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
