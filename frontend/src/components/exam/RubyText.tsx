import { parseRubyText } from "@/core/exam/ruby";
import { cn } from "@/lib/utils";
import { Fragment } from "react";

const UNDERLINE_CLASS =
  "underline decoration-primary/70 decoration-2 underline-offset-4";

export interface RubyTextProps {
  text: string;
  className?: string;
  font?: "sans" | "serif";
  as?: "span" | "p" | "div";
}

export function RubyText({
  text,
  className,
  font = "sans",
  as: Tag = "span",
}: RubyTextProps) {
  const segments = parseRubyText(text);
  let offset = 0;

  return (
    <Tag
      lang="ja"
      className={cn(font === "serif" ? "font-jp" : "font-jp-sans", className)}
    >
      {segments.map((segment) => {
        const key = `${offset}-${segment.kind}`;
        offset +=
          segment.kind === "text"
            ? segment.text.length
            : segment.base.length + segment.reading.length + 3;

        if (segment.kind === "ruby") {
          return (
            <ruby
              key={key}
              className={segment.underline ? UNDERLINE_CLASS : undefined}
            >
              {segment.base}
              <rt>{segment.reading}</rt>
            </ruby>
          );
        }

        if (segment.underline) {
          return (
            <span key={key} className={UNDERLINE_CLASS}>
              {segment.text}
            </span>
          );
        }

        return <Fragment key={key}>{segment.text}</Fragment>;
      })}
    </Tag>
  );
}
