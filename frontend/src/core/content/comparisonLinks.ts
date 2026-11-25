import type { GrammarComparison, GrammarPattern } from "./types";

export interface ComparisonPartLink {
  part: string;
  grammarIds: string[];
}

export interface ComparisonLinkReport {
  byComparisonId: Map<string, string[]>;
  partsByComparisonId: Map<string, ComparisonPartLink[]>;
  byGrammarId: Map<string, GrammarComparison[]>;
  unmatched: Array<{ comparisonId: string; group: string; part: string }>;
}

const BARE_SLOT =
  /^(?:[VNAL][₁₂₃]?[いな]?|V(?:辞書形|る|た|ない|意向形|使役|受身|khảnăng)|N[₁₂₃]?[はがをにの]|A[くに]|自動詞|他動詞)$/u;
const LEADING_CASE_FRAME =
  /^(?:N[₁₂₃]?(?:[はがをに]|から)(?:／(?:N[₁₂₃]?(?:[はがをに]|から)|から))*\s+)+/u;
const LEADING_SLOT = /^(?:Vる|Vない|V|Aい|Aな|A|N[₁₂₃]?[はがをに]|N[₁₂₃]?|L)/u;

interface ExtractedForm {
  core: string;
  hint: string;
}

interface IndexedGrammar {
  id: string;
  hint: string;
  tier1: Set<string>;
  tier2: Set<string>;
}

function normalizeText(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

function extractHint(raw: string): ExtractedForm {
  let core = raw.trim();
  let hint = "";

  // Extract trailing Vietnamese parenthesized note, ignoring Japanese parens like (それで).
  const parenMatch = /\s*\(([^)]*[a-zA-ZÀ-ỹ][^)]*)\)\s*$/u.exec(core);
  if (parenMatch) {
    hint = normalizeText(parenMatch[1]);
    core = core.slice(0, parenMatch.index).trim();
  } else {
    // Extract trailing lowercase Vietnamese descriptor after Japanese text (e.g. "～そうだ vẻ ngoài").
    const trailingMatch =
      /(?<=[\u3040-\u30ff\u4e00-\u9faf])\s+([a-zà-ỹ][a-zà-ỹ\s/,]*)$/u.exec(
        core,
      );
    if (trailingMatch) {
      hint = normalizeText(trailingMatch[1]);
      core = core.slice(0, trailingMatch.index).trim();
    }
  }

  return { core, hint };
}

function isBareSlot(token: string): boolean {
  const compact = token.replace(/\s+/g, "");
  return compact.length === 0 || BARE_SLOT.test(compact);
}

function expandAlternatives(text: string, sep: "／" | "・"): string[] {
  const cleaned = text.trim().replace(LEADING_CASE_FRAME, "");
  if (!cleaned.includes(sep)) return [cleaned];

  const parts = cleaned
    .split(sep)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return parts;

  const last = parts[parts.length - 1];
  const earlier = parts.slice(0, -1);

  // Distribute shared suffix after ＋ or whitespace (e.g. "Vた／Vない＋ほうがいい", "Aく／Aに／Nに なる").
  for (const delim of ["＋", " "]) {
    const idx = last.indexOf(delim);
    if (idx > 0 && earlier.every((item) => !item.includes(delim))) {
      const head = last.slice(0, idx).trim();
      const suffix = last.slice(idx + 1).trim();
      if (head && suffix) {
        return [...earlier, head].map((item) => `${item}${delim}${suffix}`);
      }
    }
  }

  // Handle compact comparison shorthand without ＋ (e.g. "Vる・ないつもり", "Vた・Nのあとで").
  if (sep === "・" && parts.length === 2 && /^(?:Vる|Vた)$/u.test(parts[0])) {
    const secondMatch = /^(V?ない|Nの)(.+)$/u.exec(parts[1]);
    if (secondMatch) {
      const [, secondHead, sharedSuffix] = secondMatch;
      const normalizedHead = secondHead === "ない" ? "Vない" : secondHead;
      return [`${parts[0]}${sharedSuffix}`, `${normalizedHead}${sharedSuffix}`];
    }
  }

  // Distribute shared prefix before ＋ to slotless trailing branches (e.g. "Vます-stem＋やすい／にくい").
  const first = parts[0];
  const plusIdx = first.indexOf("＋");
  if (plusIdx > 0 && parts.slice(1).every((item) => !item.includes("＋"))) {
    const prefix = first.slice(0, plusIdx).trim();
    const firstTail = first.slice(plusIdx + 1).trim();
    if (prefix && firstTail) {
      return [
        `${prefix}＋${firstTail}`,
        ...parts
          .slice(1)
          .map((item) => (/^[VNAL]/u.test(item) ? item : `${prefix}＋${item}`)),
      ];
    }
  }

  return parts;
}

function normalizeFormBase(raw: string): string {
  return raw
    .replace(/tự động từ/giu, "自動詞")
    .replace(/tha động từ/giu, "他動詞")
    .replace(/thể\s*て/giu, "て")
    .replace(/(?:lượng thời gian|số lượng|lượng từ|lượng)/giu, "L")
    .replace(/V\s*phủ định/giu, "Vない")
    .replace(/V(?:辞書形|\s*thể từ điển)/giu, "Vる")
    .replace(/V意向形/gu, "Vよう")
    .replace(/V使役て/gu, "Vさせて")
    .replace(/Vます-stem/gu, "V")
    .replace(/(?:V\s*)?thể thường/giu, "")
    .replace(/Thể điều kiện/giu, "")
    .replace(/[～〜…＋+「」\s]/gu, "")
    .replace(/かもしれません$/u, "かもしれない")
    .replace(/ています$/u, "ている")
    .replace(/と思います$/u, "と思う")
    .replace(/と思っています$/u, "と思っている")
    .replace(/見えます$/u, "見える")
    .replace(/聞こえます$/u, "聞こえる")
    .replace(/(.{2,})です$/u, "$1だ");
}

function emitKeys(form: string, target: Set<string>): void {
  const base = normalizeFormBase(form);
  if (isBareSlot(base)) return;

  const variants = [base];
  // Drop optional trailing copula only when the remaining stem is >= 3 chars
  // (keeps ようだ/そうだ/はずだ distinct from bare Vよう).
  if (base.endsWith("だ") && base.length >= 4) {
    variants.push(base.slice(0, -1));
  }
  // Normalize embedded V before ない (e.g. NしかVない -> しかない).
  const compactNeg = base.replace(/^([NL])しかVない$/u, "$1しかない");
  if (compactNeg !== base) variants.push(compactNeg);

  for (const variant of variants) {
    if (!isBareSlot(variant)) target.add(variant);
    const stripped = variant.replace(LEADING_SLOT, "");
    if (stripped !== variant && !isBareSlot(stripped) && stripped.length >= 3) {
      target.add(stripped);
      if (stripped.endsWith("だ") && stripped.length >= 4) {
        const stem = stripped.slice(0, -1);
        if (stem.length >= 3 && !isBareSlot(stem)) target.add(stem);
      }
    }
  }
}

function emitClauseAndInterrogative(text: string, target: Set<string>): void {
  emitKeys(text, target);
  const withoutInterrogative = text.replace(
    /(?:Từ nghi vấn|疑問詞)[＋+\s]*/giu,
    "",
  );
  if (withoutInterrogative !== text) emitKeys(withoutInterrogative, target);
}

function indexGrammarPattern(item: GrammarPattern): IndexedGrammar {
  const { core, hint } = extractHint(item.pattern);
  const tier1 = new Set<string>();
  const tier2 = new Set<string>();

  for (const branch of expandAlternatives(core, "／")) {
    // Clauses split on 、 go to tier2 so exact full-branch matches win over clause snippets.
    if (branch.includes("、")) {
      emitKeys(branch, tier1);
      for (const clause of branch.split("、")) {
        const trimmed = clause.trim();
        if (!trimmed || /^\(.*\)$/.test(trimmed)) continue;
        emitClauseAndInterrogative(trimmed, tier2);
      }
    } else {
      emitKeys(branch, tier1);
      const withoutInterrogative = branch.replace(
        /(?:Từ nghi vấn|疑問詞)[＋+\s]*/giu,
        "",
      );
      if (withoutInterrogative !== branch) {
        emitKeys(withoutInterrogative, tier2);
      }
    }

    // Trailing V₂ (e.g. Vて／Vないで＋V₂) is stripped only in tier2 so exact Vて wins over Vて＋V₂.
    if (/V₂$/u.test(branch.replace(/[＋+\s]/gu, ""))) {
      const withoutV2 = branch.replace(/[＋+\s]*V₂$/u, "");
      emitKeys(withoutV2, tier2);
    }
  }

  // Progressive-to-plain fallback in tier2 (e.g. ようにしている -> ようにする).
  for (const key of tier1) {
    if (key.endsWith("している") && key.length > 4) {
      tier2.add(`${key.slice(0, -4)}する`);
    }
  }

  return { id: item.id, hint, tier1, tier2 };
}

function splitComparisonParts(patterns: string): string[] {
  const slashParts = patterns
    .split("／")
    .map((part) => part.trim())
    .filter(Boolean);
  if (slashParts.length !== 1 || !slashParts[0].includes("・")) {
    return slashParts;
  }

  const single = slashParts[0];
  const expanded = expandAlternatives(single, "・");
  // Keep compact slot-alternation patterns together (e.g. "Vる・ないつもり", "Aく・Aに・Nに なる").
  const rawDotParts = single
    .split("・")
    .map((part) => part.trim())
    .filter(Boolean);
  const isStandaloneList =
    expanded.length === rawDotParts.length &&
    rawDotParts.every((part, index) => part === expanded[index]) &&
    rawDotParts.every((part) => !isBareSlot(normalizeFormBase(part)));

  return isStandaloneList ? rawDotParts : slashParts;
}

function disambiguateByHint(
  candidates: IndexedGrammar[],
  hint: string,
): IndexedGrammar[] {
  if (!hint || candidates.length <= 1) return candidates;
  const matched = candidates.filter(
    (entry) =>
      entry.hint.length > 0 &&
      (entry.hint.includes(hint) || hint.includes(entry.hint)),
  );
  return matched.length > 0 ? matched : candidates;
}

function lookupFormGroups(
  formKeyGroups: readonly Set<string>[],
  hint: string,
  indexed: readonly IndexedGrammar[],
): string[] {
  if (formKeyGroups.length === 0) return [];

  for (const tier of ["tier1", "tier2"] as const) {
    let bestScore = 0;
    let best: IndexedGrammar[] = [];
    for (const entry of indexed) {
      let score = 0;
      for (const group of formKeyGroups) {
        for (const key of group) {
          if (entry[tier].has(key)) {
            score++;
            break;
          }
        }
      }
      if (score === 0) continue;
      if (score > bestScore) {
        bestScore = score;
        best = [entry];
      } else if (score === bestScore) {
        best.push(entry);
      }
    }
    if (best.length > 0) {
      return disambiguateByHint(best, hint).map((entry) => entry.id);
    }
  }

  return [];
}

function keysForForms(forms: readonly string[]): Set<string>[] {
  const groups: Set<string>[] = [];
  for (const form of forms) {
    const keys = new Set<string>();
    emitKeys(form, keys);
    if (keys.size > 0) groups.push(keys);
  }
  return groups;
}

function matchSingleForm(
  rawPart: string,
  indexed: readonly IndexedGrammar[],
): string[] {
  const { core, hint } = extractHint(rawPart);
  const forms = core.includes("・") ? expandAlternatives(core, "・") : [core];

  // If expanding ・ produced a shared-suffix/prefix group (differing from raw split),
  // match as one unit; otherwise fall back to individual ・ sub-parts below.
  const rawDotParts = core
    .split("・")
    .map((item) => item.trim())
    .filter(Boolean);
  const isUnexpandedDotList =
    core.includes("・") &&
    forms.length === rawDotParts.length &&
    forms.every((item, index) => item === rawDotParts[index]);

  if (!isUnexpandedDotList) {
    const direct = lookupFormGroups(keysForForms(forms), hint, indexed);
    if (direct.length > 0) return direct;

    // Secondary relaxation: 自動詞/他動詞 -> V when the specific verb-class form had no direct match.
    const relaxedForms = forms
      .map((form) => form.replace(/(?:自動詞|他動詞)/gu, "V"))
      .filter((generic, index) => generic !== forms[index]);
    if (relaxedForms.length > 0) {
      const relaxedIds = lookupFormGroups(
        keysForForms(relaxedForms),
        hint,
        indexed,
      );
      if (relaxedIds.length > 0) return relaxedIds;
    }
    return [];
  }

  // Match each independent ・ sub-part (e.g. "～たらいいですか・～ばいいですか", "Vて・Aくて・Nで").
  const combined: string[] = [];
  const seen = new Set<string>();
  for (const subPart of rawDotParts) {
    for (const id of lookupFormGroups(keysForForms([subPart]), hint, indexed)) {
      if (!seen.has(id)) {
        seen.add(id);
        combined.push(id);
      }
    }
  }
  return combined;
}

export function buildComparisonLinks(
  comparisons: readonly GrammarComparison[],
  grammar: readonly GrammarPattern[],
): ComparisonLinkReport {
  const indexed = grammar.map(indexGrammarPattern);
  const byComparisonId = new Map<string, string[]>();
  const partsByComparisonId = new Map<string, ComparisonPartLink[]>();
  const byGrammarId = new Map<string, GrammarComparison[]>();
  const unmatched: Array<{
    comparisonId: string;
    group: string;
    part: string;
  }> = [];

  for (const comparison of comparisons) {
    const parts = splitComparisonParts(comparison.patterns);
    const partLinks: ComparisonPartLink[] = [];
    const comparisonGrammarIds: string[] = [];
    const seenIds = new Set<string>();

    for (const part of parts) {
      const grammarIds = matchSingleForm(part, indexed);
      partLinks.push({ part, grammarIds });
      if (grammarIds.length === 0) {
        unmatched.push({
          comparisonId: comparison.id,
          group: comparison.group,
          part,
        });
      }
      for (const grammarId of grammarIds) {
        if (!seenIds.has(grammarId)) {
          seenIds.add(grammarId);
          comparisonGrammarIds.push(grammarId);
          const list = byGrammarId.get(grammarId);
          if (list) list.push(comparison);
          else byGrammarId.set(grammarId, [comparison]);
        }
      }
    }

    byComparisonId.set(comparison.id, comparisonGrammarIds);
    partsByComparisonId.set(comparison.id, partLinks);
  }

  return { byComparisonId, partsByComparisonId, byGrammarId, unmatched };
}

export function splitComparisonExamples(
  exampleJa: string,
  exampleVi: string,
): Array<{ ja: string; vi: string }> {
  const jaTrimmed = exampleJa.trim();
  const viTrimmed = exampleVi.trim();
  if (!jaTrimmed && !viTrimmed) return [];

  const jaSlash = jaTrimmed
    .split("／")
    .map((part) => part.trim())
    .filter(Boolean);
  const viSlash = viTrimmed
    .split("／")
    .map((part) => part.trim())
    .filter(Boolean);
  if (jaSlash.length >= 2 && jaSlash.length === viSlash.length) {
    return jaSlash.map((ja, index) => ({ ja, vi: viSlash[index] }));
  }

  const jaSentences = jaTrimmed
    .split(/(?<=[。！？])/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const viSentences = viTrimmed
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (jaSentences.length >= 2 && jaSentences.length === viSentences.length) {
    return jaSentences.map((ja, index) => ({ ja, vi: viSentences[index] }));
  }

  return [{ ja: jaTrimmed, vi: viTrimmed }];
}

export function splitComparisonDistinctions(
  patterns: string,
  distinction: string,
): Array<{ pattern: string; detail: string }> | null {
  const details = distinction
    .split(/[;；]/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (details.length < 2) return null;

  const slashPatterns = patterns
    .split("／")
    .map((part) => part.trim())
    .filter(Boolean);
  if (slashPatterns.length === details.length) {
    return slashPatterns.map((pattern, index) => ({
      pattern,
      detail: details[index],
    }));
  }

  if (slashPatterns.length === 1 && slashPatterns[0].includes("・")) {
    const dotPatterns = slashPatterns[0]
      .split("・")
      .map((part) => part.trim())
      .filter(Boolean);
    if (dotPatterns.length === details.length) {
      return dotPatterns.map((pattern, index) => ({
        pattern,
        detail: details[index],
      }));
    }
  }

  return null;
}
