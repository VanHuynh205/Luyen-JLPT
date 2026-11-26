import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamAnswerSummary, ExamAttemptRecord } from "@/core/exam/types";
import { useContent } from "@/hooks/useContent";
import { useExamAttempts, useExamIndex } from "@/hooks/useExams";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  Headphones,
  RefreshCw,
} from "lucide-react";

const ANSWER_SOURCE_LABEL: Record<ExamAnswerSummary, string> = {
  official_key: "Đáp án gốc",
  solved: "Tự giải đối chiếu",
  mixed: "Đáp án gốc & đối chiếu",
};

function isMissingExamIndexError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(": 404");
}

function summarizeAttempts(
  attempts: readonly ExamAttemptRecord[],
): { count: number; bestScore: number; bestTotal: number } | null {
  if (attempts.length === 0) return null;
  let best = attempts[0];
  for (const item of attempts) {
    if (item.totalScore > best.totalScore) {
      best = item;
    }
  }
  return {
    count: attempts.length,
    bestScore: best.totalScore,
    bestTotal: best.totalQuestions,
  };
}

export default function ExamListPage() {
  const { level } = useContent();
  const levelLabel = level.toUpperCase();
  const indexQuery = useExamIndex();
  const attemptsQuery = useExamAttempts();

  const attemptsByExam = new Map<string, ExamAttemptRecord[]>();
  for (const attempt of attemptsQuery.data ?? []) {
    const list = attemptsByExam.get(attempt.examId);
    if (list) list.push(attempt);
    else attemptsByExam.set(attempt.examId, [attempt]);
  }

  const isMissingForLevel =
    indexQuery.isError && isMissingExamIndexError(indexQuery.error);
  const exams = indexQuery.data?.exams ?? [];

  return (
    <section
      data-ocid="exam_list.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="mb-8 max-w-2xl md:mb-10">
        <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
          Luyện đề JLPT {levelLabel}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Bộ đề thi mô phỏng 3 phần theo cấu trúc chuẩn JLPT N4, gồm chuẩn hiện
          hành (25/55/35 phút — 115 phút) và trước 2020 (30/60/35 phút — 125
          phút), tự động khóa đáp án khi hết giờ kèm furigana và lời giải chi
          tiết.
        </p>
      </header>

      {indexQuery.isPending && (
        <div
          data-ocid="exam_list.loading_state"
          aria-label="Đang tải danh sách đề thi"
          className="grid gap-4 md:grid-cols-2"
        >
          {[1, 2, 3, 4].map((slot) => (
            <div
              key={slot}
              className="rounded-xl border border-border bg-card p-5"
            >
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="mt-6 h-11 w-full rounded-md" />
            </div>
          ))}
        </div>
      )}

      {indexQuery.isError && !isMissingForLevel && (
        <div
          data-ocid="exam_list.error_state"
          role="alert"
          className="flex flex-col items-start gap-4 rounded-xl border border-destructive/40 bg-card p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Không tải được danh sách đề thi
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kiểm tra kết nối hoặc thử tải lại danh sách đề từ gói nội dung.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-md"
            onClick={() => void indexQuery.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      )}

      {!indexQuery.isPending &&
        (isMissingForLevel || (!indexQuery.isError && exams.length === 0)) && (
          <div
            data-ocid="exam_list.empty_state"
            className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-14 text-center"
          >
            <FileText
              className="mb-3 size-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="font-display text-xl font-semibold text-foreground">
              Chưa có đề thi cho cấp độ {levelLabel}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Bộ đề luyện thi {levelLabel} đang được biên soạn. Bạn có thể
              chuyển sang cấp độ N4 hoặc tiếp tục ôn từ vựng, kanji và ngữ pháp.
            </p>
          </div>
        )}

      {!indexQuery.isPending && !indexQuery.isError && exams.length > 0 && (
        <ul data-ocid="exam_list.list" className="grid gap-4 md:grid-cols-2">
          {exams.map((exam, index) => {
            const totalMinutes = Math.round(exam.totalDurationSeconds / 60);
            const attemptSummary = summarizeAttempts(
              attemptsByExam.get(exam.id) ?? [],
            );

            return (
              <li
                key={exam.id}
                data-ocid={`exam_list.item.${index + 1}`}
                className="hover-lift flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold leading-snug text-foreground">
                      {exam.title}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Mã đề: {exam.code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground tabular-nums">
                    {exam.year}/{String(exam.month).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    {exam.totalQuestions} câu
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                    {totalMinutes} phút · 3 phần
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {ANSWER_SOURCE_LABEL[exam.answerSourceSummary]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    <Headphones className="size-3" aria-hidden="true" />
                    {exam.hasListeningScript
                      ? "Nghe có script"
                      : "Chưa có audio"}
                  </Badge>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    {attemptsQuery.isPending ? (
                      <Skeleton className="h-5 w-36" />
                    ) : attemptSummary ? (
                      <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-primary tabular-nums">
                        <CheckCircle2
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        Đã làm {attemptSummary.count} lần · Cao nhất{" "}
                        {attemptSummary.bestScore}/{attemptSummary.bestTotal}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <CircleDashed
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        Chưa làm
                      </span>
                    )}
                  </div>

                  <Button
                    asChild
                    className="min-h-11 w-full rounded-md sm:w-auto"
                  >
                    <Link
                      to="/luyen-de/$examId"
                      params={{ examId: exam.id }}
                      data-ocid={`exam_list.start.${index + 1}`}
                    >
                      {attemptSummary ? "Làm lại đề" : "Vào làm đề"}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
