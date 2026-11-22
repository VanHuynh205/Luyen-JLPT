import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadyPack } from "@/hooks/useContent";
import { useMyLearnedGrammar } from "@/hooks/useProgress";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, Search, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

const ALL_LESSONS = "all";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
}

function LearnedSummary({
  learnedIds,
  total,
}: { learnedIds: Set<string>; total: number }) {
  const learnedQuery = useMyLearnedGrammar();

  if (learnedQuery.isLoading) {
    return (
      <div data-ocid="grammar_list.loading_state" className="w-full space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (learnedQuery.isError) {
    return (
      <div
        data-ocid="grammar_list.error_state"
        className="flex flex-wrap items-center gap-3 text-sm text-destructive"
      >
        Không tải được tiến độ ngữ pháp.
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-ocid="grammar_list.retry_button"
          onClick={() => void learnedQuery.refetch()}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  const count = learnedIds.size;
  return (
    <div data-ocid="grammar_list.progress.panel" className="w-full space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Đã học</span>
        <span className="font-semibold tabular-nums text-foreground">
          {count} / {total} mẫu
        </span>
      </div>
      <Progress
        value={total ? (count / total) * 100 : 0}
        className="h-2"
        aria-label={`Đã học ${count} trên ${total} mẫu ngữ pháp`}
      />
    </div>
  );
}

export default function GrammarListPage() {
  const { grammar: grammarPatterns, manifest } = useReadyPack();
  const [query, setQuery] = useState("");
  const [lesson, setLesson] = useState(ALL_LESSONS);
  const deferredQuery = useDeferredValue(query);
  const learnedQuery = useMyLearnedGrammar();
  const validIds = useMemo(
    () => new Set(grammarPatterns.map((pattern) => pattern.id)),
    [grammarPatterns],
  );
  const searchIndex = useMemo(
    () =>
      grammarPatterns.map((pattern) => ({
        pattern,
        text: normalize(
          `${pattern.pattern} ${pattern.meaning} ${pattern.usage}`,
        ),
      })),
    [grammarPatterns],
  );
  const lessons = useMemo(() => {
    const counts = new Map<number, number>();
    for (const pattern of grammarPatterns) {
      counts.set(pattern.lesson, (counts.get(pattern.lesson) ?? 0) + 1);
    }
    return [...counts].sort(([left], [right]) => left - right);
  }, [grammarPatterns]);

  const learnedIds = useMemo(
    () => new Set((learnedQuery.data ?? []).filter((id) => validIds.has(id))),
    [learnedQuery.data, validIds],
  );

  const filtered = useMemo(() => {
    const term = normalize(deferredQuery.trim());
    return searchIndex
      .filter(
        (entry) =>
          (lesson === ALL_LESSONS || entry.pattern.lesson === Number(lesson)) &&
          (!term || entry.text.includes(term)),
      )
      .map((entry) => entry.pattern);
  }, [deferredQuery, lesson, searchIndex]);

  return (
    <section
      data-ocid="grammar_list.page"
      className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16"
    >
      <header className="grid gap-8 md:grid-cols-[1fr_minmax(0,20rem)] md:items-end">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <span className="font-jp text-lg" lang="ja">
              文法
            </span>
            JLPT {manifest.level.toUpperCase()}
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">
            Ngữ pháp {manifest.level.toUpperCase()}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            {grammarPatterns.length} mẫu ngữ pháp có cách chia, ý nghĩa, cách
            dùng và câu ví dụ kèm bản dịch.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <LearnedSummary
            learnedIds={learnedIds}
            total={grammarPatterns.length}
          />
        </div>
      </header>

      <div className="mt-10 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <label htmlFor="grammar-search" className="sr-only">
            Tìm mẫu ngữ pháp
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="grammar-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mẫu (〜たら), nghĩa hoặc cách dùng"
            className="h-11 bg-card pl-9"
            data-ocid="grammar_list.search_input"
          />
        </div>
        <Select value={lesson} onValueChange={setLesson}>
          <SelectTrigger
            aria-label="Lọc theo bài"
            className="h-11 w-full bg-card"
            data-ocid="grammar_list.lesson_select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LESSONS}>
              Tất cả bài ({grammarPatterns.length})
            </SelectItem>
            {lessons.map(([number, count]) => (
              <SelectItem key={number} value={String(number)}>
                Bài {number} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filtered.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
          Hiển thị {filtered.length} / {grammarPatterns.length} mẫu
        </p>
      )}

      {filtered.length === 0 ? (
        <div
          data-ocid="grammar_list.empty_state"
          className="mt-10 flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">
            Không tìm thấy mẫu ngữ pháp phù hợp
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {query.trim()
              ? `Không có mẫu nào khớp với “${query.trim()}”.`
              : "Bài này chưa có mẫu nào."}{" "}
            Hãy thử từ khoá hoặc bài khác.
          </p>
          <Button
            type="button"
            className="mt-6"
            data-ocid="grammar_list.clear_search_button"
            onClick={() => {
              setQuery("");
              setLesson(ALL_LESSONS);
            }}
          >
            Xoá bộ lọc
          </Button>
        </div>
      ) : (
        <ul
          data-ocid="grammar_list.list"
          className="mt-6 grid gap-3 md:grid-cols-2"
        >
          {filtered.map((p, index) => {
            const learned = learnedIds.has(p.id);
            return (
              <li
                key={p.id}
                className="[contain-intrinsic-size:auto_96px] [content-visibility:auto]"
              >
                <Link
                  to="/ngu-phap/$patternId"
                  params={{ patternId: p.id }}
                  data-ocid={`grammar_list.item.${index + 1}`}
                  className="group ink-rule flex h-full items-center gap-4 rounded-lg border border-border bg-card p-5 transition-smooth hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        lang="ja"
                        className="font-jp text-xl font-semibold text-foreground"
                      >
                        {p.pattern}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Bài {p.lesson}
                      </span>
                      {learned && (
                        <Badge
                          variant="secondary"
                          className="gap-1 rounded-full"
                          data-ocid={`grammar_list.learned_badge.${index + 1}`}
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Đã học
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.meaning}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
