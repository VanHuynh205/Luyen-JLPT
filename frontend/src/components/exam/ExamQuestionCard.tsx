import { Button } from "@/components/ui/button";
import type { ExamQuestion } from "@/core/exam/types";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  X,
} from "lucide-react";
import { useState } from "react";
import { RubyText } from "./RubyText";

export interface ExamQuestionCardProps {
  question: ExamQuestion;
  selected: number | undefined;
  locked: boolean;
  showScriptControl?: boolean;
  onSelect: (choiceIndex: number) => void;
}

export function ExamQuestionCard({
  question,
  selected,
  locked,
  showScriptControl = false,
  onSelect,
}: ExamQuestionCardProps) {
  const [scriptOpen, setScriptOpen] = useState(false);

  const isCorrect = locked && selected === question.answerIndex;
  const isUnanswered = locked && selected === undefined;
  const promptText = locked
    ? question.promptRuby || question.prompt
    : question.prompt;
  const hasScript = Boolean(question.scriptRuby || question.script);

  return (
    <article
      data-ocid={`exam_runner.question.${question.id}`}
      className="rounded-xl border border-border bg-card p-4 sm:p-5 md:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-base leading-relaxed text-foreground">
          <span className="mr-2 font-display font-semibold text-primary tabular-nums">
            Câu {question.number}.
          </span>
          <RubyText
            text={promptText}
            className="whitespace-pre-line break-words"
          />
        </div>

        {locked && (
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
            {isCorrect ? "Đúng" : isUnanswered ? "Bỏ trống" : "Sai"}
          </span>
        )}
      </div>

      {question.imageHint && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          <ImageIcon
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="min-w-0 break-words">
            <span className="font-medium text-foreground">Mô tả hình: </span>
            {question.imageHint}
          </p>
        </div>
      )}

      {!locked && showScriptControl && question.script && (
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={scriptOpen}
            className="min-h-11 rounded-md"
            onClick={() => setScriptOpen((prev) => !prev)}
          >
            <FileText className="size-4" aria-hidden="true" />
            {scriptOpen ? "Ẩn script nghe" : "Xem script nghe"}
            {scriptOpen ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </Button>
          {scriptOpen && (
            <div className="mt-2.5 rounded-lg border border-border bg-muted/50 p-3.5 text-sm leading-relaxed text-foreground">
              <RubyText
                text={question.script}
                as="p"
                className="whitespace-pre-line break-words"
              />
            </div>
          )}
        </div>
      )}

      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="sr-only">
          Các lựa chọn cho câu {question.number}
        </legend>
        {question.choices.map((choice, ci) => {
          const isSelected = selected === ci;
          const isAnswer = ci === question.answerIndex;
          const choiceText =
            locked && question.choicesRuby?.[ci]
              ? question.choicesRuby[ci]
              : choice;

          return (
            <button
              key={`${question.id}-choice-${ci + 1}`}
              type="button"
              disabled={locked}
              aria-pressed={isSelected}
              data-ocid={`exam_runner.choice.${question.id}.${ci + 1}`}
              onClick={() => onSelect(ci)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-base transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !locked &&
                  "cursor-pointer hover:border-primary/50 hover:bg-muted/50",
                !locked && isSelected && "border-primary bg-primary/5",
                locked && "cursor-default",
                locked && isAnswer && "border-success bg-success/10",
                locked &&
                  isSelected &&
                  !isAnswer &&
                  "border-destructive bg-destructive/10",
                locked && !isAnswer && !isSelected && "opacity-75",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  isSelected &&
                    !locked &&
                    "border-primary bg-primary text-primary-foreground",
                  locked &&
                    isAnswer &&
                    "border-success bg-success text-success-foreground",
                  locked &&
                    isSelected &&
                    !isAnswer &&
                    "border-destructive bg-destructive text-destructive-foreground",
                )}
              >
                {ci + 1}
              </span>
              <span className="min-w-0 flex-1 break-words">
                <RubyText text={choiceText} />
              </span>
              {locked && isAnswer && (
                <span className="shrink-0 text-xs font-medium text-success">
                  Đáp án đúng
                </span>
              )}
              {locked && isSelected && !isAnswer && (
                <span className="shrink-0 text-xs font-medium text-destructive">
                  Bạn chọn
                </span>
              )}
            </button>
          );
        })}
      </fieldset>

      {locked && (
        <div
          data-ocid={`exam_runner.explanation.${question.id}`}
          className="mt-4 space-y-3 rounded-lg border border-border bg-muted/50 p-3.5 text-sm leading-relaxed text-foreground sm:p-4"
        >
          <div className="flex items-start gap-2.5">
            <Lightbulb
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-words">
                <span className="font-semibold text-foreground">
                  Dịch nghĩa:{" "}
                </span>
                <span className="text-foreground/90">
                  {question.translation}
                </span>
              </p>
              <p className="break-words">
                <span className="font-semibold text-foreground">
                  Vì sao chọn:{" "}
                </span>
                <span className="text-foreground/90">
                  {question.explanation}
                </span>
              </p>
            </div>
          </div>

          {hasScript && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Script nghe
              </p>
              <RubyText
                text={question.scriptRuby || question.script || ""}
                as="p"
                className="whitespace-pre-line break-words text-sm leading-loose text-foreground"
              />
              {question.scriptTranslation && (
                <p className="break-words text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Dịch script:{" "}
                  </span>
                  {question.scriptTranslation}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
