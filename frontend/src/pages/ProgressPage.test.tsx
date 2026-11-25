import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import type { ExamAttemptRecord, ExamIndex } from "@/core/exam/types";
import type { ProgressSummary } from "@/core/progress/types";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "./ProgressPage";

const emptyProgress: ProgressSummary = {
  flashcards: [],
  knownFlashcardCount: 0n,
  learnedGrammarIds: [],
  recentKanjiResults: [],
  readingResults: [],
};

const state = vi.hoisted(() => ({
  progress: {
    flashcards: [] as ProgressSummary["flashcards"],
    knownFlashcardCount: 0n,
    learnedGrammarIds: [] as string[],
    recentKanjiResults: [] as ProgressSummary["recentKanjiResults"],
    readingResults: [] as ProgressSummary["readingResults"],
  } satisfies ProgressSummary,
  attempts: [] as ExamAttemptRecord[],
  attemptsPending: false,
  examIndex: null as ExamIndex | null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    params?: { examId?: string };
    [key: string]: unknown;
  }) => {
    const href =
      to === "/luyen-de/$examId" && params?.examId
        ? `/luyen-de/${params.examId}`
        : to;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/hooks/useContent", () => ({
  useReadyPack: () => miniPack,
}));

vi.mock("@/hooks/useProgress", () => ({
  useIsSignedIn: () => ({ isInitializing: false }),
  useMyProgress: () => ({
    data: state.progress,
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  timestampToDate: (ts: bigint) => new Date(Number(ts / 1_000_000n)),
}));

vi.mock("@/hooks/useExams", () => ({
  useExamAttempts: () => ({
    data: state.attemptsPending ? undefined : state.attempts,
    isPending: state.attemptsPending,
    isError: false,
  }),
  useExamIndex: () => ({
    data: state.examIndex,
    isPending: false,
    isError: false,
  }),
}));

beforeEach(() => {
  state.progress = { ...emptyProgress };
  state.attempts = [];
  state.attemptsPending = false;
  state.examIndex = null;
});

describe("ProgressPage", () => {
  it("shows empty state when all progress and exam attempts are empty", () => {
    const html = renderToStaticMarkup(<ProgressPage />);
    expect(html).toContain('data-ocid="progress.empty_state"');
    expect(html).toContain("Bạn chưa có tiến độ nào ở cấp độ này");
    expect(html).not.toContain('data-ocid="progress.exam_attempts.section"');
  });

  it("shows exam history instead of empty state when only exam attempts exist", () => {
    state.attempts = [
      {
        id: "attempt-1",
        owner: "guest",
        level: "n4",
        examId: "n4-2023-12",
        completedAt: "2026-11-25T10:30:00.000Z",
        totalScore: 42,
        totalQuestions: 55,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 18,
            total: 20,
            elapsedSeconds: 900,
          },
          {
            key: "grammar_reading",
            status: "submitted",
            score: 24,
            total: 35,
            elapsedSeconds: 2100,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: {},
      },
      {
        id: "attempt-2",
        owner: "guest",
        level: "n4",
        examId: "n4-2022-07",
        completedAt: "2026-11-24T08:00:00.000Z",
        totalScore: 30,
        totalQuestions: 50,
        sections: [
          {
            key: "vocab",
            status: "submitted",
            score: 15,
            total: 20,
            elapsedSeconds: 900,
          },
          {
            key: "grammar_reading",
            status: "submitted",
            score: 15,
            total: 30,
            elapsedSeconds: 2000,
          },
          {
            key: "listening",
            status: "skipped",
            score: 0,
            total: 0,
            elapsedSeconds: 0,
          },
        ],
        answers: {},
      },
    ];
    state.examIndex = {
      level: "n4",
      version: "1",
      exams: [
        {
          id: "n4-2023-12",
          level: "n4",
          year: 2023,
          month: 12,
          code: "2023-12",
          title: "Đề JLPT N4 tháng 12/2023",
          answerSourceSummary: "official_key",
          hasListeningScript: true,
          hasSourceAudio: false,
          questionCounts: { vocab: 20, grammar_reading: 35, listening: 0 },
          totalQuestions: 55,
          totalDurationSeconds: 4800,
          sha256: "a".repeat(64),
        },
      ],
    };

    const html = renderToStaticMarkup(<ProgressPage />);
    expect(html).not.toContain('data-ocid="progress.empty_state"');
    expect(html).toContain('data-ocid="progress.exam_attempts.section"');
    expect(html).toContain("Lịch sử luyện đề");
    expect(html).toContain("Đề JLPT N4 tháng 12/2023");
    expect(html).toContain("42/55");
    expect(html).toContain('href="/luyen-de/n4-2023-12"');
    expect(html).toContain("n4-2022-07");
    expect(html).toContain("30/50");
    expect(html).toContain('href="/luyen-de/n4-2022-07"');
  });

  it("hides exam history section when other progress exists without exam attempts", () => {
    state.progress = {
      ...emptyProgress,
      learnedGrammarIds: ["grammar-1"],
    };
    const html = renderToStaticMarkup(<ProgressPage />);
    expect(html).not.toContain('data-ocid="progress.empty_state"');
    expect(html).toContain('data-ocid="progress.stat.card.2"');
    expect(html).not.toContain('data-ocid="progress.exam_attempts.section"');
  });
});
