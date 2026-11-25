import { describe, expect, it } from "vitest";
import { parseRubyText } from "./ruby";

describe("parseRubyText", () => {
  it("returns an empty array for empty input", () => {
    expect(parseRubyText("")).toEqual([]);
  });

  it("returns a plain text segment when there is no markup", () => {
    expect(parseRubyText("きょうは いい てんきです。")).toEqual([
      { kind: "text", text: "きょうは いい てんきです。" },
    ]);
  });

  it("parses standalone ruby annotations", () => {
    expect(parseRubyText("{漢字|かんじ}")).toEqual([
      { kind: "ruby", base: "漢字", reading: "かんじ" },
    ]);
  });

  it("parses mixed plain text and ruby annotations", () => {
    expect(parseRubyText("きょうは{天気|てんき}が{良|よ}いです。")).toEqual([
      { kind: "text", text: "きょうは" },
      { kind: "ruby", base: "天気", reading: "てんき" },
      { kind: "text", text: "が" },
      { kind: "ruby", base: "良", reading: "よ" },
      { kind: "text", text: "いです。" },
    ]);
  });

  it("parses underlined plain text", () => {
    expect(parseRubyText("[[あした]]は{休|やす}みです。")).toEqual([
      { kind: "text", text: "あした", underline: true },
      { kind: "text", text: "は" },
      { kind: "ruby", base: "休", reading: "やす" },
      { kind: "text", text: "みです。" },
    ]);
  });

  it("parses nested ruby annotations inside underlined spans", () => {
    expect(parseRubyText("[[{買|か}い{物|もの}]]に{行|い}きます。")).toEqual([
      { kind: "ruby", base: "買", reading: "か", underline: true },
      { kind: "text", text: "い", underline: true },
      { kind: "ruby", base: "物", reading: "もの", underline: true },
      { kind: "text", text: "に" },
      { kind: "ruby", base: "行", reading: "い" },
      { kind: "text", text: "きます。" },
    ]);
  });

  it("handles multiple underlined spans in one string", () => {
    expect(parseRubyText("[[A]]と[[{B|びー}]]")).toEqual([
      { kind: "text", text: "A", underline: true },
      { kind: "text", text: "と" },
      { kind: "ruby", base: "B", reading: "びー", underline: true },
    ]);
  });

  it("treats unclosed braces and malformed ruby tokens as literal text", () => {
    expect(parseRubyText("{漢字")).toEqual([{ kind: "text", text: "{漢字" }]);
    expect(parseRubyText("{no-pipe}と{漢字|かんじ}")).toEqual([
      { kind: "text", text: "{no-pipe}と" },
      { kind: "ruby", base: "漢字", reading: "かんじ" },
    ]);
    expect(parseRubyText("{broken {漢字|かんじ}")).toEqual([
      { kind: "text", text: "{broken " },
      { kind: "ruby", base: "漢字", reading: "かんじ" },
    ]);
    expect(parseRubyText("{|かんじ}{漢字|}")).toEqual([
      { kind: "text", text: "{|かんじ}{漢字|}" },
    ]);
  });

  it("treats unclosed underline brackets as literal text while still parsing ruby", () => {
    expect(parseRubyText("[[{漢字|かんじ}")).toEqual([
      { kind: "text", text: "[[" },
      { kind: "ruby", base: "漢字", reading: "かんじ" },
    ]);
    expect(parseRubyText("[[outer [[inner]]")).toEqual([
      { kind: "text", text: "[[outer " },
      { kind: "text", text: "inner", underline: true },
    ]);
  });

  it("preserves raw HTML characters as literal text segments", () => {
    expect(parseRubyText("<script>alert(1)</script>")).toEqual([
      { kind: "text", text: "<script>alert(1)</script>" },
    ]);
  });
});
