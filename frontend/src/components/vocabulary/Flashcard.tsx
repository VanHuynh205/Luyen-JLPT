import { Badge } from "@/components/ui/badge";
import type { VocabWord } from "@/core/content/types";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import { RotateCw } from "lucide-react";
import { type KeyboardEvent, type TouchEvent, useRef } from "react";

export type CardStatus = "known" | "unknown" | "none";

const SWIPE_THRESHOLD_PX = 50;
const SCROLL_TOLERANCE_PX = 12;

const STATUS_LABEL: Record<CardStatus, string> = {
  known: "Đã thuộc",
  unknown: "Chưa thuộc",
  none: "",
};

function StatusBadge({ status }: { status: CardStatus }) {
  if (status === "none") return null;
  return (
    <Badge
      data-ocid="flashcard.status_badge"
      variant={status === "known" ? "default" : "secondary"}
      className="absolute right-3 top-3 rounded-md sm:right-4 sm:top-4"
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function Flashcard({
  word,
  status,
  flipped,
  onFlip,
  onPrev,
  onNext,
}: {
  word: VocabWord;
  status: CardStatus;
  flipped: boolean;
  onFlip: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { mode } = useMotionPreference();
  const reduced = mode === "reduced";
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches.length === 1 ? event.touches[0] : undefined;
    if (!touch) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    suppressNextClickRef.current = false;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      suppressNextClickRef.current = true;
      if (dx < 0) onNext?.();
      else onPrev?.();
      return;
    }

    if (Math.abs(dy) > SCROLL_TOLERANCE_PX) {
      suppressNextClickRef.current = true;
    }
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
  };

  const handleClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const selection = window.getSelection?.()?.toString();
    if (selection && selection.length > 0) return;
    onFlip();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onFlip();
    }
  };

  const face =
    "paper-edge absolute inset-0 flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8";

  return (
    // biome-ignore lint/a11y/useSemanticElements: card back holds scrollable block content invalid inside <button>
    <div
      role="button"
      tabIndex={0}
      data-ocid="flashcard.card"
      aria-pressed={flipped}
      aria-label={
        flipped
          ? `Mặt sau thẻ ${word.word}. Nhấn để xem mặt trước`
          : `Thẻ ${word.word}. Nhấn để lật xem nghĩa`
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ touchAction: "pan-y pinch-zoom" }}
      className="perspective-1000 group block h-[15rem] w-full cursor-pointer select-none rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:h-[22rem] md:h-[24rem]"
    >
      <div
        className={cn(
          "flashcard-3d-inner relative h-full w-full",
          !reduced &&
            "preserve-3d transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
          !reduced && flipped && "rotate-y-180",
        )}
      >
        {/* Front */}
        <div
          aria-hidden={flipped}
          className={cn(
            face,
            "items-center justify-center",
            reduced
              ? cn(
                  "transition-opacity duration-200 ease-out",
                  flipped ? "pointer-events-none opacity-0" : "opacity-100",
                )
              : cn("backface-hidden", flipped && "pointer-events-none"),
          )}
        >
          <span className="absolute left-5 top-4 text-xs uppercase tracking-wider text-muted-foreground sm:left-6 sm:top-5 md:left-8">
            Bài {word.lesson}
          </span>
          <StatusBadge status={status} />
          <span
            lang="ja"
            className="font-jp break-all text-center text-4xl font-semibold leading-tight text-foreground sm:text-kanji-hero"
          >
            {word.word}
          </span>
          {word.context && (
            <span
              lang="ja"
              className="font-jp-sans mt-2 line-clamp-2 text-center text-base text-muted-foreground sm:mt-3 sm:text-lg"
            >
              {word.context}
            </span>
          )}
          <span className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted-foreground transition-smooth group-hover:text-primary sm:bottom-5 sm:text-sm">
            <RotateCw className="size-3.5 sm:size-4" aria-hidden="true" />
            Nhấn để lật thẻ
          </span>
        </div>

        {/* Back */}
        <div
          aria-hidden={!flipped}
          className={cn(
            face,
            "gap-3 overflow-y-auto overscroll-contain sm:gap-4",
            reduced
              ? cn(
                  "transition-opacity duration-200 ease-out",
                  flipped ? "opacity-100" : "pointer-events-none opacity-0",
                )
              : cn(
                  "backface-hidden rotate-y-180",
                  !flipped && "pointer-events-none",
                ),
          )}
        >
          <StatusBadge status={status} />
          <div className="min-w-0 pr-20">
            <p
              lang="ja"
              className="font-jp text-2xl text-foreground sm:text-3xl"
            >
              {word.word}
            </p>
            <p
              lang="ja"
              className="font-jp-sans mt-0.5 text-base text-primary sm:mt-1 sm:text-lg"
            >
              {word.reading}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge variant="outline" className="rounded-md">
              Bài {word.lesson}
            </Badge>
            <Badge variant="outline" className="rounded-md capitalize">
              {word.section}
            </Badge>
            {word.wordType && (
              <Badge variant="secondary" className="rounded-md">
                {word.wordType}
              </Badge>
            )}
          </div>
          {word.hanViet && (
            <p className="text-sm text-muted-foreground">
              Hán Việt:{" "}
              <span className="font-medium uppercase tracking-wide text-foreground">
                {word.hanViet}
              </span>
            </p>
          )}
          <p className="font-display text-xl leading-snug text-foreground sm:text-2xl">
            {word.meaning}
          </p>
          {(word.context || word.note) && (
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 sm:gap-2 sm:p-4">
              {word.context && (
                <p lang="ja" className="font-jp-sans text-base text-foreground">
                  {word.context}
                </p>
              )}
              {word.note && (
                <p className="text-sm text-muted-foreground">{word.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
