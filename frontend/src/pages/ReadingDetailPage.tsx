import { RubyText } from "@/components/exam/RubyText";
import { HankoStamp } from "@/components/motion/HankoStamp";
import { QuestionCard } from "@/components/reading/QuestionCard";
import { StudyAids } from "@/components/reading/StudyAids";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Level, ReadingPassage } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import { useFuriganaPreference } from "@/hooks/useFuriganaPreference";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useRecordReadingResult } from "@/hooks/useProgress";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, RotateCcw } from "lucide-react";
import { useState } from "react";

function BackLink() {
  return (
    <Link
      to="/doc-hieu"
      data-ocid="reading_detail.back.link"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-smooth hover:text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Quay lại danh sách bài đọc
    </Link>
  );
}

function ReadingDetailContent({
  passage,
  level,
}: {
  passage: ReadingPassage;
  level: Level;
}) {
  const { mode } = useMotionPreference();
  const { showFurigana, setShowFurigana } = useFuriganaPreference(level);
  const recordResult = useRecordReadingResult();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = passage.questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = total > 0 && answeredCount === total;
  const score = passage.questions.filter(
    (q, i) => answers[i] === q.answerIndex,
  ).length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    recordResult.mutate({ passageId: passage.id, score, total });
    window.scrollTo({
      top: 0,
      behavior: mode === "reduced" ? "auto" : "smooth",
    });
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    recordResult.reset();
  };

  return (
    <section
      data-ocid="reading_detail.page"
      className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-12"
    >
      <BackLink />
      <header className="mb-6 mt-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Đọc hiểu {level.toUpperCase()} ·{" "}
          {passage.length === "short" ? "Đoạn ngắn" : "Đoạn vừa"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">
          {passage.title}
        </h1>
      </header>

      {submitted && (
        <div
          data-ocid="reading_detail.result.success_state"
          className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-subtle sm:flex-row sm:items-center md:p-6"
        >
          <div className="flex flex-1 items-center gap-4">
            <HankoStamp
              label={`${percent}%`}
              sublabel={`${score}/${total}`}
              size="md"
              className="shrink-0"
            />
            <div>
              <p className="text-sm text-muted-foreground">Kết quả của bạn</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {score}/{total}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  câu đúng
                </span>
              </p>
              {recordResult.isSuccess && (
                <p className="text-sm text-success">Đã lưu vào tiến độ.</p>
              )}
              {recordResult.isPending && (
                <p className="text-sm text-muted-foreground">Đang lưu…</p>
              )}
              {recordResult.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Chưa lưu được kết quả.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            data-ocid="reading_detail.retry_button"
            className="min-h-11 rounded-md transition-smooth"
            onClick={handleRetry}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Làm lại
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 lg:sticky lg:top-32">
          <article
            data-ocid="reading_detail.passage.panel"
            className="rounded-xl border bg-card p-6 shadow-subtle md:p-8"
          >
            {passage.textRuby && (
              <div className="mb-4 flex items-center justify-end border-b pb-3">
                <div className="flex min-h-11 items-center gap-2.5">
                  <Switch
                    id="reading-furigana-switch"
                    data-ocid="reading_detail.furigana.switch"
                    checked={showFurigana}
                    onCheckedChange={setShowFurigana}
                  />
                  <Label
                    htmlFor="reading-furigana-switch"
                    className="min-h-12 cursor-pointer text-sm"
                  >
                    Hiện Furigana
                  </Label>
                </div>
              </div>
            )}
            {showFurigana && passage.textRuby ? (
              <RubyText
                text={passage.textRuby}
                font="serif"
                as="p"
                className="whitespace-pre-line text-lg leading-loose text-foreground"
              />
            ) : (
              <p
                lang="ja"
                className="whitespace-pre-line font-jp text-lg leading-loose text-foreground"
              >
                {passage.text}
              </p>
            )}
          </article>
          {(submitted || total === 0) && <StudyAids passage={passage} />}
        </div>

        <div className="grid gap-4">
          {passage.questions.map((q, i) => (
            <QuestionCard
              key={q.question}
              question={q}
              index={i}
              selected={answers[i]}
              submitted={submitted}
              onSelect={(choice) =>
                setAnswers((prev) => ({ ...prev, [i]: choice }))
              }
            />
          ))}
          {total === 0 && (
            <p className="rounded-xl border bg-card p-5 text-muted-foreground">
              Bài đọc này chưa có câu hỏi.
            </p>
          )}
          {!submitted && total > 0 && (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {allAnswered
                  ? "Bạn đã trả lời tất cả câu hỏi."
                  : `Đã trả lời ${answeredCount}/${total} câu — hãy trả lời hết để nộp bài.`}
              </p>
              <Button
                type="button"
                data-ocid="reading_detail.submit_button"
                className="min-h-11 rounded-md transition-smooth"
                disabled={!allAnswered}
                onClick={handleSubmit}
              >
                Nộp bài
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ReadingDetailPage() {
  const { reading: readingPassages, manifest } = useReadyPack();
  const { passageId } = useParams({ from: "/doc-hieu/$passageId" });
  const passage = readingPassages.find((p) => p.id === passageId);

  if (!passage) {
    return (
      <section
        data-ocid="reading_detail.empty_state"
        className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center"
      >
        <FileQuestion
          className="mb-4 size-12 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="font-display text-2xl font-semibold">
          Không tìm thấy bài đọc
        </h1>
        <p className="mt-2 text-muted-foreground">
          Bài đọc này không tồn tại hoặc đã bị gỡ. Hãy chọn một bài khác.
        </p>
        <Button asChild className="mt-6 min-h-11 rounded-md">
          <Link to="/doc-hieu" data-ocid="reading_detail.back.primary_button">
            Xem danh sách bài đọc
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <ReadingDetailContent
      key={passage.id}
      passage={passage}
      level={manifest.level}
    />
  );
}
