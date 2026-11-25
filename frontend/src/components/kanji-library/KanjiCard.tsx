import type { CompoundEntry, KanjiEntry } from "@/core/content/types";
import { ChevronDown } from "lucide-react";
import { memo, useState } from "react";

interface KanjiCardProps {
  entry: KanjiEntry;
  index: number;
  compounds: CompoundEntry[];
}

const COMPOUND_PREVIEW = 4;

function ReadingRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="w-9 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        lang="ja"
        className="font-jp-sans min-w-0 break-words text-foreground"
      >
        {values.length > 0 ? values.join("、") : "—"}
      </dd>
    </div>
  );
}

function KanjiCardBase({ entry, index, compounds }: KanjiCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? compounds : compounds.slice(0, COMPOUND_PREVIEW);
  const hidden = compounds.length - visible.length;

  return (
    <article
      data-ocid={`kanji_library.kanji.item.${index}`}
      className="hover-lift group flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-subtle"
    >
      <div className="flex gap-4">
        <div
          lang="ja"
          className="font-jp flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-5xl font-semibold text-foreground"
        >
          {entry.kanji}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-display text-lg font-semibold tracking-wide text-primary">
              {entry.hanViet}
            </p>
            <p className="break-words text-sm text-foreground">
              {entry.meaning}
            </p>
          </div>
          <dl className="space-y-1">
            <ReadingRow label="On" values={entry.onyomi} />
            <ReadingRow label="Kun" values={entry.kunyomi} />
          </dl>
          {entry.lessons.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Bài {entry.lessons.join(", ")}
            </p>
          )}
        </div>
      </div>

      {compounds.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Từ ghép ({compounds.length})
          </p>
          <ul className="space-y-1.5">
            {visible.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline gap-x-3 rounded-md bg-muted px-3 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span lang="ja" className="font-jp text-lg font-semibold">
                      {c.word}
                    </span>
                    <span
                      lang="ja"
                      className="font-jp-sans text-sm text-muted-foreground"
                    >
                      {c.reading}
                    </span>
                  </span>
                  <span className="block break-words text-xs">
                    <span className="font-semibold tracking-wide text-primary">
                      {c.hanViet}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {c.meaning}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {compounds.length > COMPOUND_PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-smooth hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
              data-ocid={`kanji_library.kanji.toggle.${index}`}
            >
              {expanded ? "Thu gọn" : `Xem thêm ${hidden} từ`}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export const KanjiCard = memo(KanjiCardBase);
