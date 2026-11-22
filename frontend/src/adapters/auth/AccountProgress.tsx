import { db } from "@/adapters/local-store/db";
import { progressStore } from "@/adapters/local-store/progress";
import { createSupabaseProgressRemote } from "@/adapters/supabase-sync";
import { Button } from "@/components/ui/button";
import { createProgressSync } from "@/core/sync";
import { useQueryClient } from "@tanstack/react-query";
import { liveQuery } from "dexie";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "./client";
import { useAuth } from "./session";

const AccountProgressContext = createContext<{
  enabled: boolean;
  online: boolean;
  queued: number | null;
  synced: boolean;
}>({ enabled: false, online: true, queued: null, synced: false });

export const useAccountProgress = () => useContext(AccountProgressContext);

export function AccountProgress({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const owner = session?.user.id;
  const confirmed = !!session?.user.email_confirmed_at;
  return (
    <OwnerProgress
      key={`${owner ?? "guest"}:${confirmed}`}
      owner={owner}
      confirmed={confirmed}
    >
      {children}
    </OwnerProgress>
  );
}

function OwnerProgress({
  owner,
  confirmed,
  children,
}: { owner?: string; confirmed: boolean; children: ReactNode }) {
  const cache = useQueryClient();
  const [prompt, setPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(
    () => globalThis.navigator?.onLine !== false,
  );
  const [queued, setQueued] = useState<number | null>(null);
  const [pulled, setPulled] = useState(false);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine !== false);
      if (navigator.onLine === false) setPulled(false);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!owner || !confirmed || !supabase) return;
    let active = true;
    const subscription = liveQuery(() =>
      db.progressOutbox.where("owner").equals(owner).count(),
    ).subscribe({
      next: (count) => {
        setQueued(count);
        if (count > 0) setPulled(false);
      },
      error: () => setQueued(null),
    });
    void progressStore
      .hasGuestProgress()
      .then((hasGuest) => {
        if (active) setPrompt(hasGuest);
      })
      .catch(() => toast.error("Không đọc được tiến độ khách."));
    const remote = createSupabaseProgressRemote(supabase);
    const sync = createProgressSync({
      owner,
      store: progressStore,
      remote: {
        ...remote,
        push: (...args) => {
          setPulled(false);
          return remote.push(...args);
        },
      },
      onChange: () => {
        void cache.invalidateQueries({ queryKey: ["progress", owner] });
      },
      onComplete: () => setPulled(true),
      onError: () => {
        setPulled(false);
        toast.error(
          "Chưa đồng bộ được. Tiến độ vẫn còn trên máy; ứng dụng sẽ thử lại.",
          { id: "progress-sync-error" },
        );
      },
    });
    sync.start();
    return () => {
      active = false;
      subscription.unsubscribe();
      sync.stop();
      cache.removeQueries({ queryKey: ["progress", owner] });
    };
  }, [owner, confirmed, cache]);
  const merge = async () => {
    if (!owner) return;
    setBusy(true);
    try {
      await progressStore.mergeGuest(owner, true);
      await cache.invalidateQueries({ queryKey: ["progress"] });
      setPrompt(false);
    } catch {
      toast.error("Chưa gộp được tiến độ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AccountProgressContext.Provider
      value={{
        enabled: !!(owner && confirmed && supabase),
        online,
        queued,
        synced: pulled && queued === 0,
      }}
    >
      {prompt && (
        <aside
          aria-label="Tiến độ khách"
          className="flex flex-wrap items-center justify-center gap-3 border-b p-3"
        >
          <p>Gộp tiến độ khách trên máy này vào tài khoản đang đăng nhập?</p>
          <Button disabled={busy} onClick={() => void merge()}>
            Gộp tiến độ
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setPrompt(false)}
          >
            Giữ riêng
          </Button>
        </aside>
      )}
      {children}
    </AccountProgressContext.Provider>
  );
}
