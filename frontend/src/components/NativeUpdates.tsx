import {
  type AndroidUpdate,
  checkAndroidUpdate,
  downloadAndInstallAndroidUpdate,
} from "@/adapters/native/androidUpdate";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { toast } from "sonner";

const UPDATE_TOAST_ID = "native-update";

export type NativeUpdateCheckStatus =
  | "available"
  | "up-to-date"
  | "offline"
  | "unsupported"
  | "error";

let activeInstall = false;

async function relaunchDesktopApp() {
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    toast.error(
      "Không thể tự khởi động lại. Vui lòng đóng và mở lại ứng dụng thủ công.",
      { id: UPDATE_TOAST_ID },
    );
  }
}

async function installDesktopUpdate(version: string) {
  if (activeInstall) return;
  activeInstall = true;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: 10_000 });
    if (!update) return;
    let totalBytes = 0;
    let downloadedBytes = 0;
    toast.loading(`Đang tải bản Windows ${version} (0%)...`, {
      id: UPDATE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
    });
    try {
      await update.downloadAndInstall(
        (event) => {
          if (event.event === "Started") {
            totalBytes = event.data.contentLength ?? 0;
            downloadedBytes = 0;
            toast.loading(`Đang tải bản Windows ${version} (0%)...`, {
              id: UPDATE_TOAST_ID,
              duration: Number.POSITIVE_INFINITY,
            });
          } else if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            const percent =
              totalBytes > 0
                ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100))
                : 0;
            toast.loading(
              totalBytes > 0
                ? `Đang tải bản Windows ${version} (${percent}%)...`
                : `Đang tải bản Windows ${version}...`,
              {
                id: UPDATE_TOAST_ID,
                duration: Number.POSITIVE_INFINITY,
              },
            );
          } else if (event.event === "Finished") {
            toast.loading(`Đang cài đặt bản Windows ${version}...`, {
              id: UPDATE_TOAST_ID,
              duration: Number.POSITIVE_INFINITY,
            });
          }
        },
        { timeout: 120_000 },
      );
      toast.success(`Đã cài bản Windows ${version}`, {
        id: UPDATE_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Khởi động lại để áp dụng",
          onClick: () => void relaunchDesktopApp(),
        },
      });
    } finally {
      await update.close();
    }
  } catch {
    toast.error("Không cài được bản cập nhật. Vui lòng thử lại sau.", {
      id: UPDATE_TOAST_ID,
    });
  } finally {
    activeInstall = false;
  }
}

async function installAndroidUpdate(update: AndroidUpdate) {
  if (activeInstall) return;
  activeInstall = true;
  toast.loading(`Đang tải bản Android ${update.version} (0%)...`, {
    id: UPDATE_TOAST_ID,
    duration: Number.POSITIVE_INFINITY,
  });
  try {
    await downloadAndInstallAndroidUpdate(update, (percent, stage) => {
      if (stage === "verifying") {
        toast.loading(
          `Đang xác minh SHA-256 & chứng chỉ bản ${update.version}...`,
          {
            id: UPDATE_TOAST_ID,
            duration: Number.POSITIVE_INFINITY,
          },
        );
      } else {
        toast.loading(
          `Đang tải bản Android ${update.version} (${percent}%)...`,
          {
            id: UPDATE_TOAST_ID,
            duration: Number.POSITIVE_INFINITY,
          },
        );
      }
    });
    toast.success(
      `Đã xác minh SHA-256 bản ${update.version}. Chọn "Cập nhật" trên hộp thoại hệ thống.`,
      { id: UPDATE_TOAST_ID },
    );
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const permissionPrefix = "PERMISSION_REQUIRED:";
    const message = rawMessage.includes(permissionPrefix)
      ? rawMessage.split(permissionPrefix)[1]?.trim() ||
        "Hãy bật quyền cài ứng dụng từ nguồn này rồi thử lại."
      : "Không tải hoặc xác minh được bản cập nhật Android. Vui lòng thử lại sau.";
    toast.error(message, { id: UPDATE_TOAST_ID });
  } finally {
    activeInstall = false;
  }
}

async function desktopVersionAvailable() {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check({ timeout: 10_000 });
  if (!update) return;
  const { version } = update;
  await update.close();
  return version;
}

export async function checkForNativeUpdate(
  signal?: AbortSignal,
): Promise<NativeUpdateCheckStatus> {
  if (!isTauri()) return "unsupported";
  const android = /Android/i.test(navigator.userAgent);
  const windows = /Windows/i.test(navigator.userAgent);
  if (!android && !windows) return "unsupported";
  if (!navigator.onLine) return "offline";

  const request = new AbortController();
  const forwardAbort = () => request.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => request.abort(), 10_000);
  try {
    if (android) {
      const update = await checkAndroidUpdate(
        await getVersion(),
        request.signal,
      );
      if (signal?.aborted) return "error";
      if (!update) return "up-to-date";
      toast.info(`Có bản Android ${update.version}`, {
        id: UPDATE_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Tải & cài đặt",
          onClick: () => void installAndroidUpdate(update),
        },
      });
      return "available";
    }
    const version = await desktopVersionAvailable();
    if (signal?.aborted) return "error";
    if (!version) return "up-to-date";
    toast.info(`Có bản Windows ${version}`, {
      id: UPDATE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "Cài cập nhật",
        onClick: () => void installDesktopUpdate(version),
      },
    });
    return "available";
  } catch {
    return "error";
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export function NativeUpdates() {
  useEffect(() => {
    if (!isTauri()) return;
    const android = /Android/i.test(navigator.userAgent);
    const windows = /Windows/i.test(navigator.userAgent);
    if (!android && !windows) return;
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;

    const checkUpdate = async () => {
      if (pending || !navigator.onLine || !active) return;
      pending = true;
      const request = new AbortController();
      controller = request;
      try {
        await checkForNativeUpdate(request.signal);
      } finally {
        pending = false;
      }
    };

    void checkUpdate();
    window.addEventListener("online", checkUpdate);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("online", checkUpdate);
      toast.dismiss(UPDATE_TOAST_ID);
    };
  }, []);
  return null;
}
