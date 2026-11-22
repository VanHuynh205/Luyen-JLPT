import { useAccountProgress } from "@/adapters/auth/AccountProgress";
import { useContent } from "@/hooks/useContent";
import { CircleCheck, CloudOff, CloudUpload } from "lucide-react";

export function SyncIndicator() {
  const { enabled, online, queued, synced } = useAccountProgress();
  const { preferenceSync } = useContent();
  if (!enabled && online) return null;

  const count =
    queued === null ? null : queued + Number(preferenceSync.pending);
  const isSynced = synced && preferenceSync.synced && count === 0;
  const Icon = !online ? CloudOff : isSynced ? CircleCheck : CloudUpload;
  const pending = count ? `Chờ đồng bộ ${count}` : null;
  const label = !online
    ? ["Ngoại tuyến", pending].filter(Boolean).join(" · ")
    : (pending ?? (isSynced ? "Đã đồng bộ" : "Chưa đồng bộ"));

  return (
    <output
      className="flex items-center gap-1.5 text-xs leading-tight text-muted-foreground"
      data-ocid="sync.status"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </output>
  );
}
