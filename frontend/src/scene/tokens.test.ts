import { describe, expect, it } from "vitest";
import {
  createContactShadowTexture,
  createKanjiTextures,
  createWashiTexture,
  createWoodTexture,
} from "./kanjiTexture";
import {
  DARK_SCENE_TOKENS,
  LEVEL_KANJI,
  SCENE_TOKENS,
  getKanjiForLevel,
  getSceneTokens,
  normalizeSceneLevel,
} from "./tokens";

describe("scene tokens", () => {
  it("exposes Washi & Sumi 3D palette tokens", () => {
    expect(SCENE_TOKENS.background).toBe("#F9F6F1");
    expect(SCENE_TOKENS.foreground).toBe("#13161D");
    expect(SCENE_TOKENS.card).toBe("#FEFDFB");
    expect(SCENE_TOKENS.primary).toBe("#203F7C");
    expect(SCENE_TOKENS.accent).toBe("#D33E21");
    expect(SCENE_TOKENS.deskWood).toBe("#8A6A4A");
    expect(SCENE_TOKENS.inkShadow).toBe("#13161D");
  });

  it("maps JLPT levels n5 through n1 to expected display glyphs", () => {
    expect(LEVEL_KANJI).toEqual({
      n5: "あ",
      n4: "漢",
      n3: "学",
      n2: "語",
      n1: "極",
    });

    expect(getKanjiForLevel("n5")).toBe("あ");
    expect(getKanjiForLevel("n4")).toBe("漢");
    expect(getKanjiForLevel("n3")).toBe("学");
    expect(getKanjiForLevel("n2")).toBe("語");
    expect(getKanjiForLevel("n1")).toBe("極");
  });

  it("normalizes casing/whitespace and falls back to n4 for unknown levels", () => {
    expect(normalizeSceneLevel(" N3 ")).toBe("n3");
    expect(getKanjiForLevel("N2")).toBe("語");
    expect(normalizeSceneLevel("unknown")).toBe("n4");
    expect(getKanjiForLevel("")).toBe("漢");
  });

  it("safely returns null from canvas texture builders when document is unavailable", () => {
    expect(createKanjiTextures("漢")).toBeNull();
    expect(createWoodTexture()).toBeNull();
    expect(createWashiTexture(true)).toBeNull();
    expect(createContactShadowTexture()).toBeNull();
  });

  it("returns dark sumi palette distinct from light washi palette and never pure #000000", () => {
    expect(getSceneTokens("light")).toEqual(SCENE_TOKENS);

    const dark = getSceneTokens("dark");
    expect(dark).toEqual(DARK_SCENE_TOKENS);
    expect(dark.background).toBe("#1D2028");
    expect(dark.deskWood).toBe("#4E3B2B");
    expect(dark.foreground).toBe("#F0ECE4");
    expect(dark.lamp).toBe("#FFD7A8");
    expect(dark.primary).toBe("#7B9CE2");
    expect(dark.background).not.toBe(SCENE_TOKENS.background);
    expect(dark.deskWood).not.toBe(SCENE_TOKENS.deskWood);

    for (const value of Object.values(dark)) {
      expect(value.toUpperCase()).not.toBe("#000000");
    }
  });
});
