import { useAuth } from "@/adapters/auth/session";
import {
  ExamSourceHttpError,
  loadExamDocument,
  loadExamIndex,
} from "@/adapters/content-pack/examSource";
import { type ExamAttemptInput, examStore } from "@/adapters/local-store/exams";
import type { Level } from "@/core/content/types";
import type { ExamAttemptRecord } from "@/core/exam/types";
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
    queryFn: async ({ signal }) => {
      const result = await loadExamIndex(level, undefined, signal);
      if (!result.ok) throw new ExamSourceHttpError(result.error);
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
    queryFn: async ({ signal }) => {
      if (!entry) throw new Error("Exam entry not found");
      const result = await loadExamDocument(level, entry, undefined, signal);
      if (!result.ok) throw new ExamSourceHttpError(result.error);
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

export function useActiveExamAttempt(examId: string | undefined) {
  const { owner, level } = useExamScope();
  return useQuery({
    queryKey: ["exam-attempts", owner, level, examId ?? null, "active"],
    enabled: Boolean(examId),
    queryFn: () =>
      examId
        ? examStore.getActiveAttempt(owner, level, examId)
        : Promise.resolve(null),
    networkMode: "always",
  });
}

export function useExamDraft(examId: string | undefined) {
  const { owner, level } = useExamScope();
  return useQuery({
    queryKey: ["exam-draft", owner, level, examId ?? null],
    enabled: Boolean(examId),
    queryFn: () =>
      examId
        ? examStore.loadDraft(owner, level, examId)
        : Promise.resolve(null),
    networkMode: "always",
  });
}

export function useSaveExamProgress() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (record: ExamAttemptRecord) =>
      examStore.saveAttemptProgress(record),
    networkMode: "always",
    onSuccess: async (record) => {
      await cache.invalidateQueries({
        queryKey: ["exam-attempts", record.owner, record.level],
      });
      if (record.status === "completed") {
        await cache.invalidateQueries({
          queryKey: ["exam-draft", record.owner, record.level, record.examId],
        });
      }
    },
    onError: () =>
      toast.error("Không lưu được tiến độ đề thi trên máy. Vui lòng thử lại."),
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
