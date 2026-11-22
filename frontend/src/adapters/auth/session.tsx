import { isOwnerRetired } from "@/adapters/local-store/retirement";
import type { Session } from "@supabase/supabase-js";
import { liveQuery } from "dexie";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { clearDeletedSession, offlineSession, supabase } from "./client";

const AuthContext = createContext<{
  session: Session | null;
  recovering: boolean;
  finishRecovery: () => void;
}>({ session: null, recovering: false, finishRecovery: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let version = 0;
    function restoreOffline() {
      const current = ++version;
      void offlineSession()
        .catch(() => null)
        .then((cached) => {
          if (active && current === version) {
            setSession(cached);
            setReady(true);
          }
        });
    }
    if (!navigator.onLine) restoreOffline();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!next && event === "INITIAL_SESSION" && !navigator.onLine) {
        restoreOffline();
        return;
      }
      version++;
      setSession(next);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (!next) setRecovering(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const owner = session?.user.id;
  useEffect(() => {
    if (!owner) return;
    const subscription = liveQuery(() => isOwnerRetired(owner)).subscribe(
      (marker) => {
        if (!marker) return;
        setSession((previous) =>
          previous?.user.id === owner ? null : previous,
        );
        void clearDeletedSession(owner).catch(() => {});
      },
    );
    return () => subscription.unsubscribe();
  }, [owner]);
  return (
    <AuthContext.Provider
      value={{
        session,
        recovering,
        finishRecovery: () => setRecovering(false),
      }}
    >
      {ready ? children : <output className="p-6">Đang mở tài khoản…</output>}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
