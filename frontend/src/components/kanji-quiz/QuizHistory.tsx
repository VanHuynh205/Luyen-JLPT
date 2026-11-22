import { Skeleton } from "@/components/ui/skeleton";
import { timestampToDate, useMyKanjiHistory } from "@/hooks/useProgress";
import { History } from "lucide-react";
import { modeLabel } from "./quizEngine";

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Signed-in learner's past kanji quiz scores, newest first. */
export function QuizHistory() {
  const { data, isLoading, isError } = useMyKanjiHistory();
  const results = [...(data ?? [])]
    .sort((a, b) =>
      a.takenAt > b.takenAt ? -1 : a.takenAt < b.takenAt ? 1 : 0,
    )
    .slice(0, 10);

  return (
    <section
      data-ocid="kanji_quiz.history.section"
      className="rounded-lg border bg-card p-5 md:p-6"
    >
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <History className="size-5 text-primary" aria-hidden="true" />
        Lịch sử điểm
      </h2>
      {isLoading ? (
        <div data-ocid="kanji_quiz.history.loading_state" className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => `history-skeleton-${i}`).map(
            (id) => (
              <Skeleton key={id} className="h-10 w-full" />
            ),
          )}
        </div>
      ) : isError ? (
        <p
          data-ocid="kanji_quiz.history.error_state"
          className="text-sm text-destructive"
        >
          Không tải được lịch sử điểm. Vui lòng thử lại sau.
        </p>
      ) : results.length === 0 ? (
        <p
          data-ocid="kanji_quiz.history.empty_state"
          className="text-sm text-muted-foreground"
        >
          Chưa có bài làm nào được lưu.
        </p>
      ) : (
        <ul data-ocid="kanji_quiz.history.list" className="divide-y">
          {results.map((r, i) => {
            const date = timestampToDate(r.takenAt);
            const score = Number(r.score);
            const total = Number(r.total);
            return (
              <li
                key={r.id.toString()}
                data-ocid={`kanji_quiz.history.item.${i + 1}`}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    {modeLabel(r.mode)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {date ? dateFormat.format(date) : "—"}
                  </span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {score}/{total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
