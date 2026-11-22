import { Button } from "@/components/ui/button";
import { RotateCcw, Settings2 } from "lucide-react";
import { Explanation } from "./Explanation";
import { QuizHistory } from "./QuizHistory";
import type { QuizQuestion } from "./quizEngine";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function QuizResult({
  questions,
  answers,
  saveState,
  onRetrySave,
  onRetry,
  onChangeMode,
}: {
  questions: QuizQuestion[];
  answers: number[];
  saveState: SaveState;
  onRetrySave: () => void;
  onRetry: () => void;
  onChangeMode: () => void;
}) {
  const wrong = questions.filter((q, i) => answers[i] !== q.correctIndex);
  const score = questions.length - wrong.length;
  const ratio = questions.length ? score / questions.length : 0;
  const verdict =
    ratio >= 0.8
      ? "Xuất sắc!"
      : ratio >= 0.5
        ? "Khá tốt, cố lên!"
        : "Cần ôn thêm nhé.";

  return (
    <div data-ocid="kanji_quiz.result.panel" className="space-y-6">
      <div className="ink-rule flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-subtle sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div>
          <p className="text-sm text-muted-foreground">Kết quả của bạn</p>
          <p
            data-ocid="kanji_quiz.result.score"
            className="font-display text-6xl font-semibold tabular-nums text-foreground"
          >
            {score}/{questions.length}
          </p>
          <p className="mt-1 text-foreground">{verdict}</p>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {saveState === "saving" && "Đang lưu kết quả…"}
            {saveState === "saved" && "Đã lưu kết quả trên máy."}
            {saveState === "error" && (
              <span
                data-ocid="kanji_quiz.save.error_state"
                className="text-destructive"
              >
                Chưa lưu được kết quả.{" "}
                <button
                  type="button"
                  onClick={onRetrySave}
                  data-ocid="kanji_quiz.save.retry_button"
                  className="font-semibold underline underline-offset-2"
                >
                  Thử lưu lại
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onChangeMode}
            className="rounded-md transition-smooth"
            data-ocid="kanji_quiz.change_mode.secondary_button"
          >
            <Settings2 className="size-4" aria-hidden="true" />
            Đổi dạng bài
          </Button>
          <Button
            type="button"
            onClick={onRetry}
            className="rounded-md transition-smooth"
            data-ocid="kanji_quiz.retry.primary_button"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Làm lại
          </Button>
        </div>
      </div>

      <QuizHistory />

      <section data-ocid="kanji_quiz.wrong.section" className="space-y-3">
        <h2 className="text-xl font-semibold">
          Câu trả lời sai {wrong.length > 0 && `(${wrong.length})`}
        </h2>
        {wrong.length === 0 ? (
          <p
            data-ocid="kanji_quiz.wrong.empty_state"
            className="rounded-lg border bg-success/10 p-5 text-sm text-foreground"
          >
            Tuyệt vời! Bạn không trả lời sai câu nào.
          </p>
        ) : (
          <ul className="space-y-3">
            {wrong.map((q, i) => {
              const picked = answers[questions.indexOf(q)];
              return (
                <li
                  key={q.key}
                  data-ocid={`kanji_quiz.wrong.item.${i + 1}`}
                  className="rounded-lg border bg-card p-5"
                >
                  <p className="mb-3 text-sm text-muted-foreground">
                    {q.instruction}{" "}
                    <span
                      lang={q.subjectIsJapanese ? "ja" : undefined}
                      className="font-jp text-base font-semibold text-foreground"
                    >
                      {q.subject}
                    </span>
                  </p>
                  <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      Bạn chọn:{" "}
                      <span
                        lang={q.choicesAreJapanese ? "ja" : undefined}
                        className="text-destructive line-through"
                      >
                        {q.choices[picked]}
                      </span>
                    </span>
                    <span>
                      Đáp án đúng:{" "}
                      <span
                        lang={q.choicesAreJapanese ? "ja" : undefined}
                        className="font-semibold text-success"
                      >
                        {q.choices[q.correctIndex]}
                      </span>
                    </span>
                  </p>
                  <Explanation item={q.item} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
