/// <reference types="vite-plugin-pwa/react" />
import { useRegisterSW } from "virtual:pwa-register/react";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { toast } from "sonner";

const PWA_UPDATE_TOAST_ID = "pwa-update";

function WebPwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast.info("Có bản cập nhật mới cho Web", {
      id: PWA_UPDATE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "Tải lại",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
    });
    return () => {
      toast.dismiss(PWA_UPDATE_TOAST_ID);
    };
  }, [needRefresh, updateServiceWorker]);

  return null;
}

/** Registers the Web PWA service worker and offers a reload toast on updates. */
export function PwaUpdatePrompt() {
  if (isTauri()) return null;
  return <WebPwaUpdatePrompt />;
}
