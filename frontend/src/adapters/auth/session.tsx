import { isOwnerRetired } from "@/adapters/local-store/retirement";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { liveQuery } from "dexie";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import {
  AUTH_CALLBACK_ERROR,
  clearDeletedSession,
  completeWebAuthCallback,
  offlineSession,
  supabase,
} from "./client";

type AuthState = {
  session: Session | null | undefined;
  recovering: boolean;
  callbackFailed: boolean | undefined;
};

export const pendingSession: AuthState = {
  session: undefined,
  recovering: false,
  callbackFailed: undefined,
};

export const isSessionReady = (state: AuthState) =>
  state.session !== undefined && state.callbackFailed !== undefined;

export function authSessionReducer(
  state: AuthState,
  action:
    | { type: AuthChangeEvent; session: Session | null }
    | { type: "callback"; failed: boolean }
    | { type: "finishRecovery" }
    | { type: "retired"; owner: string },
): AuthState {
  switch (action.type) {
    case "callback":
      return { ...state, callbackFailed: action.failed };
    case "finishRecovery":
      return { ...state, recovering: false };
    case "retired":
      return state.session?.user.id === action.owner
        ? { ...state, session: null, recovering: false }
        : state;
    case "INITIAL_SESSION":
      if (state.session !== undefined) return state;
  }
  return {
    ...state,
    session: action.session,
    recovering:
      !!action.session &&
      (action.type === "PASSWORD_RECOVERY" ||
        (state.recovering &&
          state.session?.user.id === action.session.user.id)),
  };
}

const AuthContext = createContext<{
  session: Session | null;
  recovering: boolean;
  callbackError: string | null;
  clearCallbackError: () => void;
  finishRecovery: () => void;
}>({
  session: null,
  recovering: false,
  callbackError: null,
  clearCallbackError: () => {},
  finishRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authSessionReducer, pendingSession);
  const { session, recovering, callbackFailed } = state;
  const ready = !supabase || isSessionReady(state);
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
            dispatch({ type: "INITIAL_SESSION", session: cached });
          }
        });
    }
    if (!navigator.onLine) restoreOffline();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (!next && event === "INITIAL_SESSION" && !navigator.onLine) {
        restoreOffline();
        return;
      }
      version++;
      dispatch({ type: event, session: next });
    });
    void completeWebAuthCallback().then((failed) => {
      if (active) dispatch({ type: "callback", failed });
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
        dispatch({ type: "retired", owner });
        void clearDeletedSession(owner).catch(() => {});
      },
    );
    return () => subscription.unsubscribe();
  }, [owner]);
  return (
    <AuthContext.Provider
      value={{
        session: session ?? null,
        recovering,
        callbackError: callbackFailed ? AUTH_CALLBACK_ERROR : null,
        clearCallbackError: () => dispatch({ type: "callback", failed: false }),
        finishRecovery: () => dispatch({ type: "finishRecovery" }),
      }}
    >
      {ready ? children : <output className="p-6">Đang mở tài khoản…</output>}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
