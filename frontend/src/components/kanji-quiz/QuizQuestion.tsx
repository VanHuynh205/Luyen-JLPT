import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Explanation } from "./Explanation";
import type { QuizQuestion as Question } from "./quizEngine";

const LETTERS = ["A", "B", "C", "D"];

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select"));
}

export function QuizQuestion({
  question,
  number,
  total,
  selected,
  onSelect,
  onNext,
}: {
  question: Question;
  number: number;
  total: number;
  selected: number | null;
  onSelect: (index: number) => void;
  onNext: () => void;
}) {
  const { mode } = useMotionPreference();
  const reduced = mode === "reduced";
  const answered = selected !== null;
  const correct = selected === question.correctIndex;
  const isLast = number === total;

  const questionCardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = questionCardRef.current;
    if (!el || !question.key) return;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.fromTo(
          el,
          { opacity: 0.7 },
          {
            opacity: 1,
            duration: 0.14,
            ease: "power1.out",
            clearProps: "opacity",
          },
        );
        return;
      }
      gsap.fromTo(
        el,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "transform,opacity",
        },
      );
    }, questionCardRef);
    return () => ctx.revert();
  }, [question.key, reduced]);

  useEffect(() => {
    if (!answered) return;
    const el = feedbackRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.fromTo(
          el,
          { opacity: 0.7 },
          {
            opacity: 1,
            duration: 0.14,
            ease: "power1.out",
            clearProps: "opacity",
          },
        );
        return;
      }
      gsap.fromTo(
        el,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
          clearProps: "transform,opacity",
        },
      );
    }, feedbackRef);
    return () => ctx.revert();
  }, [answered, reduced]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextInputTarget(event.target)) return;

      if (!answered && event.key >= "1" && event.key <= "4") {
        const choiceIndex = Number(event.key) - 1;
        if (choiceIndex < question.choices.length) {
          event.preventDefault();
          onSelect(choiceIndex);
        }
        return;
      }

      if (answered && event.key === "Enter") {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("button, a")
        ) {
          return;
        }
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [answered, onNext, onSelect, question.choices.length]);

  return (
    <div data-ocid="kanji_quiz.question.panel" className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold tabular-nums text-foreground">
            Câu {number}/{total}
          </span>
          <span className="text-muted-foreground">
            {question.item.kind === "kanji" ? "Kanji đơn" : "Từ ghép"}
          </span>
        </div>
        <Progress value={(number / total) * 100} className="h-1.5" />
      </div>

      <div
        ref={questionCardRef}
        className="rounded-xl border bg-card p-6 shadow-subtle md:p-8"
      >
        <p className="text-center text-sm text-muted-foreground">
          {question.instruction}
        </p>
        <p
          lang={question.subjectIsJapanese ? "ja" : undefined}
          className="font-jp mt-3 text-center text-5xl font-semibold text-foreground md:text-6xl"
        >
          {question.subject}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {question.choices.map((choice, i) => {
            const isCorrect = i === question.correctIndex;
            const isPicked = i === selected;
            return (
              <button
                key={choice}
                type="button"
                disabled={answered}
                onClick={() => onSelect(i)}
                data-ocid={`kanji_quiz.choice.${i + 1}`}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg border bg-background px-4 py-3 text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !answered && "hover:border-primary hover:bg-primary/5",
                  answered && isCorrect && "border-success bg-success/10",
                  answered &&
                    isPicked &&
                    !isCorrect &&
                    "border-destructive bg-destructive/10",
                  answered && !isCorrect && !isPicked && "opacity-60",
                )}
              >
                <span className="text-sm font-semibold text-muted-foreground">
                  {LETTERS[i]}.
                </span>
                <span
                  lang={question.choicesAreJapanese ? "ja" : undefined}
                  className={cn(
                    "min-w-0 flex-1 break-words",
                    question.choicesAreJapanese && "font-jp-sans text-lg",
                  )}
                >
                  {choice}
                </span>
                {answered && isCorrect && (
                  <CheckCircle2
                    className="size-5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                )}
                {answered && isPicked && !isCorrect && (
                  <XCircle
                    className="size-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
          Phím tắt: 1–4 chọn đáp án · Enter sang câu tiếp theo
        </p>
      </div>

      {answered && (
        <div
          ref={feedbackRef}
          aria-live="polite"
          data-ocid={
            correct
              ? "kanji_quiz.answer.success_state"
              : "kanji_quiz.answer.error_state"
          }
          className={cn(
            "rounded-xl border bg-card p-5 shadow-subtle md:p-6",
            correct ? "border-success/50" : "border-destructive/50",
          )}
        >
          <p
            className={cn(
              "mb-4 flex items-center gap-2 font-display text-2xl font-semibold",
              correct ? "text-success" : "text-destructive",
            )}
          >
            {correct ? (
              <CheckCircle2 className="size-6" aria-hidden="true" />
            ) : (
              <XCircle className="size-6" aria-hidden="true" />
            )}
            {correct ? "Đúng" : "Sai"}
            {!correct && (
              <span className="text-base font-normal text-muted-foreground">
                — đáp án đúng:{" "}
                <span
                  lang={question.choicesAreJapanese ? "ja" : undefined}
                  className="text-foreground"
                >
                  {question.choices[question.correctIndex]}
                </span>
              </span>
            )}
          </p>
          <Explanation item={question.item} />
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={onNext}
              className="min-h-11 rounded-md transition-smooth"
              data-ocid="kanji_quiz.next.primary_button"
            >
              {isLast ? "Xem kết quả" : "Câu tiếp theo"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
