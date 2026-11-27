import { describe, expect, it } from "vitest";
import {
  auditFuriganaString,
  findUnannotatedKanji,
  stripRubyToPlain,
} from "./verify-furigana";

describe("stripRubyToPlain", () => {
  it("strips {base|reading} annotations back to plain Japanese text", () => {
    expect(
      stripRubyToPlain("{図書館|としょかん}で{本|ほん}を{読|よ}みます。"),
    ).toBe("図書館で本を読みます。");
  });

  it("preserves plain text and newlines unchanged", () => {
    expect(stripRubyToPlain("{田中|たなか}さんへ\nきのうはありがとう。")).toBe(
      "田中さんへ\nきのうはありがとう。",
    );
  });
});

describe("auditFuriganaString", () => {
  it("passes when stripping ruby matches plain text and all readings are kana", () => {
    expect(
      auditFuriganaString(
        "図書館で本を読みます。",
        "{図書館|としょかん}で{本|ほん}を{読|よ}みます。",
      ),
    ).toEqual([]);
  });

  it("accepts katakana, prolonged sound marks, and middle dots in readings", () => {
    expect(
      auditFuriganaString(
        "珈琲を飲みます。",
        "{珈琲|コーヒー}を{飲|の}みます。",
      ),
    ).toEqual([]);
    expect(
      auditFuriganaString(
        "人々が行きます。",
        "{人々|ひとびと}が{行|い}きます。",
      ),
    ).toEqual([]);
  });

  it("fails when reading contains latin, kanji, digits, or spaces", () => {
    expect(
      auditFuriganaString("本を読みます", "{本|book}を{読|よ}みます").length,
    ).toBeGreaterThan(0);
    expect(
      auditFuriganaString("本を読みます", "{本|本}を{読|よ}みます").length,
    ).toBeGreaterThan(0);
    expect(
      auditFuriganaString("本を読みます", "{本|ほん }を{読|よ}みます").length,
    ).toBeGreaterThan(0);
    expect(auditFuriganaString("二時", "{二時|2じ}").length).toBeGreaterThan(0);
  });

  it("fails when base text mismatches plain text", () => {
    expect(
      auditFuriganaString("本を読みます", "{紙|かみ}を{読|よ}みます").length,
    ).toBeGreaterThan(0);
  });

  it("fails on unbalanced braces, missing/extra pipes, and empty base or reading", () => {
    expect(auditFuriganaString("本", "{本|ほん").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "本|ほん}").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "{{本|ほん}}").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "{本}").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "{本|ほ|ん}").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "{|ほん}本").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本", "{本|}").length).toBeGreaterThan(0);
  });
});

describe("findUnannotatedKanji", () => {
  it("returns empty when every kanji is wrapped in ruby", () => {
    expect(
      findUnannotatedKanji("{図書館|としょかん}で{本|ほん}を{読|よ}みます。"),
    ).toEqual([]);
  });

  it("detects kanji left outside ruby annotations", () => {
    expect(
      findUnannotatedKanji("{図書館|としょかん}で本を{読|よ}みます。"),
    ).toEqual(["本"]);
  });
});
