import { GrammarSubNav } from "@/components/grammar/GrammarSubNav";
import { MiniDrillPanel } from "@/components/grammar/MiniDrillPanel";
import { normalize } from "@/components/kanji-library/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { KeigoEntry } from "@/core/content/types";
import { buildKeigoDrill } from "@/core/grammar/miniDrill";
import { useReadyPack } from "@/hooks/useContent";
import { Search, SearchX, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

function buildSearchText(entry: KeigoEntry): string {
  return normalize(
    [
      entry.plainJa,
      entry.plainKana,
      entry.sonkeigo,
      entry.sonkeigoMasu,
      entry.kenjogoI,
      entry.kenjogoII,
      entry.teineigo,
      entry.recognition,
      entry.exampleJa,
      entry.exampleVi,
    ].join(" "),
  );
}

function renderValueOrDash(value: string, ja = false) {
  const trimmed = value.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">—</span>;
  }
  return ja ? <span lang="ja">{trimmed}</span> : <span>{trimmed}</span>;
}

function renderSonkeigo(sonkeigo: string, sonkeigoMasu: string) {
  const plain = sonkeigo.trim();
  const masu = sonkeigoMasu.trim();
  if (!plain && !masu) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-0.5">
      {plain && (
        <p lang="ja" className="font-medium text-foreground break-words">
          {plain}
        </p>
      )}
      {masu && (
        <p className="text-xs text-muted-foreground break-words">
          Thể <span lang="ja">ます</span>:{" "}
          <span lang="ja" className="text-foreground">
            {masu}
          </span>
        </p>
      )}
    </div>
  );
}

export default function GrammarKeigoPage() {
  const { keigo, manifest } = useReadyPack();
  const [query, setQuery] = useState("");

  const searchIndex = useMemo(
    () =>
      keigo.map((entry) => ({
        entry,
        text: buildSearchText(entry),
      })),
    [keigo],
  );

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return keigo;
    return searchIndex
      .filter((item) => item.text.includes(term))
      .map((item) => item.entry);
  }, [keigo, query, searchIndex]);

  const buildQuestions = useCallback(() => buildKeigoDrill(keigo, 5), [keigo]);

  const trimmed = query.trim();

  return (
    <section
      data-ocid="grammar_keigo.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="max-w-2xl space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="font-jp text-lg" lang="ja">
            敬語
          </span>
          Ngữ pháp JLPT {manifest.level.toUpperCase()}
        </p>
        <h1 className="text-3xl font-semibold md:text-4xl">Kính ngữ</h1>
        <p className="text-muted-foreground">
          {keigo.length} động từ thông dụng phân theo tôn kính ngữ, khiêm nhường
          ngữ I, khiêm nhường ngữ II và lịch sự kèm câu ví dụ.
        </p>
      </header>

      <GrammarSubNav />

      <MiniDrillPanel
        className="mt-5"
        description="Phân biệt nhanh tôn kính ngữ và khiêm nhường ngữ I / II."
        buildQuestions={buildQuestions}
      />

      <div className="relative mt-6 md:mt-8">
        <label htmlFor="keigo-search" className="sr-only">
          Tìm mục kính ngữ
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="keigo-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo từ gốc, kính ngữ (いらっしゃる), ví dụ hoặc nghĩa"
          className="h-11 bg-card pl-10 pr-11"
          data-ocid="grammar_keigo.search_input"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Xoá tìm kiếm"
            data-ocid="grammar_keigo.search_clear_button"
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p
        className="mt-3 text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        Hiển thị {filtered.length} / {keigo.length} mục
      </p>

      {filtered.length === 0 ? (
        <div
          data-ocid="grammar_keigo.empty_state"
          className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <SearchX
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">
            Không tìm thấy mục kính ngữ phù hợp
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground break-words">
            {trimmed
              ? `Không có mục nào khớp với “${trimmed}”. Hãy thử từ khoá khác.`
              : "Cấp độ này chưa có dữ liệu kính ngữ."}
          </p>
          {trimmed && (
            <Button
              type="button"
              variant="outline"
              className="mt-6 min-h-11"
              data-ocid="grammar_keigo.clear_search_button"
              onClick={() => setQuery("")}
            >
              Xoá tìm kiếm
            </Button>
          )}
        </div>
      ) : (
        <ul data-ocid="grammar_keigo.list" className="mt-6 space-y-5">
          {filtered.map((entry, index) => (
            <li
              key={entry.id}
              data-ocid={`grammar_keigo.item.${index + 1}`}
              className="rounded-xl border border-border bg-card p-4 shadow-subtle md:p-6"
            >
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h2
                  lang="ja"
                  className="font-jp text-2xl font-semibold text-foreground"
                >
                  {entry.plainJa}
                </h2>
                {entry.plainKana.trim() && (
                  <span lang="ja" className="text-sm text-muted-foreground">
                    {entry.plainKana}
                  </span>
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-32 whitespace-normal sm:w-48">
                        Phân loại
                      </TableHead>
                      <TableHead className="whitespace-normal">
                        Dạng kính ngữ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="align-top font-medium whitespace-normal">
                        Tôn kính ngữ
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        {renderSonkeigo(entry.sonkeigo, entry.sonkeigoMasu)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="align-top font-medium whitespace-normal">
                        Khiêm nhường ngữ I
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        {renderValueOrDash(entry.kenjogoI, true)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="align-top font-medium whitespace-normal">
                        Khiêm nhường ngữ II
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        {renderValueOrDash(entry.kenjogoII, true)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="align-top font-medium whitespace-normal">
                        Lịch sự
                      </TableCell>
                      <TableCell className="align-top whitespace-normal break-words">
                        {renderValueOrDash(entry.teineigo, true)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {entry.recognition.trim() && (
                <p className="mt-4 text-sm text-muted-foreground break-words">
                  <span className="font-semibold text-foreground">
                    Nhận biết / Lưu ý:{" "}
                  </span>
                  {entry.recognition}
                </p>
              )}

              {(entry.exampleJa.trim() || entry.exampleVi.trim()) && (
                <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3">
                  {entry.exampleJa.trim() && (
                    <p
                      lang="ja"
                      className="text-base font-medium text-foreground break-words"
                    >
                      {entry.exampleJa}
                    </p>
                  )}
                  {entry.exampleVi.trim() && (
                    <p className="mt-1 text-sm text-muted-foreground break-words">
                      {entry.exampleVi}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
