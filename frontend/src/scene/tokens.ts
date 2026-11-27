import type { ResolvedTheme } from "@/hooks/useThemePreference";

export interface SceneTokens {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  accent: string;
  deskWood: string;
  inkShadow: string;
  muted: string;
  deskWoodDark: string;
  hankoWood: string;
  lamp: string;
}

export const SCENE_TOKENS = {
  background: "#F9F6F1",
  foreground: "#13161D",
  card: "#FEFDFB",
  primary: "#203F7C",
  accent: "#D33E21",
  deskWood: "#8A6A4A",
  inkShadow: "#13161D",
  muted: "#F1ECE4",
  deskWoodDark: "#6A4E34",
  hankoWood: "#3B2B20",
  lamp: "#FFE2D4",
} as const satisfies SceneTokens;

export const DARK_SCENE_TOKENS = {
  background: "#1D2028",
  foreground: "#F0ECE4",
  card: "#262A34",
  primary: "#7B9CE2",
  accent: "#E25B3E",
  deskWood: "#4E3B2B",
  inkShadow: "#0E1016",
  muted: "#2E333F",
  deskWoodDark: "#38291D",
  hankoWood: "#4A3628",
  lamp: "#FFD7A8",
} as const satisfies SceneTokens;

export function getSceneTokens(theme: ResolvedTheme): SceneTokens {
  return theme === "dark" ? DARK_SCENE_TOKENS : SCENE_TOKENS;
}

export type JlptSceneLevel = "n5" | "n4" | "n3" | "n2" | "n1";

export const LEVEL_KANJI: Record<JlptSceneLevel, string> = {
  n5: "あ",
  n4: "漢",
  n3: "学",
  n2: "語",
  n1: "極",
};

export const MINCHO_FONT_FAMILY =
  '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", Georgia, serif';

export function normalizeSceneLevel(level: string): JlptSceneLevel {
  const key = level.trim().toLowerCase();
  if (
    key === "n5" ||
    key === "n4" ||
    key === "n3" ||
    key === "n2" ||
    key === "n1"
  ) {
    return key;
  }
  return "n4";
}

export function getKanjiForLevel(level: string): string {
  return LEVEL_KANJI[normalizeSceneLevel(level)];
}
