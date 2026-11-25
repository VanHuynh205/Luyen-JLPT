import {
  type MotionMode,
  type MotionPreference,
  parseMotionPreference,
  resolveMotionMode,
} from "@/core/motion";
import { useSyncExternalStore } from "react";

export type { MotionMode, MotionPreference };

export interface MotionSnapshot {
  preference: MotionPreference;
  mode: MotionMode;
  osReduced: boolean;
  webglSupported: boolean | null;
  lowPerf: boolean;
}

export interface MotionState extends MotionSnapshot {
  setPreference: (preference: MotionPreference) => void;
  markLowPerf: () => void;
}

const STORAGE_KEY = "jlpt:motionPreference";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const SERVER_SNAPSHOT: MotionSnapshot = {
  preference: "auto",
  mode: "static",
  osReduced: false,
  webglSupported: null,
  lowPerf: false,
};

const listeners = new Set<() => void>();
let initialized = false;
let snapshot: MotionSnapshot = SERVER_SNAPSHOT;

function readStoredPreference(): MotionPreference {
  try {
    return parseMotionPreference(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "auto";
  }
}

function writeStoredPreference(preference: MotionPreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}

function readOsReduced(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_QUERY).matches
    );
  } catch {
    return false;
  }
}

/** Probe WebGL once without logging console errors in headless or SSR runtimes. */
function probeWebGLSupport(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (typeof window.WebGL2RenderingContext !== "function") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const attrs: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: true,
      powerPreference: "default",
    };
    const gl = canvas.getContext("webgl2", attrs);
    if (!gl) return false;
    // Release the probe context immediately to preserve WebView context limits.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function syncDocumentClass(mode: MotionMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    "reduce-motion",
    mode === "reduced",
  );
}

function buildSnapshot(
  preference: MotionPreference,
  osReduced: boolean,
  webglSupported: boolean | null,
  lowPerf: boolean,
): MotionSnapshot {
  const mode = resolveMotionMode({
    preference,
    osReduced,
    webglSupported,
    lowPerf,
  });
  return { preference, mode, osReduced, webglSupported, lowPerf };
}

function updateSnapshot(next: MotionSnapshot): void {
  if (
    snapshot.preference === next.preference &&
    snapshot.mode === next.mode &&
    snapshot.osReduced === next.osReduced &&
    snapshot.webglSupported === next.webglSupported &&
    snapshot.lowPerf === next.lowPerf
  ) {
    return;
  }
  snapshot = next;
  syncDocumentClass(next.mode);
  for (const listener of listeners) listener();
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const preference = readStoredPreference();
  const osReduced = readOsReduced();
  snapshot = buildSnapshot(preference, osReduced, null, false);
  syncDocumentClass(snapshot.mode);

  try {
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia(REDUCED_QUERY);
      const onMediaChange = (event: MediaQueryListEvent) => {
        updateSnapshot(
          buildSnapshot(
            snapshot.preference,
            event.matches,
            snapshot.webglSupported,
            snapshot.lowPerf,
          ),
        );
      };
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onMediaChange);
      } else if (typeof mql.addListener === "function") {
        mql.addListener(onMediaChange);
      }
    }
  } catch {
    // Ignore unsupported matchMedia listeners.
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const nextPref = parseMotionPreference(event.newValue);
    updateSnapshot(
      buildSnapshot(
        nextPref,
        snapshot.osReduced,
        snapshot.webglSupported,
        snapshot.lowPerf,
      ),
    );
  });
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMotionSnapshot(): MotionSnapshot {
  ensureInitialized();
  return snapshot;
}

function getServerSnapshot(): MotionSnapshot {
  return SERVER_SNAPSHOT;
}

export function setMotionPreference(preference: MotionPreference): void {
  ensureInitialized();
  writeStoredPreference(preference);
  updateSnapshot(
    buildSnapshot(
      preference,
      snapshot.osReduced,
      snapshot.webglSupported,
      snapshot.lowPerf,
    ),
  );
}

export function markMotionLowPerf(): void {
  ensureInitialized();
  if (snapshot.lowPerf) return;
  updateSnapshot(
    buildSnapshot(
      snapshot.preference,
      snapshot.osReduced,
      snapshot.webglSupported,
      true,
    ),
  );
}

export function checkMotionWebGL(): void {
  ensureInitialized();
  if (snapshot.mode !== "full" || snapshot.webglSupported !== null) return;
  updateSnapshot(
    buildSnapshot(
      snapshot.preference,
      snapshot.osReduced,
      probeWebGLSupport(),
      snapshot.lowPerf,
    ),
  );
}

export function useMotionPreference(): MotionState {
  const current = useSyncExternalStore(
    subscribe,
    getMotionSnapshot,
    getServerSnapshot,
  );
  return {
    ...current,
    setPreference: setMotionPreference,
    markLowPerf: markMotionLowPerf,
  };
}
