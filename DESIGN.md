# Design Brief

## Direction

Washi & Sumi — a calm scholarly study desk: ivory washi paper, sumi-ink text, ai-zome indigo actions, a vermilion hanko seal.

## Tone

Refined editorial minimalism with Japanese stationery cues, so learners focus on kanji and sentences, not chrome.

## Differentiation

Japanese text is the hero: large Mincho kanji with crisp furigana, Hán Việt shown as small-caps labels, results "stamped" with a vermilion seal.

## Color Palette

| Token       | OKLCH            | Role                                         |
| ----------- | ---------------- | -------------------------------------------- |
| background  | 0.975 0.008 85   | Washi ivory page                             |
| foreground  | 0.2 0.015 265    | Sumi ink text                                |
| card        | 0.995 0.003 85   | Paper cards, header                          |
| primary     | 0.38 0.11 262    | Indigo CTAs, active nav, progress bars       |
| accent      | 0.58 0.19 33     | Vermilion hanko: N4 seal, scores, highlights |
| success     | 0.55 0.12 145    | Matcha: correct answer, "đã thuộc"           |
| destructive | 0.53 0.2 25      | Wrong answer, "chưa thuộc"                   |
| muted       | 0.945 0.012 80   | Alternate bands, footer, chips               |

## Typography

- Display: Fraunces — headings, Vietnamese titles, score numbers
- Body: Plus Jakarta Sans — UI, explanations, Vietnamese meanings
- Japanese: system Mincho via `.font-jp` (showcase kanji/words), system Gothic via `.font-jp-sans` or `lang="ja"` (sentences, examples, passages)
- Scale: hero `text-4xl md:text-6xl font-bold`, h2 `text-2xl md:text-3xl font-semibold`, label `text-xs font-semibold tracking-widest uppercase`, body `text-base`; kanji hero `.text-kanji-hero`
- Furigana: use `<ruby>…<rt>…</rt></ruby>`; rt styled globally (0.5em, muted)

## Elevation & Depth

Flat paper layers separated by hairline borders; `shadow-card` for study cards, `shadow-elevated` only for the active flashcard/quiz card.

## Structural Zones

| Zone    | Background                 | Border   | Notes                                              |
| ------- | -------------------------- | -------- | -------------------------------------------------- |
| Header  | bg-card, shadow-subtle     | border-b | Logo with `.hanko` "N4" seal, nav, sign-in button  |
| Content | bg-background / bg-paper   | —        | Alternate sections with bg-muted/40 bands          |
| Footer  | bg-muted/50                | border-t | Small muted text, JLPT N4 note                     |

## Spacing & Rhythm

Sections py-12 md:py-16, card padding p-5 md:p-6, gap-4/6 grids; Japanese text gets line-height 1.8 and extra breathing room.

## Component Patterns

- Buttons: primary indigo rounded-md; secondary indigo-tinted; accent vermilion only for key result/score moments
- Cards: rounded-xl bg-card border shadow-card; section cards use `.ink-rule` indigo left rule
- Badges: rounded-full muted chips for word type / Hán Việt; `.hanko` square seal for N4 & scores
- Quiz options: bordered rows; correct → success border/bg-success/10, wrong → destructive + animate-shake
- Flashcard: 3D flip with `.perspective-1000 .preserve-3d .backface-hidden .rotate-y-180`

## Motion

- Entrance: `animate-fade-up` staggered 60ms on cards
- Hover: `transition-smooth`, slight border-primary/40 and shadow lift
- Decorative: `animate-stamp-in` for score seal; flashcard flip 0.5s

## Constraints

- Never render Japanese in Fraunces — always `.font-jp`, `.font-jp-sans`, or `lang="ja"`
- Vermilion is a seal, not a fill: max one accent element per view
- No gradients beyond the subtle `bg-paper`; no glow shadows
- All UI copy in Vietnamese

## Signature Detail

The vermilion hanko seal (rotated -4°) that marks the N4 logo and "stamps" quiz scores — stationery-inspired craft detail.
