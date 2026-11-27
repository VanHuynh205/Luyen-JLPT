import type { JlptScoreReport } from "@/core/exam/scoring";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export interface JlptScoreBreakdownProps {
  report: JlptScoreReport;
  className?: string;
}

function ScoreMeter({
  label,
  scaled,
  max,
  cutoff,
  cutoffLabel,
  failedCutoff,
  skipped = false,
  ocid,
}: {
  label: string;
  scaled: number;
  max: number;
  cutoff: number;
  cutoffLabel: string;
  failedCutoff: boolean;
  skipped?: boolean;
  ocid: string;
}) {
  const fillPct = Math.min(100, Math.max(0, Math.round((scaled / max) * 100)));
  const cutoffPct = Math.min(100, Math.max(0, (cutoff / max) * 100));

  return (
    <div data-ocid={ocid} className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span
            className={cn(
              "font-semibold",
              failedCutoff ? "text-destructive" : "text-foreground",
            )}
          >
            {skipped ? `Chưa làm (0/${max})` : `${scaled}/${max}`}
          </span>
          <span className="text-xs text-muted-foreground">({cutoffLabel})</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            failedCutoff
              ? "bg-destructive"
              : skipped
                ? "bg-muted-foreground/40"
                : "bg-primary",
          )}
          style={{ width: `${fillPct}%` }}
        />
        <span
          aria-hidden="true"
          title={cutoffLabel}
          className="absolute inset-y-0 w-0.5 bg-destructive"
          style={{ left: `${cutoffPct.toFixed(2)}%` }}
        />
      </div>
    </div>
  );
}

export function JlptScoreBreakdown({
  report,
  className,
}: JlptScoreBreakdownProps) {
  const hasCutoffFailure = report.failedByCutoff !== "none";
  const lrFailed =
    report.failedByCutoff === "language_reading" ||
    report.failedByCutoff === "both";
  const listeningFailed =
    report.failedByCutoff === "listening" || report.failedByCutoff === "both";
  const totalPct = Math.min(
    100,
    Math.max(0, Math.round((report.totalScaled / report.totalMax) * 100)),
  );
  const passPct = (report.passThreshold / report.totalMax) * 100;

  return (
    <section
      data-ocid="exam_runner.jlpt_breakdown"
      aria-labelledby="jlpt-score-breakdown-title"
      className={cn(
        "space-y-4 rounded-xl border border-border bg-muted/25 p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3
            id="jlpt-score-breakdown-title"
            className="font-display text-lg font-semibold text-foreground"
          >
            Mô phỏng điểm chuẩn JLPT
          </h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            Quy đổi thang {report.totalMax} · Mốc đỗ {report.passThreshold}/
            {report.totalMax}
          </p>
        </div>

        <div className="flex items-center gap-2.5 tabular-nums">
          <span className="font-display text-2xl font-semibold text-foreground">
            {report.totalScaled}/{report.totalMax}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              report.passed
                ? "bg-success/15 text-success"
                : hasCutoffFailure
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {report.passed
              ? "Đạt chuẩn"
              : hasCutoffFailure
                ? "Dính điểm liệt"
                : report.listeningSkipped
                  ? "Chưa đủ phần"
                  : "Chưa đạt"}
          </span>
        </div>
      </div>

      <div className="space-y-3.5">
        <ScoreMeter
          ocid="exam_runner.jlpt_bar.language_reading"
          label="Kiến thức ngôn ngữ · Đọc hiểu"
          scaled={report.languageReadingScaled}
          max={report.languageReadingMax}
          cutoff={report.languageReadingCutoff}
          cutoffLabel={`Điểm liệt ${report.languageReadingCutoff}`}
          failedCutoff={lrFailed}
        />

        <ScoreMeter
          ocid="exam_runner.jlpt_bar.listening"
          label="Nghe hiểu"
          scaled={report.listeningScaled}
          max={report.listeningMax}
          cutoff={report.listeningCutoff}
          cutoffLabel={`Điểm liệt ${report.listeningCutoff}`}
          failedCutoff={listeningFailed}
          skipped={report.listeningSkipped}
        />

        <div className="space-y-1.5 border-t border-border/70 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">
              Tổng điểm quy đổi
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {report.totalScaled}/{report.totalMax} (mốc đỗ{" "}
              {report.passThreshold})
            </span>
          </div>
          <div
            aria-hidden="true"
            className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                report.passed
                  ? "bg-success"
                  : hasCutoffFailure
                    ? "bg-destructive"
                    : "bg-primary",
              )}
              style={{ width: `${totalPct}%` }}
            />
            <span
              aria-hidden="true"
              title={`Mốc đỗ ${report.passThreshold}/${report.totalMax}`}
              className="absolute inset-y-0 w-0.5 bg-foreground/60"
              style={{ left: `${passPct.toFixed(2)}%` }}
            />
          </div>
        </div>
      </div>

      <div
        data-ocid="exam_runner.jlpt_verdict"
        className={cn(
          "flex items-start gap-2.5 rounded-lg border p-3.5 text-sm leading-relaxed",
          report.passed
            ? "border-success/40 bg-success/10 text-foreground"
            : hasCutoffFailure
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-border bg-card text-foreground",
        )}
      >
        {report.passed ? (
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-success"
            aria-hidden="true"
          />
        ) : hasCutoffFailure ? (
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <Info
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{report.verdictVi}</p>
          {report.weakestGroup && (
            <p className="text-muted-foreground tabular-nums">
              Nhóm cần ưu tiên:{" "}
              <strong className="font-medium text-foreground">
                {report.weakestGroup.sectionTitle} — {report.weakestGroup.label}
              </strong>{" "}
              (sai hoặc bỏ trống {report.weakestGroup.missedCount} câu).
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
