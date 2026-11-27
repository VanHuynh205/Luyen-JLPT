import { db } from "@/adapters/local-store/db";
import type { Level } from "@/core/content/types";
import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";

function defaultFuriganaForLevel(level: Level): boolean {
  return level === "n5" || level === "n4";
}

function furiganaSettingKey(level: Level): string {
  return `furigana:${level}`;
}

/** Persists per-level furigana display preference in IndexedDB `settings`. */
export function useFuriganaPreference(level: Level): {
  showFurigana: boolean;
  setShowFurigana: (value: boolean) => void;
} {
  const key = furiganaSettingKey(level);
  const defaultValue = defaultFuriganaForLevel(level);
  const [stored, setStored] = useState<{
    level: Level;
    value: boolean | undefined;
  }>({ level, value: undefined });

  useEffect(() => {
    let active = true;
    const subscription = liveQuery(() => db.settings.get(key)).subscribe({
      next: (row) => {
        if (!active) return;
        setStored({
          level,
          value: typeof row?.value === "boolean" ? row.value : undefined,
        });
      },
      error: () => {
        if (!active) return;
        setStored({ level, value: undefined });
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [key, level]);

  const showFurigana =
    stored.level === level && stored.value !== undefined
      ? stored.value
      : defaultValue;

  const setShowFurigana = useCallback(
    (value: boolean) => {
      setStored({ level, value });
      void db.settings.put({ key, value }).catch(() => {
        // Keep optimistic UI state if IndexedDB write fails in restricted browsing modes.
      });
    },
    [key, level],
  );

  return { showFurigana, setShowFurigana };
}
