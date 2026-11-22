import { Button } from "@/components/ui/button";
import type { GrammarQuizQuestion } from "@/core/content/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function QuizQuestion({
  question,
  index,
}: {
  question: GrammarQuizQuestion;
  index: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = selected === question.answerIndex;
  const n = index + 1;

  return (
    <li
      data-ocid={`grammar_quiz.item.${n}`}
      className="rounded-lg border bg-card p-5 shadow-subtle md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Câu {n}
        </p>
        {answered && (
          <button
            type="button"
            data-ocid={`grammar_quiz.retry_button.${n}`}
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Làm lại
          </button>
        )}
      </div>
      <p
        lang="ja"
        className="mt-2 break-words text-lg text-foreground md:text-xl"
      >
        {question.question}
      </p>
      <div
        className="mt-4 grid gap-2 sm:grid-cols-2"
        aria-label={`Lựa chọn cho câu ${n}`}
      >
        {question.choices.map((choice, ci) => {
          const isAnswer = ci === question.answerIndex;
          const isPicked = ci === selected;
          return (
            <button
              key={`${n}-${choice}`}
              type="button"
              data-ocid={`grammar_quiz.choice.${n}.${ci + 1}`}
              disabled={answered}
              aria-pressed={isPicked}
              onClick={() => setSelected(ci)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !answered &&
                  "bg-card hover:border-primary/50 hover:bg-secondary",
                answered &&
                  isAnswer &&
                  "border-success bg-success/10 text-foreground",
                answered &&
                  isPicked &&
                  !isAnswer &&
                  "border-destructive bg-destructive/10",
                answered && !isAnswer && !isPicked && "opacity-60",
                answered && "cursor-default",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {LETTERS[ci] ?? ci + 1}
              </span>
              <span lang="ja" className="min-w-0 break-words">
                {choice}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <output
          data-ocid={
            correct
              ? `grammar_quiz.success_state.${n}`
              : `grammar_quiz.error_state.${n}`
          }
          className={cn(
            "mt-4 block rounded-md border-l-4 p-4 text-sm",
            correct
              ? "border-success bg-success/10"
              : "border-destructive bg-destructive/10",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-2 font-semibold",
              correct ? "text-success" : "text-destructive",
            )}
          >
            {correct ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <XCircle className="size-4" aria-hidden="true" />
            )}
            {correct ? "Đúng!" : "Sai"}
            {!correct && (
              <span className="font-normal text-foreground">
                — Đáp án đúng:{" "}
                <span lang="ja" className="font-semibold">
                  {question.choices[question.answerIndex]}
                </span>
              </span>
            )}
          </p>
          <p className="mt-1.5 text-foreground">{question.explanation}</p>
        </output>
      )}
    </li>
  );
}

export function GrammarQuiz({
  questions,
}: { questions?: GrammarQuizQuestion[] }) {
  const [round, setRound] = useState(0);

  if (!questions || questions.length === 0) {
    return (
      <p
        data-ocid="grammar_quiz.empty_state"
        className="rounded-lg border bg-card p-5 text-sm text-muted-foreground"
      >
        Mẫu ngữ pháp này chưa có câu luyện tập.
      </p>
    );
  }

  return (
    <div>
      <ol className="space-y-4" data-ocid="grammar_quiz.list">
        {questions.map((question, i) => (
          <QuizQuestion
            key={`${round}-${question.question}`}
            question={question}
            index={i}
          />
        ))}
      </ol>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          data-ocid="grammar_quiz.reset_button"
          className="rounded-md transition-smooth"
          onClick={() => setRound((r) => r + 1)}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Làm lại tất cả
        </Button>
      </div>
    </div>
  );
}
