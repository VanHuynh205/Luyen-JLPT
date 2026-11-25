# Chức năng Giải đề JLPT N4 (6 đề + Web/App) Implementation Plan

> **For agentic workers:** Follow `ponytail`, `codebase-design`, `test-driven-development`, `impeccable` (`craft-floor.md` + `DESIGN.md`), and `verification-before-completion`.

**Goal:** Số hóa toàn bộ 6 đề JLPT N4 từ `infra/de_jlptn4` thành bộ dataset chuẩn có furigana, dịch sát ngữ pháp và giải thích chi tiết từng câu; xây dựng tính năng giải đề chia 3 phần có đồng hồ đếm ngược chuẩn kỳ thi thật trên web và app Tauri.

**Architecture:** Tách riêng dataset đề tại `infra/dataset_n4_exams/` và xuất gói tải lười tại `/packs/n4/exams/` (`index.json` + `<examId>.json`) để giữ nguyên `ContentPack 1.0.0` và giới hạn APK `≤ 30 MB` (không nhúng 73 MB `.mp3`). Lõi chấm điểm, khóa hết giờ, kiểm tra tiến trình phần và bộ phân tích `{漢字|かんじ}` đặt trong `frontend/src/core/exam/`; kết quả làm đề lưu cục bộ bằng Dexie v3 (`examAttempts`, `examPacks`).

**Tech Stack:** React 19, TypeScript 7, TanStack Router 1.131, Dexie 4.4.7, Tailwind CSS + shadcn/ui, Vitest 5.1.1, Playwright 1.65.1, Python PyMuPDF (trích xuất PDF tạm thời), Graphify 0.9.99.

**Spec & References:** `DESIGN.md`, `docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/EXPERIENCE.md`, `frontend/src/core/content/types.ts`, `frontend/src/adapters/local-store/db.ts`.

## Global Constraints

- Không sửa `infra/content/n4/*.json` hoặc `infra/content/n4/VERSION` (`1.0.0`).
- Không xóa `infra/de_jlptn4/` gốc của người dùng; chỉ xóa các thư mục tạm sinh ra khi xử lý (`.tmp-exam-ocr/`, script tạm).
- Không nhúng file `.mp3` vào `frontend/public/` để bảo đảm kích thước gói cài đặt.
- Chuẩn thời gian JLPT N4: Phần 1 `文字・語彙` **25 phút** (`1500s`), Phần 2 `文法・読解` **55 phút** (`3300s`), Phần 3 `聴解` **35 phút** (`2100s`). Hết giờ khóa ngay việc chọn đáp án và tự nộp phần hiện tại.
- Giải thích sau nộp: nêu rõ vì sao chọn, dịch sát nghĩa theo cấu trúc ngữ pháp và từ vựng (không hoa mỹ), hiển thị furigana nhỏ (`<ruby><rt>...</rt></ruby>`) cho các chữ kanji trong đề.
- Giao diện Washi & Sumi, 100% tiếng Việt (trừ văn bản tiếng Nhật gắn `lang="ja"`), không dùng Fraunces cho chữ Nhật, tối đa 1 dấu `.hanko` son mỗi màn hình, chạm ≥ 44px ở 360px.

---

### Task 1 (`pdf-prep`): Trích xuất text & render trang scan PDF tạm

- Trích toàn bộ PDF text (`2023-07`, 5 file đáp án, 3 file script nghe) ra `.tmp-exam-ocr/text/*.txt` (UTF-8).
- Render 5 bộ đề PDF scan (`2021-07`, `2021-12`, `2024-07`, `2024-12`, `2025-07`) sang PNG rõ nét tại `.tmp-exam-ocr/pages/<code>/p01.png..pNN.png`.
- Ghi nhận `.tmp-exam-ocr/` là thư mục tạm sẽ bị xóa ở bước dọn rác cuối cùng.

### Task 2 (`exam-core`): Lõi giải đề, Dexie v3, Adapter & Script build/verify dataset đề

**Files:**
- Create: `frontend/src/core/exam/types.ts`, `ruby.ts`, `ruby.test.ts`, `validate.ts`, `validate.test.ts`, `engine.ts`, `engine.test.ts`
- Modify: `frontend/src/adapters/local-store/db.ts` (Dexie v3: `examAttempts`, `examPacks`)
- Create: `frontend/src/adapters/local-store/exams.ts`, `exams.test.ts`
- Create: `frontend/src/adapters/content-pack/examSource.ts`, `examSource.test.ts`
- Create: `frontend/src/hooks/useExams.ts`
- Create: `infra/scripts/src/exams.ts`, `exams.test.ts`
- Modify: `infra/scripts/src/packs.ts`

### Task 3 (`exam-2023-07`, `exam-2021-12`, `exam-2024-07`, `exam-2024-12`, `exam-2025-07`, `exam-2021-07`): Số hóa đủ 6 đề JLPT N4

**Files:**
- Create: `infra/dataset_n4_exams/exams/n4-2023-07.json`
- Create: `infra/dataset_n4_exams/exams/n4-2021-12.json`
- Create: `infra/dataset_n4_exams/exams/n4-2024-07.json`
- Create: `infra/dataset_n4_exams/exams/n4-2024-12.json`
- Create: `infra/dataset_n4_exams/exams/n4-2025-07.json`
- Create: `infra/dataset_n4_exams/exams/n4-2021-07.json` (tự giải & kiểm chéo khi chưa có file đáp án riêng, gắn `answerSource: "solved"`)

### Task 4 (`exam-ui` & `exam-nav`): Giao diện giải đề & tích hợp điều hướng/tiến độ

**Files:**
- Create: `frontend/src/components/exam/RubyText.tsx`, `ExamTimerBar.tsx`, `ExamQuestionCard.tsx`
- Create: `frontend/src/pages/ExamListPage.tsx`, `ExamRunnerPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/components/home/sections.ts`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/ProgressPage.tsx`

### Task 5 (`exam-e2e`): Kiểm thử E2E Playwright cho luồng giải đề

**Files:**
- Modify: `tests/web/routes.spec.ts`
- Create: `tests/web/exam-practice.spec.ts`

### Task 6 (`verifier`): Review, dọn rác tạm, kiểm chứng toàn bộ & cập nhật Graphify

- Review toàn bộ diff bằng `open-code-review-delegate` -> `docs/code-review/2026-11-25-luyen-de-jlpt-review.md`.
- Đánh dấu & xóa an toàn toàn bộ file/folder tạm sinh ra trong phiên (`.tmp-exam-ocr/`, script tạm).
- Chạy lại trọn bộ: `pnpm packs:build`, `pnpm packs:verify`, `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`, `pnpm e2e:web`.
- Cập nhật `graphify-out/` theo `graphify/SKILL.md` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`).
