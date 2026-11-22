import { db } from "@/adapters/local-store/db";
import { QUESTION_COUNT } from "@/components/kanji-quiz/quizEngine";
import { KanjiQuizMode } from "@/core/progress/types";
import { useEffect, useRef, useState } from "react";

export type QuizCounts = Record<KanjiQuizMode, number>;

const KEY = "kanjiQuizCounts";
const MODES = [
  KanjiQuizMode.single,
  KanjiQuizMode.compound,
  KanjiQuizMode.mixed,
] as const;

function parseQuizCounts(raw: unknown): QuizCounts {
  const saved =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const counts = {} as QuizCounts;
  for (const mode of MODES) {
    const value = saved[mode];
    // Giới hạn theo Gói được kẹp lại lúc dùng; ở đây chỉ loại giá trị hỏng.
    counts[mode] =
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.round(value)
        : QUESTION_COUNT;
  }
  return counts;
}

export async function loadQuizCounts(): Promise<QuizCounts> {
  const row = await db.settings.get(KEY).catch(() => undefined);
  return parseQuizCounts(row?.value);
}

export async function saveQuizCounts(counts: QuizCounts): Promise<void> {
  await db.settings.put({ key: KEY, value: counts });
}

/** Số câu trắc nghiệm Kanji theo từng dạng bài, lưu trong IndexedDB của trình duyệt. */
export function useQuizCounts(): [
  QuizCounts,
  (mode: KanjiQuizMode, count: number) => void,
] {
  const [counts, setCounts] = useState<QuizCounts>(() =>
    parseQuizCounts(undefined),
  );
  const changed = useRef(false);

  useEffect(() => {
    let active = true;
    void loadQuizCounts().then((saved) => {
      // Không ghi đè lựa chọn người học đã bấm trong lúc đang đọc.
      if (active && !changed.current) setCounts(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const setCount = (mode: KanjiQuizMode, count: number) => {
    changed.current = true;
    const next = { ...counts, [mode]: count };
    setCounts(next);
    void saveQuizCounts(next).catch(() => undefined);
  };

  return [counts, setCount];
}
