import { Badge } from "@/components/ui/badge";
import type { VocabWord } from "@/core/content/types";
import { cn } from "@/lib/utils";
import { RotateCw } from "lucide-react";

export type CardStatus = "known" | "unknown" | "none";

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
      className="absolute right-4 top-4 rounded-md"
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
}: {
  word: VocabWord;
  status: CardStatus;
  flipped: boolean;
  onFlip: () => void;
}) {
  const face =
    "backface-hidden absolute inset-0 flex flex-col rounded-xl border bg-card p-6 shadow-subtle md:p-8";
  return (
    <button
      type="button"
      data-ocid="flashcard.card"
      aria-pressed={flipped}
      aria-label={
        flipped
          ? `Mặt sau thẻ ${word.word}. Nhấn để xem mặt trước`
          : `Thẻ ${word.word}. Nhấn để lật xem nghĩa`
      }
      onClick={onFlip}
      className="perspective-1000 group block h-[26rem] w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background md:h-[24rem]"
    >
      <div
        className={cn(
          "preserve-3d relative h-full w-full transition-transform duration-500 ease-out motion-reduce:duration-0",
          flipped && "rotate-y-180",
        )}
      >
        {/* Front */}
        <div className={cn(face, "ink-rule items-center justify-center")}>
          <span className="absolute left-6 top-5 text-xs uppercase tracking-wider text-muted-foreground md:left-8">
            Bài {word.lesson}
          </span>
          <StatusBadge status={status} />
          <span
            lang="ja"
            className="text-kanji-hero break-all text-center text-foreground"
          >
            {word.word}
          </span>
          {word.context && (
            <span
              lang="ja"
              className="font-jp-sans mt-3 text-center text-lg text-muted-foreground"
            >
              {word.context}
            </span>
          )}
          <span className="absolute bottom-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-smooth group-hover:text-primary">
            <RotateCw className="size-4" aria-hidden="true" />
            Nhấn để lật thẻ
          </span>
        </div>

        {/* Back */}
        <div className={cn(face, "rotate-y-180 gap-4 overflow-y-auto")}>
          <StatusBadge status={status} />
          <div className="min-w-0 pr-20">
            <p lang="ja" className="font-jp text-3xl text-foreground">
              {word.word}
            </p>
            <p lang="ja" className="font-jp-sans mt-1 text-lg text-primary">
              {word.reading}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          <p className="font-display text-2xl leading-snug text-foreground">
            {word.meaning}
          </p>
          {(word.context || word.note) && (
            <div className="mt-auto flex flex-col gap-2 rounded-lg bg-muted/60 p-4">
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
    </button>
  );
}
