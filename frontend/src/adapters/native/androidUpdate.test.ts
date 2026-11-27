import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ANDROID_APK_BYTES,
  availableAndroidUpdate,
  downloadAndInstallAndroidUpdate,
} from "./androidUpdate";

const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

const update = {
  version: "0.4.0",
  versionCode: 4000,
  url: "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v0.4.0/Luyen-JLPT-android.apk",
  sha256: "a".repeat(64),
  sizeBytes: 24_000_000,
};

describe("Android update metadata (SEC-T08)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("accepts a verified release download only when versionCode increases and integrity metadata is valid", () => {
    expect(availableAndroidUpdate("0.3.1", update)).toEqual(update);
    expect(
      availableAndroidUpdate("0.3.1", {
        ...update,
        sha256: "A".repeat(64),
      }),
    ).toEqual(update);
    expect(availableAndroidUpdate("0.4.0", update)).toBeUndefined();
    expect(availableAndroidUpdate("0.5.0", update)).toBeUndefined();
  });

  it("rejects missing/bad sha256, oversize > 60 MiB, zero/non-int sizeBytes, downgrade, or unpinned URL", () => {
    for (const metadata of [
      null,
      [],
      {
        version: update.version,
        versionCode: update.versionCode,
        url: update.url,
      },
      { ...update, sha256: "bad" },
      { ...update, sha256: "g".repeat(64) },
      { ...update, sha256: "a".repeat(63) },
      { ...update, sizeBytes: 0 },
      { ...update, sizeBytes: -1 },
      { ...update, sizeBytes: 12.5 },
      { ...update, sizeBytes: MAX_ANDROID_APK_BYTES + 1 },
      { ...update, sizeBytes: 63_000_000 },
      { ...update, version: "0.4.0-beta" },
      { ...update, versionCode: 4001 },
      { ...update, url: `${update.url}?redirect=example.test` },
      { ...update, url: "https://evil.example/app.apk" },
      { ...update, url: update.url.replace("v0.4.0", "v0.3.0") },
    ]) {
      expect(availableAndroidUpdate("0.3.1", metadata)).toBeUndefined();
    }
    expect(availableAndroidUpdate("unknown", update)).toBeUndefined();
  });

  it("invokes install_android_apk, relays progress events, and always unlistens", async () => {
    let listener:
      | ((event: { payload: { percent?: number; stage?: string } }) => void)
      | undefined;
    const unlisten = vi.fn();
    listenMock.mockImplementation(async (_name, cb) => {
      listener = cb;
      return unlisten;
    });
    invokeMock.mockImplementation(async () => {
      listener?.({ payload: { percent: 42, stage: "downloading" } });
      listener?.({ payload: { percent: 100, stage: "verifying" } });
    });

    const progress: Array<{ percent: number; stage: string }> = [];
    await downloadAndInstallAndroidUpdate(update, (percent, stage) => {
      progress.push({ percent, stage: stage ?? "downloading" });
    });

    expect(listenMock).toHaveBeenCalledWith(
      "android-update-progress",
      expect.any(Function),
    );
    expect(invokeMock).toHaveBeenCalledWith("install_android_apk", {
      url: update.url,
      expectedSha256: update.sha256,
      expectedSizeBytes: update.sizeBytes,
      expectedVersionCode: update.versionCode,
    });
    expect(progress).toEqual([
      { percent: 42, stage: "downloading" },
      { percent: 100, stage: "verifying" },
    ]);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("rejects tampered update objects before invoking native installer and cleans up listener on error", async () => {
    await expect(
      downloadAndInstallAndroidUpdate({ ...update, sha256: "bad" }),
    ).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();

    const unlisten = vi.fn();
    listenMock.mockResolvedValue(unlisten);
    invokeMock.mockRejectedValue(new Error("SHA-256 mismatch"));
    await expect(downloadAndInstallAndroidUpdate(update)).rejects.toThrow(
      "SHA-256 mismatch",
    );
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
