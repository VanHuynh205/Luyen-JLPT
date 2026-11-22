# Nội dung theo Cấp độ (epic-goi-noi-dung) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nội dung học được nạp từ Gói nội dung JSON có phiên bản theo Cấp độ (N4 đủ 9 bảng), người học chọn Cấp độ, mọi route hiện có vẫn chạy, CI kiểm Gói so với dataset.

**Architecture:** Lõi `core/content` định nghĩa kiểu Gói và hàm kiểm schema. Script trong `infra/scripts` đóng băng dữ liệu N4 đã biên soạn (5 bảng đang có trong `src/frontend/src/data`) thành JSON, nhập 4 bảng mới từ `jsonl`, rồi đóng gói kèm `manifest.json` (số lượng + sha256). Frontend đọc Gói qua adapter `content-pack` (file tĩnh `/packs/...` + cache Dexie) và `ContentProvider`; trang không import `@/data/*` nữa.

**Tech Stack:** TypeScript 7, React 19.1, Vite 8, Vitest 5.1.1, fake-indexeddb, Dexie 4.4.7, tsx (chạy script), Playwright 1.65.1, GitHub Actions.

**Spec:** `docs/initiative-jlpt-da-nen-tang/tickets/epic-goi-noi-dung/epic-goi-noi-dung.md`, initiative R1–R4, R14; kiến trúc `docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md` AD-3, AD-4, AD-5, AD-6, AD-12.

**Quyết định của plan:** epic này làm việc trong `src/frontend` (gốc frontend hiện tại). Việc chuyển `src/frontend` → `frontend/` và `src/backend` → `backend/icp-legacy/` (AD-1) là task đầu của plan epic-tai-khoan-dong-bo, vì nó cắt đứt deploy Caffeine và phải đi cùng việc chuyển host web.

## Global Constraints

- Giao diện tiếng Việt; chữ Nhật có `lang="ja"`.
- Mã Mục N4 giữ nguyên: `vocab-TV-<bai>-<nn>`, `kanji-K-XXXX`, `compound-KCxxx`, `grammar-Gxxx`, mã bài đọc hiện có (AD-5).
- Số lượng Gói N4: vocabulary 1182, kanji 118, grammar 148, comparisons 27, conjugations 22, keigo 17, verbPairs 12; compounds 388 bản ghi phủ đủ 403 dòng `tu_ghep_kanji` (mỗi cặp (compound, kanji_id) của dataset có compound cùng `word` chứa `kanji-<kanji_id>` trong `kanjiIds`).
- Route không đổi: `/`, `/tu-vung`, `/kanji`, `/kanji/tra-cuu`, `/ngu-phap`, `/ngu-phap/$patternId`, `/doc-hieu`, `/doc-hieu/$passageId`, `/tien-do`.
- Chỉ `src/frontend/src/adapters/` được import `dexie` (AD-2, AD-6).
- `Level = "n5" | "n4" | "n3" | "n2" | "n1"`; mặc định `"n4"`.
- Chuỗi Nhật trong dataset giữ nguyên từng ký tự (không chuẩn hoá `～`/`〜`, `／`).

## Review Focus

1. Gói trong IndexedDB hỏng hoặc thiếu file (app bị tắt khi đang tải) → app dùng Gói đóng kèm, không màn lỗi. Test ở Task 5.
2. Không có mạng hoặc `index.json` từ xa trả 404/HTML → dùng Gói đã có, không thông báo lỗi chặn. Test ở Task 5.
3. Tiến độ chứa mã Mục không còn trong Gói → trang Tiến độ bỏ qua mã đó, phần trăm không vượt 100%. Test ở Task 6.
4. Cấp độ đã lưu không còn trong danh sách Gói (ví dụ `"n3"` sau khi tắt cờ thử nghiệm) → quay về `"n4"`. Test ở Task 6.
5. Chuỗi Nhật toàn chiều rộng trong 4 bảng mới bị đổi khi nhập → test so đúng chuỗi `"～んですか／～ですか・ますか"` của `SS001`. Test ở Task 3.

---

### Task 1: Test harness và test cho logic sẵn có

**Files:**
- Modify: `src/frontend/package.json` (thêm `vitest@5.1.1`, `fake-indexeddb`, script `"test": "vitest run"`)
- Create: `src/frontend/vitest.config.ts` (môi trường `node`, alias `@` → `src`)
- Test: `src/frontend/src/components/kanji-quiz/quizEngine.test.ts`, `src/frontend/src/components/kanji-library/search.test.ts`

**Interfaces:**
- Produces: lệnh `pnpm --filter @caffeine/template-frontend test`; root `package.json` thêm `"test": "pnpm -r --if-present run test"`.

- [x] **Step 1: Viết test**

```ts
// quizEngine.test.ts
it.each([KanjiQuizMode.single, KanjiQuizMode.compound, KanjiQuizMode.mixed])(
  "generateQuiz(%s) trả 10 câu, 4 đáp án khác nhau, correctIndex đúng", (mode) => {
    for (let run = 0; run < 50; run++) {
      const qs = generateQuiz(mode);
      expect(qs).toHaveLength(10);
      for (const q of qs) {
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices[q.correctIndex]).toBeDefined();
        if (q.choicesAreJapanese) expect(q.choices.some((c) => /[.\-－]/.test(c))).toBe(false);
      }
    }
  });
// search.test.ts
expect(normalize("Học")).toBe("hoc");
expect(normalize("ĐỘNG")).toBe("dong");
expect(normalize("カ")).toBe("か");
expect(normalize("が")).toBe("が");
expect(filterKanji(kanjiList, "ac").map((k) => k.kanji)).toContain("悪");
```

- [x] **Step 2: Chạy** `pnpm --filter @caffeine/template-frontend test` — Expected: PASS (test bao hành vi đang đúng; nếu FAIL là lỗi thật, sửa trước khi đi tiếp).
- [x] **Step 3: Chạy** `pnpm typecheck && pnpm check` — Expected: không lỗi.
- [ ] **Step 4: Commit** `test: add vitest harness and quiz/search tests`

Đã kiểm chứng 8 test bằng cả lệnh frontend và `pnpm test` trên Node 26.2.0. Vitest 5.1.1 yêu cầu Node `^22.12.0 || ^24.0.0 || >=26.0.0`; workspace khai báo dải này và frontend dùng `@types/node` dòng 22. Không tạo commit trong lượt này.

### Task 2: Kiểu Gói nội dung và hàm kiểm schema (lõi)

**Files:**
- Create: `src/frontend/src/core/result.ts`, `src/frontend/src/core/content/types.ts`, `src/frontend/src/core/content/validate.ts`
- Modify: `src/frontend/src/data/{vocabulary,kanji,grammar,reading}.ts` — bỏ khai báo interface, `export type { … } from "@/core/content/types"` để code cũ không gãy
- Test: `src/frontend/src/core/content/validate.test.ts`

**Interfaces:**
- Produces:
  - `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
  - `type Level = "n5" | "n4" | "n3" | "n2" | "n1"`; `const LEVELS: readonly Level[]` theo thứ tự `n5, n4, n3, n2, n1`
  - `type PackTable = "vocabulary" | "kanji" | "compounds" | "grammar" | "comparisons" | "conjugations" | "keigo" | "verbPairs" | "reading"`
  - `interface PackManifest { level: Level; version: string; counts: Record<PackTable, number>; sha256: Record<PackTable, string> }`
  - `interface ContentPack { manifest: PackManifest; vocabulary: VocabWord[]; kanji: KanjiEntry[]; compounds: CompoundEntry[]; grammar: GrammarPattern[]; comparisons: GrammarComparison[]; conjugations: ConjugationRule[]; keigo: KeigoEntry[]; verbPairs: VerbPair[]; reading: ReadingPassage[] }`
  - `VocabWord, KanjiEntry, CompoundEntry, CompoundComponent, GrammarPattern, GrammarExample, GrammarQuizQuestion, GrammarConnections, ReadingPassage, ReadingQuestion, ReadingVocab` — chuyển nguyên văn từ `data/*.ts`
  - `interface GrammarComparison { id: string; group: string; patterns: string; distinction: string; whenToUse: string; exampleJa: string; exampleVi: string }`
  - `interface ConjugationRule { id: string; name: string; labelJa: string; recognition: string; group1: string; group2: string; group3: string; examplesG1: string; examplesG2: string; examplesG3: string; adjI: string; adjNa: string; noun: string; exceptions: string }`
  - `interface KeigoEntry { id: string; plainJa: string; plainKana: string; sonkeigo: string; sonkeigoMasu: string; kenjogoI: string; kenjogoII: string; teineigo: string; recognition: string; exampleJa: string; exampleVi: string }`
  - `interface VerbPair { id: string; transitiveJa: string; transitiveKana: string; intransitiveJa: string; intransitiveKana: string; meaning: string }`
  - `type PackError = { code: "schema" | "count-mismatch" | "duplicate-id"; detail: string }`
  - `function validatePack(raw: unknown): Result<ContentPack, PackError>` — mỗi bảng là mảng, mỗi phần tử có `id` chuỗi 1–128 ký tự, không trùng `id` trong toàn Gói, độ dài mỗi bảng bằng `manifest.counts`.

- [x] **Step 1: Viết test** — `validatePack(fixture)` hợp lệ trả `ok: true`; bốn ca lỗi: `counts.kanji` sai → `code: "count-mismatch"`; hai mục cùng `id` → `"duplicate-id"`; `vocabulary` không phải mảng → `"schema"`; `id` dài 129 ký tự → `"schema"`. Fixture tối thiểu 1 mục mỗi bảng trong `src/frontend/src/core/content/__fixtures__/mini-pack.ts`.
- [x] **Step 2: Chạy test** — RED: `Cannot find module './validate'`.
- [x] **Step 3: Viết** `types.ts`, `result.ts`, `validate.ts` (kiểm tay, không thêm thư viện schema).
- [x] **Step 4: Chạy** `pnpm test` (55 test đạt), `pnpm typecheck` và `pnpm check` (đều đạt).
- [ ] **Step 5: Commit** `feat(core): content pack types and validation`

Các module dữ liệu cũ giữ nguyên giá trị runtime và các đường dẫn import kiểu. `validatePack` kiểm cấu trúc dữ liệu đã giải mã và định dạng SHA-256; kiểm hash theo byte và giới hạn tải thuộc bước đóng gói và adapter. Không tạo commit trong lượt này.

### Task 3: Đóng băng N4 và nhập 4 bảng mới vào `infra/content/n4`

**Files:**
- Create: `infra/scripts/package.json` (workspace `@luyen/infra-scripts`, deps `tsx`, `vitest@5.1.1`), thêm `infra/scripts` vào `pnpm-workspace.yaml`
- Create: `infra/scripts/src/export-n4-legacy.ts`, `infra/scripts/src/import-dataset.ts`
- Create (output, commit vào repo): `infra/content/n4/{vocabulary,kanji,compounds,grammar,reading,comparisons,conjugations,keigo,verb-pairs}.json`
- Test: `infra/scripts/src/import-dataset.test.ts`

**Interfaces:**
- Consumes: kiểu từ Task 2 (import tương đối `../../../src/frontend/src/core/content/types`).
- Produces:
  - `exportN4Legacy(outDir: string): void` — import `vocabulary`, `kanjiList`, `compoundList`, `grammarPatterns`, `readingPassages` từ `src/frontend/src/data/*` và ghi JSON (UTF-8, `JSON.stringify(x, null, 1)`).
  - `importDatasetTables(jsonlDir: string, outDir: string, idPrefix: string): void` — ánh xạ: `so_sanh` → `comparisons.json` (`group, patterns, distinction_vi→distinction, when_to_use_vi→whenToUse, example_ja→exampleJa, example_vi→exampleVi`); `cach_chia` → `conjugations.json` (`ten_vi→name, label_ja→labelJa, recognition_vi→recognition, v_group_1..3→group1..3, examples_g1..3→examplesG1..3, a_i→adjI, a_na→adjNa, n→noun, exceptions_vi→exceptions`); `kinh_ngu` → `keigo.json` (`plain_hiragana→plainKana, kenjogo_i→kenjogoI, kenjogo_ii→kenjogoII, recognition_vi→recognition`, còn lại camelCase); `tu_dong_tha_dong` → `verb-pairs.json` (`tadong_ja→transitiveJa, tadong_hiragana→transitiveKana, tudong_ja→intransitiveJa, tudong_hiragana→intransitiveKana, meaning_vi→meaning`). `id` mới: `comparison-SS001`, `conjugation-C001`, `keigo-KG001`, `verbpair-TD001`. Bỏ `image_ids`, `reference_ids`, `origin`. Giá trị `null` → `""`.
  - Lệnh `pnpm --filter @luyen/infra-scripts content:n4` chạy cả hai.
  - `importDatasetTables` nhận đường dẫn thư mục bất kỳ có cùng tên file `jsonl` như dataset N4, để dataset N3 chủ dự án soạn sau dùng lại được; tiền tố mã theo AD-5 truyền qua tham số `idPrefix: string` (`""` cho N4, `"n3-"` cho N3).

- [x] **Step 1: Viết test** cho `importDatasetTables` với thư mục tạm:

```ts
const c = read("comparisons.json"); expect(c).toHaveLength(27);
expect(c[0]).toMatchObject({ id: "comparison-SS001", patterns: "～んですか／～ですか・ますか" });
expect(read("conjugations.json")).toHaveLength(22);
expect(read("keigo.json")).toHaveLength(17);
expect(read("verb-pairs.json")[0]).toMatchObject({ id: "verbpair-TD001", transitiveJa: "電気をつける", intransitiveJa: "電気がつく" });
```

- [x] **Step 2: Chạy** `pnpm --filter @luyen/infra-scripts test` — Expected: FAIL.
- [x] **Step 3: Viết** hai hàm và lệnh `content:n4`; chạy lệnh để sinh 9 file trong `infra/content/n4/`.
- [x] **Step 4: Chạy** test — Expected: PASS. Kiểm `infra/content/n4/vocabulary.json` có 1182 phần tử.
- [ ] **Step 5: Commit** `feat(infra): freeze N4 content and import comparison/conjugation/keigo/verb-pair tables`

Kiểm chứng Task 3: 5 bảng cũ khớp dữ liệu frontend; 78 dòng của 4 bảng mới khớp JSONL. Sinh lại 9 tệp cho cùng SHA-256. `pnpm test` đạt 109/109 (54 infra, 55 frontend); `pnpm typecheck` và `pnpm check` đều đạt. Chưa tạo commit.

### Task 4: Đóng gói và kiểm Gói (CI)

**Files:**
- Create: `infra/scripts/src/build-packs.ts`, `infra/scripts/src/verify-packs.ts`
- Create: `infra/content/n3-sample/*.json` (2–3 mục mỗi bảng, mã `n3-…`, chỉ để thử Cấp độ thứ hai)
- Modify: `.gitignore` thêm `infra/packs/`, `src/frontend/public/packs/`
- Test: `infra/scripts/src/build-packs.test.ts`, `infra/scripts/src/verify-packs.test.ts`

**Interfaces:**
- Consumes: `validatePack`, `PackManifest` (Task 2); `infra/content/<level>/` (Task 3).
- Produces:
  - `buildPack(level: Level, contentDir: string, outDir: string, version: string): PackManifest` — ghi `outDir/<level>/<version>/{manifest.json, <table>.json}`; tên file bảng: `verbPairs` → `verb-pairs.json`; sha256 hex của đúng bytes đã ghi; gọi `validatePack` trước khi trả, lỗi thì throw.
  - `writeIndex(outDir: string, entries: { level: Level; version: string }[]): void` — ghi `outDir/index.json` dạng `{ "levels": [{ "level": "n4", "version": "1.0.0", "path": "n4/1.0.0" }] }`.
  - `verifyN4AgainstDataset(packDir: string, datasetDir: string): string[]` — trả danh sách lỗi theo Global Constraints (số lượng + phủ 403 dòng từ ghép).
  - `removedIds(prevPackDir: string, nextPackDir: string): string[]`
  - Lệnh: `packs:build` (N4 version đọc từ `infra/content/n4/VERSION`, bắt đầu `1.0.0`; thêm `n3-sample` khi `EXPERIMENTAL_LEVELS=1`; copy kết quả sang `src/frontend/public/packs/`), `packs:verify` (exit 1 nếu có lỗi).

- [x] **Step 1: Viết test** — `buildPack("n4", …)` trả `counts.vocabulary === 1182`; sửa 1 byte file đã ghi thì `validatePack` + kiểm sha256 phát hiện; `verifyN4AgainstDataset` trên gói thật trả `[]`; xoá một compound khỏi bản sao gói → lỗi chứa `"tu_ghep_kanji"`; `removedIds` trả đúng mã bị xoá.
- [x] **Step 2: Chạy** — Expected: FAIL.
- [x] **Step 3: Viết** `build-packs.ts`, `verify-packs.ts`, scripts trong `package.json`.
- [x] **Step 4: Chạy** test, rồi `pnpm --filter @luyen/infra-scripts packs:build && pnpm --filter @luyen/infra-scripts packs:verify` — Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `feat(infra): build and verify versioned content packs`

Kiểm chứng Task 4: 149/149 test đạt (94 infra, 55 frontend); typecheck và Biome đạt. Gói N4 `1.0.0` có 9 bảng; 388 từ ghép phủ đủ 403 dòng nguồn. Hai lệnh `packs:build` và `packs:verify` chạy thành công cục bộ. Khi thêm một byte vào bản giao cho frontend, `packs:verify` trả mã 1; sau khi khôi phục, trả 0. Đã thử bật/tắt mẫu N3 (2 mục/bảng); bản mặc định chỉ liệt kê N4. GitHub Actions thuộc Task 7. Chưa tạo commit.

### Task 5: Adapter Gói nội dung + cache Dexie

**Files:**
- Modify: `src/frontend/package.json` (thêm `dexie@4.4.7`)
- Create: `src/frontend/src/adapters/local-store/db.ts`, `src/frontend/src/adapters/content-pack/packSource.ts`
- Test: `src/frontend/src/adapters/content-pack/packSource.test.ts` (dùng `fake-indexeddb/auto`, `fetch` giả)

**Interfaces:**
- Consumes: `ContentPack`, `Level`, `validatePack`, `Result` (Task 2); cấu trúc `/packs/index.json` (Task 4).
- Produces:
  - `db`: Dexie `luyen-jlpt`, version 1, bảng `packs` (khoá `[level+version]`, giá trị `ContentPack`), `settings` (khoá `key`, giá trị `unknown`).
  - `interface PackIndexEntry { level: Level; version: string; path: string }`
  - `async function listAvailableLevels(baseUrl: string): Promise<Level[]>` — đọc `${baseUrl}/index.json`; lỗi mạng → các level đã có trong `db.packs`; nếu vẫn rỗng → `["n4"]`.
  - `async function loadPack(level: Level, baseUrl: string): Promise<Result<ContentPack, PackError>>` — thứ tự: bản mới nhất hợp lệ trong `db.packs`; nếu index (đóng kèm hoặc `VITE_CONTENT_INDEX_URL`) có version cao hơn (so semver) thì tải 9 file, kiểm sha256 + `validatePack`, lưu Dexie, trả bản mới; mọi lỗi tải/kiểm → giữ bản cũ; không có bản nào → tải bản đóng kèm `/packs`.

- [x] **Step 1: Viết test** (5 ca, ca 1–2 thuộc Review Focus):
  - Dexie có gói hỏng (thiếu `kanji`) + mạng lỗi → trả gói đóng kèm, `ok: true`.
  - `fetch(index.json)` trả HTML 404 → trả gói đã cache, không throw.
  - Cache có `1.0.0`, index có `1.1.0` hợp lệ → trả `1.1.0` và Dexie chứa `1.1.0`.
  - Index có `1.1.0` nhưng sha256 sai → trả `1.0.0`.
  - `listAvailableLevels` khi offline và Dexie rỗng → `["n4"]`.
- [x] **Step 2: Chạy** — Expected: FAIL.
- [x] **Step 3: Viết** `db.ts`, `packSource.ts`.
- [x] **Step 4: Chạy** test — Expected: PASS.
- [ ] **Step 5: Commit** `feat(adapters): content pack source with Dexie cache`

Kiểm chứng Task 5: `pnpm test` đạt 206/206 (112 frontend, 94 infra); typecheck, Biome, `packs:verify` và build production đều đạt. Trên Chrome với IndexedDB thật: tải N4 `1.0.0` (1.182 từ), đọc lại khi chặn mạng, từ chối bản cache bị sửa nghĩa và khôi phục từ `/packs`. Dexie `4.4.7` đã khóa phiên bản và kiểm tra bằng cài đặt offline với lockfile cố định. Giao diện chưa đổi; chưa tạo commit.

### Task 6: Cấp độ, ContentProvider và chuyển các trang sang Gói

**Files:**
- Create: `src/frontend/src/core/level.ts`, `src/frontend/src/hooks/useContent.tsx`, `src/frontend/src/components/LevelSwitcher.tsx`
- Modify: `src/frontend/src/main.tsx` (bọc `ContentProvider`), `src/frontend/src/components/Layout.tsx` (thêm `LevelSwitcher` trong header), các trang trong `src/frontend/src/pages/*.tsx`, `components/kanji-quiz/quizEngine.ts`, `components/home/sections.ts`, `components/progress/*`, `components/reading/*`, `components/kanji-library/*`
- Test: `src/frontend/src/core/level.test.ts`, `src/frontend/src/components/home/sections.test.ts`

**Interfaces:**
- Consumes: `loadPack`, `listAvailableLevels`, `db.settings` (Task 5).
- Produces:
  - `function resolveLevel(saved: unknown, available: Level[]): Level` — `saved` hợp lệ và có trong `available` thì giữ, không thì `"n4"` nếu có, không thì `available[0]`.
  - `ContentProvider`, `useContent(): { level: Level; available: Level[]; setLevel(l: Level): void; pack: ContentPack | null; status: "loading" | "ready" | "error" }` — lưu Cấp độ vào `db.settings` khoá `"level"`.
  - `generateQuiz(mode: KanjiQuizMode, pack: Pick<ContentPack, "kanji" | "compounds">): QuizQuestion[]` (thêm tham số; bỏ hằng cấp module).
  - `LevelSwitcher`: chip N5–N1 (`data-ocid="level.switcher.<level>"`); level không có trong `available` → `disabled`, nhãn "Sắp ra mắt".
  - Khi `status === "loading"` trang hiện `Skeleton` sẵn có; `"error"` hiện "Không tải được nội dung. Vui lòng thử lại." + nút "Thử lại".

- [x] **Step 1: Viết test** — `resolveLevel("n3", ["n4"]) === "n4"` (Review Focus 4); `resolveLevel("n3", ["n4","n3"]) === "n3"`; `resolveLevel(42, ["n4"]) === "n4"`. Với `countKnownVocabulary` / `currentKanjiResults` trong `sections.ts`: Tiến độ chứa `cardId: "vocab-XOA"` không có trong Gói → không được đếm, phần trăm ≤ 100 (Review Focus 3).
- [x] **Step 2: Chạy** — Expected: FAIL.
- [x] **Step 3: Viết** `level.ts`, `useContent.tsx`, `LevelSwitcher.tsx`; đổi mọi import `@/data/*` trong `pages/` và `components/` sang `useContent().pack`; `quizEngine.test.ts` (Task 1) đổi sang truyền Gói fixture.
- [x] **Step 4: Chạy** `pnpm test && pnpm typecheck && pnpm check` — Expected: PASS. Chạy `rg "@/data/" src/frontend/src/pages src/frontend/src/components` — Expected: không có kết quả.
- [ ] **Step 5: Commit** `feat: load study content from level packs with level switcher`

Kiểm chứng Task 6: 219/219 test đạt (125 frontend, 94 infra); typecheck, Biome, `packs:verify` và build production đạt. Trang và component không còn import dữ liệu nhúng. Smoke test Chrome mở đủ 9 route, chuyển từ 1.182 thẻ N4 sang 2 thẻ N3, giữ N3 sau tải lại và tự về N4 khi tắt gói thử. Nút Thử lại phục hồi sau lỗi tải; bài đọc không có câu hỏi không thể nộp. Chưa thử lưu tiến độ với tài khoản thật vì Vite cục bộ thiếu `CANISTER_ID_BACKEND`. Kết quả Kanji đúng hết không có mã câu sai để gán cấp độ, nên không tính vào thống kê riêng của gói. Chưa tạo commit.

### Task 7: Xoá dữ liệu nhúng, CI và E2E web cục bộ

**Files:**
- Delete: `src/frontend/src/data/{vocabulary,kanji,grammar,reading}.ts` (sau khi Task 3 đã đóng băng; `export-n4-legacy.ts` chuyển sang đọc từ `infra/content/n4` hoặc bị xoá cùng)
- Create: `.github/workflows/ci.yml`, `tests/web/playwright.config.ts`, `tests/web/routes.spec.ts`, `tests/web/level-switcher.spec.ts`
- Modify: root `package.json` (scripts `packs:build`, `packs:verify`, `e2e:web`)

**Interfaces:**
- Consumes: mọi task trước.
- Produces: CI job `ci` chạy theo thứ tự `pnpm install --frozen-lockfile`, `pnpm packs:build`, `pnpm packs:verify`, `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`, `pnpm e2e:web`.

- [x] **Step 1: Viết E2E** — `routes.spec.ts`: với mỗi route trong Global Constraints, trang mở không lỗi console, có `h1`; `/tu-vung` hiện bộ đếm `"1 / 1182"`. `level-switcher.spec.ts`: chip N4 được chọn; chip N3 `disabled` và có chữ "Sắp ra mắt"; với `EXPERIMENTAL_LEVELS=1` chọn N3 thì `/tu-vung` hiện số từ của `n3-sample`.
- [x] **Step 2: Chạy** `pnpm e2e:web` trên code trước khi xoá `data/*.ts` — PASS ở cả hai chế độ.
- [x] **Step 3: Xoá** `data/*.ts` và exporter cũ; chạy lại toàn bộ chuỗi lệnh CI cục bộ.
- [x] **Step 4: Kiểm** tất cả lệnh thoát `0`; đo chunk chính trước/sau và xác nhận production không còn dữ liệu nhúng.
- [ ] **Step 5: Commit** `chore: drop embedded data, add CI and web e2e`

Kiểm chứng Task 7: toàn bộ chuỗi kiểm tra cục bộ đạt sau khi xoá nguồn TS, gồm 217/217 test Vitest. Playwright đạt 10/10 cho từng chế độ N4 mặc định và N3 thử nghiệm, cả trước và sau khi xoá. JSON N4 và `VERSION` giữ nguyên từng byte. Đã so SHA của ba Action với tag chính thức và kiểm tra quyền, cú pháp YAML, thứ tự lệnh. Chưa tạo commit hoặc chạy workflow trên GitHub.

Điều chỉnh tiêu chí kích thước: chunk chính giữ nguyên 2.522.580 byte và SHA-256 trước/sau. Task 6 đã gỡ import khỏi đường chạy production; Task 7 chỉ xoá nguồn trùng và các tham chiếu còn lại trong công cụ/test. Không còn tham chiếu tới bốn module cũ, và các mã mục mẫu chỉ nằm trong JSON gói, không có trong JS build.
