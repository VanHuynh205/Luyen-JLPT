import { checkAndroidUpdate } from "@/adapters/native/androidUpdate";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { toast } from "sonner";

async function installDesktopUpdate() {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check({ timeout: 10_000 });
    if (!update) return;
    try {
      await update.downloadAndInstall(undefined, { timeout: 120_000 });
    } finally {
      await update.close();
    }
  } catch {
    toast.error("Không cài được bản cập nhật. Vui lòng thử lại sau.");
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

export function NativeUpdates() {
  useEffect(() => {
    if (!isTauri()) return;
    const android = /Android/i.test(navigator.userAgent);
    const windows = /Windows/i.test(navigator.userAgent);
    if (!android && !windows) return;
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    const id = "native-update";

    const checkUpdate = async () => {
      if (pending || !navigator.onLine) return;
      pending = true;
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 10_000);
      try {
        if (android) {
          const update = await checkAndroidUpdate(
            await getVersion(),
            request.signal,
          );
          if (active && update) {
            toast.info(`Có bản Android ${update.version}`, {
              id,
              duration: Number.POSITIVE_INFINITY,
              action: {
                label: "Tải APK",
                onClick: () => {
                  void import("@tauri-apps/plugin-opener")
                    .then(({ openUrl }) => openUrl(update.url))
                    .catch(() => toast.error("Không mở được trang tải APK."));
                },
              },
            });
          }
        } else {
          const version = await desktopVersionAvailable();
          if (active && version) {
            toast.info(`Có bản Windows ${version}`, {
              id,
              duration: Number.POSITIVE_INFINITY,
              action: {
                label: "Cài cập nhật",
                onClick: () => void installDesktopUpdate(),
              },
            });
          }
        }
      } catch {
        return;
      } finally {
        pending = false;
        window.clearTimeout(timeout);
      }
    };

    void checkUpdate();
    window.addEventListener("online", checkUpdate);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("online", checkUpdate);
      toast.dismiss(id);
    };
  }, []);
  return null;
}
