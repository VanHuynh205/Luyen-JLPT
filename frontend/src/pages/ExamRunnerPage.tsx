import { useAuth } from "@/adapters/auth/session";
import type { ActiveExamDraft } from "@/adapters/local-store/db";
import { examStore } from "@/adapters/local-store/exams";
import { ExamQuestionCard } from "@/components/exam/ExamQuestionCard";
import { ExamTimerBar } from "@/components/exam/ExamTimerBar";
import { JlptScoreBreakdown } from "@/components/exam/JlptScoreBreakdown";
import { QuickRemediationModal } from "@/components/exam/QuickRemediationModal";
import { RubyText } from "@/components/exam/RubyText";
import { HankoStamp } from "@/components/motion/HankoStamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentPack } from "@/core/content/types";
import {
  type ExamSectionMetaInput,
  buildExamAttemptSnapshot,
  canAccessSection,
  computeRemainingSeconds,
  countSectionQuestions,
  formatCountdown,
  gradeSection,
  isSectionLocked,
} from "@/core/exam/engine";
import { buildRemediationSession } from "@/core/exam/remediation";
import { computeJlptScore } from "@/core/exam/scoring";
import type {
  ExamAttemptRecord,
  ExamDocument,
  ExamSection,
  ExamSectionAttemptSummary,
  ExamSectionKey,
  ExamSectionStatus,
} from "@/core/exam/types";
import { GUEST_OWNER } from "@/core/progress";
import { useContent } from "@/hooks/useContent";
import {
  useActiveExamAttempt,
  useExamAttempts,
  useExamDocument,
  useExamDraft,
  useExamIndex,
  useSaveExamProgress,
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
  Layers,
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

const DRAFT_DEBOUNCE_MS = 150;

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
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10),
  ]
    .map((part) => part.join(""))
    .join("-");
}

function initialStatuses(sectionCount: number): ExamSectionStatus[] {
  return Array.from({ length: sectionCount }, (_, i) =>
    i === 0 ? "ready" : "locked",
  );
}

interface HydratedSessionState {
  attemptId: string;
  attemptNumber: number;
  attemptStartedAt: string;
  statuses: ExamSectionStatus[];
  activeIndex: number;
  viewingSummary: boolean;
  answers: Record<string, number>;
  startedAtMs: Partial<Record<ExamSectionKey, number>>;
  deadlineMs: Partial<Record<ExamSectionKey, number>>;
  elapsedBySection: Partial<Record<ExamSectionKey, number>>;
  submittedAtBySection: Partial<Record<ExamSectionKey, string>>;
  remainingSeconds: number;
  listeningScriptMode: boolean;
  finalizedKeys: ExamSectionKey[];
  staleDraftDetected: boolean;
}

function hydrateSessionState(
  exam: ExamDocument,
  initialActiveAttempt: ExamAttemptRecord | null,
  initialDraft: ActiveExamDraft | null,
  attempts: readonly ExamAttemptRecord[],
): HydratedSessionState {
  const completedIds = new Set(
    attempts.filter((a) => a.status === "completed").map((a) => a.id),
  );
  let maxAttemptNumber = 0;
  for (const attempt of attempts) {
    if (attempt.attemptNumber > maxAttemptNumber) {
      maxAttemptNumber = attempt.attemptNumber;
    }
  }

  const draftValid =
    initialDraft !== null &&
    !completedIds.has(initialDraft.attemptId) &&
    (!initialActiveAttempt ||
      initialDraft.attemptId === initialActiveAttempt.id);
  const draft = draftValid ? initialDraft : null;
  const staleDraftDetected = initialDraft !== null && !draftValid;

  const attemptId =
    initialActiveAttempt?.id ?? draft?.attemptId ?? createRunId();
  const attemptNumber =
    initialActiveAttempt?.attemptNumber ?? maxAttemptNumber + 1;
  const attemptStartedAt =
    initialActiveAttempt?.startedAt ??
    draft?.savedAt ??
    new Date().toISOString();

  const statuses = initialStatuses(exam.sections.length);
  const elapsedBySection: Partial<Record<ExamSectionKey, number>> = {};
  const submittedAtBySection: Partial<Record<ExamSectionKey, string>> = {};
  const finalizedKeys: ExamSectionKey[] = [];

  if (initialActiveAttempt) {
    const byKey = new Map(
      initialActiveAttempt.sections.map((section) => [section.key, section]),
    );
    exam.sections.forEach((sec, idx) => {
      const summary = byKey.get(sec.key);
      if (summary && summary.status !== "pending") {
        statuses[idx] = summary.status;
        elapsedBySection[sec.key] = summary.elapsedSeconds;
        submittedAtBySection[sec.key] =
          summary.submittedAt ?? initialActiveAttempt.updatedAt;
        finalizedKeys.push(sec.key);
      }
    });
    for (let idx = 0; idx < exam.sections.length - 1; idx++) {
      if (isSectionLocked(statuses[idx]) && statuses[idx + 1] === "locked") {
        statuses[idx + 1] = "ready";
      }
    }
  }

  const answers: Record<string, number> = {
    ...(initialActiveAttempt?.answers ?? {}),
    ...(draft?.answers ?? {}),
  };
  const startedAtMs: Partial<Record<ExamSectionKey, number>> = {
    ...(draft?.startedAtMs ?? {}),
  };
  const deadlineMs: Partial<Record<ExamSectionKey, number>> = {
    ...(draft?.deadlineMs ?? {}),
  };
  const listeningScriptMode = draft?.listeningScriptMode ?? false;

  const draftSection = draft ? exam.sections[draft.activeIndex] : undefined;
  const draftCanResume =
    Boolean(draft && draftSection) &&
    !isSectionLocked(statuses[draft!.activeIndex] ?? "locked") &&
    deadlineMs[draftSection!.key] !== undefined;

  let activeIndex = 0;
  let remainingSeconds = exam.sections[0]?.durationSeconds ?? 0;

  if (draft && draftSection && draftCanResume) {
    statuses[draft.activeIndex] = "in_progress";
    activeIndex = draft.activeIndex;
    remainingSeconds = computeRemainingSeconds(
      deadlineMs[draftSection.key]!,
      Date.now(),
    );
  } else {
    const firstUnlocked = statuses.findIndex(
      (status) => !isSectionLocked(status),
    );
    activeIndex = firstUnlocked >= 0 ? firstUnlocked : 0;
    remainingSeconds = exam.sections[activeIndex]?.durationSeconds ?? 0;
  }

  const allLocked =
    statuses.length > 0 && statuses.every((status) => isSectionLocked(status));

  return {
    attemptId,
    attemptNumber,
    attemptStartedAt,
    statuses,
    activeIndex,
    viewingSummary: allLocked,
    answers,
    startedAtMs,
    deadlineMs,
    elapsedBySection,
    submittedAtBySection,
    remainingSeconds,
    listeningScriptMode,
    finalizedKeys,
    staleDraftDetected,
  };
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

function ExamRunnerSession({
  exam,
  owner,
  pack,
  initialActiveAttempt,
  initialDraft,
  attempts,
}: {
  exam: ExamDocument;
  owner: string;
  pack: ContentPack | null;
  initialActiveAttempt: ExamAttemptRecord | null;
  initialDraft: ActiveExamDraft | null;
  attempts: readonly ExamAttemptRecord[];
}) {
  const { mode } = useMotionPreference();
  const saveProgress = useSaveExamProgress();

  const [initialState] = useState<HydratedSessionState>(() =>
    hydrateSessionState(exam, initialActiveAttempt, initialDraft, attempts),
  );

  const [attemptId, setAttemptId] = useState<string>(initialState.attemptId);
  const [attemptNumber, setAttemptNumber] = useState<number>(
    initialState.attemptNumber,
  );
  const [attemptStartedAt, setAttemptStartedAt] = useState<string>(
    initialState.attemptStartedAt,
  );
  const [statuses, setStatuses] = useState<ExamSectionStatus[]>(
    initialState.statuses,
  );
  const [activeIndex, setActiveIndex] = useState<number>(
    initialState.activeIndex,
  );
  const [viewingSummary, setViewingSummary] = useState<boolean>(
    initialState.viewingSummary,
  );
  const [answers, setAnswers] = useState<Record<string, number>>(
    initialState.answers,
  );
  const [startedAtMs, setStartedAtMs] = useState<
    Partial<Record<ExamSectionKey, number>>
  >(initialState.startedAtMs);
  const [deadlineMs, setDeadlineMs] = useState<
    Partial<Record<ExamSectionKey, number>>
  >(initialState.deadlineMs);
  const [elapsedBySection, setElapsedBySection] = useState<
    Partial<Record<ExamSectionKey, number>>
  >(initialState.elapsedBySection);
  const [submittedAtBySection, setSubmittedAtBySection] = useState<
    Partial<Record<ExamSectionKey, string>>
  >(initialState.submittedAtBySection);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialState.remainingSeconds,
  );
  const [listeningScriptMode, setListeningScriptMode] = useState<boolean>(
    initialState.listeningScriptMode,
  );
  const [lastCompletedSnapshot, setLastCompletedSnapshot] =
    useState<ExamAttemptRecord | null>(null);
  const [selectedHistoryAttemptId, setSelectedHistoryAttemptId] = useState<
    string | null
  >(null);
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "dirty" | "saved">(
    "idle",
  );

  const attemptIdRef = useRef(attemptId);
  attemptIdRef.current = attemptId;
  const attemptNumberRef = useRef(attemptNumber);
  attemptNumberRef.current = attemptNumber;
  const attemptStartedAtRef = useRef(attemptStartedAt);
  attemptStartedAtRef.current = attemptStartedAt;
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const startedAtRef = useRef(startedAtMs);
  startedAtRef.current = startedAtMs;
  const deadlineRef = useRef(deadlineMs);
  deadlineRef.current = deadlineMs;
  const elapsedRef = useRef(elapsedBySection);
  elapsedRef.current = elapsedBySection;
  const submittedAtRef = useRef(submittedAtBySection);
  submittedAtRef.current = submittedAtBySection;
  const listeningScriptModeRef = useRef(listeningScriptMode);
  listeningScriptModeRef.current = listeningScriptMode;
  const finalizedSectionsRef = useRef<Set<ExamSectionKey>>(
    new Set(initialState.finalizedKeys),
  );
  const draftDebounceRef = useRef<number | null>(null);
  const draftEpochRef = useRef(0);

  useEffect(() => {
    if (initialState.staleDraftDetected) {
      void examStore.clearDraft(owner, exam.level, exam.id).catch(() => {});
    }
  }, [exam.id, exam.level, initialState.staleDraftDetected, owner]);

  const cancelPendingDraftSave = useCallback(() => {
    draftEpochRef.current += 1;
    if (draftDebounceRef.current !== null) {
      window.clearTimeout(draftDebounceRef.current);
      draftDebounceRef.current = null;
    }
  }, []);

  const persistDraftNow = useCallback(
    async (overrides?: {
      activeIndex?: number;
      answers?: Record<string, number>;
      startedAtMs?: Partial<Record<ExamSectionKey, number>>;
      deadlineMs?: Partial<Record<ExamSectionKey, number>>;
      listeningScriptMode?: boolean;
      allowIndex?: number;
    }) => {
      const targetIdx = overrides?.activeIndex ?? activeIndexRef.current;
      const status =
        overrides?.allowIndex === targetIdx
          ? "in_progress"
          : statusesRef.current[targetIdx];
      if (status !== "in_progress") return;

      const epoch = draftEpochRef.current;
      const draft: ActiveExamDraft = {
        owner,
        level: exam.level,
        examId: exam.id,
        attemptId: attemptIdRef.current,
        activeIndex: targetIdx,
        answers: overrides?.answers ?? answersRef.current,
        startedAtMs: overrides?.startedAtMs ?? startedAtRef.current,
        deadlineMs: overrides?.deadlineMs ?? deadlineRef.current,
        listeningScriptMode:
          overrides?.listeningScriptMode ?? listeningScriptModeRef.current,
        savedAt: new Date().toISOString(),
      };
      try {
        await examStore.saveDraft(draft);
        if (epoch !== draftEpochRef.current) {
          await examStore.clearDraft(owner, exam.level, exam.id);
        } else {
          setDraftState("saved");
        }
      } catch {
        // Keep in-memory progress intact even if IndexedDB is temporarily unavailable.
      }
    },
    [exam.id, exam.level, owner],
  );

  useEffect(() => {
    const flushIfPending = () => {
      if (draftDebounceRef.current !== null) {
        window.clearTimeout(draftDebounceRef.current);
        draftDebounceRef.current = null;
        void persistDraftNow();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushIfPending();
    };
    window.addEventListener("pagehide", flushIfPending);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flushIfPending();
      window.removeEventListener("pagehide", flushIfPending);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persistDraftNow]);

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
      const currentStatus = statusesRef.current[sectionIdx];
      if (!currentStatus || isSectionLocked(currentStatus)) return;
      if (finalizedSectionsRef.current.has(section.key)) return;
      finalizedSectionsRef.current.add(section.key);

      cancelPendingDraftSave();

      const submittedIso = new Date(nowMs).toISOString();
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

      const nextStatuses = [...statusesRef.current];
      nextStatuses[sectionIdx] = finalStatus;
      if (
        sectionIdx + 1 < nextStatuses.length &&
        nextStatuses[sectionIdx + 1] === "locked"
      ) {
        nextStatuses[sectionIdx + 1] = "ready";
      }
      const nextElapsed = {
        ...elapsedRef.current,
        [section.key]: elapsed,
      };
      const nextSubmittedAt = {
        ...submittedAtRef.current,
        [section.key]: submittedIso,
      };

      statusesRef.current = nextStatuses;
      elapsedRef.current = nextElapsed;
      submittedAtRef.current = nextSubmittedAt;

      setStatuses(nextStatuses);
      setElapsedBySection(nextElapsed);
      setSubmittedAtBySection(nextSubmittedAt);
      if (finalStatus === "timed_out") {
        setRemainingSeconds(0);
      }
      if (openSummaryAfter) {
        setViewingSummary(true);
      }

      const sectionMeta: Partial<Record<ExamSectionKey, ExamSectionMetaInput>> =
        {};
      exam.sections.forEach((sec, idx) => {
        const st = nextStatuses[idx];
        if (st === "submitted" || st === "timed_out" || st === "skipped") {
          sectionMeta[sec.key] = {
            status: st,
            elapsedSeconds: nextElapsed[sec.key] ?? 0,
            submittedAt: nextSubmittedAt[sec.key] ?? submittedIso,
          };
        }
      });

      const allLocked = nextStatuses.every((st) => isSectionLocked(st));
      const snapshot = buildExamAttemptSnapshot({
        id: attemptIdRef.current,
        owner,
        exam,
        answers: answersRef.current,
        sectionMeta,
        attemptNumber: attemptNumberRef.current,
        startedAt: attemptStartedAtRef.current,
        updatedAt: submittedIso,
        completedAt: allLocked ? submittedIso : null,
      });

      if (allLocked) {
        setLastCompletedSnapshot(snapshot);
      }

      setDraftState("idle");
      void examStore.clearDraft(owner, exam.level, exam.id).catch(() => {});
      saveProgress.mutate(snapshot);
    },
    [cancelPendingDraftSave, exam, owner, saveProgress],
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

  const currentRunSnapshot = useMemo(() => {
    if (!allDone) return null;
    if (lastCompletedSnapshot) return lastCompletedSnapshot;
    const sectionMeta: Partial<Record<ExamSectionKey, ExamSectionMetaInput>> =
      {};
    exam.sections.forEach((section, idx) => {
      const st = statuses[idx];
      const finalSt: FinalSectionStatus =
        st === "submitted" || st === "timed_out" || st === "skipped"
          ? st
          : "skipped";
      sectionMeta[section.key] = {
        status: finalSt,
        elapsedSeconds: elapsedBySection[section.key] ?? 0,
        submittedAt: submittedAtBySection[section.key] ?? attemptStartedAt,
      };
    });
    return buildExamAttemptSnapshot({
      id: attemptId,
      owner,
      exam,
      answers,
      sectionMeta,
      attemptNumber,
      startedAt: attemptStartedAt,
    });
  }, [
    allDone,
    answers,
    attemptId,
    attemptNumber,
    attemptStartedAt,
    elapsedBySection,
    exam,
    lastCompletedSnapshot,
    owner,
    statuses,
    submittedAtBySection,
  ]);

  const completedAttempts = useMemo(() => {
    const byId = new Map<string, ExamAttemptRecord>();
    for (const attempt of attempts) {
      if (attempt.status === "completed") {
        byId.set(attempt.id, attempt);
      }
    }
    if (currentRunSnapshot?.status === "completed") {
      byId.set(currentRunSnapshot.id, currentRunSnapshot);
    }
    return Array.from(byId.values()).sort(
      (left, right) => left.attemptNumber - right.attemptNumber,
    );
  }, [attempts, currentRunSnapshot]);

  const displayedSummaryAttempt = useMemo(() => {
    if (selectedHistoryAttemptId) {
      const matched = completedAttempts.find(
        (item) => item.id === selectedHistoryAttemptId,
      );
      if (matched) return matched;
    }
    return currentRunSnapshot ?? completedAttempts.at(-1) ?? null;
  }, [completedAttempts, currentRunSnapshot, selectedHistoryAttemptId]);

  const reviewingHistory =
    selectedHistoryAttemptId !== null && displayedSummaryAttempt !== null;

  const displayedStatuses: ExamSectionStatus[] = useMemo(() => {
    if (reviewingHistory && displayedSummaryAttempt) {
      return exam.sections.map((section) => {
        const summary = displayedSummaryAttempt.sections.find(
          (item) => item.key === section.key,
        );
        return summary && summary.status !== "pending"
          ? summary.status
          : "skipped";
      });
    }
    return statuses;
  }, [displayedSummaryAttempt, exam.sections, reviewingHistory, statuses]);

  const displayedAnswers =
    reviewingHistory && displayedSummaryAttempt
      ? displayedSummaryAttempt.answers
      : answers;

  const displayedAllDone = reviewingHistory ? true : allDone;

  const jlptReport = useMemo(
    () =>
      displayedSummaryAttempt
        ? computeJlptScore(displayedSummaryAttempt, exam)
        : null,
    [displayedSummaryAttempt, exam],
  );

  const remediationItems = useMemo(
    () =>
      displayedSummaryAttempt && pack
        ? buildRemediationSession(displayedSummaryAttempt, exam, pack)
        : [],
    [displayedSummaryAttempt, exam, pack],
  );

  const activeSection = exam.sections[activeIndex];
  const activeStatus = displayedStatuses[activeIndex] ?? "locked";
  const activeLocked = isSectionLocked(activeStatus);

  const hasStartedCurrentRun =
    runningIndex >= 0 ||
    statuses.some((status) => isSectionLocked(status)) ||
    Object.keys(answers).length > 0;

  const handleStartSection = (scriptAssisted = false) => {
    if (!activeSection || activeStatus !== "ready") return;
    const now = Date.now();
    const deadline = now + activeSection.durationSeconds * 1000;
    const nextStartedAtMs = {
      ...startedAtRef.current,
      [activeSection.key]: now,
    };
    const nextDeadlineMs = {
      ...deadlineRef.current,
      [activeSection.key]: deadline,
    };
    const nextScriptMode = scriptAssisted || listeningScriptModeRef.current;

    if (scriptAssisted) {
      listeningScriptModeRef.current = true;
      setListeningScriptMode(true);
    }
    startedAtRef.current = nextStartedAtMs;
    deadlineRef.current = nextDeadlineMs;

    const nextStatuses = [...statusesRef.current];
    nextStatuses[activeIndex] = "in_progress";
    statusesRef.current = nextStatuses;

    setStartedAtMs(nextStartedAtMs);
    setDeadlineMs(nextDeadlineMs);
    setRemainingSeconds(activeSection.durationSeconds);
    setStatuses(nextStatuses);

    void persistDraftNow({
      activeIndex,
      answers: answersRef.current,
      startedAtMs: nextStartedAtMs,
      deadlineMs: nextDeadlineMs,
      listeningScriptMode: nextScriptMode,
      allowIndex: activeIndex,
    });
    scrollToTop();
  };

  const handleSkipListening = () => {
    if (!activeSection || reviewingHistory) return;
    const isLast = activeIndex === exam.sections.length - 1;
    finalizeSection(activeIndex, "skipped", Date.now(), isLast);
    if (!isLast) {
      setActiveIndex(activeIndex + 1);
    }
    scrollToTop();
  };

  const handleSelectChoice = (questionId: string, choiceIndex: number) => {
    if (activeStatus !== "in_progress" || reviewingHistory) return;
    const nextAnswers = { ...answersRef.current, [questionId]: choiceIndex };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setDraftState("dirty");
    if (draftDebounceRef.current !== null) {
      window.clearTimeout(draftDebounceRef.current);
    }
    draftDebounceRef.current = window.setTimeout(() => {
      draftDebounceRef.current = null;
      void persistDraftNow({ answers: nextAnswers });
    }, DRAFT_DEBOUNCE_MS);
  };

  const handleSubmitSection = () => {
    if (activeStatus !== "in_progress" || reviewingHistory) return;
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
    cancelPendingDraftSave();
    finalizedSectionsRef.current.clear();
    saveProgress.reset();

    let maxNum = attemptNumberRef.current;
    for (const attempt of completedAttempts) {
      if (attempt.attemptNumber > maxNum) maxNum = attempt.attemptNumber;
    }
    const nextNum =
      allDone || lastCompletedSnapshot !== null ? maxNum + 1 : attemptNumber;
    const nextRunId = createRunId();
    const nowIso = new Date().toISOString();
    const freshStatuses = initialStatuses(exam.sections.length);

    attemptIdRef.current = nextRunId;
    attemptNumberRef.current = nextNum;
    attemptStartedAtRef.current = nowIso;
    statusesRef.current = freshStatuses;
    activeIndexRef.current = 0;
    answersRef.current = {};
    startedAtRef.current = {};
    deadlineRef.current = {};
    elapsedRef.current = {};
    submittedAtRef.current = {};
    listeningScriptModeRef.current = false;

    setAttemptId(nextRunId);
    setAttemptNumber(nextNum);
    setAttemptStartedAt(nowIso);
    setStatuses(freshStatuses);
    setActiveIndex(0);
    setViewingSummary(false);
    setSelectedHistoryAttemptId(null);
    setLastCompletedSnapshot(null);
    setRemediationOpen(false);
    setAnswers({});
    setStartedAtMs({});
    setDeadlineMs({});
    setElapsedBySection({});
    setSubmittedAtBySection({});
    setRemainingSeconds(exam.sections[0]?.durationSeconds ?? 0);
    setListeningScriptMode(false);
    setDraftState("idle");

    void examStore.clearDraft(owner, exam.level, exam.id).catch(() => {});
    scrollToTop();
  };

  const activeGraded = activeSection
    ? gradeSection(activeSection, displayedAnswers)
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
      data-draft-state={draftState}
      className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10"
    >
      <BackToListLink />

      <header className="mb-6 mt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
            {exam.title}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">
            Mã đề: {exam.code} · Lần{" "}
            {reviewingHistory && displayedSummaryAttempt
              ? displayedSummaryAttempt.attemptNumber
              : attemptNumber}
          </span>
        </div>
      </header>

      {!viewingSummary &&
        !hasStartedCurrentRun &&
        !reviewingHistory &&
        completedAttempts.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Bạn đã hoàn thành đề này{" "}
              <strong className="font-semibold text-foreground">
                {completedAttempts.length} lần
              </strong>
              . Lượt hiện tại là{" "}
              <strong className="font-semibold text-foreground">
                Lần {attemptNumber}
              </strong>
              .
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-ocid="exam_runner.view_history_button"
              className="min-h-11 rounded-md"
              onClick={() => {
                const latest = completedAttempts.at(-1);
                if (latest) setSelectedHistoryAttemptId(latest.id);
                setViewingSummary(true);
              }}
            >
              Xem kết quả các lần trước
            </Button>
          </div>
        )}

      <nav
        aria-label="Các phần của đề thi"
        data-ocid="exam_runner.stepper"
        className="mb-6 grid gap-2 sm:grid-cols-3"
      >
        {exam.sections.map((section, idx) => {
          const st = displayedStatuses[idx] ?? "locked";
          const accessible = canAccessSection(displayedStatuses, idx);
          const isCurrent = !viewingSummary && activeIndex === idx;
          const locked = isSectionLocked(st);
          const minutes = Math.round(section.durationSeconds / 60);

          return (
            <button
              key={section.key}
              type="button"
              disabled={
                !accessible ||
                (!reviewingHistory && runningIndex >= 0 && runningIndex !== idx)
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
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Đã nộp
                  </span>
                ) : st === "timed_out" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Hết giờ
                  </span>
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

      {displayedAllDone && !viewingSummary && (
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

      {viewingSummary && displayedSummaryAttempt ? (
        <div
          data-ocid="exam_runner.summary"
          className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8"
        >
          {completedAttempts.length > 1 && (
            <fieldset
              data-ocid="exam_runner.attempt_selector"
              className="flex flex-wrap items-center gap-2 border-0 border-b border-border p-0 pb-4"
            >
              <legend className="sr-only">Chọn lần làm bài để xem lại</legend>
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lịch sử các lần:
              </span>
              {completedAttempts.map((item) => {
                const isSelected = displayedSummaryAttempt.id === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    aria-pressed={isSelected}
                    data-ocid={`exam_runner.attempt.${item.attemptNumber}`}
                    className="min-h-11 rounded-md tabular-nums"
                    onClick={() => setSelectedHistoryAttemptId(item.id)}
                  >
                    Lần {item.attemptNumber} · {item.totalScore}/
                    {item.totalQuestions}
                  </Button>
                );
              })}
            </fieldset>
          )}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <HankoStamp
                label={`${displayedSummaryAttempt.totalQuestions > 0 ? Math.round((displayedSummaryAttempt.totalScore / displayedSummaryAttempt.totalQuestions) * 100) : 0}%`}
                sublabel={`${displayedSummaryAttempt.totalScore}/${displayedSummaryAttempt.totalQuestions}`}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                    Tổng kết bài làm
                  </h2>
                  <Badge
                    variant="outline"
                    className="rounded-full tabular-nums"
                  >
                    Lần {displayedSummaryAttempt.attemptNumber}
                  </Badge>
                </div>
                <p className="mt-1 text-base text-muted-foreground tabular-nums">
                  Đúng{" "}
                  <strong className="font-semibold text-foreground">
                    {displayedSummaryAttempt.totalScore}/
                    {displayedSummaryAttempt.totalQuestions}
                  </strong>{" "}
                  câu trên toàn đề
                </p>
                {!reviewingHistory && saveProgress.isSuccess && (
                  <p className="mt-1 text-sm text-success">
                    Đã lưu kết quả làm đề trên máy.
                  </p>
                )}
                {!reviewingHistory && saveProgress.isPending && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Đang lưu kết quả…
                  </p>
                )}
                {!reviewingHistory && saveProgress.isError && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    Chưa lưu được kết quả trên máy.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="secondary"
                data-ocid="exam_runner.remediation_button"
                disabled={!pack}
                className="min-h-11 rounded-md"
                onClick={() => setRemediationOpen(true)}
              >
                <Layers className="size-4" aria-hidden="true" />
                Ôn cấp tốc 10 phút từ đề này
                {remediationItems.length > 0 && ` (${remediationItems.length})`}
              </Button>
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

          {jlptReport && <JlptScoreBreakdown report={jlptReport} />}

          <div className="grid gap-3 border-t border-border pt-6 md:grid-cols-3">
            {displayedSummaryAttempt.sections.map((secSummary, idx) => {
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

          <QuickRemediationModal
            open={remediationOpen}
            onOpenChange={setRemediationOpen}
            items={remediationItems}
            examTitle={exam.title}
          />
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
                              selected={displayedAnswers[question.id]}
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
                            selected={displayedAnswers[question.id]}
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
  const { session } = useAuth();
  const { pack } = useContent();
  const owner = session?.user.id ?? GUEST_OWNER;

  const indexQuery = useExamIndex();
  const entry = indexQuery.data?.exams.find((item) => item.id === examId);
  const docQuery = useExamDocument(examId);
  const activeAttemptQuery = useActiveExamAttempt(examId);
  const draftQuery = useExamDraft(examId);
  const attemptsQuery = useExamAttempts(examId);

  if (
    indexQuery.isPending ||
    (Boolean(entry) && docQuery.isPending) ||
    activeAttemptQuery.isPending ||
    draftQuery.isPending ||
    attemptsQuery.isPending ||
    !activeAttemptQuery.isFetchedAfterMount ||
    !draftQuery.isFetchedAfterMount ||
    !attemptsQuery.isFetchedAfterMount
  ) {
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

  return (
    <ExamRunnerSession
      key={`${owner}:${docQuery.data.id}`}
      exam={docQuery.data}
      owner={owner}
      pack={pack}
      initialActiveAttempt={activeAttemptQuery.data ?? null}
      initialDraft={draftQuery.data ?? null}
      attempts={attemptsQuery.data ?? []}
    />
  );
}
