import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Summary card: one learning section with count, percentage and bar. */
export function ProgressStatCard({
  index,
  glyph,
  title,
  done,
  total,
  unit,
  to,
  linkLabel,
}: {
  index: number;
  glyph: string;
  title: string;
  done: number;
  total: number;
  unit: string;
  to: "/tu-vung" | "/kanji" | "/ngu-phap" | "/doc-hieu";
  linkLabel: string;
}) {
  const pct = percentOf(done, total);
  return (
    <article
      data-ocid={`progress.stat.card.${index}`}
      className="ink-rule flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl">
          <span lang="ja" className="font-jp text-2xl text-primary">
            {glyph}
          </span>
          {title}
        </h2>
        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
          {total > 0 ? `${pct}%` : "—"}
        </span>
      </div>
      <Progress
        value={pct}
        aria-label={
          total > 0 ? `${title}: ${pct}%` : `${title}: Chưa có dữ liệu`
        }
        className="h-2 bg-muted"
      />
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 tabular-nums text-muted-foreground">
          {done} / {total} {unit}
        </span>
        <Link
          to={to}
          data-ocid={`progress.stat.link.${index}`}
          className="inline-flex items-center gap-1 rounded-sm font-medium text-primary transition-smooth hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
