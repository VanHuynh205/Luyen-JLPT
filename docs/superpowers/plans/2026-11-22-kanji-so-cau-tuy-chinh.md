# Số câu trắc nghiệm Kanji tùy chỉnh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người học chọn số câu trắc nghiệm Kanji cho từng dạng bài (Kanji đơn, Từ ghép, Trộn cả hai), từ 10 tới toàn bộ mục của dạng đó; bài N4 đúng hết được tính vào Tiến độ.

**Architecture:** `quizEngine.ts` nhận thêm số câu và có hai hàm thuần tính giới hạn. `KanjiQuizPage` giữ số câu riêng cho từng dạng bài. `QuizStart` hiện ô nhập số và các nút chọn nhanh. `currentKanjiResults` trong `sections.ts` nhận bài đúng hết khi Gói đang chọn là N4.

**Tech Stack:** React 19.1, TypeScript 7, Vitest 5.1.1, Playwright 1.65.1, Biome.

**Spec:** yêu cầu của chủ dự án ngày 2026-11-22: "Kết quả kanji 10/10 có tính vào N4" và "sửa chức năng học kanji từ 10 thành có thể tùy chỉnh từ 10 đến toàn bộ số kanji để học trong từng phần học kanji, không khóa cứng 10 từ ở toàn phần học kanji".

## Global Constraints

- Giao diện tiếng Việt; chữ Nhật có `lang="ja"`.
- Số câu mặc định vẫn là `10` cho cả ba dạng bài (test tester-army `tests/e2e/kanji-quiz-full.e2e.ts` kiểm `1/10` … `10/10`).
- Giới hạn dưới: `min(10, kích thước nguồn câu hỏi)`; giới hạn trên: `min(kích thước nguồn câu hỏi, 1000)`. `1000` là `maxQuizTotal` trong `src/backend/lib/progress.mo`; vượt quá thì backend trap.
- Kích thước nguồn câu hỏi N4: Kanji đơn `118`, Từ ghép `388`, Trộn `506`.
- Không đổi backend, không đổi route, không thêm dependency.
- Mỗi dạng bài giữ số câu riêng; đổi dạng bài không làm mất số câu đã chọn của dạng khác (trong phiên trang).

## Review Focus

1. Ô số bị xoá trống, nhập chữ, số thập phân, số âm hoặc lớn hơn giới hạn → khi rời ô hoặc bấm Bắt đầu, số được kẹp về số nguyên trong `[min, max]`. Test ở Task 2 (`clampQuestionCount`) và Task 3 (E2E nhập `5` và `9999`).
2. Gói nhỏ hơn 10 mục (mẫu N3 có 2 Kanji) → `min = max = 2`, không vỡ trang, vẫn báo "Chưa đủ nội dung để tạo câu hỏi cho dạng bài này." Test ở Task 2.
3. Chọn "Tất cả" → không mục nào lặp; với Gói N4 ra đúng 118 / 388 / 506 câu (đo 30 lần mỗi dạng). Gói khác có thể có mục không tạo được câu hỏi, nên giữ chữ "Tối đa". Test ở Task 2.
4. Bài đúng hết của Gói không phải N4 vẫn bị loại; bài có `score !== total` mà `wrongItemIds` rỗng bị loại. Test ở Task 1.
5. Nguồn câu hỏi lớn hơn `1000` (Gói N1 sau này) → giới hạn trên dừng ở `1000`. Test ở Task 2.

---

### Task 1: Tính bài Kanji đúng hết vào Tiến độ N4

**Files:**
- Modify: `src/frontend/src/components/home/sections.ts` (`currentKanjiResults`)
- Test: `src/frontend/src/components/home/sections.test.ts`

**Interfaces:**
- Produces: `currentKanjiResults(summary, pack)` giữ nguyên chữ ký; thêm điều kiện nhận bài có `wrongItemIds.length === 0 && score === total && total > 0n` khi `pack.manifest.level === "n4"`.

- [ ] **Step 1: Viết test** trong `describe("progress for the selected pack")`:
  - `"counts a perfect quiz for the N4 pack"`: `miniPack` (level `n4`) với kết quả `{ total: 10n, score: 10n, wrongItemIds: [] }` → `currentKanjiResults` chứa nó; `computeSectionStats(...).kanji.value === "10 / 10 câu đúng"`.
  - `"ignores a perfect quiz for a non-N4 pack"`: cùng kết quả với `{ ...miniPack, manifest: { ...miniPack.manifest, level: "n3" } }` → `[]`.
  - `"ignores an empty wrong list when the score is not perfect"`: `{ total: 10n, score: 9n, wrongItemIds: [] }` với N4 → `[]`.
  - Sửa ca hiện có: kết quả `id: 3n` (`total 1n, score 1n, wrongItemIds []`) giờ được nhận → kỳ vọng `[1n, 3n, 7n]`.
- [ ] **Step 2: Chạy** `pnpm --filter @caffeine/template-frontend test -- sections` — Expected: FAIL ở 2 ca mới cần nhận bài đúng hết.
- [ ] **Step 3: Sửa** `currentKanjiResults`: tách nhánh `wrongItemIds.length === 0` → `pack.manifest.level === "n4" && r.score === r.total`; nhánh còn lại giữ nguyên kiểm tra cũ. Một dòng chú thích lý do: backend không lưu cấp độ, bài cũ trước Epic 1 đều là N4.
- [ ] **Step 4: Chạy** lại — Expected: PASS.
- [ ] **Step 5: Commit** `fix(progress): count perfect kanji quizzes for N4`

### Task 2: Số câu tùy chỉnh trong `quizEngine`

**Files:**
- Modify: `src/frontend/src/components/kanji-quiz/quizEngine.ts`
- Test: `src/frontend/src/components/kanji-quiz/quizEngine.test.ts`

**Interfaces:**
- Produces:
  - `export const QUESTION_COUNT = 10` (giữ tên, nghĩa: mặc định và giới hạn dưới).
  - `export const MAX_QUESTION_COUNT = 1000`
  - `export function quizPoolSize(mode: KanjiQuizMode, pack: Pick<ContentPack, "kanji" | "compounds">): number` — `single` → `kanji.length`; `compound` → `compounds.length`; `mixed` → tổng.
  - `export function questionCountRange(poolSize: number): { min: number; max: number }` — `max = min(poolSize, 1000)`, `min = min(10, max)`.
  - `export function clampQuestionCount(value: number, poolSize: number): number` — `NaN`/không hữu hạn → `min`; làm tròn `Math.round`; kẹp vào `[min, max]`.
  - `generateQuiz(mode, pack, count = QUESTION_COUNT): QuizQuestion[]` — dừng khi đủ `clampQuestionCount(count, quizPoolSize(mode, pack))` câu.

- [ ] **Step 1: Viết test**:
  - Đọc Gói N4 thật bằng `readFileSync` từ `infra/content/n4/{kanji,compounds}.json` (biến `n4`). `quizPoolSize` trên `n4` → `118`, `388`, `506`.
  - `questionCountRange(118)` → `{ min: 10, max: 118 }`; `questionCountRange(2)` → `{ min: 2, max: 2 }`; `questionCountRange(2500)` → `{ min: 10, max: 1000 }`.
  - `clampQuestionCount`: `(5, 118) → 10`, `(9999, 118) → 118`, `(Number.NaN, 118) → 10`, `(-3, 118) → 10`, `(20.6, 118) → 21`, `(1, 2) → 2`.
  - `generateQuiz(KanjiQuizMode.single, n4, 30)` → 30 câu, mã mục không lặp.
  - Với mỗi dạng bài, `generateQuiz(mode, n4, quizPoolSize(mode, n4))` → `length` bằng kích thước nguồn, mã mục không lặp, mỗi câu 4 đáp án khác nhau.
  - `generateQuiz(mode, pack)` không truyền số câu → 10 câu (ca cũ giữ nguyên).
- [ ] **Step 2: Chạy** `pnpm --filter @caffeine/template-frontend test -- quizEngine` — Expected: FAIL (`quizPoolSize is not a function`).
- [ ] **Step 3: Viết** ba hàm và tham số `count`.
- [ ] **Step 4: Chạy** lại — Expected: PASS.
- [ ] **Step 5: Commit** `feat(kanji-quiz): configurable question count per mode`

### Task 3: Chọn số câu trên màn hình bắt đầu

**Files:**
- Modify: `src/frontend/src/components/kanji-quiz/QuizStart.tsx`, `src/frontend/src/pages/KanjiQuizPage.tsx`
- Create: `tests/web/kanji-quiz-count.spec.ts`

**Interfaces:**
- Consumes: `quizPoolSize`, `questionCountRange`, `clampQuestionCount`, `generateQuiz(mode, pack, count)` (Task 2).
- Produces:
  - `QuizStart` thêm props `count: number`, `poolSize: number`, `onCountChange: (count: number) => void`; khoảng tính bằng `questionCountRange(poolSize)` bên trong.
  - `KanjiQuizPage` giữ `counts: Record<KanjiQuizMode, number>` khởi tạo `10` mỗi dạng; `start` gọi `generateQuiz(mode, pack, clampQuestionCount(counts[mode], poolSize))`.
  - Giao diện trong khối dưới phần chọn dạng bài, `fieldset` có `legend` "Số câu":
    - Nút chọn nhanh `10`, `20`, `50` (chỉ hiện khi `< max`) và `Tất cả (max)`; `aria-pressed` khi bằng số hiện tại; `data-ocid="kanji_quiz.count_<n>.toggle"`, `data-ocid="kanji_quiz.count_all.toggle"`.
    - Ô `Input type="number"` `min`/`max`/`step=1`, `inputMode="numeric"`, nhãn "Số câu tự chọn", `data-ocid="kanji_quiz.count.input"`; giữ chuỗi nháp khi gõ, kẹp và báo lên khi `blur` hoặc Enter; nháp đồng bộ lại khi `count` hoặc dạng bài đổi.
    - Dòng gợi ý `Từ {min} đến {max} câu cho dạng {label}.`
    - Dòng tóm tắt đổi từ `Tối đa {QUESTION_COUNT} câu…` thành `Tối đa {count} câu ngẫu nhiên · 4 lựa chọn · giải thích ngay sau mỗi câu.`
  - Nút chạm ≥ 44px trên di động (theo `min-h-11` đang dùng).

- [ ] **Step 1: Viết E2E** `tests/web/kanji-quiz-count.spec.ts` (dùng `./fixtures`):
  - Mở `/kanji`: nút `Tất cả (118)` hiện cho Kanji đơn; chọn Từ ghép → `Tất cả (388)`; Trộn → `Tất cả (506)`.
  - Kanji đơn chọn `20`, sang Từ ghép (vẫn `10`), quay lại Kanji đơn → ô số là `20`.
  - Ở Từ ghép (đang `10`) nhập `5` rồi rời ô → `10` (ca số ở trang cha không đổi nên ô nhập phải tự kẹp); ở Kanji đơn nhập `9999` rồi Enter → `118`, nút `Tất cả` được chọn.
  - Chọn `20`, bấm Bắt đầu → hiện `1/20`.
  - Spec chạy được ở cả hai chế độ vì Cấp độ mặc định luôn là N4.
- [ ] **Step 2: Chạy** `pnpm build && pnpm e2e:web` — Expected: FAIL ở spec mới.
- [ ] **Step 3: Viết** props và UI trong `QuizStart`, state `counts` trong `KanjiQuizPage`.
- [ ] **Step 4: Chạy** `pnpm typecheck && pnpm check && pnpm test && pnpm build && pnpm e2e:web` — Expected: tất cả exit 0; spec cũ `routes`, `level-switcher` vẫn đạt.
- [ ] **Step 5: Commit** `feat(kanji-quiz): choose question count on the start screen`

### Task 4: Kiểm chứng toàn chuỗi

- [ ] Chạy chuỗi CI cục bộ ở chế độ mặc định và `EXPERIMENTAL_LEVELS=1`: `packs:build`, `packs:verify`, `typecheck`, `check`, `test`, `build`, `e2e:web` — Expected: exit 0.
- [ ] Mở `/kanji` ở 375px: không cuộn ngang, nút chọn nhanh xuống dòng gọn.
