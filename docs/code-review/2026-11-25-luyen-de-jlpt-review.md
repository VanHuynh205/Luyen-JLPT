# Rà soát Tính năng Luyện đề JLPT N4 (6 đề chuẩn + Web/App)

**Chế độ rà:** `delegation` (`open-code-review-delegate`, `workspace` mode).  
**Kế hoạch đối chiếu:** [2026-11-25-luyen-de-jlpt-n4.md](../superpowers/plans/2026-11-25-luyen-de-jlpt-n4.md), `DESIGN.md`, `AGENTS.md`.

## 1. Cách rà & Độ phủ OCR (`delegation`)

| Việc | Công cụ / Skill | Ghi chú |
| --- | --- | --- |
| Chọn file & nạp rule | `open-code-review-delegate` (`ocr`) | `ocr delegate preview --format json` trước dọn rác: `280` file thay đổi/mới (`38` file `reviewable`, `242` file `excluded` gồm 192 PNG/10 TXT tạm trong `.tmp-exam-ocr/`, 18 file gốc `infra/de_jlptn4/`, test & markdown). Sau khi xóa `.tmp-exam-ocr/`: `76` file (`37` `reviewable`, `39` `excluded`). `ocr delegate rule --format json`: 3 nhóm rule hệ thống (`TS/JS`, `Python`, `JSON`). |
| Rà diff & toàn bộ file mới | Đọc 100% diff `git --no-pager diff` và 100% file thêm mới | Rà toàn bộ 25 file `reviewable` của tính năng Luyện đề (6 file chỉnh sửa, 13 file mã nguồn mới, 6 file JSON đề + `manifest.json`, kèm `.tmp-exam-ocr/prep.py` trước khi xóa), cùng 13 file Epic 4 đã rà ở [2026-11-25-epic-4-review.md](./2026-11-25-epic-4-review.md) và toàn bộ 9 file unit/E2E test + `questions.jsonl`. |
| Kiểm tra dữ liệu 6 đề | Script kiểm tra tự động + `validateExamDocument` + `parseRubyText` | Xác minh 426 câu hỏi, 0 khóa JSON lạ/sai chính tả, 0 kanji trần ngoài `{base\|reading}`, 0 trường `translation`/`explanation` rỗng, 0 thiếu `script`/`scriptRuby`/`scriptTranslation` ở phần Nghe có script, 0 file `.mp3` trong `frontend/public/`. |
| Kiểm chứng cuối | `verification-before-completion` | Chạy tươi toàn bộ chuỗi 7 lệnh sau khi dọn rác tạm; tất cả thoát mã `0`. |

### Độ phủ OCR (`delegation`, workspace trước dọn rác / sau dọn rác)

- `total_files` (`reviewable_files`): **38** (trước xóa `.tmp-exam-ocr/prep.py`) / **37** (sau dọn rác)
- `reviewed_files`: **38 / 38** (sau dọn rác **37 / 37**)
- `skipped_files`: **0**
- `coverage_rate`: **100%**

| File | Trạng thái | Kết quả rà |
| --- | --- | --- |
| `frontend/src/App.tsx` | modified | `reviewed` — đăng ký `/luyen-de` (`ExamListPage`) và `/luyen-de/$examId` (`ExamRunnerPage`) |
| `frontend/src/adapters/local-store/db.ts` | modified | `reviewed` — nâng Dexie lên `version(3)` giữ nguyên `version(1)` và `version(2)`, thêm `examAttempts` & `examPacks` |
| `frontend/src/components/Layout.tsx` | modified | `reviewed` — thêm `"Luyện đề"` vào `NAV_ITEMS` (desktop + mobile drawer), giữ nguyên 5 tab thanh dưới (`grid-cols-5`) |
| `frontend/src/pages/HomePage.tsx` | modified | `reviewed` — thêm thẻ kêu gọi vào `/luyen-de` (`data-ocid="home.exam.link"`, `min-h-11`), không đổi 4 mục `home.section.list` |
| `frontend/src/pages/ProgressPage.tsx` | modified | `reviewed` — tích hợp `useExamAttempts()` vào `isEmpty`, hiện mục `Lịch sử luyện đề` kèm tiêu đề đề, điểm và nút làm lại ≥ 44px |
| `infra/scripts/src/packs.ts` | modified | `reviewed` — gọi `buildExams`/`verifyExams` có điều kiện khi `infra/dataset_n4_exams/exams` tồn tại |
| `frontend/src/core/exam/types.ts` | added | `reviewed` — định nghĩa chuẩn 3 phần `vocab`/`grammar_reading`/`listening`, hỗ trợ 3–4 đáp án và lịch sử làm đề |
| `frontend/src/core/exam/ruby.ts` | added | `reviewed` — parser an toàn cho `{base\|reading}` và `[[...]]`, giữ nguyên ký tự HTML thành text thuần |
| `frontend/src/core/exam/validate.ts` | added | `reviewed` — kiểm tra chặt schema `ExamDocument`/`ExamIndex`, safe ID, trùng ID, 3 hoặc 4 lựa chọn, biên `answerIndex`, SHA-256 |
| `frontend/src/core/exam/engine.ts` | added | `reviewed` — chuẩn thời gian `1500/3300/2100s`, chấm điểm, khóa tuần tự, tính giây còn lại & tổng hợp lượt làm |
| `frontend/src/adapters/local-store/exams.ts` | added | `reviewed` — lưu/đọc `examAttempts` theo `[owner+level]` & `[owner+level+examId]`, chặn `isOwnerRetired`, cache đề & index có kiểm tra SHA-256 |
| `frontend/src/adapters/content-pack/examSource.ts` | added | `reviewed` — tải `/packs/{level}/exams/`, kiểm tra SHA-256 trên raw UTF-8 bytes trước khi parse JSON, dự phòng offline |
| `frontend/src/hooks/useExams.ts` | added | `reviewed` — các hook TanStack Query (`networkMode: "always"`) và mutation lưu kết quả + invalidate cache |
| `frontend/src/components/exam/RubyText.tsx` | added | `reviewed` — render React `<ruby><rt>` + gạch chân, gắn `lang="ja"` & `.font-jp-sans`/`.font-jp` (không dùng Fraunces), không dùng `dangerouslySetInnerHTML` |
| `frontend/src/components/exam/ExamTimerBar.tsx` | added | `reviewed` — thanh đồng hồ dính trên cùng, `MM:SS`, cảnh báo `<120s`, trạng thái `"Hết giờ"` & `"Đã nộp bài"` (1 ghi nhận Low) |
| `frontend/src/components/exam/ExamQuestionCard.tsx` | added | `reviewed` — ẩn furigana/lời giải trước khi nộp; sau khi khóa hiện `<ruby><rt>`, màu đúng/sai, `Dịch nghĩa`, `Vì sao chọn`, `Script nghe` + `Dịch script`; hỗ trợ 3 hoặc 4 đáp án, nút ≥ 44px (1 ghi nhận Low) |
| `frontend/src/pages/ExamListPage.tsx` | added | `reviewed` — danh sách 6 đề N4, trạng thái tải/lỗi/trống (xử lý 404 cấp N3), badge nguồn đáp án & nghe, tóm tắt số lần làm & điểm cao nhất (1 ghi nhận Low) |
| `frontend/src/pages/ExamRunnerPage.tsx` | added | `reviewed` — luồng tuần tự 3 phần, đồng hồ deadline 250ms tự khóa & tự chấm khi hết giờ, màn hình giới thiệu phần Nghe không có `.mp3` (script-assisted hoặc bỏ qua), 1 `<HankoStamp />` ở tổng kết, auto-save 1 lần, key theo `docQuery.data.id` (2 ghi nhận Low) |
| `infra/scripts/src/exams.ts` | added | `reviewed` — build & verify `manifest.json`, `jsonl/questions.jsonl`, `infra/packs/n4/exams/` và `frontend/public/packs/n4/exams/` đối chiếu byte-for-byte & SHA-256 |
| `infra/dataset_n4_exams/exams/*.json` (6 file) + `manifest.json` | added | `reviewed` — 0 lỗi chính tả khóa JSON, 0 khóa lạ, 426 câu đạt 100% kiểm tra schema & furigana |
| `.tmp-exam-ocr/prep.py` | added → **đã xóa** | `reviewed` — script trích xuất PDF tạm bằng PyMuPDF, đã xóa an toàn ở Giai đoạn 2 |
| 13 file Epic 4 chưa commit (`Grammar*`, `ReadingDetailPage.tsx`, `build-packs.ts`, `comparisonLinks.ts`, `GrammarSubNav.tsx`) | modified/added | `reviewed` — đã rà chi tiết ở [2026-11-25-epic-4-review.md](./2026-11-25-epic-4-review.md), không có thay đổi mới ngoài phạm vi |

*(Ngoài các file trên, toàn bộ 9 file test của tính năng gồm `ruby.test.ts`, `validate.test.ts`, `engine.test.ts`, `exams.test.ts`, `examSource.test.ts`, `db.test.ts`, `Layout.test.tsx`, `ProgressPage.test.tsx`, `infra/scripts/src/exams.test.ts`, `tests/web/routes.spec.ts`, `tests/web/exam-practice.spec.ts` và `infra/dataset_n4_exams/jsonl/questions.jsonl` đều đã được đọc và rà đầy đủ.)*

## 2. Kiểm tra dữ liệu 6 đề JLPT N4 (`infra/dataset_n4_exams/`)

| Mã đề | ID | Từ vựng (`1500s`) | Ngữ pháp & Đọc hiểu (`3300s`) | Nghe hiểu (`2100s`) | Tổng câu | Phân bố lựa chọn Nghe | Nguồn đáp án | Kanji trần / Thiếu lời giải |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `2025-07` | `n4-2025-07` | 28 | 29 | 0 *(chưa có script/audio)* | **57** | — | `official_key` (57) | 0 / 0 |
| `2024-12` | `n4-2024-12` | 28 | 29 | 28 *(có script)* | **85** | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2024-07` | `n4-2024-07` | 28 | 29 | 28 *(có script)* | **85** | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2023-07` | `n4-2023-07` | 28 | 29 | 0 *(chưa có script/audio)* | **57** | — | `official_key` (57) | 0 / 0 |
| `2021-12` | `n4-2021-12` | 28 | 29 | 28 *(có script)* | **85** | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2021-07` | `n4-2021-07` | 28 | 29 | 0 *(chưa có script)* | **57** | — | `mixed` (56 `official_key`, 1 `solved` sửa lỗi in ở `g-12`) | 0 / 0 |
| **Tổng cộng** | **6 đề** | **168** | **174** | **84** | **426** | **45×4 + 39×3** | **425 gốc + 1 đối chiếu** | **0 / 0** |

- `infra/dataset_n4_exams/jsonl/questions.jsonl`: **426 dòng**, **426 ID duy nhất**, khớp byte-for-byte với `verifyExams`.
- `git diff HEAD -- infra/content/n4`: **rỗng** (không chạm vào gói N4 `1.0.0`).
- Số file `.mp3` trong `frontend/public/`: **0** (không đóng gói âm thanh vào web/app).

## 3. Đối chiếu yêu cầu & Phát hiện theo mức độ

| Yêu cầu | Kết luận |
| --- | --- |
| Thời lượng 3 phần chuẩn JLPT N4 (`1500s` / `3300s` / `2100s`) | Đạt — xác minh ở `EXAM_SECTION_DURATIONS`, cả 6 JSON đề và E2E (`25:00`, `55:00`) |
| Hết giờ tự động khóa đáp án & chấm điểm | Đạt — `ExamRunnerPage` tự khóa `disabled={locked}` & hiện `Hết giờ! Phần này đã tự động nộp và khóa đáp án.`, xác minh qua `page.clock.fastForward(1501 * 1000)` |
| Sau nộp hiện `<ruby><rt>` furigana + `Dịch nghĩa` + `Vì sao chọn` | Đạt — xác minh ở `RubyText`, `ExamQuestionCard` và E2E (`ruby rt` visible + `Dịch nghĩa:` + `Vì sao chọn:`) |
| Hỗ trợ 3 hoặc 4 lựa chọn cho Nghe Mondai 3/4 | Đạt — `validate.ts`, `engine.ts`, `ExamQuestionCard.tsx` và E2E trên `n4-2024-07` (`l-16`, `l-21` đều 3 lựa chọn) |
| Không nhúng `.mp3` vào `frontend/public` | Đạt — 0 file `.mp3` dưới `frontend/public/` |
| Dexie v3 giữ nguyên schema v1/v2 | Đạt — `db.ts` giữ nguyên `version(1)` & `version(2)`, xác minh bằng `db.test.ts` |
| Washi & Sumi (`DESIGN.md`), 100% tiếng Việt, `lang="ja"`, không Fraunces cho chữ Nhật, 360px không tràn ngang & chạm ≥ 44px | Đạt — xác minh bằng Playwright E2E `360px` (`scrollWidth === 360`, toàn bộ nút chính ≥ 44px) |

### Phát hiện theo mức độ

- **Critical / High:** Không có (0).
- **Medium:** Không có (0).
- **Low (ghi nhận, không chặn merge):**
  1. `frontend/src/adapters/local-store/progress.ts` (`purgeOwner`, dòng 167–185, `maintainability`): `purgeOwner(owner)` đánh dấu chủ tài khoản đã xóa (nên `examStore.recordAttempt` từ chối ghi mới), nhưng chưa xóa các bản ghi `db.examAttempts` cũ của `owner` đó trong IndexedDB cục bộ. Nên bổ sung dọn `examAttempts` khi đồng bộ/tích hợp xóa tài khoản ở đợt sau.
  2. `frontend/src/pages/ExamRunnerPage.tsx` (dòng 300–310, 463–468, 515–521, 528–551, 711–740), `ExamTimerBar.tsx` (dòng 71–75), `ExamQuestionCard.tsx` (dòng 70) (`style`): có một số biểu thức 3 ngôi lồng nhau khi chọn nhãn/class trạng thái; có thể tách thành hàm nhỏ cho gọn hơn.
  3. `frontend/src/pages/ExamRunnerPage.tsx` (dòng 384–390, `maintainability`): `useEffect` tự lưu kết quả phụ thuộc cả object `recordAttempt`; dù `savedAttemptIdRef` đã ngăn gọi trùng an toàn, tách `const { mutate } = recordAttempt` sẽ giúp danh sách dependency chặt hơn.
  4. `frontend/src/pages/ExamListPage.tsx` (dòng 25–28, `maintainability`): `isMissingExamIndexError` kiểm tra chuỗi `": 404"` trong `error.message`; nên gắn mã trạng thái có cấu trúc khi refactor `examSource.ts`.

## 4. Rà soát file/thư mục tồn dư & Dọn rác an toàn

Đối chiếu đầy đủ từ `git status --ignored -s` trước và sau khi dọn:

| Đường dẫn | Phân loại | Trạng thái / Ghi chú |
| --- | --- | --- |
| `.tmp-exam-ocr/` (`prep.py`, `text/*.txt` 10 file, `pages/*/*.png` 192 ảnh, `__pycache__/`) | **ĐÃ XÓA AN TOÀN (tạm sinh trong phiên)** | Đã xóa vĩnh viễn (`204` file tạm phục vụ OCR/đọc đề PDF). |
| `infra/packs/n3/` | **ĐÃ XÓA AN TOÀN (tạm sinh trong phiên)** | Vỏ thư mục rỗng (0 file), đã xóa an toàn. |
| `frontend/public/packs/n3/` | **ĐÃ XÓA AN TOÀN (tạm sinh trong phiên)** | Vỏ thư mục rỗng (0 file), đã xóa an toàn. |
| `frontend/dist/packs/n3/` | **ĐÃ XÓA AN TOÀN (tạm sinh trong phiên)** | Vỏ thư mục rỗng (0 file), đã xóa an toàn. |
| `frontend/src/core/exam/*`, `frontend/src/adapters/local-store/exams.*`, `frontend/src/adapters/content-pack/examSource.*`, `frontend/src/hooks/useExams.ts`, `frontend/src/components/exam/*`, `frontend/src/pages/ExamListPage.tsx`, `ExamRunnerPage.tsx`, `ProgressPage.test.tsx`, `infra/scripts/src/exams.*`, `tests/web/exam-practice.spec.ts` | **GIỮ (code, dataset chuẩn & tài liệu)** | Mã nguồn và kiểm thử mới của tính năng Luyện đề JLPT N4. |
| `frontend/src/App.tsx`, `db.ts`, `db.test.ts`, `Layout.tsx`, `Layout.test.tsx`, `HomePage.tsx`, `ProgressPage.tsx`, `infra/scripts/src/packs.ts`, `tests/web/routes.spec.ts` | **GIỮ (code, dataset chuẩn & tài liệu)** | File tích hợp route, Dexie v3, điều hướng, tiến độ và pipeline pack. |
| `infra/dataset_n4_exams/` (`exams/*.json` 6 đề, `manifest.json`, `jsonl/questions.jsonl`) | **GIỮ (code, dataset chuẩn & tài liệu)** | Bộ dataset 6 đề JLPT N4 chuẩn hóa (426 câu), được `pnpm packs:verify` kiểm chứng. |
| `infra/content/n4/` | **GIỮ (code, dataset chuẩn & tài liệu)** | Gói nội dung N4 `1.0.0` (10 file), `git diff HEAD -- infra/content/n4` rỗng. |
| Các file Epic 4 & kế hoạch/review (`docs/superpowers/plans/2026-11-25-*.md`, `docs/code-review/2026-11-25-*.md`, `Grammar*`, `comparisonLinks.*`, `ReadingDetailPage.*`, `grammar-extended.spec.ts`) | **GIỮ (code, dataset chuẩn & tài liệu)** | Tài liệu thiết kế, rà soát và mã nguồn Epic 4 hiện hành. |
| `infra/packs/`, `frontend/public/packs/`, `frontend/dist/`, `test-results/`, `node_modules/`, `frontend/node_modules/`, `infra/scripts/node_modules/`, `graphify-out/`, `mobile/src-tauri/icons/` | **TẠM / BUILD OUTPUT (gitignore, tái tạo được)** | Sản phẩm build/test/đồ thị kiến thức đã được `.gitignore`, tái tạo bằng lệnh build/graphify. |
| `.claude/`, `.codex/`, `_bmad/custom/config.user.toml`, `_bmad/render/bmad-agent-po/` | **TẠM / BUILD OUTPUT (gitignore, tái tạo được)** | Cấu hình/công cụ cục bộ đã `.gitignore`. |
| `infra/de_jlptn4/` (`18` file PDF đề, đáp án, script & `.mp3` gốc của người dùng) | **NGUỒN GỐC / RÁC CŨ KHÔNG TỰ XÓA** | **Tài liệu nguồn gốc của người dùng — tuyệt đối không tự xóa.** |
| `.cache/` (`epic3-android/`, `epic3-native/` ~5.1 GB) & `infra/dataset_n4_minnanihongo.zip` (tracked) | **NGUỒN GỐC / RÁC CŨ KHÔNG TỰ XÓA** | Tồn dư từ các đợt trước, giữ nguyên để chủ dự án tự quyết định. |

## 5. Kiểm chứng cuối (sau khi dọn rác tạm)

Chạy tươi ngày 25-11-2026 sau khi xóa `.tmp-exam-ocr/` và 3 vỏ thư mục rỗng `n3/`:

| Lệnh | Exit | Kết quả thực tế |
| --- | --- | --- |
| `pnpm packs:build` | `0` | Build gói N4 `1.0.0` + 6 đề thi (`infra/packs/n4/exams/` & `frontend/public/packs/n4/exams/`), `manifest.json`, `questions.jsonl`; in cảnh báo không chặn `64/74` comparison links |
| `pnpm packs:verify` | `0` | Xác minh toàn bộ gói N4 + đối chiếu byte-for-byte & SHA-256 cho cả 6 đề thi, `index.json`, `manifest.json`, `questions.jsonl` |
| `pnpm typecheck` | `0` | `frontend` & `infra/scripts` `tsc --noEmit` đều đạt (0 lỗi) |
| `pnpm check` | `0` | Biome kiểm tra `155` file `frontend` + `13` file `infra/scripts`, 0 lỗi |
| `pnpm test` | `0` | `frontend`: **34/34** file, **292/292** test đạt; `infra/scripts`: **5/5** file, **100/100** test đạt (tổng **392/392**) |
| `pnpm build` | `0` | Build gói N4 + 6 đề + Vite production bundle thành công |
| `pnpm e2e:web` | `0` | Playwright: **40 passed, 3 skipped, 0 failed** (`56.4s`; 3 test bỏ qua thuộc `.local.spec.ts` cần `JLPT_LOCAL_AUTH=1`; lần chạy trước đó gặp 1 timeout thoáng qua ở `motion-scene.spec.ts:188` do chạy song song với test WebGL2 chậm, chạy tươi lại đạt 40/40) |
