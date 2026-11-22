import {
  countKnownVocabulary,
  currentKanjiResults,
  currentReadingResults,
} from "@/components/home/sections";
import { ProgressStatCard } from "@/components/progress/ProgressStatCard";
import {
  KanjiResultsList,
  ReadingResultsList,
} from "@/components/progress/ResultLists";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadyPack } from "@/hooks/useContent";
import { useIsSignedIn, useMyProgress } from "@/hooks/useProgress";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCw, Sprout } from "lucide-react";

const SKELETON_IDS = Array.from({ length: 4 }, (_, i) => `skeleton-${i}`);

function PageHeader({ level }: { level: string }) {
  return (
    <header className="mb-8 flex flex-col gap-2">
      <p className="text-sm font-medium uppercase tracking-wider text-primary">
        JLPT {level} · Hồ sơ học tập
      </p>
      <h1 className="text-3xl font-semibold md:text-4xl">Tiến độ của tôi</h1>
      <p className="max-w-2xl text-muted-foreground">
        Tổng hợp từ vựng đã thuộc, ngữ pháp đã học, bài đọc hiểu đã làm và kết
        quả trắc nghiệm Kanji của bạn.
      </p>
    </header>
  );
}

function LoadingState() {
  return (
    <div data-ocid="progress.loading_state" aria-busy="true">
      <span className="sr-only">Đang tải tiến độ…</span>
      <div className="grid gap-4 sm:grid-cols-2">
        {SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-36 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

function ProgressContent() {
  const pack = useReadyPack();
  const { data, isPending, isError, refetch, isRefetching } = useMyProgress();

  if (isPending && !isError) return <LoadingState />;

  if (isError || !data) {
    return (
      <div
        data-ocid="progress.error_state"
        role="alert"
        className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-subtle"
      >
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <h2 className="text-xl">Không tải được tiến độ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Đã có lỗi khi kết nối. Vui lòng thử lại sau giây lát.
          </p>
        </div>
        <Button
          type="button"
          data-ocid="progress.retry_button"
          className="rounded-md transition-smooth"
          disabled={isRefetching}
          onClick={() => void refetch()}
        >
          <RotateCw className="size-4" aria-hidden="true" />
          {isRefetching ? "Đang thử lại…" : "Thử lại"}
        </Button>
      </div>
    );
  }

  const grammarIds = new Set(pack.grammar.map((g) => g.id));
  const knownCount = countKnownVocabulary(data, pack);
  const kanjiResults = currentKanjiResults(data, pack);
  const mistakes = new Map<string, number>();
  for (const result of kanjiResults) {
    for (const id of result.wrongItemIds)
      mistakes.set(id, (mistakes.get(id) ?? 0) + 1);
  }
  const mostMissed = [
    ...pack.kanji.map((item) => ({ id: item.id, text: item.kanji })),
    ...pack.compounds.map((item) => ({ id: item.id, text: item.word })),
  ]
    .filter((item) => mistakes.has(item.id))
    .sort((left, right) => mistakes.get(right.id)! - mistakes.get(left.id)!)
    .slice(0, 10);
  const learnedGrammar = new Set(
    data.learnedGrammarIds.filter((id) => grammarIds.has(id)),
  ).size;
  const readingResults = currentReadingResults(data, pack);
  const kanjiCorrect = kanjiResults.reduce(
    (sum, r) => sum + Math.min(Number(r.score), Number(r.total)),
    0,
  );
  const kanjiAsked = kanjiResults.reduce((sum, r) => sum + Number(r.total), 0);

  const isEmpty =
    knownCount === 0 &&
    learnedGrammar === 0 &&
    readingResults.length === 0 &&
    kanjiResults.length === 0;

  if (isEmpty) {
    return (
      <div
        data-ocid="progress.empty_state"
        className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-12 text-center shadow-subtle"
      >
        <Sprout className="size-10 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-2xl">Bạn chưa có tiến độ nào ở cấp độ này</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Hãy bắt đầu với flashcard từ vựng — mỗi thẻ bạn đánh dấu "đã thuộc"
            sẽ được lưu lại tại đây.
          </p>
        </div>
        <Button asChild className="rounded-md transition-smooth">
          <Link to="/tu-vung" data-ocid="progress.empty_state.primary_button">
            Bắt đầu học từ vựng
          </Link>
        </Button>
      </div>
    );
  }

  const kanjiTotal = pack.kanji.length + pack.compounds.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ProgressStatCard
          index={1}
          glyph="語"
          title="Từ vựng đã thuộc"
          done={knownCount}
          total={pack.vocabulary.length}
          unit="từ"
          to="/tu-vung"
          linkLabel="Ôn flashcard"
        />
        <ProgressStatCard
          index={2}
          glyph="文"
          title="Ngữ pháp đã học"
          done={learnedGrammar}
          total={pack.grammar.length}
          unit="mẫu"
          to="/ngu-phap"
          linkLabel="Học ngữ pháp"
        />
        <ProgressStatCard
          index={3}
          glyph="読"
          title="Đọc hiểu đã làm"
          done={readingResults.length}
          total={pack.reading.length}
          unit="bài"
          to="/doc-hieu"
          linkLabel="Đọc bài mới"
        />
        <ProgressStatCard
          index={4}
          glyph="漢"
          title="Kết quả Kanji"
          done={kanjiCorrect}
          total={kanjiAsked}
          unit="câu đúng"
          to="/kanji"
          linkLabel={`Luyện ${kanjiTotal} mục Kanji`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <KanjiResultsList results={kanjiResults} />
        <ReadingResultsList results={readingResults} passages={pack.reading} />
      </div>
      {mostMissed.length > 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-xl">Kanji và từ ghép hay sai</h2>
          <ul>
            {mostMissed.map((item) => (
              <li key={item.id}>
                <span lang="ja">{item.text}</span>: {mistakes.get(item.id)} lần
                sai
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const level = useReadyPack().manifest.level.toUpperCase();
  const { isInitializing } = useIsSignedIn();
  return (
    <section
      data-ocid="progress.page"
      className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16"
    >
      <PageHeader level={level} />
      {isInitializing ? <LoadingState /> : <ProgressContent />}
    </section>
  );
}
