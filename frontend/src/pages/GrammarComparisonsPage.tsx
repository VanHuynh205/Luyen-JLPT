import { GrammarSubNav } from "@/components/grammar/GrammarSubNav";
import { normalize } from "@/components/kanji-library/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GrammarComparison } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, SearchX, X } from "lucide-react";
import { useMemo, useState } from "react";

function buildSearchText(item: GrammarComparison): string {
  return normalize(
    [
      item.group,
      item.patterns,
      item.distinction,
      item.whenToUse,
      item.exampleJa,
      item.exampleVi,
    ].join(" "),
  );
}

export default function GrammarComparisonsPage() {
  const { comparisons, manifest } = useReadyPack();
  const [query, setQuery] = useState("");

  const searchIndex = useMemo(
    () =>
      comparisons.map((item) => ({
        item,
        text: buildSearchText(item),
      })),
    [comparisons],
  );

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return comparisons;
    return searchIndex
      .filter((entry) => entry.text.includes(term))
      .map((entry) => entry.item);
  }, [comparisons, query, searchIndex]);

  const trimmed = query.trim();

  return (
    <section
      data-ocid="grammar_comparisons.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-semibold md:text-4xl">
          So sánh ngữ pháp {manifest.level.toUpperCase()}
        </h1>
        <p className="text-muted-foreground">
          {comparisons.length} bài so sánh giúp phân biệt các mẫu dễ nhầm lẫn
          qua sắc thái nghĩa, ngữ cảnh dùng và câu ví dụ đối chiếu.
        </p>
      </header>

      <GrammarSubNav />

      <div className="relative mt-6 md:mt-8">
        <label htmlFor="comparisons-search" className="sr-only">
          Tìm bài so sánh ngữ pháp
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="comparisons-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo nhóm, mẫu câu (ようにする), điểm khác nhau hoặc ví dụ"
          className="h-11 bg-card pl-10 pr-11"
          data-ocid="grammar_comparisons.search_input"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Xoá tìm kiếm"
            data-ocid="grammar_comparisons.search_clear_button"
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p
        className="mt-3 text-sm tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        Hiển thị {filtered.length} / {comparisons.length} bài so sánh
      </p>

      {filtered.length === 0 ? (
        <div
          data-ocid="grammar_comparisons.empty_state"
          className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <SearchX
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">
            Không tìm thấy bài so sánh phù hợp
          </h2>
          <p className="mt-2 max-w-sm break-words text-sm text-muted-foreground">
            {trimmed
              ? `Không có bài so sánh nào khớp với “${trimmed}”. Hãy thử từ khoá khác.`
              : "Cấp độ này chưa có dữ liệu so sánh ngữ pháp."}
          </p>
          {trimmed && (
            <Button
              type="button"
              variant="outline"
              className="mt-6 min-h-11"
              data-ocid="grammar_comparisons.clear_search_button"
              onClick={() => setQuery("")}
            >
              Xoá tìm kiếm
            </Button>
          )}
        </div>
      ) : (
        <ul
          data-ocid="grammar_comparisons.list"
          className="mt-6 grid gap-3 md:grid-cols-2"
        >
          {filtered.map((item, index) => (
            <li key={item.id}>
              <Link
                to="/ngu-phap/so-sanh/$comparisonId"
                params={{ comparisonId: item.id }}
                data-ocid={`grammar_comparisons.item.${index + 1}`}
                className="hover-lift group flex h-full items-center gap-4 rounded-xl border border-border bg-card p-5 transition-smooth hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    {item.group}
                  </p>
                  <p
                    lang="ja"
                    className="break-words font-jp text-lg font-semibold leading-relaxed text-primary"
                  >
                    {item.patterns}
                  </p>
                  <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                    {item.distinction}
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
      )}
    </section>
  );
}
