import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RemediationItem } from "@/core/exam/remediation";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface QuickRemediationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly RemediationItem[];
  examTitle: string;
}

const KIND_LABEL: Record<RemediationItem["kind"], string> = {
  vocab: "Từ vựng",
  kanji: "Chữ Hán",
  compound: "Từ ghép",
  grammar: "Ngữ pháp",
  exam_question: "Câu đề thi",
};

export function QuickRemediationModal({
  open,
  onOpenChange,
  items,
  examTitle,
}: QuickRemediationModalProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setRevealed(false);
    }
  }, [open]);

  const current = items[index];
  const isLast = index >= items.length - 1;

  const goTo = (nextIndex: number) => {
    setIndex(nextIndex);
    setRevealed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-ocid="remediation.dialog"
        className="max-h-[88dvh] overflow-y-auto p-5 sm:max-w-xl sm:p-6"
      >
        <DialogHeader className="flex-row items-start justify-between gap-3 text-left">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-display text-xl font-semibold text-foreground">
              Ôn cấp tốc 10 phút
            </DialogTitle>
            <DialogDescription className="truncate">
              {examTitle}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Đóng hộp thoại ôn tập"
              data-ocid="remediation.close_button"
              className="min-h-11 min-w-11 shrink-0 rounded-md"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>

        {!current ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-5 py-8 text-center">
            <CheckCircle2 className="size-9 text-success" aria-hidden="true" />
            <p className="font-display text-lg font-semibold text-foreground">
              Không có câu sai cần ôn lại
            </p>
            <p className="text-sm text-muted-foreground">
              Bạn đã trả lời đúng toàn bộ các câu đã chấm trong lượt thi này.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full">
                  {KIND_LABEL[current.kind]}
                </Badge>
                {current.lesson !== undefined && (
                  <Badge variant="outline" className="rounded-full">
                    Bài {current.lesson} Minna
                  </Badge>
                )}
                <span>Câu {current.sourceQuestionNumber}</span>
              </div>
              <span className="font-medium text-foreground">
                Thẻ {index + 1} / {items.length}
              </span>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
              <div className="space-y-1.5 text-center">
                <p
                  lang="ja"
                  className={cn(
                    "font-jp break-words font-semibold text-foreground",
                    current.kind === "kanji"
                      ? "text-5xl leading-tight"
                      : current.kind === "exam_question"
                        ? "font-jp-sans text-lg leading-relaxed"
                        : "text-3xl leading-snug",
                  )}
                >
                  {current.label}
                </p>
                {revealed && current.reading && (
                  <p
                    lang="ja"
                    className="font-jp-sans text-base font-medium text-primary"
                  >
                    {current.reading}
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  data-ocid="remediation.flip_button"
                  className="min-h-11 rounded-md"
                  onClick={() => setRevealed((prev) => !prev)}
                >
                  {revealed ? (
                    <>
                      <EyeOff className="size-4" aria-hidden="true" />
                      Ẩn đáp án
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" aria-hidden="true" />
                      Lật thẻ xem nghĩa &amp; giải thích
                    </>
                  )}
                </Button>
              </div>

              {revealed && (
                <div className="space-y-2.5 border-t border-border pt-4 text-sm leading-relaxed">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {current.meaning}
                  </p>
                  <p className="text-muted-foreground">{current.explanation}</p>
                </div>
              )}
            </div>

            {current.kind === "grammar" && (
              <Button
                asChild
                variant="outline"
                className="min-h-11 w-full rounded-md"
              >
                <Link
                  to="/ngu-phap/$patternId"
                  params={{ patternId: current.id }}
                  data-ocid="remediation.curriculum_link"
                  onClick={() => onOpenChange(false)}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Mở chi tiết ngữ pháp (Bài {current.lesson ?? "N4"})
                </Link>
              </Button>
            )}

            {(current.kind === "kanji" || current.kind === "compound") && (
              <Button
                asChild
                variant="outline"
                className="min-h-11 w-full rounded-md"
              >
                <Link
                  to="/kanji/tra-cuu"
                  data-ocid="remediation.curriculum_link"
                  onClick={() => onOpenChange(false)}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Mở tra cứu Kanji &amp; từ ghép
                </Link>
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:justify-between">
          {current ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={index === 0}
                data-ocid="remediation.prev_button"
                className="min-h-11 rounded-md"
                onClick={() => goTo(Math.max(0, index - 1))}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Câu trước
              </Button>
              <Button
                type="button"
                data-ocid="remediation.next_button"
                className="min-h-11 rounded-md"
                onClick={() => {
                  if (isLast) onOpenChange(false);
                  else goTo(index + 1);
                }}
              >
                {isLast ? "Hoàn tất ôn tập" : "Sang câu tiếp"}
                {!isLast && (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="min-h-11 w-full rounded-md sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Đóng
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
