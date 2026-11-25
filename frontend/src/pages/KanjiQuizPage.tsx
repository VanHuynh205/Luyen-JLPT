import { QuizQuestion } from "@/components/kanji-quiz/QuizQuestion";
import { QuizResult, type SaveState } from "@/components/kanji-quiz/QuizResult";
import { QuizStart } from "@/components/kanji-quiz/QuizStart";
import {
  type QuizQuestion as Question,
  clampQuestionCount,
  generateQuiz,
  quizPoolSize,
} from "@/components/kanji-quiz/quizEngine";
import { KanjiQuizMode } from "@/core/progress/types";
import { useContent } from "@/hooks/useContent";
import { useRecordKanjiQuiz } from "@/hooks/useProgress";
import { useQuizCounts } from "@/hooks/useQuizCounts";
import { useState } from "react";

type Stage = "start" | "quiz" | "result";

export default function KanjiQuizPage() {
  const [stage, setStage] = useState<Stage>("start");
  const [mode, setMode] = useState<KanjiQuizMode>(KanjiQuizMode.single);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [noQuestions, setNoQuestions] = useState(false);
  const [counts, setCount] = useQuizCounts();
  const { pack } = useContent();
  const recordQuiz = useRecordKanjiQuiz();
  const poolSize = pack ? quizPoolSize(mode, pack) : 0;
  const count = clampQuestionCount(counts[mode], poolSize);

  const start = () => {
    if (!pack) return;
    const generated = generateQuiz(mode, pack, count);
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
    setSaveState("saving");
    recordQuiz.mutate(
      {
        mode,
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
      </header>

      {stage === "start" && (
        <QuizStart
          mode={mode}
          count={count}
          poolSize={poolSize}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setNoQuestions(false);
          }}
          onCountChange={(next) => setCount(mode, next)}
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
          onChangeMode={() => setStage("start")}
        />
      )}
    </section>
  );
}
