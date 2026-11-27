import { db } from "@/adapters/local-store/db";
import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeSnapshot {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

export interface ThemeState extends ThemeSnapshot {
  setPreference: (next: ThemePreference) => void;
}

export const THEME_STORAGE_KEY = "luyen-jlpt:theme";
const THEME_SETTING_KEY = "themePreference";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const SERVER_SNAPSHOT: ThemeSnapshot = {
  preference: "system",
  resolved: "light",
};

const listeners = new Set<() => void>();
let initialized = false;
let osDark = false;
let preferenceRevision = 0;
let snapshot: ThemeSnapshot = SERVER_SNAPSHOT;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

function readValidStoredPreference(): ThemePreference | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredPreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}

function readOsDark(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(DARK_MEDIA_QUERY).matches
    );
  } catch {
    return false;
  }
}

function syncDocumentClass(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function applyState(preference: ThemePreference, systemDark: boolean): void {
  osDark = systemDark;
  const resolved = resolveTheme(preference, systemDark);
  syncDocumentClass(resolved);
  if (snapshot.preference === preference && snapshot.resolved === resolved) {
    return;
  }
  snapshot = { preference, resolved };
  for (const listener of listeners) listener();
}

function hydrateFromSettings(expectedRevision: number): void {
  if (typeof indexedDB === "undefined") return;
  void db.settings
    .get(THEME_SETTING_KEY)
    .then((row) => {
      if (preferenceRevision !== expectedRevision) return;
      if (!isThemePreference(row?.value)) return;
      writeStoredPreference(row.value);
      applyState(row.value, osDark);
    })
    .catch(() => {
      // Ignore IndexedDB unavailability in restricted environments.
    });
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const stored = readValidStoredPreference();
  const initialPref = stored ?? "system";
  const initialOsDark = readOsDark();
  osDark = initialOsDark;
  const initialResolved = resolveTheme(initialPref, initialOsDark);
  snapshot = { preference: initialPref, resolved: initialResolved };
  syncDocumentClass(initialResolved);

  if (stored === null) {
    hydrateFromSettings(preferenceRevision);
  }

  try {
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia(DARK_MEDIA_QUERY);
      const onMediaChange = (event: MediaQueryListEvent) => {
        applyState(snapshot.preference, event.matches);
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
    if (event.key !== THEME_STORAGE_KEY) return;
    preferenceRevision += 1;
    applyState(parseThemePreference(event.newValue), osDark);
  });
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemeSnapshot(): ThemeSnapshot {
  ensureInitialized();
  return snapshot;
}

function getServerSnapshot(): ThemeSnapshot {
  return SERVER_SNAPSHOT;
}

export function setThemePreference(next: ThemePreference): void {
  ensureInitialized();
  const preference = parseThemePreference(next);
  preferenceRevision += 1;
  writeStoredPreference(preference);
  applyState(preference, osDark);

  if (typeof indexedDB !== "undefined") {
    void db.settings
      .put({ key: THEME_SETTING_KEY, value: preference })
      .catch(() => {
        // Ignore IndexedDB write failures in restricted environments.
      });
  }
}

export function useThemePreference(): ThemeState {
  const current = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerSnapshot,
  );
  return {
    ...current,
    setPreference: setThemePreference,
  };
}
