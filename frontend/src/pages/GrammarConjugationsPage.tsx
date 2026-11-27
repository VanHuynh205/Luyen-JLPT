import { GrammarSubNav } from "@/components/grammar/GrammarSubNav";
import { MiniDrillPanel } from "@/components/grammar/MiniDrillPanel";
import { normalize } from "@/components/kanji-library/search";
import { Badge } from "@/components/ui/badge";
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
import type { ConjugationRule } from "@/core/content/types";
import { buildConjugationDrill } from "@/core/grammar/miniDrill";
import { useReadyPack } from "@/hooks/useContent";
import { Search, SearchX, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

function buildSearchText(rule: ConjugationRule): string {
  return normalize(
    [
      rule.name,
      rule.labelJa,
      rule.recognition,
      rule.group1,
      rule.group2,
      rule.group3,
      rule.examplesG1,
      rule.examplesG2,
      rule.examplesG3,
      rule.adjI,
      rule.adjNa,
      rule.noun,
      rule.exceptions,
    ].join(" "),
  );
}

function getVerbRows(rule: ConjugationRule) {
  return [
    { label: "Nhóm I", formula: rule.group1, examples: rule.examplesG1 },
    { label: "Nhóm II", formula: rule.group2, examples: rule.examplesG2 },
    { label: "Nhóm III", formula: rule.group3, examples: rule.examplesG3 },
  ];
}

function getOtherForms(rule: ConjugationRule) {
  return [
    { label: "Tính từ い", value: rule.adjI },
    { label: "Tính từ な", value: rule.adjNa },
    { label: "Danh từ", value: rule.noun },
  ];
}

export default function GrammarConjugationsPage() {
  const { conjugations, manifest } = useReadyPack();
  const [query, setQuery] = useState("");

  const searchIndex = useMemo(
    () =>
      conjugations.map((rule) => ({
        rule,
        text: buildSearchText(rule),
      })),
    [conjugations],
  );

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return conjugations;
    return searchIndex
      .filter((entry) => entry.text.includes(term))
      .map((entry) => entry.rule);
  }, [conjugations, query, searchIndex]);

  const buildQuestions = useCallback(
    () => buildConjugationDrill(conjugations, 5),
    [conjugations],
  );

  const trimmed = query.trim();

  return (
    <section
      data-ocid="grammar_conjugations.page"
      className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14"
    >
      <header className="max-w-2xl space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="font-jp text-lg" lang="ja">
            活用
          </span>
          Ngữ pháp JLPT {manifest.level.toUpperCase()}
        </p>
        <h1 className="text-3xl font-semibold md:text-4xl">Bảng chia thể</h1>
        <p className="text-muted-foreground">
          {conjugations.length} quy tắc chia động từ, tính từ và danh từ kèm ví
          dụ minh họa và ngoại lệ thường gặp.
        </p>
      </header>

      <GrammarSubNav />

      <MiniDrillPanel
        className="mt-5"
        description="Ôn nhanh nhận diện thể và cách chia động từ theo nhóm."
        buildQuestions={buildQuestions}
      />

      <div className="relative mt-6 md:mt-8">
        <label htmlFor="conjugations-search" className="sr-only">
          Tìm quy tắc chia thể
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="conjugations-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên thể, tên tiếng Nhật (て形), cách chia hoặc ngoại lệ"
          className="h-11 bg-card pl-10 pr-11"
          data-ocid="grammar_conjugations.search_input"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Xoá tìm kiếm"
            data-ocid="grammar_conjugations.search_clear_button"
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
        Hiển thị {filtered.length} / {conjugations.length} quy tắc
      </p>

      {filtered.length === 0 ? (
        <div
          data-ocid="grammar_conjugations.empty_state"
          className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <SearchX
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-xl font-semibold">
            Không tìm thấy quy tắc phù hợp
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground break-words">
            {trimmed
              ? `Không có quy tắc nào khớp với “${trimmed}”. Hãy thử từ khoá khác.`
              : "Cấp độ này chưa có dữ liệu bảng chia thể."}
          </p>
          {trimmed && (
            <Button
              type="button"
              variant="outline"
              className="mt-6 min-h-11"
              data-ocid="grammar_conjugations.clear_search_button"
              onClick={() => setQuery("")}
            >
              Xoá tìm kiếm
            </Button>
          )}
        </div>
      ) : (
        <ul data-ocid="grammar_conjugations.list" className="mt-6 space-y-5">
          {filtered.map((rule, index) => {
            const verbRows = getVerbRows(rule);
            const otherForms = getOtherForms(rule);

            return (
              <li
                key={rule.id}
                data-ocid={`grammar_conjugations.item.${index + 1}`}
                className="rounded-xl border border-border bg-card p-4 shadow-subtle md:p-6"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-body text-xl font-semibold text-foreground md:text-2xl">
                    {rule.name}
                  </h2>
                  {rule.labelJa && (
                    <Badge variant="secondary" className="rounded-full px-2.5">
                      <span
                        lang="ja"
                        className="font-jp-sans text-sm font-medium"
                      >
                        {rule.labelJa}
                      </span>
                    </Badge>
                  )}
                </div>
                {rule.recognition && (
                  <p className="mt-2 text-sm text-muted-foreground break-words">
                    {rule.recognition}
                  </p>
                )}

                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-24 whitespace-normal sm:w-28">
                          Động từ
                        </TableHead>
                        <TableHead className="whitespace-normal">
                          Cách chia
                        </TableHead>
                        <TableHead className="hidden whitespace-normal sm:table-cell">
                          Ví dụ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verbRows.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell className="align-top font-medium whitespace-normal">
                            {row.label}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-words">
                            <p>{row.formula.trim() || "—"}</p>
                            {row.examples.trim() && (
                              <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                                Ví dụ:{" "}
                                <span lang="ja" className="text-foreground">
                                  {row.examples}
                                </span>
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="hidden align-top whitespace-normal break-words sm:table-cell">
                            {row.examples.trim() ? (
                              <span lang="ja">{row.examples}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <dl className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3.5 sm:grid-cols-3">
                  {otherForms.map((item) => {
                    const value = item.value.trim();
                    const isEmpty = !value || value === "—";
                    return (
                      <div key={item.label} className="min-w-0">
                        <dt className="text-xs font-semibold text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd
                          className={
                            isEmpty
                              ? "mt-0.5 text-sm text-muted-foreground"
                              : "mt-0.5 text-sm text-foreground break-words"
                          }
                        >
                          {value || "—"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {rule.exceptions.trim() && (
                  <p className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground break-words">
                    <span className="font-semibold">Ngoại lệ / Lưu ý: </span>
                    {rule.exceptions}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
