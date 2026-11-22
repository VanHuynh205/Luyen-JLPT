import type { CompoundEntry, KanjiEntry } from "@/core/content/types";

/** Lowercase, strip Vietnamese diacritics, fold katakana to hiragana. */
export function normalize(value: string): string {
  return (
    value
      .normalize("NFD")
      // Keep Japanese voicing marks (U+3099/U+309A); drop Latin diacritics
      .replace(/\p{M}/gu, (m) => (m === "\u3099" || m === "\u309a" ? m : ""))
      .normalize("NFC")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[\u30a1-\u30f6]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60),
      )
      .trim()
  );
}

function matches(fields: string[], query: string): boolean {
  return fields.some((field) => normalize(field).includes(query));
}

export function filterKanji(list: KanjiEntry[], query: string): KanjiEntry[] {
  const q = normalize(query);
  if (!q) return list;
  return list.filter((k) =>
    matches([k.kanji, k.hanViet, k.meaning, ...k.onyomi, ...k.kunyomi], q),
  );
}

export function filterCompounds(
  list: CompoundEntry[],
  query: string,
): CompoundEntry[] {
  const q = normalize(query);
  if (!q) return list;
  return list.filter((c) =>
    matches(
      [
        c.word,
        c.reading,
        c.hanViet,
        c.meaning,
        ...c.components.flatMap((p) => [p.kanji, p.hanViet, p.meaning]),
      ],
      q,
    ),
  );
}
