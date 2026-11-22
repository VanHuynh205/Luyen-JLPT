import type { ReactNode } from "react";

export function DetailSection({
  id,
  label,
  jpLabel,
  children,
}: {
  id: string;
  label: string;
  jpLabel: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-ocid={`grammar_detail.${id.replace(/-/g, "_")}.section`}
      className="scroll-mt-24"
    >
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id={`${id}-title`} className="text-xl font-semibold md:text-2xl">
          {label}
        </h2>
        <span lang="ja" className="font-jp text-sm text-muted-foreground">
          {jpLabel}
        </span>
      </div>
      {children}
    </section>
  );
}
