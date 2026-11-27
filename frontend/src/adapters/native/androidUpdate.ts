export const nativeReleases =
  "https://github.com/VanHuynh205/Luyen-JLPT/releases";
const metadataUrl = `${nativeReleases}/latest/download/android-latest.json`;
const metadataLimit = 8192;
export const MAX_ANDROID_APK_BYTES = 62_914_560; // 60 MiB hard ceiling (SEC-E7-06)

export type AndroidUpdate = {
  version: string;
  versionCode: number;
  url: string;
  sha256: string;
  sizeBytes: number;
};

export type AndroidUpdateStage = "downloading" | "verifying";

type AndroidProgressPayload = {
  percent?: unknown;
  stage?: unknown;
};

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

function normalizeSha256(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const trimmed = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(trimmed) ? trimmed : undefined;
}

function parseSizeBytes(value: unknown): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_ANDROID_APK_BYTES
  ) {
    return;
  }
  return value;
}

function canonicalAndroidApkUrl(version: string) {
  return `${nativeReleases}/download/v${version}/Luyen-JLPT-android.apk`;
}

export function availableAndroidUpdate(
  current: string,
  metadata: unknown,
): AndroidUpdate | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return;
  }
  const {
    version,
    versionCode: publishedCode,
    url,
    sha256,
    sizeBytes,
  } = metadata as Partial<AndroidUpdate>;
  const installedCode = versionCode(current);
  const nextCode = versionCode(version);
  const normalizedSha = normalizeSha256(sha256);
  const validSize = parseSizeBytes(sizeBytes);
  if (
    typeof version !== "string" ||
    typeof url !== "string" ||
    !installedCode ||
    nextCode <= installedCode ||
    publishedCode !== nextCode ||
    !normalizedSha ||
    validSize === undefined ||
    url !== canonicalAndroidApkUrl(version)
  ) {
    return;
  }
  return {
    version,
    versionCode: nextCode,
    url,
    sha256: normalizedSha,
    sizeBytes: validSize,
  };
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

export async function downloadAndInstallAndroidUpdate(
  update: AndroidUpdate,
  onProgress?: (percent: number, stage?: AndroidUpdateStage) => void,
): Promise<void> {
  const nextCode = versionCode(update.version);
  const normalizedSha = normalizeSha256(update.sha256);
  const validSize = parseSizeBytes(update.sizeBytes);
  if (
    !nextCode ||
    update.versionCode !== nextCode ||
    !normalizedSha ||
    validSize === undefined ||
    update.url !== canonicalAndroidApkUrl(update.version)
  ) {
    throw new Error("Thông tin bản cập nhật Android không hợp lệ.");
  }

  const [{ invoke }, { listen }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/event"),
  ]);

  const unlisten = await listen<AndroidProgressPayload>(
    "android-update-progress",
    (event) => {
      if (!onProgress) return;
      const rawPercent = event.payload?.percent;
      const percent =
        typeof rawPercent === "number" && Number.isFinite(rawPercent)
          ? Math.max(0, Math.min(100, Math.round(rawPercent)))
          : 0;
      const stage: AndroidUpdateStage =
        event.payload?.stage === "verifying" ? "verifying" : "downloading";
      onProgress(percent, stage);
    },
  );

  try {
    await invoke("install_android_apk", {
      url: update.url,
      expectedSha256: normalizedSha,
      expectedSizeBytes: validSize,
      expectedVersionCode: nextCode,
    });
  } finally {
    unlisten();
  }
}
