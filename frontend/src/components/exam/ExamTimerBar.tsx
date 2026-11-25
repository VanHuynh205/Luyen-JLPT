import { formatCountdown } from "@/core/exam/engine";
import type { ExamSectionStatus } from "@/core/exam/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export interface ExamTimerBarProps {
  sectionTitle: string;
  sectionTitleJa: string;
  answered: number;
  total: number;
  remainingSeconds: number;
  status: ExamSectionStatus;
}

export function ExamTimerBar({
  sectionTitle,
  sectionTitleJa,
  answered,
  total,
  remainingSeconds,
  status,
}: ExamTimerBarProps) {
  const isTimedOut =
    status === "timed_out" ||
    (status === "in_progress" && remainingSeconds <= 0);
  const isWarning =
    status === "in_progress" && remainingSeconds > 0 && remainingSeconds < 120;
  const isSubmitted = status === "submitted";

  return (
    <div
      data-ocid="exam_runner.timer_bar"
      className={cn(
        "sticky top-[6.25rem] z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 backdrop-blur-sm transition-smooth md:top-[6.75rem] md:px-5",
        isTimedOut && "border-destructive/50 bg-destructive/10",
        isWarning && "border-warning bg-warning/15",
        isSubmitted && "border-success/40 bg-success/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">
            {sectionTitle}
          </h2>
          <span
            lang="ja"
            className="font-jp-sans text-xs text-muted-foreground sm:text-sm"
          >
            {sectionTitleJa}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums sm:text-sm">
          Đã trả lời{" "}
          <strong className="font-semibold text-foreground">{answered}</strong>{" "}
          / {total} câu
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isSubmitted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Đã nộp bài
          </span>
        ) : (
          <div
            aria-live="off"
            data-ocid="exam_runner.timer_value"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-base font-semibold tabular-nums sm:text-lg",
              isTimedOut
                ? "border-destructive/40 bg-card text-destructive"
                : isWarning
                  ? "border-warning/60 bg-card text-warning-foreground"
                  : "border-border bg-muted/60 text-foreground",
            )}
          >
            {isWarning || isTimedOut ? (
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Clock
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
            <span>{formatCountdown(isTimedOut ? 0 : remainingSeconds)}</span>
            {isTimedOut && (
              <span className="font-body text-xs font-semibold uppercase tracking-wide">
                Hết giờ
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
