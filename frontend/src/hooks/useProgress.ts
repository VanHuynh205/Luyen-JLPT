import { useAuth } from "@/adapters/auth/session";
import { progressStore } from "@/adapters/local-store/progress";
import {
  GUEST_OWNER,
  type KanjiQuizInput,
  type ProgressScope,
  type ReadingAttemptInput,
} from "@/core/progress";
import type { ProgressSummary } from "@/core/progress/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useContent } from "./useContent";

export function useIsSignedIn() {
  const { session } = useAuth();
  return {
    principal: session?.user.id ?? null,
    isSignedIn: !!session,
    isInitializing: false,
  };
}

function useScope(): ProgressScope {
  const { level } = useContent();
  const { session } = useAuth();
  return { owner: session?.user.id ?? GUEST_OWNER, level };
}

function useSummary<Result>(select: (summary: ProgressSummary) => Result) {
  const scope = useScope();
  return useQuery({
    queryKey: ["progress", scope.owner, scope.level],
    queryFn: () => progressStore.getSummary(scope),
    select,
    networkMode: "always",
  });
}

export const useMyProgress = () => useSummary((summary) => summary);
export const useMyFlashcardStatuses = () =>
  useSummary((summary) => summary.flashcards);
export const useMyLearnedGrammar = () =>
  useSummary((summary) => summary.learnedGrammarIds);
export const useMyKanjiHistory = () =>
  useSummary((summary) => summary.recentKanjiResults);
export const useMyReadingResults = () =>
  useSummary((summary) => summary.readingResults);

function useSave<Input, Result>(
  write: (scope: ProgressScope, input: Input) => Promise<Result>,
) {
  const scope = useScope();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => write(scope, input),
    networkMode: "always",
    onSuccess: () =>
      cache.invalidateQueries({
        queryKey: ["progress", scope.owner, scope.level],
      }),
    onError: () =>
      toast.error("Không lưu được tiến độ trên máy. Vui lòng thử lại."),
  });
}

export const useSetFlashcardStatus = () =>
  useSave((scope, { cardId, known }: { cardId: string; known: boolean }) =>
    progressStore.setCardStatus(scope, cardId, known),
  );
export const useSetGrammarLearned = () =>
  useSave(
    (scope, { patternId, learned }: { patternId: string; learned: boolean }) =>
      progressStore.setGrammarLearned(scope, patternId, learned),
  );
export const useRecordKanjiQuiz = () =>
  useSave((scope, input: KanjiQuizInput) =>
    progressStore.recordKanjiQuiz(scope, input),
  );
export const useRecordReadingResult = () =>
  useSave((scope, input: ReadingAttemptInput) =>
    progressStore.recordReadingAttempt(scope, input),
  );

export function timestampToDate(timestamp: bigint): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}
