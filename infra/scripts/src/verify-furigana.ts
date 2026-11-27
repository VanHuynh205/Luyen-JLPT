const KANA_READING_RE = /^[\u3041-\u3096\u30a1-\u30faー・]+$/;
const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf々]/;
const KANJI_GLOBAL_RE = /[\u4e00-\u9fff\u3400-\u4dbf々]/g;

interface RubyScanResult {
  plain: string;
  outsideText: string;
  errors: string[];
}

function scanRubyText(rubyText: string): RubyScanResult {
  const errors: string[] = [];
  let plain = "";
  let outsideText = "";
  let i = 0;

  while (i < rubyText.length) {
    const ch = rubyText[i];
    if (ch === "}") {
      errors.push(`Unmatched '}' at index ${i}`);
      plain += ch;
      outsideText += ch;
      i += 1;
      continue;
    }

    if (ch === "{") {
      const nextOpen = rubyText.indexOf("{", i + 1);
      const closeIdx = rubyText.indexOf("}", i + 1);
      if (closeIdx === -1 || (nextOpen !== -1 && nextOpen < closeIdx)) {
        errors.push(`Unclosed or nested '{' at index ${i}`);
        const nextStep =
          nextOpen !== -1 && (closeIdx === -1 || nextOpen < closeIdx)
            ? nextOpen
            : rubyText.length;
        const chunk = rubyText.slice(i, nextStep);
        plain += chunk;
        outsideText += chunk;
        i = nextStep;
        continue;
      }

      const inner = rubyText.slice(i + 1, closeIdx);
      const parts = inner.split("|");
      if (parts.length === 1) {
        errors.push(`Missing '|' separator in '{${inner}}' at index ${i}`);
        plain += `{${inner}}`;
        outsideText += `{${inner}}`;
      } else if (parts.length > 2) {
        errors.push(`Multiple '|' separators in '{${inner}}' at index ${i}`);
        plain += `{${inner}}`;
        outsideText += `{${inner}}`;
      } else {
        const [base, reading] = parts;
        if (!base) {
          errors.push(`Empty ruby base in '{${inner}}' at index ${i}`);
        } else if (base.includes("\n") || base.includes("\r")) {
          errors.push(`Newline inside ruby base '{${inner}}' at index ${i}`);
        }
        if (!reading) {
          errors.push(`Empty ruby reading in '{${inner}}' at index ${i}`);
        } else if (!KANA_READING_RE.test(reading)) {
          errors.push(
            `Invalid non-kana reading '${reading}' for '${base}' at index ${i}`,
          );
        }
        if (base && reading) {
          plain += base;
        } else {
          plain += `{${inner}}`;
          outsideText += `{${inner}}`;
        }
      }
      i = closeIdx + 1;
      continue;
    }

    plain += ch;
    outsideText += ch;
    i += 1;
  }

  return { plain, outsideText, errors };
}

/** Strips `{base|reading}` ruby annotations back to plain text. */
export function stripRubyToPlain(rubyText: string): string {
  return scanRubyText(rubyText).plain;
}

/** Validates balanced `{base|reading}` syntax, kana-only readings, and 100% plain-text round-trip match. */
export function auditFuriganaString(plain: string, ruby: string): string[] {
  const { plain: stripped, errors } = scanRubyText(ruby);
  if (stripped !== plain) {
    errors.push(
      `Stripped ruby text does not match plain text (expected ${JSON.stringify(plain)}, got ${JSON.stringify(stripped)})`,
    );
  }
  return errors;
}

/** Returns true if the input contains CJK ideographs or iteration mark `々`. */
export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text);
}

/** Returns any Kanji characters left unannotated outside `{base|reading}` pairs. */
export function findUnannotatedKanji(rubyText: string): string[] {
  const { outsideText } = scanRubyText(rubyText);
  return outsideText.match(KANJI_GLOBAL_RE) ?? [];
}
