import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildComparisonLinks,
  splitComparisonDistinctions,
  splitComparisonExamples,
} from "@/core/content/comparisonLinks";
import type { GrammarComparison, GrammarPattern } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronRight, SearchX } from "lucide-react";
import { useMemo } from "react";

function ComparisonNavLink({
  target,
  direction,
  ocid,
}: {
  target: GrammarComparison;
  direction: "prev" | "next";
  ocid: string;
}) {
  const isNext = direction === "next";
  return (
    <Link
      to="/ngu-phap/so-sanh/$comparisonId"
      params={{ comparisonId: target.id }}
      data-ocid={ocid}
      className={`hover-lift group flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-smooth hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isNext ? "flex-row-reverse text-right sm:col-start-2" : ""}`}
    >
      {isNext ? (
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
          aria-hidden="true"
        />
      ) : (
        <ArrowLeft
          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {isNext ? "Bài tiếp theo" : "Bài trước"} · {target.group}
        </span>
        <span
          lang="ja"
          className="mt-0.5 block truncate font-jp text-base font-semibold text-foreground"
        >
          {target.patterns}
        </span>
      </span>
    </Link>
  );
}

export default function GrammarComparisonDetailPage() {
  const { comparisons, grammar, manifest } = useReadyPack();
  const { comparisonId } = useParams({
    from: "/ngu-phap/so-sanh/$comparisonId",
  });

  const index = comparisons.findIndex((item) => item.id === comparisonId);
  const comparison = index >= 0 ? comparisons[index] : undefined;
  const prev = index > 0 ? comparisons[index - 1] : undefined;
  const next =
    index >= 0 && index < comparisons.length - 1
      ? comparisons[index + 1]
      : undefined;

  const linkReport = useMemo(
    () => buildComparisonLinks(comparisons, grammar),
    [comparisons, grammar],
  );
  const grammarById = useMemo(
    () => new Map(grammar.map((pattern) => [pattern.id, pattern])),
    [grammar],
  );

  const partLinks = useMemo(
    () =>
      comparison
        ? (linkReport.partsByComparisonId.get(comparison.id) ?? [])
        : [],
    [comparison, linkReport],
  );

  const relatedPatterns = useMemo(() => {
    const seen = new Set<string>();
    const list: GrammarPattern[] = [];
    for (const partLink of partLinks) {
      for (const grammarId of partLink.grammarIds) {
        if (seen.has(grammarId)) continue;
        seen.add(grammarId);
        const pattern = grammarById.get(grammarId);
        if (pattern) list.push(pattern);
      }
    }
    return list;
  }, [grammarById, partLinks]);

  const distinctions = useMemo(
    () =>
      comparison
        ? splitComparisonDistinctions(
            comparison.patterns,
            comparison.distinction,
          )
        : null,
    [comparison],
  );

  const examples = useMemo(
    () =>
      comparison
        ? splitComparisonExamples(comparison.exampleJa, comparison.exampleVi)
        : [],
    [comparison],
  );

  if (!comparison) {
    return (
      <section
        data-ocid="grammar_comparison_detail.page"
        className="mx-auto max-w-3xl px-4 py-16 md:px-6"
      >
        <div
          data-ocid="grammar_comparison_detail.empty_state"
          className="flex flex-col items-center rounded-xl border border-border bg-card p-10 text-center"
        >
          <SearchX
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-semibold">
            Không tìm thấy bài so sánh
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Bài so sánh bạn tìm không tồn tại hoặc đường dẫn đã thay đổi. Hãy
            chọn một bài khác trong danh sách {manifest.level.toUpperCase()}.
          </p>
          <Button
            asChild
            className="mt-6 min-h-11 rounded-md transition-smooth"
            data-ocid="grammar_comparison_detail.primary_button"
          >
            <Link to="/ngu-phap/so-sanh">Xem danh sách so sánh</Link>
          </Button>
        </div>
      </section>
    );
  }

  const patternChips =
    partLinks.length > 0
      ? partLinks.map((entry) => entry.part)
      : [comparison.patterns];

  return (
    <article
      key={comparison.id}
      data-ocid="grammar_comparison_detail.page"
      className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-12"
    >
      <Link
        to="/ngu-phap/so-sanh"
        data-ocid="grammar_comparison_detail.back_link"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại danh sách so sánh
      </Link>

      <header className="mt-4 border-b pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            {comparison.group}
          </h1>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            Bài so sánh {index + 1}/{comparisons.length}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {patternChips.map((chip) => (
            <Badge
              key={chip}
              variant="secondary"
              className="max-w-full rounded-full px-3 py-1"
            >
              <span
                lang="ja"
                className="break-words font-jp text-sm font-semibold text-foreground"
              >
                {chip}
              </span>
            </Badge>
          ))}
        </div>
      </header>

      <div className="mt-10 space-y-12">
        <section
          id="diem-khac-nhau"
          aria-labelledby="diem-khac-nhau-title"
          className="scroll-mt-24"
        >
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="diem-khac-nhau-title"
              className="text-xl font-semibold md:text-2xl"
            >
              Điểm khác nhau
            </h2>
            <span lang="ja" className="font-jp text-sm text-muted-foreground">
              違い
            </span>
          </div>
          {distinctions ? (
            <div className="grid gap-4 md:grid-cols-2">
              {distinctions.map((entry) => (
                <div
                  key={`${entry.pattern}-${entry.detail}`}
                  className="min-w-0 rounded-xl border border-border bg-card p-5"
                >
                  <p
                    lang="ja"
                    className="break-words font-jp text-lg font-semibold leading-relaxed text-primary"
                  >
                    {entry.pattern}
                  </p>
                  <p className="mt-2 break-words text-base text-foreground">
                    {entry.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="break-words text-base text-foreground">
                {comparison.distinction}
              </p>
            </div>
          )}
        </section>

        <section
          id="khi-nao-dung"
          aria-labelledby="khi-nao-dung-title"
          className="scroll-mt-24"
        >
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="khi-nao-dung-title"
              className="text-xl font-semibold md:text-2xl"
            >
              Khi nào dùng
            </h2>
            <span lang="ja" className="font-jp text-sm text-muted-foreground">
              使い分け
            </span>
          </div>
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-5">
            <p className="break-words text-base leading-relaxed text-foreground">
              {comparison.whenToUse}
            </p>
          </div>
        </section>

        {examples.length > 0 && (
          <section
            id="vi-du-doi-chieu"
            aria-labelledby="vi-du-doi-chieu-title"
            className="scroll-mt-24"
          >
            <div className="mb-3 flex items-baseline gap-3">
              <h2
                id="vi-du-doi-chieu-title"
                className="text-xl font-semibold md:text-2xl"
              >
                Ví dụ đối chiếu
              </h2>
              <span lang="ja" className="font-jp text-sm text-muted-foreground">
                例文
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {examples.map((example) => (
                <div
                  key={`${example.ja}-${example.vi}`}
                  className="min-w-0 rounded-xl border border-border bg-card p-5"
                >
                  <p
                    lang="ja"
                    className="break-words text-lg font-medium leading-relaxed text-foreground"
                  >
                    {example.ja}
                  </p>
                  <p className="mt-2 break-words text-sm text-muted-foreground">
                    {example.vi}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {relatedPatterns.length > 0 && (
          <section
            id="mau-ngu-phap-lien-quan"
            aria-labelledby="mau-ngu-phap-lien-quan-title"
            className="scroll-mt-24"
          >
            <div className="mb-3 flex items-baseline gap-3">
              <h2
                id="mau-ngu-phap-lien-quan-title"
                className="text-xl font-semibold md:text-2xl"
              >
                Mẫu ngữ pháp liên quan
              </h2>
              <span lang="ja" className="font-jp text-sm text-muted-foreground">
                関連文法
              </span>
            </div>
            <ul
              data-ocid="grammar_comparison_detail.patterns.list"
              className="grid gap-3 md:grid-cols-2"
            >
              {relatedPatterns.map((pattern, itemIndex) => (
                <li key={pattern.id}>
                  <Link
                    to="/ngu-phap/$patternId"
                    params={{ patternId: pattern.id }}
                    data-ocid={`grammar_comparison_detail.pattern.item.${itemIndex + 1}`}
                    className="hover-lift group flex h-full items-center gap-4 rounded-xl border border-border bg-card p-5 transition-smooth hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          lang="ja"
                          className="break-words font-jp text-lg font-semibold text-foreground"
                        >
                          {pattern.pattern}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Bài {pattern.lesson}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                        {pattern.meaning}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground transition-smooth group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <nav
        aria-label="Chuyển bài so sánh"
        className="mt-10 grid gap-3 border-t pt-6 sm:grid-cols-2"
      >
        {prev ? (
          <ComparisonNavLink
            target={prev}
            direction="prev"
            ocid="grammar_comparison_detail.pagination_prev"
          />
        ) : (
          <span />
        )}
        {next ? (
          <ComparisonNavLink
            target={next}
            direction="next"
            ocid="grammar_comparison_detail.pagination_next"
          />
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
