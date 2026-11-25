import { GrammarSubNav } from "@/components/grammar/GrammarSubNav";
import { normalize } from "@/components/kanji-library/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VerbPair } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import { Search, SearchX, X } from "lucide-react";
import { useMemo, useState } from "react";

function buildSearchText(pair: VerbPair): string {
  return normalize(
    [
      pair.transitiveJa,
      pair.transitiveKana,
      pair.intransitiveJa,
      pair.intransitiveKana,
      pair.meaning,
    ].join(" "),
  );
}

export default function GrammarVerbPairsPage() {
  const { verbPairs, manifest } = useReadyPack();
  const [query, setQuery] = useState("");

  const searchIndex = useMemo(
    () =>
      verbPairs.map((pair) => ({
        pair,
        text: buildSearchText(pair),
      })),
    [verbPairs],
  );

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return verbPairs;
    return searchIndex
      .filter((item) => item.text.includes(term))
      .map((item) => item.pair);
  }, [query, searchIndex, verbPairs]);

  const trimmed = query.trim();

  return (
    <section
      data-ocid="grammar_verb_pairs.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="max-w-2xl space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="font-jp text-lg" lang="ja">
            自他動詞
          </span>
          Ngữ pháp JLPT {manifest.level.toUpperCase()}
        </p>
        <h1 className="text-3xl font-semibold md:text-4xl">
          Tự động từ &amp; Tha động từ
        </h1>
        <p className="text-muted-foreground">
          {verbPairs.length} cặp động từ đối ứng thường gặp giúp phân biệt hành
          động có chủ thể tác động và trạng thái tự nhiên.
        </p>
      </header>

      <GrammarSubNav />

      <div
        aria-label="Phân biệt tự động từ và tha động từ"
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-subtle md:grid-cols-2 md:gap-6 md:p-5"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Tha động từ
            </h2>
            <Badge variant="secondary" className="rounded-full">
              <span lang="ja">を</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Chủ thể chủ động tác động lên đối tượng, thường đi với trợ từ{" "}
            <span lang="ja" className="font-semibold text-foreground">
              を
            </span>
            .
          </p>
        </div>
        <div className="space-y-1 border-t pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Tự động từ
            </h2>
            <Badge variant="outline" className="rounded-full">
              <span lang="ja">が</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Diễn tả trạng thái hoặc biến đổi tự nhiên của sự vật, hay đi với trợ
            từ{" "}
            <span lang="ja" className="font-semibold text-foreground">
              が
            </span>
            .
          </p>
        </div>
      </div>

      <div className="relative mt-6">
        <label htmlFor="verb-pairs-search" className="sr-only">
          Tìm cặp tự động từ và tha động từ
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="verb-pairs-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo từ tiếng Nhật, kana hoặc nghĩa (vd: 開ける, あく, bật đèn)"
          className="h-11 bg-card pl-10 pr-11"
          data-ocid="grammar_verb_pairs.search_input"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Xoá tìm kiếm"
            data-ocid="grammar_verb_pairs.search_clear_button"
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p
        className="mt-3 text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        Hiển thị {filtered.length} / {verbPairs.length} cặp
      </p>

      {filtered.length === 0 ? (
        <div
          data-ocid="grammar_verb_pairs.empty_state"
          className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <SearchX
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">
            Không tìm thấy cặp động từ phù hợp
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground break-words">
            {trimmed
              ? `Không có cặp nào khớp với “${trimmed}”. Hãy thử từ khoá khác.`
              : "Cấp độ này chưa có dữ liệu tự / tha động từ."}
          </p>
          {trimmed && (
            <Button
              type="button"
              variant="outline"
              className="mt-6 min-h-11"
              data-ocid="grammar_verb_pairs.clear_search_button"
              onClick={() => setQuery("")}
            >
              Xoá tìm kiếm
            </Button>
          )}
        </div>
      ) : (
        <ul data-ocid="grammar_verb_pairs.list" className="mt-6 space-y-4">
          {filtered.map((pair, index) => (
            <li
              key={pair.id}
              data-ocid={`grammar_verb_pairs.item.${index + 1}`}
              className="rounded-xl border border-border bg-card p-4 shadow-subtle md:p-5"
            >
              <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tha động từ (
                    <span lang="ja" className="text-foreground">
                      を
                    </span>
                    )
                  </p>
                  <p
                    lang="ja"
                    className="mt-1 font-jp text-xl font-semibold text-foreground break-words"
                  >
                    {pair.transitiveJa}
                  </p>
                  <p
                    lang="ja"
                    className="text-sm text-muted-foreground break-words"
                  >
                    {pair.transitiveKana}
                  </p>
                </div>

                <div className="min-w-0 border-t pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tự động từ (
                    <span lang="ja" className="text-foreground">
                      が
                    </span>
                    )
                  </p>
                  <p
                    lang="ja"
                    className="mt-1 font-jp text-xl font-semibold text-foreground break-words"
                  >
                    {pair.intransitiveJa}
                  </p>
                  <p
                    lang="ja"
                    className="text-sm text-muted-foreground break-words"
                  >
                    {pair.intransitiveKana}
                  </p>
                </div>
              </div>

              <p className="mt-3 border-t pt-3 text-sm text-foreground break-words">
                {pair.meaning}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
