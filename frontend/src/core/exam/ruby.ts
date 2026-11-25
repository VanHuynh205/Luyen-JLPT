export type RubySegment =
  | { kind: "text"; text: string; underline?: boolean }
  | { kind: "ruby"; base: string; reading: string; underline?: boolean };

function pushText(
  segments: RubySegment[],
  text: string,
  underline: boolean,
): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === "text" && Boolean(last.underline) === underline) {
    last.text += text;
    return;
  }
  segments.push(
    underline
      ? { kind: "text", text, underline: true }
      : { kind: "text", text },
  );
}

function parseInto(
  input: string,
  underline: boolean,
  segments: RubySegment[],
): void {
  let i = 0;
  while (i < input.length) {
    if (!underline && input.startsWith("[[", i)) {
      const closeIdx = input.indexOf("]]", i + 2);
      const nextOpen = input.indexOf("[[", i + 2);
      if (closeIdx !== -1 && (nextOpen === -1 || nextOpen > closeIdx)) {
        parseInto(input.slice(i + 2, closeIdx), true, segments);
        i = closeIdx + 2;
        continue;
      }
      pushText(segments, "[[", underline);
      i += 2;
      continue;
    }

    if (input[i] === "{") {
      const closeIdx = input.indexOf("}", i + 1);
      if (closeIdx !== -1) {
        const inner = input.slice(i + 1, closeIdx);
        const pipeIdx = inner.indexOf("|");
        if (
          pipeIdx > 0 &&
          pipeIdx < inner.length - 1 &&
          inner.indexOf("|", pipeIdx + 1) === -1 &&
          !inner.includes("{") &&
          !inner.includes("[[") &&
          !inner.includes("]]")
        ) {
          const base = inner.slice(0, pipeIdx);
          const reading = inner.slice(pipeIdx + 1);
          segments.push(
            underline
              ? { kind: "ruby", base, reading, underline: true }
              : { kind: "ruby", base, reading },
          );
          i = closeIdx + 1;
          continue;
        }
      }
      pushText(segments, "{", underline);
      i += 1;
      continue;
    }

    const nextBrace = input.indexOf("{", i);
    const nextUnderline = underline ? -1 : input.indexOf("[[", i);
    let end = input.length;
    if (nextBrace !== -1 && nextBrace < end) end = nextBrace;
    if (nextUnderline !== -1 && nextUnderline < end) end = nextUnderline;
    if (end === i) end = i + 1;
    pushText(segments, input.slice(i, end), underline);
    i = end;
  }
}

export function parseRubyText(input: string): RubySegment[] {
  if (!input) return [];
  const segments: RubySegment[] = [];
  parseInto(input, false, segments);
  return segments;
}
