import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { SectionStat, StudySection } from "./sections";

export function SectionCard({
  section,
  level,
  index,
  stat,
}: {
  section: StudySection;
  level: string;
  index: number;
  stat: SectionStat | null;
}) {
  return (
    <Link
      to={section.to}
      data-ocid={`home.section.item.${index}`}
      className="group ink-rule relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-5 transition-smooth hover:-translate-y-0.5 hover:shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-6"
    >
      <span
        aria-hidden="true"
        className="font-jp pointer-events-none absolute -right-3 -top-6 select-none text-[7rem] leading-none text-foreground/[0.05] transition-smooth group-hover:text-primary/10"
      >
        {section.glyph}
      </span>
      <div className="relative flex items-center gap-3">
        <ruby className="font-jp text-3xl text-primary" lang="ja">
          {section.glyph}
          <rt>{section.reading}</rt>
        </ruby>
        <h3 className="text-2xl">{section.title}</h3>
      </div>
      <p className="relative mt-3 flex-1 text-sm text-muted-foreground">
        {section.description}
      </p>
      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        {stat ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium tabular-nums text-secondary-foreground">
            {stat.label}: {stat.value}
          </span>
        ) : (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            JLPT {level}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {section.cta}
          <ArrowUpRight
            className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
