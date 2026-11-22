import { supabase } from "@/adapters/auth/client";
import { useAuth } from "@/adapters/auth/session";
import {
  listAvailableLevels,
  loadPack,
} from "@/adapters/content-pack/packSource";
import type { ContentPack, Level } from "@/core/content/types";
import { resolveLevel } from "@/core/level";
import { GUEST_OWNER } from "@/core/progress";
import { liveQuery } from "dexie";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import {
  createLevelProfile,
  readLevelPreference,
  saveLevelPreference,
  syncLevelPreference,
} from "./levelPreference";

type Selection = { level: Level; available: Level[] };

type ContentState = Selection & {
  setLevel: (level: Level) => void;
  pack: ContentPack | null;
  status: "loading" | "ready" | "error";
  retry: () => void;
  preferenceSync: { pending: boolean; synced: boolean };
};

const ContentContext = createContext<ContentState | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const owner = session?.user.id;
  return (
    <OwnerContentProvider
      key={owner ?? GUEST_OWNER}
      owner={owner}
      confirmed={!!session?.user.email_confirmed_at}
    >
      {children}
    </OwnerContentProvider>
  );
}

function OwnerContentProvider({
  children,
  owner,
  confirmed,
}: { children: ReactNode; owner?: string; confirmed: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [available, setAvailable] = useState<Level[] | null>(null);
  const [preference, setPreference] = useState<Awaited<
    ReturnType<typeof readLevelPreference>
  > | null>(undefined);
  const [profileSynced, setProfileSynced] = useState(false);
  const [loaded, setLoaded] = useState<{
    attempt: number;
    level: Level;
    pack: ContentPack | null;
  } | null>(null);

  useEffect(() => {
    const subscription = liveQuery(() => readLevelPreference(owner)).subscribe({
      next: (value) => setPreference(value ?? null),
      error: () => {
        setPreference(null);
        setProfileSynced(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [owner]);

  useEffect(() => {
    if (available) return;
    let active = true;
    void listAvailableLevels()
      .catch((): Level[] => ["n4"])
      .then((levels) => {
        if (active) setAvailable(levels.length ? levels : ["n4"]);
      });
    return () => {
      active = false;
    };
  }, [available]);

  useEffect(() => {
    setProfileSynced(false);
    if (!owner || !confirmed || !supabase) return;
    const profile = createLevelProfile(supabase, owner);
    let inFlight: AbortController | undefined;
    const retryMs = 10_000;

    const sync = () => {
      if (inFlight || navigator.onLine === false) return;
      const controller = new AbortController();
      inFlight = controller;
      void withAbortDeadline(controller.signal, retryMs, (signal) =>
        syncLevelPreference(owner, profile, signal),
      )
        .then((synced) => {
          if (!controller.signal.aborted) setProfileSynced(synced);
        })
        .catch(() => {
          if (!controller.signal.aborted) setProfileSynced(false);
        })
        .finally(() => {
          inFlight = undefined;
        });
    };

    const offline = () => {
      inFlight?.abort();
      setProfileSynced(false);
    };
    sync();
    const timer = window.setInterval(sync, retryMs);
    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    return () => {
      inFlight?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline);
    };
  }, [owner, confirmed]);

  const canLoad = available !== null && preference !== undefined;
  const level = resolveLevel(preference?.level, available ?? []);

  useEffect(() => {
    if (!canLoad) return;
    let active = true;
    void loadPack(level)
      .then((result) => {
        if (active)
          setLoaded({ attempt, level, pack: result.ok ? result.value : null });
      })
      .catch(() => {
        if (active) setLoaded({ attempt, level, pack: null });
      });
    return () => {
      active = false;
    };
  }, [attempt, canLoad, level]);

  const current =
    canLoad && loaded?.attempt === attempt && loaded.level === level
      ? loaded
      : null;
  const pack = current?.pack ?? null;
  const value: ContentState = {
    level,
    available: available ?? [],
    pack,
    status: !current ? "loading" : pack ? "ready" : "error",
    setLevel: (nextLevel) => {
      if (nextLevel === level || !available?.includes(nextLevel)) return;
      void saveLevelPreference(owner, nextLevel).catch(() =>
        toast.error("Chưa lưu được cấp độ trên máy. Vui lòng thử lại."),
      );
    },
    retry: () => {
      setAvailable(null);
      setAttempt((current) => current + 1);
    },
    preferenceSync: {
      pending: preference?.pending ?? false,
      synced: profileSynced,
    },
  };

  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}

export function useContent(): ContentState {
  const content = useContext(ContentContext);
  if (!content) throw new Error("ContentProvider is missing");
  return content;
}

export function useReadyPack(): ContentPack {
  const { pack } = useContent();
  if (!pack) throw new Error("No content pack is ready");
  return pack;
}
import { withAbortDeadline } from "@/core/abort";
