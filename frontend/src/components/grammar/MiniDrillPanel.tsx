import { GrammarQuiz } from "@/components/grammar/GrammarQuiz";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { GrammarQuizQuestion } from "@/core/content/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ListChecks, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";

export interface MiniDrillPanelProps {
  title?: string;
  description: string;
  buildQuestions: () => GrammarQuizQuestion[];
  className?: string;
}

export function MiniDrillPanel({
  title = "Luyện nhanh 5 câu",
  description,
  buildQuestions,
  className,
}: MiniDrillPanelProps) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<GrammarQuizQuestion[]>(() =>
    buildQuestions(),
  );
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setQuestions(buildQuestions());
    setGeneration((g) => g + 1);
  }, [buildQuestions]);

  const regenerate = () => {
    setQuestions(buildQuestions());
    setGeneration((g) => g + 1);
  };

  return (
    <section
      data-ocid="grammar_mini_drill.panel"
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-subtle",
        className,
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            data-ocid="grammar_mini_drill.toggle_button"
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-smooth hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ListChecks className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold text-foreground md:text-lg">
                  {title}
                </span>
                <span className="block text-xs text-muted-foreground sm:text-sm">
                  {description}
                </span>
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border bg-muted/30 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Chọn đáp án đúng để xem giải thích chi tiết ngay bên dưới.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-ocid="grammar_mini_drill.regenerate_button"
              className="min-h-11 shrink-0 rounded-md sm:min-h-11"
              onClick={regenerate}
            >
              <Shuffle className="size-4" aria-hidden="true" />
              Đổi 5 câu mới
            </Button>
          </div>
          <GrammarQuiz key={generation} questions={questions} />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
