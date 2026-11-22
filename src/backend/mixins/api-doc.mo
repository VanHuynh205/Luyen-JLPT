mixin () {
  public query func getApiDoc() : async Text {
    "# JLPT N4 Study App — Backend API\n" #
    "\n" #
    "## Purpose\n" #
    "Stores per-account study progress for a JLPT N4 study app: vocabulary flashcard status (known / not known), kanji quiz results (single-kanji, compound-word and mixed quizzes), learned grammar patterns, and reading-comprehension results per passage. Study content itself (cards, kanji, grammar, passages) lives in the frontend; the backend only stores progress keyed by content IDs (Text) supplied by the client.\n" #
    "\n" #
    "## Authentication and identity\n" #
    "- Every progress method acts only on the caller's own data, keyed by the caller principal.\n" #
    "- Update methods (`setFlashcardStatus`, `recordKanjiQuiz`, `setGrammarLearned`, `recordReadingResult`) require a signed (non-anonymous) caller; anonymous callers trap with `Please sign in to save progress`.\n" #
    "- Query methods (`getMyFlashcardStatuses`, `getMyKanjiHistory`, `getMyLearnedGrammar`, `getMyReadingResults`, `getMyProgress`) return empty results for anonymous callers instead of trapping.\n" #
    "- No registration or role is required for progress methods; any signed-in principal can use them. The authorization component's methods (e.g. `_initialize_access_control`) exist but progress methods do not check roles.\n" #
    "- The app's frontend pins an Internet Identity derivation origin, published at `/.well-known/ii-derivation-origin` when available. An agent already holding the user's Internet Identity authorization derives the correct per-app principal against that origin (for example `icp identity link web <name> --app <host>`). A principal derived against a different origin is a different user and will see empty progress. Warning: such a delegation acts with the user's full authority in this app until it expires.\n" #
    "\n" #
    "## Methods\n" #
    "- `setFlashcardStatus(cardId : Text, known : Bool) -> ()` — upserts the caller's status for a card. Idempotent; safe to retry.\n" #
    "- `getMyFlashcardStatuses() -> [FlashcardStatus]` (query) — all cards the caller has marked, `{ cardId; known }`, ordered by cardId.\n" #
    "- `recordKanjiQuiz(mode : {#single; #compound; #mixed}, score : Nat, total : Nat, wrongItemIds : [Text]) -> KanjiQuizResult` — appends a new quiz result with a globally unique incrementing `id` and `takenAt = now`. NOT idempotent: each call (including retries) records another attempt.\n" #
    "- `getMyKanjiHistory() -> [KanjiQuizResult]` (query) — all of the caller's kanji quiz results, newest first.\n" #
    "- `setGrammarLearned(patternId : Text, learned : Bool) -> ()` — adds (`true`) or removes (`false`) the pattern ID from the caller's learned set. Idempotent.\n" #
    "- `getMyLearnedGrammar() -> [Text]` (query) — learned pattern IDs, sorted.\n" #
    "- `recordReadingResult(passageId : Text, score : Nat, total : Nat) -> ReadingResult` — per passage: increments `attempts`, sets `lastScore`, `total`, `lastAttemptAt`, and raises `bestScore` if exceeded. NOT idempotent: a retry counts as another attempt.\n" #
    "- `getMyReadingResults() -> [ReadingResult]` (query) — one entry per attempted passage, ordered by passageId.\n" #
    "- `getMyProgress() -> ProgressSummary` (query) — `knownFlashcardCount`, all `flashcards`, the 10 most recent kanji results (`recentKanjiResults`, newest first), `learnedGrammarIds`, and `readingResults`.\n" #
    "- `schema()` / `execute(json)` — OQL data queries. Tables `flashcard`, `kanjiResult`, `learnedGrammar`, `readingResult`; signed-in callers see only their own rows, controllers see all.\n" #
    "- `getApiDoc()` (query) — this document.\n" #
    "\n" #
    "## Units and encodings\n" #
    "- Timestamps (`takenAt`, `lastAttemptAt`) are `Int` nanoseconds since the Unix epoch (divide by 1,000,000 for JS milliseconds).\n" #
    "- `id`, `score`, `total`, `attempts` are `Nat` (bigint in JS bindings).\n" #
    "- Content IDs (`cardId`, `patternId`, `passageId`, `wrongItemIds`) are opaque frontend-defined Text; the backend does not validate that they exist.\n" #
    "- In OQL rows, `mode` is text (`single`/`compound`/`mixed`) and `wrongItemIds` is a comma-joined string.\n" #
    "\n" #
    "## Lifecycle and polling\n" #
    "Progress changes only when the user calls an update method; there are no background jobs. Re-read with a query after a mutation; no polling is needed.\n" #
    "\n" #
    "## Errors and gotchas\n" #
    "- `recordKanjiQuiz` and `recordReadingResult` trap with `Score cannot exceed total` when `score > total`; nothing is stored.\n" #
    "- Anonymous updates trap; anonymous queries silently return empty data — an empty result may mean the wrong (anonymous or differently-derived) identity.\n" #
    "- There is no delete or reset endpoint for progress; setting a card to `known = false` or grammar to `learned = false` is the only way to undo those.\n" #
    "- `total` stored in a reading result is the value from the latest attempt."
  };
};
