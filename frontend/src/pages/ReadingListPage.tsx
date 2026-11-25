import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReadingPassage } from "@/core/content/types";
import type { ReadingResult } from "@/core/progress/types";
import { useReadyPack } from "@/hooks/useContent";
import { useMyReadingResults } from "@/hooks/useProgress";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
} from "lucide-react";

const LENGTH_LABEL: Record<ReadingPassage["length"], string> = {
  short: "Đoạn ngắn",
  medium: "Đoạn trung bình",
};

function splitTitle(title: string) {
  const [vi, jp] = title.split(" — ");
  return { vi: vi ?? title, jp: jp ?? "" };
}

interface StatusProps {
  isLoading: boolean;
  result: ReadingResult | undefined;
  index: number;
}

function PassageStatus({ isLoading, result, index }: StatusProps) {
  if (isLoading) {
    return (
      <Skeleton
        data-ocid={`reading_list.loading_state.${index}`}
        className="h-6 w-28 rounded-full"
      />
    );
  }
  if (!result || result.attempts === 0n) {
    return (
      <span
        data-ocid={`reading_list.status.${index}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <CircleDashed className="h-4 w-4" aria-hidden="true" />
        Chưa làm
      </span>
    );
  }
  return (
    <span
      data-ocid={`reading_list.status.${index}`}
      className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
    >
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      Đã làm
      <span className="text-primary/70">·</span>
      <span className="tabular-nums">
        Cao nhất {result.bestScore.toString()}/{result.total.toString()}
      </span>
    </span>
  );
}

export default function ReadingListPage() {
  const { reading: readingPassages, manifest } = useReadyPack();
  const results = useMyReadingResults();
  const byId = new Map(
    (results.data ?? [])
      .filter((result) => result.total > 0n)
      .map((result) => [result.passageId, result] as const),
  );
  const statusLoading = results.isPending;
  const doneCount = readingPassages.filter(
    (p) => (byId.get(p.id)?.attempts ?? 0n) > 0n,
  ).length;

  return (
    <section
      data-ocid="reading_list.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-medium tracking-wider text-primary">
            <span className="font-jp mr-2" lang="ja">
              読
            </span>
            Luyện đọc JLPT {manifest.level.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">
            Đọc hiểu
          </h1>
          <p className="mt-3 text-muted-foreground">
            Các đoạn văn ngắn và trung bình, kèm từ vựng, bản dịch và câu hỏi
            trắc nghiệm có giải thích.
          </p>
        </div>
        <div
          data-ocid="reading_list.summary.panel"
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-subtle"
        >
          {statusLoading ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <span>
              Đã làm{" "}
              <strong className="tabular-nums">
                {doneCount}/{readingPassages.length}
              </strong>{" "}
              bài
            </span>
          )}
        </div>
      </header>

      <ul data-ocid="reading_list.list" className="grid gap-4 md:grid-cols-2">
        {readingPassages.map((passage, i) => {
          const { vi, jp } = splitTitle(passage.title);
          const index = i + 1;
          return (
            <li key={passage.id}>
              <Link
                to="/doc-hieu/$passageId"
                params={{ passageId: passage.id }}
                data-ocid={`reading_list.item.${index}`}
                className="hover-lift group flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold leading-snug">
                      {vi}
                    </h2>
                    {jp && (
                      <p
                        lang="ja"
                        className="font-jp mt-1 truncate text-base text-muted-foreground"
                      >
                        {jp}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    {String(index).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {LENGTH_LABEL[passage.length]}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    {passage.questions.length} câu hỏi
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                  <PassageStatus
                    isLoading={statusLoading}
                    result={byId.get(passage.id)}
                    index={index}
                  />
                  <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Đọc bài
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
