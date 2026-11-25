export const nativeReleases =
  "https://github.com/VanHuynh205/Luyen-JLPT/releases";
const metadataUrl = `${nativeReleases}/latest/download/android-latest.json`;
const metadataLimit = 8192;

type AndroidUpdate = { version: string; versionCode: number; url: string };

function versionCode(version: unknown) {
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version)
  ) {
    return 0;
  }
  const [major, minor, patch] = version.split(".").map(Number);
  const code = major * 1_000_000 + minor * 1_000 + patch;
  return code <= 2_100_000_000 ? code : 0;
}

export function availableAndroidUpdate(
  current: string,
  metadata: unknown,
): AndroidUpdate | undefined {
  if (!metadata || typeof metadata !== "object") return;
  const {
    version,
    versionCode: publishedCode,
    url,
  } = metadata as Partial<AndroidUpdate>;
  const installedCode = versionCode(current);
  const nextCode = versionCode(version);
  if (
    typeof version !== "string" ||
    typeof url !== "string" ||
    !installedCode ||
    nextCode <= installedCode ||
    publishedCode !== nextCode ||
    url !== `${nativeReleases}/download/v${version}/Luyen-JLPT-android.apk`
  ) {
    return;
  }
  return { version, versionCode: nextCode, url };
}

export async function checkAndroidUpdate(current: string, signal: AbortSignal) {
  const { fetch } = await import("@tauri-apps/plugin-http");
  const response = await fetch(metadataUrl, {
    signal,
    maxRedirections: 3,
    connectTimeout: 5000,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > metadataLimit) return;
      text += decoder.decode(value, { stream: true });
    }
    return availableAndroidUpdate(current, JSON.parse(text + decoder.decode()));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
