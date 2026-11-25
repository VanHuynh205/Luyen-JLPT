import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, RotateCw } from "lucide-react";
import type { SectionKey, SectionStat, StudySection } from "./sections";

interface ProgressPanelProps {
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  stats: Record<SectionKey, SectionStat> | null;
  onRetry: () => void;
  level: string;
  sections: StudySection[];
}

export function ProgressPanel({
  isLoading,
  isError,
  isRefetching,
  stats,
  onRetry,
  level,
  sections,
}: ProgressPanelProps) {
  return (
    <section
      aria-labelledby="home-progress-title"
      data-ocid="home.progress.panel"
      className="rounded-xl border bg-card p-5 shadow-card md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-progress-title" className="text-xl font-semibold">
          Tiến độ học tập
        </h2>
        <span className="inline-flex items-center rounded-md border border-primary/20 bg-secondary px-2.5 py-1 text-xs font-semibold tracking-wider text-primary">
          JLPT {level}
        </span>
      </div>

      {isLoading && (
        <ul data-ocid="home.progress.loading_state" className="mt-5 space-y-5">
          {sections.map((section) => (
            <li key={section.key} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-1.5 w-full" />
            </li>
          ))}
        </ul>
      )}

      {isError && !isLoading && (
        <div
          role="alert"
          data-ocid="home.progress.error_state"
          className="mt-5 flex flex-col items-start gap-3 rounded-lg bg-muted p-4"
        >
          <p className="flex items-start gap-2 text-sm text-foreground">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            Không tải được tiến độ. Vui lòng kiểm tra kết nối và thử lại.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid="home.progress.retry_button"
            disabled={isRefetching}
            onClick={onRetry}
            className="rounded-md"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            {isRefetching ? "Đang tải…" : "Thử lại"}
          </Button>
        </div>
      )}

      {stats && !isLoading && !isError && (
        <ul data-ocid="home.progress.list" className="mt-5 space-y-4">
          {sections.map((section, index) => {
            const stat = stats[section.key];
            const pct = stat.ratio === null ? 0 : Math.round(stat.ratio * 100);
            return (
              <li
                key={section.key}
                data-ocid={`home.progress.item.${index + 1}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{section.title}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {stat.value}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out motion-reduce:transition-none"
                    style={{ transform: `scaleX(${pct / 100})` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {stats && !isLoading && !isError && (
        <p className="mt-4 text-xs text-muted-foreground">
          Tiến độ được lưu riêng theo cấp độ JLPT {level}.
        </p>
      )}

      <div className="mt-5 border-t pt-4 text-center">
        <Link
          to="/tien-do"
          data-ocid="home.progress.link"
          className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm font-medium text-primary transition-smooth hover:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
        >
          Xem chi tiết
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
