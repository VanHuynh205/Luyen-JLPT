import { Progress } from "@/components/ui/progress";
import type { ReadingPassage } from "@/core/content/types";
import type { KanjiQuizResult, ReadingResult } from "@/core/progress/types";
import { KanjiQuizMode } from "@/core/progress/types";
import { timestampToDate } from "@/hooks/useProgress";
import { percentOf } from "./ProgressStatCard";

const MODE_LABEL: Record<KanjiQuizMode, string> = {
  [KanjiQuizMode.single]: "Chữ đơn",
  [KanjiQuizMode.compound]: "Từ ghép",
  [KanjiQuizMode.mixed]: "Kết hợp",
};

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(ts: bigint): string {
  const date = timestampToDate(ts);
  return date ? dateFormat.format(date) : "Không rõ thời gian";
}

function SectionShell({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-ocid={`progress.${id}.section`}
      aria-labelledby={`progress-${id}-title`}
      className="rounded-lg border bg-card p-5 shadow-subtle md:p-6"
    >
      <h2 id={`progress-${id}-title`} className="mb-4 text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyLine({ id, text }: { id: string; text: string }) {
  return (
    <p
      data-ocid={`progress.${id}.empty_state`}
      className="rounded-md bg-muted px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {text}
    </p>
  );
}

export function KanjiResultsList({ results }: { results: KanjiQuizResult[] }) {
  const sorted = [...results].sort((a, b) =>
    b.takenAt > a.takenAt ? 1 : b.takenAt < a.takenAt ? -1 : 0,
  );
  return (
    <SectionShell id="kanji" title="Kết quả Kanji">
      {sorted.length === 0 ? (
        <EmptyLine id="kanji" text="Chưa có kết quả Kanji." />
      ) : (
        <ul data-ocid="progress.kanji.list" className="divide-y divide-border">
          {sorted.map((r, i) => {
            const score = Number(r.score);
            const total = Number(r.total);
            const pct = percentOf(score, total);
            return (
              <li
                key={r.id.toString()}
                data-ocid={`progress.kanji.item.${i + 1}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
              >
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {MODE_LABEL[r.mode]}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {formatDate(r.takenAt)}
                </span>
                <span className="font-semibold tabular-nums">
                  {score}/{total}
                </span>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

export function ReadingResultsList({
  results,
  passages,
}: { results: ReadingResult[]; passages: ReadingPassage[] }) {
  const titles = new Map(passages.map((p) => [p.id, p.title]));
  return (
    <SectionShell id="reading" title="Điểm cao nhất bài đọc hiểu">
      {results.length === 0 ? (
        <EmptyLine id="reading" text="Bạn chưa hoàn thành bài đọc hiểu nào." />
      ) : (
        <ul data-ocid="progress.reading.list" className="flex flex-col gap-4">
          {results.map((r, i) => {
            const best = Number(r.bestScore);
            const total = Number(r.total);
            const pct = percentOf(best, total);
            return (
              <li
                key={r.passageId}
                data-ocid={`progress.reading.item.${i + 1}`}
                className="flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    {titles.get(r.passageId) ?? r.passageId}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {best}/{total}
                  </span>
                </div>
                <Progress
                  value={pct}
                  aria-label={`Điểm cao nhất ${pct}%`}
                  className="h-1.5 bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {Number(r.attempts)} lần làm · Lần gần nhất{" "}
                  {formatDate(r.lastAttemptAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}
