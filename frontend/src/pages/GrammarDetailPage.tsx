import { DetailSection } from "@/components/grammar/DetailSection";
import { GrammarQuiz } from "@/components/grammar/GrammarQuiz";
import { LearnedToggle } from "@/components/grammar/LearnedToggle";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GrammarPattern } from "@/core/content/types";
import { useReadyPack } from "@/hooks/useContent";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";

const CONNECTION_LABELS = [
  { key: "v", label: "Động từ" },
  { key: "aI", label: "Tính từ い" },
  { key: "aNa", label: "Tính từ な" },
  { key: "n", label: "Danh từ" },
] as const;

function PatternNavLink({
  target,
  direction,
  ocid,
}: {
  target: GrammarPattern;
  direction: "prev" | "next";
  ocid: string;
}) {
  const isNext = direction === "next";
  return (
    <Link
      to="/ngu-phap/$patternId"
      params={{ patternId: target.id }}
      data-ocid={ocid}
      className={`hover-lift group flex min-h-11 min-w-0 items-center gap-3 rounded-xl border bg-card p-4 shadow-subtle hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isNext ? "flex-row-reverse text-right sm:col-start-2" : ""}`}
    >
      {isNext ? (
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
          aria-hidden="true"
        />
      ) : (
        <ArrowLeft
          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {isNext ? "Mẫu tiếp theo" : "Mẫu trước"} · Bài {target.lesson}
        </span>
        <span
          lang="ja"
          className="block truncate font-jp text-lg font-semibold"
        >
          {target.pattern}
        </span>
      </span>
    </Link>
  );
}

function BackLink() {
  return (
    <Link
      to="/ngu-phap"
      data-ocid="grammar_detail.back_link"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Quay lại danh sách ngữ pháp
    </Link>
  );
}

export default function GrammarDetailPage() {
  const { grammar: grammarPatterns, manifest } = useReadyPack();
  const { patternId } = useParams({ from: "/ngu-phap/$patternId" });
  const index = grammarPatterns.findIndex((p) => p.id === patternId);
  const pattern = index >= 0 ? grammarPatterns[index] : undefined;
  const prev = index > 0 ? grammarPatterns[index - 1] : undefined;
  const next =
    index >= 0 && index < grammarPatterns.length - 1
      ? grammarPatterns[index + 1]
      : undefined;
  const connectionRows = pattern
    ? CONNECTION_LABELS.flatMap(({ key, label }) => {
        const value = pattern.connections[key];
        return value ? [{ label, value }] : [];
      })
    : [];
  const hasQuiz = (pattern?.quiz?.length ?? 0) > 0;

  if (!pattern) {
    return (
      <section
        data-ocid="grammar_detail.page"
        className="mx-auto max-w-3xl px-4 py-16 md:px-6"
      >
        <div
          data-ocid="grammar_detail.empty_state"
          className="flex flex-col items-center rounded-lg border bg-card p-10 text-center shadow-subtle"
        >
          <SearchX
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-semibold">
            Không tìm thấy mẫu ngữ pháp
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Mẫu ngữ pháp bạn tìm không tồn tại hoặc đường dẫn đã thay đổi. Hãy
            chọn một mẫu khác trong danh sách {manifest.level.toUpperCase()}.
          </p>
          <Button
            asChild
            className="mt-6 min-h-11 rounded-md transition-smooth"
            data-ocid="grammar_detail.primary_button"
          >
            <Link to="/ngu-phap">Xem danh sách ngữ pháp</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <article
      key={pattern.id}
      data-ocid="grammar_detail.page"
      className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-12"
    >
      <BackLink />

      <header className="mt-4 border-b pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Bài {pattern.lesson} · Mẫu {index + 1}/{grammarPatterns.length}
        </p>
        <h1
          lang="ja"
          className="mt-2 break-words font-jp text-4xl font-semibold text-foreground md:text-5xl"
        >
          {pattern.pattern}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-foreground">
          {pattern.meaning}
        </p>
        <div className="mt-6">
          <LearnedToggle patternId={pattern.id} />
        </div>
      </header>

      <div className="mt-10 space-y-12">
        <DetailSection id="cach-chia" label="Cách chia" jpLabel="接続">
          {connectionRows.length > 0 ? (
            <div className="ink-rule overflow-hidden rounded-lg border bg-card shadow-subtle">
              <Table data-ocid="grammar_detail.connection.table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Loại từ</TableHead>
                    <TableHead>Cách nối</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectionRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="align-top font-medium">
                        {row.label}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
                        {row.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
              Mẫu này không có quy tắc chia riêng theo loại từ.
            </p>
          )}
        </DetailSection>

        <DetailSection id="y-nghia" label="Ý nghĩa" jpLabel="意味">
          <div className="rounded-lg border bg-card p-5 shadow-subtle">
            <p className="text-foreground">{pattern.meaning}</p>
          </div>
        </DetailSection>

        <DetailSection
          id="cach-dung"
          label="Cách dùng / Lưu ý"
          jpLabel="使い方"
        >
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-5">
            <p className="text-foreground">{pattern.usage}</p>
          </div>
        </DetailSection>

        <DetailSection id="vi-du" label="Ví dụ" jpLabel="例文">
          <ol className="space-y-3" data-ocid="grammar_detail.examples.list">
            {pattern.examples.map((example, i) => (
              <li
                key={example.japanese}
                data-ocid={`grammar_detail.example.item.${i + 1}`}
                className="flex gap-4 rounded-lg border bg-card p-5 shadow-subtle"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p
                    lang="ja"
                    className="break-words text-lg font-medium text-foreground md:text-xl"
                  >
                    {example.japanese}
                  </p>
                  {example.reading && (
                    <p
                      lang="ja"
                      className="break-words text-sm text-muted-foreground"
                    >
                      {example.reading}
                    </p>
                  )}
                  <p className="text-foreground">{example.meaning}</p>
                </div>
              </li>
            ))}
          </ol>
        </DetailSection>

        {hasQuiz && (
          <section
            id="luyen-tap"
            aria-labelledby="luyen-tap-title"
            data-ocid="grammar_detail.practice.section"
            className="-mx-4 rounded-none bg-muted px-4 py-8 md:mx-0 md:rounded-xl md:px-8"
          >
            <div className="mb-5">
              <div className="flex items-baseline gap-3">
                <h2
                  id="luyen-tap-title"
                  className="text-xl font-semibold md:text-2xl"
                >
                  Luyện tập
                </h2>
                <span
                  lang="ja"
                  className="font-jp text-sm text-muted-foreground"
                >
                  練習問題
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Chọn đáp án đúng điền vào chỗ trống ＿＿＿ theo dạng đề JLPT.
              </p>
            </div>
            <GrammarQuiz key={pattern.id} questions={pattern.quiz} />
          </section>
        )}
      </div>

      <nav
        aria-label="Chuyển mẫu ngữ pháp"
        className="mt-10 grid gap-3 border-t pt-6 sm:grid-cols-2"
      >
        {prev ? (
          <PatternNavLink
            target={prev}
            direction="prev"
            ocid="grammar_detail.pagination_prev"
          />
        ) : (
          <span />
        )}
        {next ? (
          <PatternNavLink
            target={next}
            direction="next"
            ocid="grammar_detail.pagination_next"
          />
        ) : (
          <span />
        )}
      </nav>

      <div className="mt-6">
        <BackLink />
      </div>
    </article>
  );
}
