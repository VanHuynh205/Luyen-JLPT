import type { Level } from "./content/types";

export function resolveLevel(saved: unknown, available: Level[]): Level {
  return (
    available.find((level) => level === saved) ??
    (available.includes("n4") ? "n4" : (available[0] ?? "n4"))
  );
}
