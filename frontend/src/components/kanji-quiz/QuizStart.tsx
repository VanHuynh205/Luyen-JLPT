import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KanjiQuizMode } from "@/core/progress/types";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { BookOpen, Play } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  clampQuestionCount,
  modeLabel,
  modeOptions,
  questionCountRange,
} from "./quizEngine";

const PRESETS = [10, 20, 50];

function CountPicker({
  mode,
  count,
  poolSize,
  onCountChange,
}: {
  mode: KanjiQuizMode;
  count: number;
  poolSize: number;
  onCountChange: (count: number) => void;
}) {
  const { min, max } = questionCountRange(poolSize);
  const inputId = useId();
  const [draft, setDraft] = useState(String(count));
  useEffect(() => setDraft(String(count)), [count]);

  const commit = () => {
    const next = clampQuestionCount(Number(draft), poolSize);
    setDraft(String(next));
    onCountChange(next);
  };
  const presets = PRESETS.filter((n) => n >= min && n < max);

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">
        Số câu
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {[...presets, max].map((n) => {
          const all = n === max;
          return (
            <Button
              key={all ? "all" : n}
              type="button"
              size="sm"
              variant={count === n ? "default" : "outline"}
              aria-pressed={count === n}
              data-ocid={`kanji_quiz.count_${all ? "all" : n}.toggle`}
              className="min-h-11 rounded-full px-4 tabular-nums sm:min-h-9"
              onClick={() => onCountChange(n)}
            >
              {all ? `Tất cả (${max})` : n}
            </Button>
          );
        })}
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="text-sm text-muted-foreground">
            Số câu tự chọn
          </label>
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={draft}
            data-ocid="kanji_quiz.count.input"
            className="h-11 w-24 text-foreground tabular-nums sm:h-9"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Từ {min} đến {max} câu cho dạng {modeLabel(mode)}.
      </p>
    </fieldset>
  );
}

export function QuizStart({
  mode,
  count,
  poolSize,
  onModeChange,
  onCountChange,
  onStart,
}: {
  mode: KanjiQuizMode;
  count: number;
  poolSize: number;
  onModeChange: (mode: KanjiQuizMode) => void;
  onCountChange: (count: number) => void;
  onStart: () => void;
}) {
  return (
    <div data-ocid="kanji_quiz.start.panel" className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-foreground">
          Chọn dạng bài
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {modeOptions.map((option) => {
            const selected = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                data-ocid={`kanji_quiz.mode_${option.mode}.toggle`}
                onClick={() => onModeChange(option.mode)}
                className={cn(
                  "group flex flex-col items-start gap-2 rounded-lg border bg-card p-5 text-left transition-smooth hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ink-rule border-primary bg-primary/5",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-xl font-semibold">
                    {option.label}
                  </span>
                  <span
                    lang="ja"
                    className={cn(
                      "font-jp rounded-md px-2 py-0.5 text-sm",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {option.jp}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <CountPicker
        mode={mode}
        count={count}
        poolSize={poolSize}
        onCountChange={onCountChange}
      />

      <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Tối đa {count} câu ngẫu nhiên · 4 lựa chọn · giải thích ngay sau mỗi
          câu.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-md transition-smooth"
            data-ocid="kanji_quiz.reference.link"
          >
            <Link to="/kanji/tra-cuu">
              <BookOpen className="size-4" aria-hidden="true" />
              Tra cứu Kanji
            </Link>
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onStart}
            className="rounded-md transition-smooth"
            data-ocid="kanji_quiz.start.primary_button"
          >
            <Play className="size-4" aria-hidden="true" />
            Bắt đầu
          </Button>
        </div>
      </div>
    </div>
  );
}
