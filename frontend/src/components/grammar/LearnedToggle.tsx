import { Button } from "@/components/ui/button";
import { useMyLearnedGrammar, useSetGrammarLearned } from "@/hooks/useProgress";
import { cn } from "@/lib/utils";
import { BookmarkPlus, CheckCircle2, Loader2 } from "lucide-react";

export function LearnedToggle({ patternId }: { patternId: string }) {
  const learnedQuery = useMyLearnedGrammar();
  const setLearned = useSetGrammarLearned();

  const savedLearned = (learnedQuery.data ?? []).includes(patternId);
  const pendingValue = setLearned.isPending
    ? setLearned.variables?.learned
    : undefined;
  const learned = pendingValue ?? savedLearned;
  const loading = learnedQuery.isLoading;

  const handleClick = () => {
    setLearned.mutate({ patternId, learned: !learned });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        data-ocid="grammar_detail.learned_toggle"
        aria-pressed={learned}
        disabled={loading || setLearned.isPending}
        onClick={handleClick}
        variant={learned ? "outline" : "default"}
        className={cn(
          "min-h-11 rounded-md transition-smooth",
          learned &&
            "border-success bg-success/10 text-success hover:bg-success/15 hover:text-success",
        )}
      >
        {setLearned.isPending || loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : learned ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <BookmarkPlus className="size-4" aria-hidden="true" />
        )}
        {learned ? "Đã học · Bỏ đánh dấu" : "Đánh dấu đã học"}
      </Button>
    </div>
  );
}
