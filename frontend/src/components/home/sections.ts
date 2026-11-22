import type { ContentPack } from "@/core/content/types";
import { KanjiQuizMode, type ProgressSummary } from "@/core/progress/types";

export type SectionKey = "vocab" | "kanji" | "grammar" | "reading";

export interface StudySection {
  key: SectionKey;
  to: "/tu-vung" | "/kanji" | "/ngu-phap" | "/doc-hieu";
  glyph: string;
  reading: string;
  title: string;
  description: string;
  cta: string;
}

export const getStudySections = (pack: ContentPack): StudySection[] => [
  {
    key: "vocab",
    to: "/tu-vung",
    glyph: "語",
    reading: "ご",
    title: "Từ vựng",
    description: `${pack.vocabulary.length} từ vựng ${pack.manifest.level.toUpperCase()}, học bằng flashcard lật mặt và đánh dấu đã thuộc.`,
    cta: "Học flashcard",
  },
  {
    key: "kanji",
    to: "/kanji",
    glyph: "漢",
    reading: "かん",
    title: "Kanji",
    description: `Trắc nghiệm ${pack.kanji.length} chữ Hán đơn và ${pack.compounds.length} từ ghép, giải thích âm Hán Việt và nghĩa.`,
    cta: "Làm trắc nghiệm",
  },
  {
    key: "grammar",
    to: "/ngu-phap",
    glyph: "文",
    reading: "ぶん",
    title: "Ngữ pháp",
    description: `${pack.grammar.length} mẫu câu ${pack.manifest.level.toUpperCase()} với nghĩa rõ ràng và nhiều câu ví dụ.`,
    cta: "Ôn ngữ pháp",
  },
  {
    key: "reading",
    to: "/doc-hieu",
    glyph: "読",
    reading: "どく",
    title: "Đọc hiểu",
    description: `${pack.reading.length} đoạn văn ngắn có câu hỏi, rèn kỹ năng đọc như đề thi.`,
    cta: "Luyện đọc",
  },
];

export interface SectionStat {
  label: string;
  value: string;
  /** 0–1, or null when there is nothing to show yet */
  ratio: number | null;
}

type KanjiResult = ProgressSummary["recentKanjiResults"][number];

/** Known flashcards that still exist in the current vocabulary. */
export function countKnownVocabulary(
  summary: ProgressSummary,
  pack: ContentPack,
): number {
  const ids = new Set(pack.vocabulary.map((w) => w.id));
  const known = new Set(
    summary.flashcards
      .filter((f) => f.known && ids.has(f.cardId))
      .map((f) => f.cardId),
  );
  return known.size;
}

export function currentKanjiResults(
  summary: ProgressSummary,
  pack: ContentPack,
): KanjiResult[] {
  const kanjiIds = new Set(pack.kanji.map((k) => k.id));
  const compoundIds = new Set(pack.compounds.map((c) => c.id));
  return summary.recentKanjiResults.filter((r) => {
    if (r.total <= 0n || r.score < 0n) return false;
    if (r.wrongItemIds.length === 0) return r.score === r.total;
    return (
      BigInt(r.wrongItemIds.length) === r.total - r.score &&
      new Set(r.wrongItemIds).size === r.wrongItemIds.length &&
      r.wrongItemIds.every((id) =>
        r.mode === KanjiQuizMode.single
          ? kanjiIds.has(id)
          : r.mode === KanjiQuizMode.compound
            ? compoundIds.has(id)
            : r.mode === KanjiQuizMode.mixed &&
              (kanjiIds.has(id) || compoundIds.has(id)),
      )
    );
  });
}

export function currentReadingResults(
  summary: ProgressSummary,
  pack: ContentPack,
) {
  const ids = new Set(pack.reading.map((p) => p.id));
  const seen = new Set<string>();
  return summary.readingResults.filter((result) => {
    if (
      !ids.has(result.passageId) ||
      seen.has(result.passageId) ||
      result.total <= 0n
    )
      return false;
    seen.add(result.passageId);
    return true;
  });
}

export function computeSectionStats(
  summary: ProgressSummary,
  pack: ContentPack,
): Record<SectionKey, SectionStat> {
  const vocabTotal = pack.vocabulary.length;
  const known = countKnownVocabulary(summary, pack);

  const latest = currentKanjiResults(summary, pack).reduce<KanjiResult | null>(
    (acc, r) => (!acc || r.takenAt > acc.takenAt ? r : acc),
    null,
  );
  const latestTotal = latest ? Number(latest.total) : 0;
  const latestScore = latest ? Math.min(Number(latest.score), latestTotal) : 0;

  const grammarIds = new Set(pack.grammar.map((p) => p.id));
  const learned = new Set(
    summary.learnedGrammarIds.filter((id) => grammarIds.has(id)),
  ).size;

  const done = currentReadingResults(summary, pack).length;

  return {
    vocab: {
      label: "Thẻ đã thuộc",
      value: `${known} / ${vocabTotal} từ`,
      ratio: vocabTotal ? known / vocabTotal : 0,
    },
    kanji: {
      label: "Bài Kanji gần nhất",
      value: latest
        ? `${latestScore} / ${latestTotal} câu đúng`
        : "Chưa đủ dữ liệu",
      ratio: latest && latestTotal ? latestScore / latestTotal : null,
    },
    grammar: {
      label: "Mẫu đã học",
      value: `${learned} / ${pack.grammar.length} mẫu`,
      ratio: pack.grammar.length ? learned / pack.grammar.length : 0,
    },
    reading: {
      label: "Bài đã đọc",
      value: `${done} / ${pack.reading.length} bài`,
      ratio: pack.reading.length ? done / pack.reading.length : 0,
    },
  };
}
