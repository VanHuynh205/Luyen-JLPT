# Rà soát Bổ sung 3 đề JLPT N4 trước 2020 (2018-12, 2017-07, 2013-07) & Nâng cấp 0.3.1

**Chế độ rà:** `delegation` (`open-code-review-delegate`, `workspace` mode).  
**Báo cáo đối chiếu trước đó:** [2026-11-25-luyen-de-jlpt-review.md](./2026-11-25-luyen-de-jlpt-review.md), `DESIGN.md`, `AGENTS.md`.

## 1. Cách rà & Độ phủ OCR (`delegation`)

| Việc | Công cụ / Skill | Ghi chú |
| --- | --- | --- |
| Chọn file & nạp rule | `open-code-review-delegate` (`ocr`) | `ocr delegate preview --format json` (trước khi `release-ops` xóa `.tmp-exam-ocr-2/`): `102` file thay đổi/mới (`9` file `reviewable`, `93` file `excluded` gồm 90 PNG + 1 TXT trong `.tmp-exam-ocr-2/`, `questions.jsonl`, `tests/web/exam-practice.spec.ts`). `ocr delegate rule --format json`: 4 nhóm rule hệ thống (`default`, `JSON`, `TS/JS`, `Python`). |
| Rà diff & toàn bộ file mới | Đọc 100% `git diff` và toàn bộ file thêm mới | Rà toàn bộ 9 file `reviewable` (5 file sửa: `.gitignore`, `ExamListPage.tsx`, `desktop` & `mobile` `tauri.conf.json`, `manifest.json`; 4 file mới: 3 JSON đề + `.tmp-exam-ocr-2/extract.py`) cùng 2 file ngoài danh sách `reviewable` (`tests/web/exam-practice.spec.ts` và `infra/dataset_n4_exams/jsonl/questions.jsonl`). |
| Kiểm tra dữ liệu 9 đề (3 đề mới) | `pnpm packs:build`, `pnpm packs:verify` + Python audit độc lập + đối chiếu ảnh PDF đáp án gốc | Xác minh 9 đề / **719 câu hỏi** (426 cũ + 98 + 97 + 98), 719 ID duy nhất, 0 khóa JSON lạ/sai chính tả, 0 kanji trần ngoài `{base\|reading}`, 100% khớp base ruby–plain, 0 trường lời giải/script rỗng, 0 file `.mp3`/`.m4a` trong `frontend/public/`, `git diff HEAD -- infra/content/n4` rỗng. |
| Kiểm chứng trước dọn rác | `verification-before-completion` | Chạy tươi `pnpm packs:build`, `pnpm packs:verify`, `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`; tất cả thoát mã `0`. Chuỗi kiểm chứng cuối sau khi xóa `.tmp-exam-ocr-2/` (kèm `pnpm e2e:web`) do `release-ops` thực hiện. |

### Độ phủ OCR (`delegation`, workspace trước dọn rác)

- `total_files` (`reviewable_files`): **9**
- `reviewed_files`: **9 / 9**
- `skipped_files`: **0**
- `coverage_rate`: **100%**

| File | Trạng thái | Kết quả rà |
| --- | --- | --- |
| `.gitignore` | modified | `reviewed` — bổ sung `/infra/de_jlptn4_2/` ngay sau `/infra/de_jlptn4/`, ngăn commit file PDF/audio nguồn gốc. |
| `desktop/src-tauri/tauri.conf.json` | modified | `reviewed` — nâng `"version"` từ `"0.3.0"` lên `"0.3.1"`, giữ nguyên `identifier`, `build`, `bundle`. |
| `mobile/src-tauri/tauri.conf.json` | modified | `reviewed` — nâng `"version"` từ `"0.3.0"` lên `"0.3.1"`, đồng bộ phiên bản với bản desktop. |
| `frontend/src/pages/ExamListPage.tsx` | modified | `reviewed` — cập nhật mô tả đầu trang bao quát cả chuẩn hiện hành (25/55/35 phút — 115 phút) và trước 2020 (30/60/35 phút — 125 phút), giữ nguyên Washi & Sumi, 100% tiếng Việt, nút ≥ 44px (1 ghi nhận Low). |
| `infra/dataset_n4_exams/manifest.json` | modified | `reviewed` — cập nhật `examCount: 9`, `totalQuestions: 719`, thứ tự giảm dần từ `2025-07` đến `2013-07`, khớp SHA-256 với `verifyExams`. |
| `infra/dataset_n4_exams/exams/n4-2013-07.json` | added | `reviewed` — 98 câu (35/35/28), 18 nhóm (`g-m4-1`..`g-m4-4`), `1800/3600/2100s`, 98/98 khớp PDF `p14.png`, 0 lỗi schema/ruby. |
| `infra/dataset_n4_exams/exams/n4-2017-07.json` | added | `reviewed` — 97 câu (34/35/28), 18 nhóm (`g-m4-1`..`g-m4-4`), `1800/3600/2100s`, 97/97 khớp PDF `p43.png`–`p44.png`, xử lý trung tính các chữ Hán biến thể nét ngoài Unicode ở M2 Q11–Q14, 0 lỗi schema/ruby. |
| `infra/dataset_n4_exams/exams/n4-2018-12.json` | added | `reviewed` — 98 câu (35/35/28), 18 nhóm (`g-m4-1`..`g-m4-4`), `1800/3600/2100s`, 96/98 khớp PDF `p14.png` + 2 bản sửa `solved` đã xác minh độc lập trên bản scan (`l-05`, `l-21`), 0 lỗi schema/ruby. |
| `.tmp-exam-ocr-2/extract.py` | added | `reviewed` — script PyMuPDF tạm để xuất 90 PNG và 1 TXT phục vụ đọc đề; đánh dấu **AN TOÀN ĐỂ XÓA**. |

*(Ngoài 9 file `reviewable` trên, 2 file `excluded` có thay đổi là `tests/web/exam-practice.spec.ts` và `infra/dataset_n4_exams/jsonl/questions.jsonl` đều đã được đọc và rà đầy đủ.)*

## 2. Kiểm tra dữ liệu toàn bộ 9 đề JLPT N4 (`infra/dataset_n4_exams/`)

| Mã đề | ID | Từ vựng | Ngữ pháp & Đọc hiểu | Nghe hiểu | Tổng câu | Thời lượng 3 phần | Phân bố lựa chọn Nghe | Nguồn đáp án | Kanji trần / Thiếu lời giải |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `2025-07` | `n4-2025-07` | 28 | 29 | 0 *(chưa có script)* | **57** | `1500/3300/2100s` (115p) | — | `official_key` (57) | 0 / 0 |
| `2024-12` | `n4-2024-12` | 28 | 29 | 28 *(có script)* | **85** | `1500/3300/2100s` (115p) | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2024-07` | `n4-2024-07` | 28 | 29 | 28 *(có script)* | **85** | `1500/3300/2100s` (115p) | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2023-07` | `n4-2023-07` | 28 | 29 | 0 *(chưa có script)* | **57** | `1500/3300/2100s` (115p) | — | `official_key` (57) | 0 / 0 |
| `2021-12` | `n4-2021-12` | 28 | 29 | 28 *(có script)* | **85** | `1500/3300/2100s` (115p) | M1–M2: 15×4; M3–M4: 13×3 | `official_key` (85) | 0 / 0 |
| `2021-07` | `n4-2021-07` | 28 | 29 | 0 *(chưa có script)* | **57** | `1500/3300/2100s` (115p) | — | `mixed` (56 gốc + 1 `solved`) | 0 / 0 |
| **`2018-12`** | **`n4-2018-12`** | **35** | **35** | **28** *(có script)* | **98** | **`1800/3600/2100s` (125p)** | **M1–M2: 15×4; M3–M4: 13×3** | **`mixed` (96 gốc + 2 `solved`)** | **0 / 0** |
| **`2017-07`** | **`n4-2017-07`** | **34** | **35** | **28** *(có script)* | **97** | **`1800/3600/2100s` (125p)** | **M1–M2: 15×4; M3–M4: 13×3** | **`official_key` (97)** | **0 / 0** |
| **`2013-07`** | **`n4-2013-07`** | **35** | **35** | **28** *(có script)* | **98** | **`1800/3600/2100s` (125p)** | **M1–M2: 15×4; M3–M4: 13×3** | **`official_key` (98)** | **0 / 0** |
| **Tổng cộng** | **9 đề** | **272** | **279** | **168** | **719** | **6×115p + 3×125p** | **90×4 + 78×3** | **716 gốc + 3 `solved`** | **0 / 0** |

- `infra/dataset_n4_exams/jsonl/questions.jsonl`: **719 dòng**, **719 ID duy nhất**, khớp 100% với 9 JSON đề và `verifyExams`.
- `git diff HEAD -- infra/content/n4`: **rỗng** (không sửa gói nội dung N4 `1.0.0`).
- Số file âm thanh (`.mp3`, `.m4a`, `.wav`, `.ogg`) dưới `frontend/public/`: **0**.
- Cấu trúc nhóm: cả 3 đề mới đều có 18 nhóm (`5` Từ vựng + `9` Ngữ pháp & Đọc hiểu tách riêng `g-m4-1`..`g-m4-4` cho 4 đoản văn + `4` Nghe hiểu), đủ `5/5` `imageHint` ở Nghe M3 và có `imageHint` cho các câu có tranh ở M1.

## 3. Đối chiếu đáp án gốc & Kiểm tra chọn mẫu (Spot-check)

### Đối chiếu toàn bộ 293 đáp án mới với ảnh bảng đáp án PDF gốc

- **`n4-2013-07` (`p14.png` — `参考答案`):** Khớp **98 / 98** câu (35 Từ vựng, 35 Ngữ pháp & Đọc hiểu, 28 Nghe hiểu), `answerSourceSummary: "official_key"`.
- **`n4-2017-07` (`p43.png` & `p44.png` — `正答表`):** Khớp **97 / 97** câu (34 Từ vựng, 35 Ngữ pháp & Đọc hiểu, 28 Nghe hiểu; đã bỏ đúng cột `例` ở phần Nghe), `answerSourceSummary: "official_key"`.
- **`n4-2018-12` (`p14.png` — `参考答案`):** Khớp **96 / 98** câu (`official_key`); **2 câu** dùng `answerSource: "solved"` (`answerSourceSummary: "mixed"`) đã được kiểm chứng độc lập trên ảnh đề & lời thoại PDF:
  1. `n4-2018-12-l-05` (Nghe M1 câu 5 — đối chiếu `2018-12/p11.png` & `p20.png`): Tranh bàn làm việc đánh số 4 ngăn kéo từ trên xuống dưới `1 → 2 → 3 → 4`. Lời thoại nói `たぶん引き出しの下から二番目` (ngăn 3) rồi lập tức đính chính `あ、ごめん。そのもう一つ上だ。` → ngăn **2** (`answerIndex: 1`). Bảng đáp án PDF in nhầm là `3`. Xác nhận bản sửa đúng 100%.
  2. `n4-2018-12-l-21` (Nghe M4 câu 1 — đối chiếu `2018-12/p23.png`): Câu dẫn `よかったら、お茶をもう一杯いかがですか。` (Nếu tiện, bạn dùng thêm một tách trà nhé?). Phương án 1 `すみません、いただきます。` là câu nhận lời lịch sự duy nhất đúng (`answerIndex: 0`), còn phương án 3 `いいえ、どういたしまして。` chỉ dùng đáp lời cảm ơn. Bảng đáp án PDF in nhầm là `3`. Xác nhận bản sửa đúng 100%.

### Kiểm tra chọn mẫu chi tiết theo ảnh scan PDF

- **`n4-2017-07` Từ vựng M2 Q11–Q14 (`2017-07/p04.png`):** Xác nhận cả 4 câu đều có chữ Hán nhiễu biến thể nét/đảo bộ ngoài Unicode (`揚/場` + `所` đảo `斤/戸`, `走/歩` tráo phần trên `止/土`, `便` tráo bộ `彳/亻`, `眠` tráo bộ `日/目`). JSON biểu diễn bằng chú thích bộ thủ trung tính trong ngoặc (không làm lộ đáp án), không có kanji trần trong `choicesRuby`, kèm giải thích tiếng Việt rõ ràng về bộ thủ.
- **Đọc hiểu & Nghe hiểu chọn mẫu:** Đã đối chiếu trực tiếp `n4-2013-07-g-34` (`2013-07/p09.png`), `n4-2013-07-l-01` (`2013-07/p20.png`), `n4-2017-07-g-29` (`2017-07/p22.png`) và `n4-2017-07-g-34` — toàn bộ văn bản đoạn đọc, câu hỏi, gạch chân `[[...]]`, lựa chọn, đáp án và lời giải tiếng Việt đều khớp chính xác với đề gốc.

## 4. Rà soát mã nguồn, cấu hình & kiểm thử (`open-code-review-delegate` + `DESIGN.md`)

- **`.gitignore`:** Thêm `/infra/de_jlptn4_2/` đúng chuẩn, đối xứng với `/infra/de_jlptn4/`.
- **`desktop/src-tauri/tauri.conf.json` & `mobile/src-tauri/tauri.conf.json`:** Nâng phiên bản đồng nhất `0.3.0` → `0.3.1` (`Cargo.toml` giữ `0.1.0` đúng theo quy ước hiện hữu của repo).
- **`frontend/src/pages/ExamListPage.tsx`:** Giao diện Washi & Sumi, tiếng Việt đầy đủ, không vi phạm font hay chạm ≥ 44px.
- **`tests/web/exam-practice.spec.ts`:** Mở rộng `EXPECTED_EXAMS` và số nút `exam_list.start.*` lên **9 đề**, tách helper `completeExamWithoutListening`, bổ sung test kiểm tra đồng hồ đề trước 2020 `n4-2018-12` (`30:00`/`29:59` và `60:00`/`59:59`) và luồng làm lại đề trên `n4-2023-07` (vị trí `exam_list.item.4` khớp `manifest.json`, xác nhận `"Đã làm 2 lần"` và `"Làm lại đề"`).

### Phát hiện theo mức độ

- **Critical / High:** Không có (0).
- **Medium:** Không có (0).
- **Low (ghi nhận, không chặn release):**
  1. `frontend/src/pages/ExamListPage.tsx` (dòng 71–78, `maintainability`): tiêu đề `<h1>` dùng biến động `Luyện đề JLPT {levelLabel}` nhưng đoạn mô tả `<p>` ngay dưới ghi cố định `JLPT N4` kèm thời lượng riêng của N4 (`25/55/35` và `30/60/35`). Hiện tại cách viết này chính xác về mặt nội dung (vì các con số trên là chuẩn N4 và cấp N3 chưa có đề), nhưng khi bổ sung đề N3 ở đợt sau nên tách câu mô tả theo `level` để tránh hiển thị `JLPT N4` dưới tiêu đề `Luyện đề JLPT N3`.

## 5. Rà soát file/thư mục tồn dư & Danh mục Dọn rác an toàn

Đối chiếu đầy đủ từ `git status --ignored -s` tại thời điểm rà soát (trước khi `release-ops` dọn rác):

| Đường dẫn | Phân loại | Trạng thái / Ghi chú |
| --- | --- | --- |
| `.tmp-exam-ocr-2/` (`extract.py`, `text/2017-07-key-script.txt`, `pages/2013-07/*.png` 23 ảnh, `pages/2017-07/*.png` 44 ảnh, `pages/2018-12/*.png` 23 ảnh; tổng **92 file**, cộng `__pycache__/` nếu phát sinh) | **MARKED SAFE TO DELETE (tạm sinh trong phiên)** | **An toàn để `release-ops` xóa hoàn toàn** sau khi chốt rà soát; chỉ phục vụ OCR/đọc đề PDF trong phiên. |
| `infra/packs/n3/`, `frontend/public/packs/n3/`, `frontend/dist/packs/n3/` | **MARKED SAFE TO DELETE (nếu phát sinh vỏ rỗng)** | Đã kiểm tra hiện **chưa tồn tại** trên đĩa; nếu `pnpm e2e:web` chế độ N3 tạo lại vỏ thư mục rỗng thì xóa an toàn. |
| `infra/dataset_n4_exams/exams/*.json` (9 đề), `infra/dataset_n4_exams/manifest.json`, `infra/dataset_n4_exams/jsonl/questions.jsonl` | **KEEP** | Bộ dataset chuẩn 9 đề JLPT N4 (719 câu hỏi), được `pnpm packs:verify` kiểm chứng byte-for-byte & SHA-256. |
| `.gitignore`, `frontend/src/pages/ExamListPage.tsx`, `desktop/src-tauri/tauri.conf.json`, `mobile/src-tauri/tauri.conf.json`, `tests/web/exam-practice.spec.ts`, `docs/code-review/2026-11-26-de-jlptn4-2-review.md` | **KEEP** | Mã nguồn, cấu hình phiên bản `0.3.1`, E2E test và báo cáo rà soát của đợt cập nhật. |
| `infra/content/n4/` | **KEEP** | Gói nội dung N4 `1.0.0`, `git diff HEAD -- infra/content/n4` rỗng. |
| `infra/packs/`, `frontend/public/packs/`, `frontend/dist/`, `test-results/`, `node_modules/`, `frontend/node_modules/`, `infra/scripts/node_modules/`, `graphify-out/`, `mobile/src-tauri/icons/`, `.claude/`, `.codex/`, `_bmad/custom/config.user.toml`, `_bmad/render/bmad-agent-po/` | **BUILD OUTPUT / LOCAL CONFIG (gitignore, tái tạo được)** | Sản phẩm build/test/cấu hình cục bộ đã `.gitignore`, không commit. |
| `infra/de_jlptn4/` (`7` mục / `18` file gốc của đợt 1) | **DO NOT DELETE** | **Tài liệu nguồn gốc của người dùng — tuyệt đối không xóa.** |
| `infra/de_jlptn4_2/` (`6` file gốc: 3 PDF `N4-2013年7月.pdf`, `N4-2017年-7月.pdf`, `N4-2018年.pdf` + 1 `.mp3` + 2 `.m4a`) | **DO NOT DELETE** | **Tài liệu nguồn gốc của người dùng — tuyệt đối không xóa** (đã thêm vào `.gitignore`). |
| `.cache/` & `infra/dataset_n4_minnanihongo.zip` (tracked) | **DO NOT DELETE** | Tồn dư bộ nhớ đệm / file gốc đã có từ trước, giữ nguyên để chủ dự án tự quyết định. |

## 6. Kết quả kiểm chứng

### 6.1. Kiểm chứng trước dọn rác (do `verifier` chạy tươi ngày 26-11-2026)

| Lệnh | Exit | Kết quả thực tế |
| --- | --- | --- |
| `pnpm packs:build` | `0` | Build gói N4 `1.0.0` + 9 đề thi (`infra/packs/n4/exams/` & `frontend/public/packs/n4/exams/`), cập nhật `manifest.json` (9 đề, 719 câu) và `questions.jsonl` (719 dòng); cảnh báo không chặn `64/74` comparison links giữ nguyên như trước. |
| `pnpm packs:verify` | `0` | Xác minh toàn bộ gói N4 + đối chiếu byte-for-byte & SHA-256 cho cả 9 đề thi, `index.json`, `manifest.json`, `questions.jsonl`. |
| `pnpm typecheck` | `0` | `frontend` & `infra/scripts` `tsc --noEmit` đạt (0 lỗi). |
| `pnpm check` | `0` | Biome kiểm tra `155` file `frontend` + `13` file `infra/scripts` (0 lỗi). |
| `pnpm test` | `0` | `frontend`: **34/34** file, **292/292** test đạt; `infra/scripts`: **5/5** file, **100/100** test đạt (tổng **392/392**). |
| `pnpm build` | `0` | Build gói N4 + 9 đề + Vite production bundle thành công. |

### 6.2. Kiểm chứng cuối sau dọn rác (do `release-ops` chạy tươi ngày 26-11-2026)

- **Trạng thái dọn rác:**
  - Đã xóa vĩnh viễn `.tmp-exam-ocr-2/` (92 file: 90 PNG, 1 TXT `2017-07-key-script.txt`, `extract.py`); xác nhận `Test-Path .tmp-exam-ocr-2` = `False`.
  - Đã kiểm tra `infra/packs/n3/`, `frontend/public/packs/n3/`, `frontend/dist/packs/n3/`: không tồn tại trước và sau khi chạy `pnpm e2e:web`.
  - Xác nhận nguyên vẹn thư mục nguồn người dùng: `infra/de_jlptn4/` (`7` mục / `18` file) và `infra/de_jlptn4_2/` (`6` file).

| Lệnh | Exit | Thời gian | Kết quả thực tế |
| --- | --- | --- | --- |
| `pnpm packs:build` | `0` | `1.51s` | Build gói N4 + 9 đề thi thành công (`64/74` comparison links matched). |
| `pnpm packs:verify` | `0` | `1.51s` | Xác minh toàn bộ gói N4 và cả 9 đề thi (`index.json`, `manifest.json`, `questions.jsonl`) đạt. |
| `pnpm typecheck` | `0` | `1.61s` | `frontend` & `infra/scripts` `tsc --noEmit` đạt (0 lỗi). |
| `pnpm check` | `0` | `1.72s` | Biome kiểm tra `155` file `frontend` (`133ms`) + `13` file `infra/scripts` (`44ms`), 0 lỗi. |
| `pnpm test` | `0` | `5.57s` | `frontend`: **34/34** file, **292/292** test (`2.83s`); `infra/scripts`: **5/5** file, **100/100** test (`3.04s`); tổng **392/392** test đạt. |
| `pnpm build` | `0` | `4.64s` | Build gói N4 + Vite production bundle `frontend/dist` thành công. |
| `pnpm e2e:web` | `0` | `58.12s` | Playwright (`56.4s`, 2 workers): **42 passed, 3 skipped** (3 test `*.local.spec.ts` bỏ qua do không bật `JLPT_LOCAL_AUTH=1`; cả 7 test trong `tests/web/exam-practice.spec.ts` đều đạt). |
