import { Button } from "@/components/ui/button";
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
  SearchX,
  Shuffle,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const ALL = "all";
const sections: VocabSection[] = ["từ chính", "hội thoại", "đọc", "ghi tay"];

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
  const [order, setOrder] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

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

  const deck = useMemo(() => {
    let words = topicWords;
    if (order) {
      const byId = new Map(words.map((w) => [w.id, w]));
      words = order.flatMap((id) => byId.get(id) ?? []);
    }
    return onlyUnknown ? words.filter((w) => !statusMap.get(w.id)) : words;
  }, [topicWords, order, onlyUnknown, statusMap]);

  const safeIndex = Math.min(index, Math.max(deck.length - 1, 0));
  const current = deck[safeIndex];
  const knownCount = topicWords.filter((w) => statusMap.get(w.id)).length;

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

  return (
    <section
      data-ocid="vocabulary.page"
      className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16"
    >
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Flashcard · JLPT {manifest.level.toUpperCase()}
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold md:text-4xl">
          {manifest.level === "n4"
            ? "Từ vựng Minna no Nihongo"
            : `Từ vựng ${manifest.level.toUpperCase()}`}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Chọn bài và mục từ vựng, lật thẻ để xem cách đọc, âm Hán Việt và nghĩa
          tiếng Việt. Đánh dấu từ đã thuộc để tập trung ôn những từ còn lại.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-subtle sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 flex-1 gap-4 sm:max-w-xl sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="vocab-lesson">Bài học</Label>
            <Select
              value={lesson}
              onValueChange={(v) => {
                setLesson(v);
                setOrder(null);
                resetPosition();
              }}
            >
              <SelectTrigger
                id="vocab-lesson"
                data-ocid="vocabulary.lesson.select"
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
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="vocab-section">Mục</Label>
            <Select
              value={section}
              onValueChange={(v) => {
                setSection(v);
                setOrder(null);
                resetPosition();
              }}
            >
              <SelectTrigger
                id="vocab-section"
                data-ocid="vocabulary.section.select"
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
        <div className="flex items-center gap-3">
          <Switch
            id="vocab-only-unknown"
            data-ocid="vocabulary.only_unknown.switch"
            checked={onlyUnknown}
            onCheckedChange={(checked) => {
              setOnlyUnknown(checked);
              resetPosition();
            }}
          />
          <Label htmlFor="vocab-only-unknown" className="cursor-pointer">
            Chỉ ôn thẻ chưa thuộc
          </Label>
        </div>
      </div>

      {statusesQuery.isSuccess && (
        <p className="mb-4 text-sm text-muted-foreground">
          Đã thuộc{" "}
          <span className="font-semibold text-foreground">
            {knownCount}/{topicWords.length}
          </span>{" "}
          từ trong lựa chọn này
        </p>
      )}

      {statusLoading ? (
        <div data-ocid="vocabulary.loading_state" aria-busy="true">
          <Skeleton className="h-[24rem] w-full rounded-xl" />
          <div className="mt-6 flex justify-between">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-28" />
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
            onClick={() => void statusesQuery.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : topicWords.length === 0 ? (
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
            Hãy thử chọn bài hoặc mục khác để xem thêm từ vựng.
          </p>
          <Button
            type="button"
            data-ocid="vocabulary.reset_filters_button"
            onClick={() => {
              setLesson(ALL);
              setSection(ALL);
              setOrder(null);
              resetPosition();
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
            onClick={() => {
              setOnlyUnknown(false);
              resetPosition();
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
          />

          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              data-ocid="vocabulary.pagination_prev"
              disabled={safeIndex === 0}
              onClick={() => go(safeIndex - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Trước
            </Button>
            <div className="order-first col-span-2 flex items-center justify-center gap-3 sm:order-none">
              <span
                data-ocid="vocabulary.position"
                aria-live="polite"
                className="font-mono text-sm tabular-nums text-muted-foreground"
              >
                {safeIndex + 1} / {deck.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-ocid="vocabulary.shuffle_button"
                onClick={() => {
                  setOrder(shuffled(topicWords.map((w) => w.id)));
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
              disabled={safeIndex >= deck.length - 1}
              onClick={() => go(safeIndex + 1)}
            >
              Tiếp
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={currentStatus === "unknown" ? "secondary" : "outline"}
              data-ocid="vocabulary.mark_unknown_button"
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
              disabled={setStatus.isPending}
              onClick={() => mark(true)}
            >
              <Check className="size-4" aria-hidden="true" />
              {pendingFor?.cardId === current.id && pendingFor.known
                ? "Đang lưu…"
                : "Đã thuộc"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
