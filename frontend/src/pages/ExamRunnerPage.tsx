import { ExamQuestionCard } from "@/components/exam/ExamQuestionCard";
import { ExamTimerBar } from "@/components/exam/ExamTimerBar";
import { RubyText } from "@/components/exam/RubyText";
import { HankoStamp } from "@/components/motion/HankoStamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canAccessSection,
  computeRemainingSeconds,
  countSectionQuestions,
  formatCountdown,
  gradeSection,
  isSectionLocked,
  summarizeExamAttempt,
} from "@/core/exam/engine";
import type {
  ExamDocument,
  ExamSection,
  ExamSectionAttemptSummary,
  ExamSectionKey,
  ExamSectionStatus,
} from "@/core/exam/types";
import {
  useExamDocument,
  useExamIndex,
  useRecordExamAttempt,
} from "@/hooks/useExams";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { cn } from "@/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  Headphones,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  SkipForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FinalSectionStatus = Exclude<
  ExamSectionAttemptSummary["status"],
  "pending"
>;

const STATUS_BADGE_LABEL: Record<ExamSectionAttemptSummary["status"], string> =
  {
    pending: "Chưa làm",
    submitted: "Đã nộp",
    timed_out: "Hết giờ",
    skipped: "Bỏ qua",
  };

function createRunId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `exam-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initialStatuses(sectionCount: number): ExamSectionStatus[] {
  return Array.from({ length: sectionCount }, (_, i) =>
    i === 0 ? "ready" : "locked",
  );
}

function BackToListLink() {
  return (
    <Link
      to="/luyen-de"
      data-ocid="exam_runner.back.link"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-smooth hover:text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Quay lại danh sách đề
    </Link>
  );
}

function SectionIntro({
  section,
  sectionNumber,
  onStart,
  onStartListeningScript,
  onSkipListening,
}: {
  section: ExamSection;
  sectionNumber: number;
  onStart: () => void;
  onStartListeningScript: () => void;
  onSkipListening: () => void;
}) {
  const questionCount = countSectionQuestions(section);
  const minutes = Math.round(section.durationSeconds / 60);
  const isListeningNoAudio =
    section.key === "listening" && !section.audioAvailable;

  return (
    <div
      data-ocid="exam_runner.section_intro"
      className="rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Phần {sectionNumber}: {section.title}
        </h2>
        <span
          lang="ja"
          className="font-jp-sans text-base text-muted-foreground"
        >
          {section.titleJa}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          Thời gian làm bài: {minutes} phút
        </span>
        <span>Số câu hỏi: {questionCount} câu</span>
      </div>

      {section.groups.length > 0 && (
        <ul className="mt-5 grid gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          {section.groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span className="font-medium text-foreground">
                {group.label}:{" "}
                <span className="font-normal text-muted-foreground">
                  {group.instructionVi}
                </span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.questions.length} câu
              </span>
            </li>
          ))}
        </ul>
      )}

      {isListeningNoAudio ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/60 p-4 text-sm text-foreground">
            <Headphones
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                Tệp âm thanh (.mp3) chưa được đóng gói để giữ ứng dụng gọn nhẹ.
              </p>
              {section.audioNote && (
                <p className="text-muted-foreground">{section.audioNote}</p>
              )}
              {section.groups.length > 0 ? (
                <p className="text-muted-foreground">
                  Bạn có thể làm phần Nghe bằng script hội thoại (tính giờ chuẩn{" "}
                  {minutes} phút) hoặc bỏ qua phần này để xem tổng kết đề ngay.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Đề này chưa có script phần Nghe. Bạn có thể hoàn tất và xem
                  tổng kết ngay.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {section.groups.length > 0 ? (
              <>
                <Button
                  type="button"
                  data-ocid="exam_runner.start_listening_script_button"
                  className="min-h-11 rounded-md"
                  onClick={onStartListeningScript}
                >
                  <Play className="size-4" aria-hidden="true" />
                  Làm bằng Script nghe ({minutes} phút)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-ocid="exam_runner.skip_listening_button"
                  className="min-h-11 rounded-md"
                  onClick={onSkipListening}
                >
                  <SkipForward className="size-4" aria-hidden="true" />
                  Bỏ qua phần Nghe &amp; xem tổng kết
                </Button>
              </>
            ) : (
              <Button
                type="button"
                data-ocid="exam_runner.skip_listening_button"
                className="min-h-11 rounded-md"
                onClick={onSkipListening}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Hoàn tất &amp; xem tổng kết
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Đồng hồ sẽ đếm ngược liên tục ngay khi bắt đầu. Khi hết giờ, hệ
            thống sẽ tự động nộp bài, khóa đáp án và hiện furigana kèm giải
            thích.
          </p>
          <Button
            type="button"
            data-ocid="exam_runner.start_section_button"
            className="min-h-11 rounded-md"
            onClick={onStart}
          >
            <Play className="size-4" aria-hidden="true" />
            Bắt đầu làm Phần {sectionNumber}
          </Button>
        </div>
      )}
    </div>
  );
}

function ExamRunnerSession({ exam }: { exam: ExamDocument }) {
  const { mode } = useMotionPreference();
  const recordAttempt = useRecordExamAttempt();

  const [attemptId, setAttemptId] = useState<string>(() => createRunId());
  const [statuses, setStatuses] = useState<ExamSectionStatus[]>(() =>
    initialStatuses(exam.sections.length),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewingSummary, setViewingSummary] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAtMs, setStartedAtMs] = useState<
    Partial<Record<ExamSectionKey, number>>
  >({});
  const [deadlineMs, setDeadlineMs] = useState<
    Partial<Record<ExamSectionKey, number>>
  >({});
  const [elapsedBySection, setElapsedBySection] = useState<
    Partial<Record<ExamSectionKey, number>>
  >({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    exam.sections[0]?.durationSeconds ?? 0,
  );
  const [listeningScriptMode, setListeningScriptMode] = useState(false);

  const savedAttemptIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(startedAtMs);
  startedAtRef.current = startedAtMs;

  const allDone = useMemo(
    () => statuses.length > 0 && statuses.every((s) => isSectionLocked(s)),
    [statuses],
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: mode === "reduced" ? "auto" : "smooth",
    });
  }, [mode]);

  const finalizeSection = useCallback(
    (
      sectionIdx: number,
      finalStatus: FinalSectionStatus,
      nowMs: number,
      openSummaryAfter = false,
    ) => {
      const section = exam.sections[sectionIdx];
      if (!section) return;

      setStatuses((prev) => {
        const current = prev[sectionIdx];
        if (!current || isSectionLocked(current)) return prev;
        const next = [...prev];
        next[sectionIdx] = finalStatus;
        if (sectionIdx + 1 < next.length && next[sectionIdx + 1] === "locked") {
          next[sectionIdx + 1] = "ready";
        }
        return next;
      });

      const started = startedAtRef.current[section.key];
      const elapsed =
        finalStatus === "skipped"
          ? 0
          : finalStatus === "timed_out"
            ? section.durationSeconds
            : started !== undefined
              ? Math.min(
                  section.durationSeconds,
                  Math.max(0, Math.round((nowMs - started) / 1000)),
                )
              : 0;

      setElapsedBySection((prev) =>
        prev[section.key] !== undefined
          ? prev
          : { ...prev, [section.key]: elapsed },
      );

      if (finalStatus === "timed_out") {
        setRemainingSeconds(0);
      }
      if (openSummaryAfter) {
        setViewingSummary(true);
      }
    },
    [exam.sections],
  );

  // Live deadline-based countdown so real time & Playwright clock fast-forward stay exact.
  const runningIndex = statuses.findIndex((s) => s === "in_progress");
  const runningSection =
    runningIndex >= 0 ? exam.sections[runningIndex] : undefined;
  const runningDeadline = runningSection
    ? deadlineMs[runningSection.key]
    : undefined;

  useEffect(() => {
    if (runningIndex < 0 || !runningSection || runningDeadline === undefined) {
      return;
    }

    const tick = () => {
      const now = Date.now();
      const rem = computeRemainingSeconds(runningDeadline, now);
      setRemainingSeconds(rem);
      if (rem <= 0) {
        finalizeSection(runningIndex, "timed_out", now);
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [runningIndex, runningSection, runningDeadline, finalizeSection]);

  const attemptSummary = useMemo(() => {
    if (!allDone) return null;
    const sectionMeta: Partial<
      Record<
        ExamSectionKey,
        { status: FinalSectionStatus; elapsedSeconds: number }
      >
    > = {};
    exam.sections.forEach((section, idx) => {
      const st = statuses[idx];
      const finalSt: FinalSectionStatus =
        st === "submitted" || st === "timed_out" || st === "skipped"
          ? st
          : "skipped";
      sectionMeta[section.key] = {
        status: finalSt,
        elapsedSeconds: elapsedBySection[section.key] ?? 0,
      };
    });
    return summarizeExamAttempt({
      id: attemptId,
      owner: "pending",
      exam,
      answers,
      sectionMeta,
    });
  }, [allDone, answers, attemptId, elapsedBySection, exam, statuses]);

  // Auto-save once per completed exam run.
  useEffect(() => {
    if (!attemptSummary) return;
    if (savedAttemptIdRef.current === attemptSummary.id) return;
    savedAttemptIdRef.current = attemptSummary.id;
    const { owner: _ignoredOwner, ...payload } = attemptSummary;
    recordAttempt.mutate(payload);
  }, [attemptSummary, recordAttempt]);

  const activeSection = exam.sections[activeIndex];
  const activeStatus = statuses[activeIndex] ?? "locked";
  const activeLocked = isSectionLocked(activeStatus);

  const handleStartSection = (scriptAssisted = false) => {
    if (!activeSection || activeStatus !== "ready") return;
    const now = Date.now();
    const deadline = now + activeSection.durationSeconds * 1000;
    if (scriptAssisted) setListeningScriptMode(true);
    setStartedAtMs((prev) => ({ ...prev, [activeSection.key]: now }));
    setDeadlineMs((prev) => ({ ...prev, [activeSection.key]: deadline }));
    setRemainingSeconds(activeSection.durationSeconds);
    setStatuses((prev) => {
      const next = [...prev];
      next[activeIndex] = "in_progress";
      return next;
    });
    scrollToTop();
  };

  const handleSkipListening = () => {
    if (!activeSection) return;
    const isLast = activeIndex === exam.sections.length - 1;
    finalizeSection(activeIndex, "skipped", Date.now(), isLast);
    if (!isLast) {
      setActiveIndex(activeIndex + 1);
    }
    scrollToTop();
  };

  const handleSelectChoice = (questionId: string, choiceIndex: number) => {
    if (activeStatus !== "in_progress") return;
    setAnswers((prev) => ({ ...prev, [questionId]: choiceIndex }));
  };

  const handleSubmitSection = () => {
    if (activeStatus !== "in_progress") return;
    finalizeSection(activeIndex, "submitted", Date.now());
    scrollToTop();
  };

  const handleNextSection = () => {
    if (activeIndex < exam.sections.length - 1) {
      setActiveIndex(activeIndex + 1);
      setViewingSummary(false);
    } else {
      setViewingSummary(true);
    }
    scrollToTop();
  };

  const handleRetryExam = () => {
    savedAttemptIdRef.current = null;
    recordAttempt.reset();
    setAttemptId(createRunId());
    setStatuses(initialStatuses(exam.sections.length));
    setActiveIndex(0);
    setViewingSummary(false);
    setAnswers({});
    setStartedAtMs({});
    setDeadlineMs({});
    setElapsedBySection({});
    setRemainingSeconds(exam.sections[0]?.durationSeconds ?? 0);
    setListeningScriptMode(false);
    scrollToTop();
  };

  const activeGraded = activeSection
    ? gradeSection(activeSection, answers)
    : { score: 0, total: 0, answered: 0 };

  const activeRemaining =
    activeStatus === "in_progress"
      ? remainingSeconds
      : activeStatus === "timed_out"
        ? 0
        : (activeSection?.durationSeconds ?? 0);

  return (
    <section
      data-ocid="exam_runner.page"
      className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10"
    >
      <BackToListLink />

      <header className="mb-6 mt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
            {exam.title}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">
            Mã đề: {exam.code}
          </span>
        </div>
      </header>

      <nav
        aria-label="Các phần của đề thi"
        data-ocid="exam_runner.stepper"
        className="mb-6 grid gap-2 sm:grid-cols-3"
      >
        {exam.sections.map((section, idx) => {
          const st = statuses[idx] ?? "locked";
          const accessible = canAccessSection(statuses, idx);
          const isCurrent = !viewingSummary && activeIndex === idx;
          const locked = isSectionLocked(st);
          const minutes = Math.round(section.durationSeconds / 60);

          return (
            <button
              key={section.key}
              type="button"
              disabled={
                !accessible || (runningIndex >= 0 && runningIndex !== idx)
              }
              aria-current={isCurrent ? "step" : undefined}
              data-ocid={`exam_runner.step.${idx + 1}`}
              onClick={() => {
                setViewingSummary(false);
                setActiveIndex(idx);
              }}
              className={cn(
                "flex min-h-11 flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCurrent
                  ? "border-primary bg-primary/5 text-foreground"
                  : locked
                    ? "border-border bg-card text-foreground hover:border-primary/40"
                    : accessible
                      ? "border-border bg-card text-foreground hover:border-primary/40"
                      : "cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-70",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">
                  Phần {idx + 1} · {minutes}p
                </span>
                {st === "locked" ? (
                  <Lock
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : st === "submitted" ? (
                  <CheckCircle2
                    className="size-3.5 text-success"
                    aria-hidden="true"
                  />
                ) : st === "timed_out" ? (
                  <AlertTriangle
                    className="size-3.5 text-destructive"
                    aria-hidden="true"
                  />
                ) : st === "skipped" ? (
                  <span className="text-[11px] text-muted-foreground">
                    Bỏ qua
                  </span>
                ) : st === "in_progress" ? (
                  <span className="text-[11px] font-medium text-primary">
                    Đang làm
                  </span>
                ) : null}
              </div>
              <span className="mt-0.5 line-clamp-1 text-sm font-medium">
                {section.title}
              </span>
            </button>
          );
        })}
      </nav>

      {allDone && !viewingSummary && (
        <div className="mb-5 flex justify-end">
          <Button
            type="button"
            variant="outline"
            data-ocid="exam_runner.view_summary_button"
            className="min-h-11 rounded-md"
            onClick={() => {
              setViewingSummary(true);
              scrollToTop();
            }}
          >
            Xem tổng kết đề
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {viewingSummary && attemptSummary ? (
        <div
          data-ocid="exam_runner.summary"
          className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <HankoStamp
                label={`${attemptSummary.totalQuestions > 0 ? Math.round((attemptSummary.totalScore / attemptSummary.totalQuestions) * 100) : 0}%`}
                sublabel={`${attemptSummary.totalScore}/${attemptSummary.totalQuestions}`}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  Tổng kết bài làm
                </h2>
                <p className="mt-1 text-base text-muted-foreground tabular-nums">
                  Đúng{" "}
                  <strong className="font-semibold text-foreground">
                    {attemptSummary.totalScore}/{attemptSummary.totalQuestions}
                  </strong>{" "}
                  câu trên toàn đề
                </p>
                {recordAttempt.isSuccess && (
                  <p className="mt-1 text-sm text-success">
                    Đã lưu kết quả làm đề trên máy.
                  </p>
                )}
                {recordAttempt.isPending && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Đang lưu kết quả…
                  </p>
                )}
                {recordAttempt.isError && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    Chưa lưu được kết quả trên máy.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                data-ocid="exam_runner.retry_button"
                className="min-h-11 rounded-md"
                onClick={handleRetryExam}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Làm lại đề này
              </Button>
              <Button asChild className="min-h-11 rounded-md">
                <Link to="/luyen-de" data-ocid="exam_runner.back_to_list_link">
                  Về danh sách đề
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-border pt-6 md:grid-cols-3">
            {attemptSummary.sections.map((secSummary, idx) => {
              const secDef = exam.sections[idx];
              if (!secDef) return null;
              const canReview =
                secSummary.status !== "skipped" && secDef.groups.length > 0;

              return (
                <div
                  key={secSummary.key}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/35 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-foreground">
                        Phần {idx + 1}: {secDef.title}
                      </p>
                      <p
                        lang="ja"
                        className="font-jp-sans text-xs text-muted-foreground"
                      >
                        {secDef.titleJa}
                      </p>
                    </div>
                    <Badge
                      variant={
                        secSummary.status === "timed_out"
                          ? "destructive"
                          : "secondary"
                      }
                      className="rounded-full"
                    >
                      {STATUS_BADGE_LABEL[secSummary.status]}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm tabular-nums">
                    <span className="text-muted-foreground">Điểm phần này</span>
                    <strong className="font-semibold text-foreground">
                      {secSummary.score}/{secSummary.total}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-sm tabular-nums">
                    <span className="text-muted-foreground">Thời gian</span>
                    <span className="font-mono text-foreground">
                      {formatCountdown(secSummary.elapsedSeconds)}
                    </span>
                  </div>

                  {canReview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-auto min-h-11 w-full rounded-md"
                      onClick={() => {
                        setViewingSummary(false);
                        setActiveIndex(idx);
                        scrollToTop();
                      }}
                    >
                      Xem lại lời giải
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : activeSection ? (
        activeStatus === "ready" ? (
          <SectionIntro
            section={activeSection}
            sectionNumber={activeIndex + 1}
            onStart={() => handleStartSection(false)}
            onStartListeningScript={() => handleStartSection(true)}
            onSkipListening={handleSkipListening}
          />
        ) : activeStatus === "skipped" ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Phần {activeIndex + 1}: {activeSection.title} đã được bỏ qua
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Bạn có thể chuyển sang xem tổng kết hoặc chọn làm lại đề nếu muốn
              làm phần này.
            </p>
            <Button
              type="button"
              data-ocid="exam_runner.next_section_button"
              className="mt-5 min-h-11 rounded-md"
              onClick={handleNextSection}
            >
              {activeIndex < exam.sections.length - 1
                ? "Sang phần tiếp theo"
                : "Xem tổng kết đề"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div>
            <ExamTimerBar
              sectionTitle={`Phần ${activeIndex + 1}: ${activeSection.title}`}
              sectionTitleJa={activeSection.titleJa}
              answered={activeGraded.answered}
              total={activeGraded.total}
              remainingSeconds={activeRemaining}
              status={activeStatus}
            />

            {activeStatus === "timed_out" && (
              <div
                role="alert"
                data-ocid="exam_runner.timeout_notice"
                className="mb-6 flex flex-col gap-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-destructive">
                      Hết giờ! Phần này đã tự động nộp và khóa đáp án.
                    </p>
                    <p className="mt-1 text-sm text-foreground tabular-nums">
                      Kết quả phần này:{" "}
                      <strong>
                        {activeGraded.score}/{activeGraded.total}
                      </strong>{" "}
                      câu đúng. Xem furigana, bản dịch và giải thích chi tiết
                      bên dưới.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  data-ocid="exam_runner.next_section_button"
                  className="min-h-11 shrink-0 rounded-md"
                  onClick={handleNextSection}
                >
                  {activeIndex < exam.sections.length - 1
                    ? "Sang phần tiếp theo"
                    : "Xem tổng kết đề"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}

            {activeStatus === "submitted" && (
              <div
                data-ocid="exam_runner.section_result"
                className="mb-6 flex flex-col gap-4 rounded-xl border border-success/40 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground tabular-nums">
                      Đã nộp Phần {activeIndex + 1} · Đúng {activeGraded.score}/
                      {activeGraded.total} câu
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tất cả đáp án đã khóa. Bạn có thể đọc furigana, dịch nghĩa
                      và giải thích cho từng câu bên dưới.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  data-ocid="exam_runner.next_section_button"
                  className="min-h-11 shrink-0 rounded-md"
                  onClick={handleNextSection}
                >
                  {activeIndex < exam.sections.length - 1
                    ? "Sang phần tiếp theo"
                    : "Xem tổng kết đề"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}

            <div className="space-y-8">
              {activeSection.groups.map((group) => {
                const hasPassage = Boolean(group.passage);
                const passageText = activeLocked
                  ? group.passageRuby || group.passage || ""
                  : group.passage || "";

                return (
                  <section
                    key={group.id}
                    aria-labelledby={`group-heading-${group.id}`}
                    className="space-y-4"
                  >
                    <header className="rounded-xl border border-border bg-muted/45 px-4 py-3.5 sm:px-5">
                      <h3
                        id={`group-heading-${group.id}`}
                        className="font-display text-lg font-semibold text-foreground"
                      >
                        {group.label} · {group.instructionVi}
                      </h3>
                      <RubyText
                        text={group.instructionJa}
                        as="p"
                        className="mt-1 break-words text-sm text-muted-foreground"
                      />
                    </header>

                    {hasPassage ? (
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                        <div className="space-y-4 lg:sticky lg:top-[11.5rem]">
                          <article
                            data-ocid={`exam_runner.passage.${group.id}`}
                            className="rounded-xl border border-border bg-card p-5 sm:p-6"
                          >
                            <RubyText
                              text={passageText}
                              as="p"
                              font="serif"
                              className="whitespace-pre-line break-words text-base leading-loose text-foreground sm:text-lg"
                            />
                          </article>

                          {activeLocked && group.passageTranslation && (
                            <div
                              data-ocid={`exam_runner.passage_translation.${group.id}`}
                              className="rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground sm:p-5"
                            >
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Dịch đoạn văn
                              </p>
                              <p className="whitespace-pre-line break-words">
                                {group.passageTranslation}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-4">
                          {group.questions.map((question) => (
                            <ExamQuestionCard
                              key={question.id}
                              question={question}
                              selected={answers[question.id]}
                              locked={activeLocked}
                              showScriptControl={
                                activeSection.key === "listening" &&
                                listeningScriptMode
                              }
                              onSelect={(choiceIndex) =>
                                handleSelectChoice(question.id, choiceIndex)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {group.questions.map((question) => (
                          <ExamQuestionCard
                            key={question.id}
                            question={question}
                            selected={answers[question.id]}
                            locked={activeLocked}
                            showScriptControl={
                              activeSection.key === "listening" &&
                              listeningScriptMode
                            }
                            onSelect={(choiceIndex) =>
                              handleSelectChoice(question.id, choiceIndex)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              {activeStatus === "in_progress" ? (
                <>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Đã trả lời{" "}
                    <strong className="font-semibold text-foreground">
                      {activeGraded.answered}/{activeGraded.total}
                    </strong>{" "}
                    câu. Bạn có thể nộp bài bất cứ lúc nào để chấm điểm và xem
                    lời giải.
                  </p>
                  <Button
                    type="button"
                    data-ocid="exam_runner.submit_section_button"
                    className="min-h-11 shrink-0 rounded-md"
                    onClick={handleSubmitSection}
                  >
                    <Send className="size-4" aria-hidden="true" />
                    Nộp Phần {activeIndex + 1}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Hoàn thành Phần {activeIndex + 1}:{" "}
                    <strong className="font-semibold text-foreground">
                      {activeGraded.score}/{activeGraded.total}
                    </strong>{" "}
                    câu đúng.
                  </p>
                  <Button
                    type="button"
                    data-ocid="exam_runner.next_section_bottom_button"
                    className="min-h-11 shrink-0 rounded-md"
                    onClick={handleNextSection}
                  >
                    {activeIndex < exam.sections.length - 1
                      ? "Sang phần tiếp theo"
                      : "Xem tổng kết đề"}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}

export default function ExamRunnerPage() {
  const { examId } = useParams({ from: "/luyen-de/$examId" });
  const indexQuery = useExamIndex();
  const entry = indexQuery.data?.exams.find((item) => item.id === examId);
  const docQuery = useExamDocument(examId);

  if (indexQuery.isPending || (Boolean(entry) && docQuery.isPending)) {
    return (
      <section
        data-ocid="exam_runner.page"
        className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12"
      >
        <BackToListLink />
        <div
          data-ocid="exam_runner.loading_state"
          aria-label="Đang tải đề thi"
          className="mt-4 space-y-4"
        >
          <Skeleton className="h-9 w-2/3 max-w-md" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </section>
    );
  }

  if (indexQuery.isError || docQuery.isError) {
    return (
      <section
        data-ocid="exam_runner.page"
        className="mx-auto max-w-3xl px-4 py-12 md:px-6"
      >
        <BackToListLink />
        <div
          data-ocid="exam_runner.error_state"
          role="alert"
          className="mt-4 flex flex-col items-start gap-4 rounded-xl border border-destructive/40 bg-card p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Không tải được nội dung đề thi
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Kiểm tra kết nối mạng hoặc thử tải lại đề thi này.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-md"
            onClick={() => {
              if (indexQuery.isError) void indexQuery.refetch();
              if (docQuery.isError) void docQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      </section>
    );
  }

  if (!entry || !docQuery.data) {
    return (
      <section
        data-ocid="exam_runner.page"
        className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center"
      >
        <FileQuestion
          className="mb-4 size-12 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Không tìm thấy đề thi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đề thi này không tồn tại ở cấp độ hiện tại hoặc đã thay đổi mã đề.
        </p>
        <Button asChild className="mt-6 min-h-11 rounded-md">
          <Link to="/luyen-de" data-ocid="exam_runner.not_found.back_button">
            Xem danh sách đề
          </Link>
        </Button>
      </section>
    );
  }

  return <ExamRunnerSession key={docQuery.data.id} exam={docQuery.data} />;
}
