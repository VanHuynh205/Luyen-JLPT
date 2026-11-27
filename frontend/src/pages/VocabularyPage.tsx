import { db } from "@/adapters/local-store/db";
import { normalize } from "@/components/kanji-library/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { type CardStatus, Flashcard } from "@/components/vocabulary/Flashcard";
import type { VocabSection } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import {
  useMyFlashcardStatuses,
  useSetFlashcardStatus,
} from "@/hooks/useProgress";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Search,
  SearchX,
  Shuffle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const ALL = "all";
const sections: VocabSection[] = ["từ chính", "hội thoại", "đọc", "ghi tay"];

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest("input, textarea, select, button, [role='combobox']"),
  );
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function VocabularyPage() {
  const { vocabulary, manifest } = useReadyPack();
  const statusesQuery = useMyFlashcardStatuses();
  const setStatus = useSetFlashcardStatus();

  const [lesson, setLesson] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const filterKey = `vocabFilter:${manifest.level}`;
  const userChangedFilterRef = useRef(false);

  const statusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of statusesQuery.data ?? []) map.set(s.cardId, s.known);
    return map;
  }, [statusesQuery.data]);

  const lessons = useMemo(() => {
    const counts = new Map<number, number>();
    for (const word of vocabulary) {
      counts.set(word.lesson, (counts.get(word.lesson) ?? 0) + 1);
    }
    return [...counts].sort(([left], [right]) => left - right);
  }, [vocabulary]);

  const validLessonSet = useMemo(
    () => new Set(lessons.map(([number]) => String(number))),
    [lessons],
  );

  useEffect(() => {
    let active = true;
    userChangedFilterRef.current = false;
    void db.settings
      .get(filterKey)
      .then((row) => {
        if (!active || userChangedFilterRef.current) return;
        const raw = row?.value;
        if (typeof raw !== "object" || raw === null) return;
        const saved = raw as Record<string, unknown>;
        const nextLesson =
          typeof saved.lesson === "string" &&
          (saved.lesson === ALL || validLessonSet.has(saved.lesson))
            ? saved.lesson
            : ALL;
        const nextSection =
          typeof saved.section === "string" &&
          (saved.section === ALL ||
            (sections as readonly string[]).includes(saved.section))
            ? saved.section
            : ALL;
        const nextOnlyUnknown =
          typeof saved.onlyUnknown === "boolean" ? saved.onlyUnknown : false;
        setLesson(nextLesson);
        setSection(nextSection);
        setOnlyUnknown(nextOnlyUnknown);
        setOrder(null);
        setIndex(0);
        setFlipped(false);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [filterKey, validLessonSet]);

  const persistFilter = (next: {
    lesson: string;
    section: string;
    onlyUnknown: boolean;
  }) => {
    userChangedFilterRef.current = true;
    void db.settings
      .put({ key: filterKey, value: next })
      .catch(() => undefined);
  };

  const searchIndex = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const w of vocabulary) {
      map.set(
        w.id,
        [w.word, w.reading, w.hanViet ?? "", w.meaning].map(normalize),
      );
    }
    return map;
  }, [vocabulary]);

  const lessonWords = useMemo(
    () =>
      lesson === ALL
        ? vocabulary
        : vocabulary.filter((w) => String(w.lesson) === lesson),
    [lesson, vocabulary],
  );

  const sectionCounts = useMemo(() => {
    const counts = new Map<VocabSection, number>();
    for (const w of lessonWords) {
      counts.set(w.section, (counts.get(w.section) ?? 0) + 1);
    }
    return counts;
  }, [lessonWords]);

  const topicWords = useMemo(
    () =>
      section === ALL
        ? lessonWords
        : lessonWords.filter((w) => w.section === section),
    [lessonWords, section],
  );

  const normalizedQuery = normalize(query);
  const matchedWords = useMemo(() => {
    if (!normalizedQuery) return topicWords;
    return topicWords.filter((w) =>
      (searchIndex.get(w.id) ?? []).some((field) =>
        field.includes(normalizedQuery),
      ),
    );
  }, [topicWords, searchIndex, normalizedQuery]);

  const deck = useMemo(() => {
    let words = matchedWords;
    if (order) {
      const byId = new Map(words.map((w) => [w.id, w]));
      words = order.flatMap((id) => byId.get(id) ?? []);
    }
    return onlyUnknown ? words.filter((w) => !statusMap.get(w.id)) : words;
  }, [matchedWords, order, onlyUnknown, statusMap]);

  const safeIndex = Math.min(index, Math.max(deck.length - 1, 0));
  const current = deck[safeIndex];
  const knownCount = matchedWords.filter((w) => statusMap.get(w.id)).length;

  const resetPosition = () => {
    setIndex(0);
    setFlipped(false);
  };
  const go = (next: number) => {
    setIndex(next);
    setFlipped(false);
  };

  const mark = (known: boolean) => {
    if (!current) return;
    setStatus.mutate({ cardId: current.id, known });
  };

  const currentStatus: CardStatus = !current
    ? "none"
    : statusMap.has(current.id)
      ? statusMap.get(current.id)
        ? "known"
        : "unknown"
      : "none";
  const pendingFor = setStatus.isPending ? setStatus.variables : undefined;
  const statusLoading = statusesQuery.isLoading;

  useEffect(() => {
    if (!current) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInteractiveTarget(event.target)) return;

      if (event.key === " " || event.code === "Space") {
        // Let the card's own keydown handler flip when the card itself is focused.
        if (
          event.target instanceof HTMLElement &&
          event.target.closest('[data-ocid="flashcard.card"]')
        ) {
          return;
        }
        event.preventDefault();
        setFlipped((f) => !f);
        return;
      }

      if (event.key === "ArrowLeft" && safeIndex > 0) {
        event.preventDefault();
        setIndex(safeIndex - 1);
        setFlipped(false);
        return;
      }

      if (event.key === "ArrowRight" && safeIndex < deck.length - 1) {
        event.preventDefault();
        setIndex(safeIndex + 1);
        setFlipped(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, deck.length, safeIndex]);

  return (
    <section
      data-ocid="vocabulary.page"
      className="mx-auto max-w-4xl px-4 py-4 sm:py-10 md:px-6 md:py-14"
    >
      <header className="mb-3 sm:mb-8">
        <p className="hidden text-sm uppercase tracking-wider text-muted-foreground sm:block">
          Flashcard · JLPT {manifest.level.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-semibold sm:mt-1 sm:text-3xl md:text-4xl">
          {manifest.level === "n4"
            ? "Từ vựng Minna no Nihongo"
            : `Từ vựng ${manifest.level.toUpperCase()}`}
        </h1>
        <p className="mt-2 hidden max-w-2xl text-muted-foreground sm:block">
          Chọn bài và mục từ vựng, lật thẻ để xem cách đọc, âm Hán Việt và nghĩa
          tiếng Việt. Đánh dấu từ đã thuộc để tập trung ôn những từ còn lại.
        </p>
      </header>

      <div className="mb-3 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-subtle sm:mb-6 sm:p-4">
        <div className="relative">
          <Label htmlFor="vocab-search" className="sr-only">
            Tìm kiếm từ vựng
          </Label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="vocab-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOrder(null);
              resetPosition();
            }}
            placeholder="Tìm từ, cách đọc, Hán Việt hoặc nghĩa… (vd: 探す, さがす, tham, tìm)"
            className="h-11 bg-background pl-10 pr-11 text-sm sm:text-base"
            data-ocid="vocabulary.search_input"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOrder(null);
                resetPosition();
              }}
              aria-label="Xóa tìm kiếm"
              data-ocid="vocabulary.search_clear_button"
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-xl sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
              <Label htmlFor="vocab-lesson" className="text-xs sm:text-sm">
                Bài học
              </Label>
              <Select
                value={lesson}
                onValueChange={(v) => {
                  setLesson(v);
                  setOrder(null);
                  resetPosition();
                  persistFilter({ lesson: v, section, onlyUnknown });
                }}
              >
                <SelectTrigger
                  id="vocab-lesson"
                  data-ocid="vocabulary.lesson.select"
                  className="min-h-11 min-w-0 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>
                    Tất cả bài ({vocabulary.length})
                  </SelectItem>
                  {lessons.map(([number, count]) => (
                    <SelectItem key={number} value={String(number)}>
                      Bài {number} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
              <Label htmlFor="vocab-section" className="text-xs sm:text-sm">
                Mục
              </Label>
              <Select
                value={section}
                onValueChange={(v) => {
                  setSection(v);
                  setOrder(null);
                  resetPosition();
                  persistFilter({ lesson, section: v, onlyUnknown });
                }}
              >
                <SelectTrigger
                  id="vocab-section"
                  data-ocid="vocabulary.section.select"
                  className="min-h-11 min-w-0 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    Tất cả mục ({lessonWords.length})
                  </SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)} (
                      {sectionCounts.get(s) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
            <div className="flex items-center gap-2.5">
              <Switch
                id="vocab-only-unknown"
                data-ocid="vocabulary.only_unknown.switch"
                checked={onlyUnknown}
                onCheckedChange={(checked) => {
                  setOnlyUnknown(checked);
                  resetPosition();
                  persistFilter({ lesson, section, onlyUnknown: checked });
                }}
              />
              <Label
                htmlFor="vocab-only-unknown"
                className="cursor-pointer text-xs sm:text-sm"
              >
                Chỉ ôn thẻ chưa thuộc
              </Label>
            </div>
            {statusesQuery.isSuccess && (
              <p className="text-xs text-muted-foreground sm:text-sm">
                Đã thuộc{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {knownCount}/{matchedWords.length}
                </span>
                <span className="hidden sm:inline"> từ trong lựa chọn này</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {statusLoading ? (
        <div data-ocid="vocabulary.loading_state" aria-busy="true">
          <Skeleton className="h-[15rem] w-full rounded-xl sm:h-[22rem] md:h-[24rem]" />
          <div className="mt-4 flex justify-between sm:mt-6">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      ) : statusesQuery.isError ? (
        <div
          role="alert"
          data-ocid="vocabulary.error_state"
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center shadow-subtle"
        >
          <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
          <p className="font-medium">Không tải được trạng thái thẻ.</p>
          <Button
            type="button"
            variant="outline"
            data-ocid="vocabulary.retry_button"
            className="min-h-11"
            onClick={() => void statusesQuery.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : matchedWords.length === 0 ? (
        <div
          data-ocid="vocabulary.no_match.empty_state"
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center shadow-subtle"
        >
          <SearchX
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-display text-xl font-semibold">
            Không có từ nào khớp bộ lọc
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Hãy thử chọn bài, mục khác hoặc thay đổi từ khóa tìm kiếm.
          </p>
          <Button
            type="button"
            data-ocid="vocabulary.reset_filters_button"
            className="min-h-11"
            onClick={() => {
              setLesson(ALL);
              setSection(ALL);
              setQuery("");
              setOrder(null);
              resetPosition();
              persistFilter({ lesson: ALL, section: ALL, onlyUnknown });
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
      ) : !current ? (
        <div
          data-ocid="vocabulary.empty_state"
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center shadow-subtle"
        >
          <PartyPopper className="size-10 text-primary" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold">
            Bạn đã thuộc hết thẻ trong lựa chọn này!
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Hãy chọn bài khác hoặc tắt bộ lọc để ôn lại toàn bộ thẻ.
          </p>
          <Button
            type="button"
            data-ocid="vocabulary.show_all_button"
            className="min-h-11"
            onClick={() => {
              setOnlyUnknown(false);
              resetPosition();
              persistFilter({ lesson, section, onlyUnknown: false });
            }}
          >
            Xem tất cả thẻ
          </Button>
        </div>
      ) : (
        <div>
          <Flashcard
            key={current.id}
            word={current}
            status={currentStatus}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onPrev={safeIndex > 0 ? () => go(safeIndex - 1) : undefined}
            onNext={
              safeIndex < deck.length - 1 ? () => go(safeIndex + 1) : undefined
            }
          />

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
            <Button
              type="button"
              variant={currentStatus === "unknown" ? "secondary" : "outline"}
              data-ocid="vocabulary.mark_unknown_button"
              className="min-h-[45px]"
              disabled={setStatus.isPending}
              onClick={() => mark(false)}
            >
              <X className="size-4" aria-hidden="true" />
              {pendingFor?.cardId === current.id && !pendingFor.known
                ? "Đang lưu…"
                : "Chưa thuộc"}
            </Button>
            <Button
              type="button"
              variant={currentStatus === "known" ? "default" : "outline"}
              data-ocid="vocabulary.mark_known_button"
              className="min-h-[45px]"
              disabled={setStatus.isPending}
              onClick={() => mark(true)}
            >
              <Check className="size-4" aria-hidden="true" />
              {pendingFor?.cardId === current.id && pendingFor.known
                ? "Đang lưu…"
                : "Đã thuộc"}
            </Button>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-4 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <Button
              type="button"
              variant="outline"
              data-ocid="vocabulary.pagination_prev"
              className="min-h-[45px]"
              disabled={safeIndex === 0}
              onClick={() => go(safeIndex - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Trước
            </Button>
            <div className="order-last col-span-2 flex items-center justify-center gap-3 sm:order-none">
              <span
                data-ocid="vocabulary.position"
                aria-live="polite"
                className="font-mono text-sm tabular-nums text-muted-foreground"
              >
                {`${safeIndex + 1} / ${deck.length}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-ocid="vocabulary.shuffle_button"
                className="min-h-11 sm:min-h-9"
                onClick={() => {
                  setOrder(shuffled(matchedWords.map((w) => w.id)));
                  resetPosition();
                }}
              >
                <Shuffle className="size-4" aria-hidden="true" />
                Xáo trộn
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              data-ocid="vocabulary.pagination_next"
              className="min-h-[45px]"
              disabled={safeIndex >= deck.length - 1}
              onClick={() => go(safeIndex + 1)}
            >
              Tiếp
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <p className="mt-3 hidden text-center text-xs text-muted-foreground sm:block">
            Phím tắt: Space lật thẻ · ← / → chuyển thẻ
          </p>
        </div>
      )}
    </section>
  );
}
