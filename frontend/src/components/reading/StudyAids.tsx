import type { ReadingPassage } from "@/core/content/types";
import { cn } from "@/lib/utils";
import { BookOpenText, ChevronDown, Languages } from "lucide-react";
import { type ReactNode, useState } from "react";

function ToggleSection({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card shadow-subtle">
      <button
        type="button"
        data-ocid={`reading_detail.${id}.toggle`}
        aria-expanded={open}
        aria-controls={`reading-${id}`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-5 py-3 text-left font-medium transition-smooth hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon}
        <span className="flex-1">
          {open ? "Ẩn" : "Hiện"} {label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={`reading-${id}`}
          data-ocid={`reading_detail.${id}.panel`}
          className="border-t px-5 py-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function StudyAids({ passage }: { passage: ReadingPassage }) {
  return (
    <div className="grid gap-3">
      <ToggleSection
        id="translation"
        label="Bản dịch"
        icon={<Languages className="size-4 text-primary" aria-hidden="true" />}
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {passage.translation}
        </p>
      </ToggleSection>
      <ToggleSection
        id="vocabulary"
        label="Từ vựng khó"
        icon={
          <BookOpenText className="size-4 text-primary" aria-hidden="true" />
        }
      >
        <ul className="divide-y">
          {passage.vocabulary.map((v, i) => (
            <li
              key={v.word}
              data-ocid={`reading_detail.vocabulary.item.${i + 1}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
            >
              <span lang="ja" className="font-jp text-lg text-foreground">
                {v.word}
              </span>
              <span
                lang="ja"
                className="font-jp-sans text-sm text-muted-foreground"
              >
                {v.reading}
              </span>
              <span className="ml-auto text-sm text-foreground">
                {v.meaning}
              </span>
            </li>
          ))}
        </ul>
      </ToggleSection>
    </div>
  );
}
