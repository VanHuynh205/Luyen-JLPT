import { CompoundCard } from "@/components/kanji-library/CompoundCard";
import { EmptyResults } from "@/components/kanji-library/EmptyResults";
import { KanjiCard } from "@/components/kanji-library/KanjiCard";
import {
  filterCompounds,
  filterKanji,
  normalize,
} from "@/components/kanji-library/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentPack } from "@/core/content/types";
import { useContent } from "@/hooks/useContent";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

const ALL_LESSONS = "all";
const KANJI_PAGE = 24;
const COMPOUND_PAGE = 36;

function LoadMore({
  shown,
  total,
  onMore,
  ocid,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  ocid: string;
}) {
  if (shown >= total) return null;
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground">
        Đang hiển thị {shown} / {total}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 rounded-lg"
        onClick={onMore}
        data-ocid={ocid}
      >
        Xem thêm
        <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export default function KanjiLibraryPage() {
  const { pack } = useContent();
  if (!pack) return null;
  return <KanjiLibrary pack={pack} />;
}
function KanjiLibrary({ pack }: { pack: ContentPack }) {
  const { kanji: kanjiList, compounds: compoundList } = pack;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("kanji");
  const [lesson, setLesson] = useState(ALL_LESSONS);
  const [kanjiShown, setKanjiShown] = useState(KANJI_PAGE);
  const [compoundShown, setCompoundShown] = useState(COMPOUND_PAGE);

  const resetPaging = () => {
    setKanjiShown(KANJI_PAGE);
    setCompoundShown(COMPOUND_PAGE);
  };
  const lessonGroups = useMemo(
    () =>
      Array.from(
        new Set(
          [...kanjiList, ...compoundList].flatMap((entry) => entry.lessons),
        ),
      ).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)),
    [kanjiList, compoundList],
  );
  const compoundsByKanjiId = useMemo(() => {
    const byId = new Map<string, ContentPack["compounds"]>();
    for (const compound of compoundList) {
      for (const id of compound.kanjiIds) {
        const bucket = byId.get(id);
        if (bucket) bucket.push(compound);
        else byId.set(id, [compound]);
      }
    }
    return byId;
  }, [compoundList]);

  const kanjiResults = useMemo(() => {
    const q = normalize(query);
    const direct = new Set(filterKanji(kanjiList, query).map((k) => k.id));
    const viaCompound = new Set<string>();
    if (q) {
      for (const c of compoundList) {
        if (normalize(c.word).includes(q) || normalize(c.reading).includes(q)) {
          for (const id of c.kanjiIds) viaCompound.add(id);
        }
      }
    }
    return kanjiList.filter(
      (k) =>
        (direct.has(k.id) || viaCompound.has(k.id)) &&
        (lesson === ALL_LESSONS || k.lessons.includes(lesson)),
    );
  }, [query, lesson, kanjiList, compoundList]);

  const compoundResults = useMemo(
    () =>
      filterCompounds(compoundList, query).filter(
        (c) => lesson === ALL_LESSONS || c.lessons.includes(lesson),
      ),
    [query, lesson, compoundList],
  );
  const trimmed = query.trim();
  const clearFilters = () => {
    setQuery("");
    setLesson(ALL_LESSONS);
    resetPaging();
  };

  return (
    <section
      data-ocid="kanji_library.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Thư viện JLPT {pack.manifest.level.toUpperCase()}
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">Tra cứu Kanji</h1>
          <p
            className="mt-3 text-muted-foreground"
            data-ocid="kanji_library.counts"
          >
            {kanjiList.length} chữ kanji đơn và {compoundList.length} từ ghép
            kèm âm Hán Việt, cách đọc On – Kun và nghĩa tiếng Việt.
          </p>
        </div>
        <Button asChild className="min-h-11 self-start rounded-lg md:self-auto">
          <Link to="/kanji" data-ocid="kanji_library.start_quiz_link">
            Làm trắc nghiệm Kanji
            <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <div className="relative mt-6 md:mt-8">
        <label htmlFor="kanji-search" className="sr-only">
          Tìm kiếm kanji
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="kanji-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetPaging();
          }}
          placeholder="Tìm theo kanji, cách đọc, Hán Việt, nghĩa hoặc từ ghép… (vd: 学, がく, học)"
          className="h-12 rounded-lg bg-card pl-11 pr-12 text-base"
          data-ocid="kanji_library.search_input"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              resetPaging();
            }}
            aria-label="Xóa tìm kiếm"
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-ocid="kanji_library.search_clear_button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <fieldset
        className="mt-4 min-w-0 border-0 p-0"
        data-ocid="kanji_library.lesson_filter"
      >
        <legend className="sr-only">Lọc theo bài</legend>
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {[ALL_LESSONS, ...lessonGroups].map((value) => {
            const active = lesson === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setLesson(value);
                  resetPaging();
                }}
                data-ocid={`kanji_library.lesson.${value}.toggle`}
                className={`min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {value === ALL_LESSONS ? "Tất cả bài" : `Bài ${value}`}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList data-ocid="kanji_library.tab" className="h-11">
          <TabsTrigger
            value="kanji"
            className="px-4"
            data-ocid="kanji_library.kanji.tab"
          >
            Kanji đơn
            <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
              {kanjiResults.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="compound"
            className="px-4"
            data-ocid="kanji_library.compound.tab"
          >
            Từ ghép
            <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
              {compoundResults.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanji" className="mt-6">
          {kanjiResults.length === 0 ? (
            <EmptyResults
              query={trimmed || "bộ lọc hiện tại"}
              onClear={clearFilters}
            />
          ) : (
            <>
              <div
                className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-ocid="kanji_library.kanji.list"
              >
                {kanjiResults.slice(0, kanjiShown).map((entry, i) => (
                  <KanjiCard
                    key={entry.id}
                    entry={entry}
                    index={i + 1}
                    compounds={compoundsByKanjiId.get(entry.id) ?? []}
                  />
                ))}
              </div>
              <LoadMore
                shown={Math.min(kanjiShown, kanjiResults.length)}
                total={kanjiResults.length}
                onMore={() => setKanjiShown((n) => n + KANJI_PAGE)}
                ocid="kanji_library.kanji.pagination_next"
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="compound" className="mt-6">
          {compoundResults.length === 0 ? (
            <EmptyResults
              query={trimmed || "bộ lọc hiện tại"}
              onClear={clearFilters}
            />
          ) : (
            <>
              <div
                className="grid items-start gap-4 md:grid-cols-2"
                data-ocid="kanji_library.compound.list"
              >
                {compoundResults.slice(0, compoundShown).map((entry, i) => (
                  <CompoundCard key={entry.id} entry={entry} index={i + 1} />
                ))}
              </div>
              <LoadMore
                shown={Math.min(compoundShown, compoundResults.length)}
                total={compoundResults.length}
                onMore={() => setCompoundShown((n) => n + COMPOUND_PAGE)}
                ocid="kanji_library.compound.pagination_next"
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
