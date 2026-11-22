import type { ReadingQuestion } from "@/core/content/types";
import { cn } from "@/lib/utils";
import { Check, Lightbulb, X } from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  index,
  selected,
  submitted,
  onSelect,
}: {
  question: ReadingQuestion;
  index: number;
  selected: number | undefined;
  submitted: boolean;
  onSelect: (choice: number) => void;
}) {
  const n = index + 1;
  const isCorrect = submitted && selected === question.answerIndex;
  return (
    <fieldset
      data-ocid={`reading_detail.question.item.${n}`}
      className="rounded-xl border bg-card p-5 shadow-subtle md:p-6"
    >
      <legend className="sr-only">Câu hỏi {n}</legend>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="min-w-0 font-jp-sans text-base leading-relaxed text-foreground">
          <span className="mr-2 font-display font-semibold text-primary">
            Câu {n}.
          </span>
          <span lang="ja">{question.question}</span>
        </p>
        {submitted && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              isCorrect
                ? "bg-success/15 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {isCorrect ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <X className="size-3.5" aria-hidden="true" />
            )}
            {isCorrect ? "Đúng" : "Sai"}
          </span>
        )}
      </div>
      <div className="grid gap-2">
        {question.choices.map((choice, ci) => {
          const isSelected = selected === ci;
          const isAnswer = ci === question.answerIndex;
          return (
            <label
              key={choice}
              data-ocid={`reading_detail.choice.radio.${n}.${ci + 1}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-smooth focus-within:ring-2 focus-within:ring-ring",
                !submitted && "hover:border-primary/50 hover:bg-muted/50",
                !submitted && isSelected && "border-primary bg-primary/5",
                submitted && "cursor-default",
                submitted && isAnswer && "border-success bg-success/10",
                submitted &&
                  isSelected &&
                  !isAnswer &&
                  "border-destructive bg-destructive/10",
              )}
            >
              <input
                type="radio"
                name={`question-${n}`}
                className="sr-only"
                checked={isSelected}
                disabled={submitted}
                onChange={() => onSelect(ci)}
              />
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isSelected &&
                    !submitted &&
                    "border-primary bg-primary text-primary-foreground",
                  submitted &&
                    isAnswer &&
                    "border-success bg-success text-success-foreground",
                  submitted &&
                    isSelected &&
                    !isAnswer &&
                    "border-destructive bg-destructive text-destructive-foreground",
                )}
              >
                {LETTERS[ci] ?? ci + 1}
              </span>
              <span lang="ja" className="min-w-0 flex-1 font-jp-sans">
                {choice}
              </span>
              {submitted && isAnswer && (
                <span className="text-xs font-medium text-success">
                  Đáp án đúng
                </span>
              )}
              {submitted && isSelected && !isAnswer && (
                <span className="text-xs font-medium text-destructive">
                  Bạn chọn
                </span>
              )}
            </label>
          );
        })}
      </div>
      {submitted && (
        <div
          data-ocid={`reading_detail.explanation.panel.${n}`}
          className="mt-4 flex gap-2.5 rounded-lg bg-muted/60 p-3.5 text-sm leading-relaxed text-foreground"
        >
          <Lightbulb
            className="mt-0.5 size-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <p className="min-w-0">{question.explanation}</p>
        </div>
      )}
    </fieldset>
  );
}
