import { QuizQuestion } from "@/components/kanji-quiz/QuizQuestion";
import { QuizResult, type SaveState } from "@/components/kanji-quiz/QuizResult";
import { QuizStart } from "@/components/kanji-quiz/QuizStart";
import {
  ALL_QUIZ_LESSONS,
  type QuizQuestion as Question,
  clampQuestionCount,
  filterQuizSourceByLesson,
  generateQuiz,
  generateTargetedQuiz,
  listQuizLessons,
  parseRetryIds,
  quizPoolSize,
} from "@/components/kanji-quiz/quizEngine";
import { KanjiQuizMode } from "@/core/progress/types";
import { useContent } from "@/hooks/useContent";
import { useRecordKanjiQuiz } from "@/hooks/useProgress";
import { useQuizCounts } from "@/hooks/useQuizCounts";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

type Stage = "start" | "quiz" | "result";

const SUBNAV_BASE =
  "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function KanjiQuizPage() {
  const [stage, setStage] = useState<Stage>("start");
  const [mode, setMode] = useState<KanjiQuizMode>(KanjiQuizMode.single);
  const [lesson, setLesson] = useState(ALL_QUIZ_LESSONS);
  const [activeRetryIds, setActiveRetryIds] = useState<string[] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [noQuestions, setNoQuestions] = useState(false);
  const [counts, setCount] = useQuizCounts();
  const { pack } = useContent();
  const recordQuiz = useRecordKanjiQuiz();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const navigate = useNavigate();
  const lastRetrySearchRef = useRef<string | null>(null);

  const lessons = useMemo(() => (pack ? listQuizLessons(pack) : []), [pack]);
  const filteredPack = useMemo(
    () => (pack ? filterQuizSourceByLesson(pack, lesson) : null),
    [pack, lesson],
  );
  const poolSize = filteredPack ? quizPoolSize(mode, filteredPack) : 0;
  const count = clampQuestionCount(counts[mode], poolSize);

  useEffect(() => {
    if (!pack) return;
    const retryIds = parseRetryIds(searchStr);
    if (retryIds.length === 0) {
      if (lastRetrySearchRef.current !== null) {
        lastRetrySearchRef.current = null;
        setActiveRetryIds(null);
        setStage("start");
      }
      return;
    }
    if (lastRetrySearchRef.current === searchStr) return;
    lastRetrySearchRef.current = searchStr;

    const targeted = generateTargetedQuiz(retryIds, pack);
    if (targeted.length === 0) {
      setActiveRetryIds(null);
      setNoQuestions(true);
      setStage("start");
      return;
    }
    setActiveRetryIds(targeted.map((q) => q.item.id));
    setQuestions(targeted);
    setAnswers([]);
    setCurrent(0);
    setSaveState("idle");
    setNoQuestions(false);
    setStage("quiz");
  }, [pack, searchStr]);

  const start = () => {
    if (!pack || !filteredPack) return;
    const generated = activeRetryIds
      ? generateTargetedQuiz(activeRetryIds, pack)
      : generateQuiz(mode, filteredPack, count);
    setNoQuestions(generated.length === 0);
    if (generated.length === 0) return;
    setQuestions(generated);
    setAnswers([]);
    setCurrent(0);
    setSaveState("idle");
    setStage("quiz");
  };

  const save = (finalAnswers: number[]) => {
    const wrongItemIds = questions
      .filter((q, i) => finalAnswers[i] !== q.correctIndex)
      .map((q) => q.item.id);
    const saveMode = activeRetryIds
      ? questions.some((q) => q.item.kind === "kanji") &&
        questions.some((q) => q.item.kind === "compound")
        ? KanjiQuizMode.mixed
        : questions.some((q) => q.item.kind === "compound")
          ? KanjiQuizMode.compound
          : KanjiQuizMode.single
      : mode;
    setSaveState("saving");
    recordQuiz.mutate(
      {
        mode: saveMode,
        score: questions.length - wrongItemIds.length,
        total: questions.length,
        wrongItemIds,
      },
      {
        onSuccess: () => setSaveState("saved"),
        onError: () => setSaveState("error"),
      },
    );
  };

  const next = () => {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      return;
    }
    setStage("result");
    save(answers);
  };

  if (!pack) return null;
  const question = questions[current];

  return (
    <section
      data-ocid="kanji_quiz.page"
      className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="mb-6 md:mb-8">
        <p
          lang="ja"
          className="font-jp text-sm tracking-widest text-muted-foreground"
        >
          漢字テスト
        </p>
        <h1 className="text-3xl font-semibold md:text-4xl">
          Trắc nghiệm Kanji
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Luyện đọc âm, nghĩa và mặt chữ theo dạng đề JLPT{" "}
          {pack.manifest.level.toUpperCase()}, kèm giải thích âm Hán Việt sau
          mỗi câu.
        </p>
        <nav
          aria-label="Phân mục Kanji"
          data-ocid="kanji_subnav.nav"
          className="mt-5 flex flex-wrap items-center gap-2"
        >
          <Link
            to="/kanji"
            activeOptions={{ exact: true }}
            data-ocid="kanji_subnav.quiz.link"
            className={`${SUBNAV_BASE} border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/60 hover:text-foreground`}
            activeProps={{
              className: `${SUBNAV_BASE} border-primary bg-primary text-primary-foreground shadow-subtle`,
              "aria-current": "page",
            }}
          >
            Trắc nghiệm
          </Link>
          <Link
            to="/kanji/tra-cuu"
            activeOptions={{ exact: false }}
            data-ocid="kanji_subnav.library.link"
            className={`${SUBNAV_BASE} border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/60 hover:text-foreground`}
            activeProps={{
              className: `${SUBNAV_BASE} border-primary bg-primary text-primary-foreground shadow-subtle`,
              "aria-current": "page",
            }}
          >
            Tra cứu Kanji
          </Link>
        </nav>
      </header>

      {stage === "start" && (
        <QuizStart
          mode={mode}
          count={count}
          poolSize={poolSize}
          lessons={lessons}
          lesson={lesson}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setNoQuestions(false);
          }}
          onCountChange={(next) => setCount(mode, next)}
          onLessonChange={(nextLesson) => {
            setLesson(nextLesson);
            setNoQuestions(false);
          }}
          onStart={start}
        />
      )}
      {stage === "start" && noQuestions && (
        <p role="alert" className="mt-4 text-sm text-muted-foreground">
          Chưa đủ nội dung để tạo câu hỏi cho dạng bài này.
        </p>
      )}

      {stage === "quiz" && question && (
        <QuizQuestion
          question={question}
          number={current + 1}
          total={questions.length}
          selected={answers[current] ?? null}
          onSelect={(index) => {
            const updated = [...answers];
            updated[current] = index;
            setAnswers(updated);
          }}
          onNext={next}
        />
      )}

      {stage === "result" && (
        <QuizResult
          questions={questions}
          answers={answers}
          saveState={saveState}
          onRetrySave={() => save(answers)}
          onRetry={start}
          onChangeMode={() => {
            setActiveRetryIds(null);
            setStage("start");
            if (searchStr) {
              void navigate({ to: "/kanji", replace: true });
            }
          }}
        />
      )}
    </section>
  );
}
