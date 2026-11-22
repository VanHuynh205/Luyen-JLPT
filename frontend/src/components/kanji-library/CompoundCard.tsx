import type { CompoundEntry } from "@/core/content/types";
import { memo } from "react";

interface CompoundCardProps {
  entry: CompoundEntry;
  index: number;
}

function CompoundCardBase({ entry, index }: CompoundCardProps) {
  return (
    <article
      data-ocid={`kanji_library.compound.item.${index}`}
      className="ink-rule flex flex-col rounded-lg border border-border bg-card p-5 transition-smooth hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p
          lang="ja"
          className="font-jp text-4xl font-semibold leading-tight text-foreground"
        >
          {entry.word}
        </p>
        <p
          lang="ja"
          className="font-jp-sans pb-1 text-base text-muted-foreground"
        >
          {entry.reading}
        </p>
      </div>
      <p className="mt-2 font-display text-lg font-semibold tracking-wide text-primary">
        {entry.hanViet}
      </p>
      <p className="text-sm text-foreground break-words">{entry.meaning}</p>
      {entry.lessons.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Bài {entry.lessons.join(", ")}
        </p>
      )}

      {entry.components.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Phân tích từng chữ
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {entry.components.map((part) => (
              <li
                key={part.kanji}
                className="flex items-center gap-3 rounded-md bg-muted px-3 py-2"
              >
                <span lang="ja" className="font-jp text-2xl font-semibold">
                  {part.kanji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-primary">
                    {part.hanViet || "—"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {part.meaning || "Chưa có nghĩa"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export const CompoundCard = memo(CompoundCardBase);
