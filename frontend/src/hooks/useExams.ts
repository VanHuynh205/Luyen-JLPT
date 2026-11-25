import { useAuth } from "@/adapters/auth/session";
import {
  loadExamDocument,
  loadExamIndex,
} from "@/adapters/content-pack/examSource";
import { type ExamAttemptInput, examStore } from "@/adapters/local-store/exams";
import type { Level } from "@/core/content/types";
import { GUEST_OWNER } from "@/core/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useContent } from "./useContent";

function useExamScope() {
  const { level } = useContent();
  const { session } = useAuth();
  return { owner: session?.user.id ?? GUEST_OWNER, level };
}

export function useExamIndex() {
  const { level } = useContent();
  return useQuery({
    queryKey: ["exam-index", level],
    queryFn: async () => {
      const result = await loadExamIndex(level);
      if (!result.ok) throw new Error(result.error.detail);
      return result.value;
    },
    networkMode: "always",
  });
}

export function useExamDocument(examId: string | undefined) {
  const { level } = useContent();
  const indexQuery = useExamIndex();
  const entry = examId
    ? indexQuery.data?.exams.find((item) => item.id === examId)
    : undefined;

  return useQuery({
    queryKey: ["exam-document", level, examId, entry?.sha256],
    enabled: Boolean(examId && entry),
    queryFn: async () => {
      if (!entry) throw new Error("Exam entry not found");
      const result = await loadExamDocument(level, entry);
      if (!result.ok) throw new Error(result.error.detail);
      return result.value;
    },
    networkMode: "always",
  });
}

export function useExamAttempts(examId?: string) {
  const { owner, level } = useExamScope();
  return useQuery({
    queryKey: ["exam-attempts", owner, level, examId ?? null],
    queryFn: () => examStore.listAttempts(owner, level, examId),
    networkMode: "always",
  });
}

export type RecordExamAttemptInput = Omit<
  ExamAttemptInput,
  "owner" | "level"
> & {
  owner?: string;
  level?: Level;
};

export function useRecordExamAttempt() {
  const { owner, level } = useExamScope();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordExamAttemptInput) =>
      examStore.recordAttempt({
        ...input,
        owner: input.owner ?? owner,
        level: input.level ?? level,
      }),
    networkMode: "always",
    onSuccess: (record) =>
      cache.invalidateQueries({
        queryKey: ["exam-attempts", record.owner, record.level],
      }),
    onError: () =>
      toast.error("Không lưu được kết quả đề thi trên máy. Vui lòng thử lại."),
  });
}
