import { useContent } from "@/hooks/useContent";
import type { ReactNode } from "react";
import type { QuizItem } from "./quizEngine";

function lessonText(lessons: string[]): string {
  return lessons.length > 0 ? `Bài ${lessons.join(", ")}` : "";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function jpList(values: string[]) {
  return values.length > 0 ? (
    <span className="font-jp-sans" lang="ja">
      {values.join("、")}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

/** Hán Việt reading, readings and meaning for a kanji or compound. */
export function Explanation({ item }: { item: QuizItem }) {
  const { pack } = useContent();
  if (item.kind === "kanji") {
    const e = item.entry;
    return (
      <div className="flex gap-5">
        <span
          lang="ja"
          className="font-jp shrink-0 text-5xl font-semibold leading-none text-foreground"
        >
          {e.kanji}
        </span>
        <dl className="min-w-0 flex-1 space-y-1.5">
          <Row label="Hán Việt">
            <span className="font-semibold tracking-wide">{e.hanViet}</span>
          </Row>
          <Row label="Âm On">{jpList(e.onyomi)}</Row>
          <Row label="Âm Kun">{jpList(e.kunyomi)}</Row>
          <Row label="Nghĩa">{e.meaning}</Row>
          {e.lessons.length > 0 && (
            <Row label="Học ở">{lessonText(e.lessons)}</Row>
          )}
        </dl>
      </div>
    );
  }

  const e = item.entry;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <ruby
          lang="ja"
          className="font-jp text-4xl font-semibold text-foreground"
        >
          {e.word}
          <rt>{e.reading}</rt>
        </ruby>
        <dl className="min-w-0 flex-1 space-y-1.5">
          <Row label="Cách đọc">{jpList([e.reading])}</Row>
          <Row label="Hán Việt">
            <span className="font-semibold tracking-wide">
              {e.hanViet || "—"}
            </span>
          </Row>
          <Row label="Nghĩa">{e.meaning}</Row>
          {e.lessons.length > 0 && (
            <Row label="Học ở">{lessonText(e.lessons)}</Row>
          )}
        </dl>
      </div>
      {e.components.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thành phần Kanji
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {e.components.map((c) => {
              const ref = pack?.kanji.find((entry) => entry.kanji === c.kanji);
              const hanViet = c.hanViet || ref?.hanViet || "";
              const meaning = c.meaning || ref?.meaning || "";
              return (
                <li
                  key={c.kanji}
                  className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <span lang="ja" className="font-jp text-2xl font-semibold">
                    {c.kanji}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold tracking-wide">
                      {hanViet || "—"}
                    </span>
                    {meaning && (
                      <span className="block text-muted-foreground">
                        {meaning}
                      </span>
                    )}
                    {!meaning && !ref && (
                      <span className="block text-xs text-muted-foreground">
                        Chưa có trong danh sách Kanji đơn
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
