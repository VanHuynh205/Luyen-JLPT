# Code review 2026-11-21

Phạm vi: toàn bộ mã nguồn hiện có (chưa có lịch sử git, nên review ở chế độ workspace với mọi file là file mới).
Cách làm: `open-code-review-delegate` (OCR CLI lọc file và cấp rule, agent tự đọc và review), cộng `tsc --noEmit` và `biome check` cho frontend, `moc --check` 2.1.0 cho backend.

## Độ phủ

| Hạng mục | Số file | Trạng thái |
| --- | --- | --- |
| OCR liệt kê là reviewable | 80 | |
| Backend `.mo` (OCR loại vì `unsupported_ext`, review thủ công) | 6 | reviewed |
| Tổng | 86 | |
| Đọc kỹ từng dòng | 28 | reviewed |
| Chỉ kiểm tra tĩnh (tsc, biome sạch): component trình bày, config Vite/Tailwind/Biome | 38 | skipped, lý do: logic hiển thị, không có luồng dữ liệu hay trạng thái lưu |
| E2E `.e2e.ts` và spec JSON do Caffeine sinh ("Edit the spec, not this file") | 20 | skipped, lý do: file sinh tự động, chỉ chạy trên hạ tầng Caffeine |

Loại khỏi review theo chủ ý: `src/frontend/src/components/ui/**` (shadcn), `src/frontend/src/data/**` (dữ liệu sinh từ dataset, đã đối chiếu số lượng riêng), `src/frontend/src/declarations/**` và `backend.ts` (binding sinh), `infra/**`, lockfile.

Kiểm tra đã chạy:

- `pnpm typecheck` (frontend): pass.
- `pnpm check` (biome, 89 file): pass, không có lỗi.
- `moc --check` 2.1.0 với `--enhanced-migration src/backend/migrations`: pass sau khi sửa.
- Đối chiếu dữ liệu với `infra/dataset_n4_minnanihongo/manifest.json`: từ vựng 1182/1182, kanji 118/118, ngữ pháp 148/148. Từ ghép 388/403: 15 bản ghi trùng từ (ví dụ 番号 thuộc cả 番 và 号) được gộp bằng trường `kanjiIds`, không mất nội dung.

## Phát hiện

### Medium

1. **[security, đã sửa] `src/backend/lib/progress.mo`**: API lưu tiến độ không giới hạn độ dài `cardId`, `patternId`, `passageId`, số phần tử `wrongItemIds` và giá trị `total`. Một tài khoản đăng nhập có thể ghi dữ liệu kích thước tùy ý vào stable memory của canister trong một lần gọi. Đã thêm `requireValidId` (1–128 ký tự), `requireValidTotal` (`score <= total <= 1000`) và kiểm tra `wrongItemIds.size() <= total`. Không đổi kiểu stable, không cần migration.
2. **[thiếu tính năng so với yêu cầu]** Bốn bảng dataset chưa được đưa vào app: `so_sanh` (27 bản ghi so sánh ngữ pháp), `cach_chia` (22 quy tắc chia), `kinh_ngu` (17 mục kính ngữ), `tu_dong_tha_dong` (12 cặp tự/tha động từ). Yêu cầu dự án ghi "bổ sung đầy đủ y như trong file dataset". Đưa vào kế hoạch phát triển.
3. **[test]** Không có unit test cho logic frontend (`quizEngine.ts`, `kanji-library/search.ts`, `useProgress.ts`) và backend (`lib/progress.mo`). E2E hiện có chỉ chạy trên hạ tầng Caffeine (repo không có `e2e.config.ts`). Đưa vào kế hoạch kiểm thử.

### Low

4. **[maintainability] `src/frontend/src/components/InternetIdentity.tsx`**: không được import ở đâu, chuỗi giao diện tiếng Anh. Là file mẫu của Caffeine nên chưa xoá; xoá khi chuyển sang lớp auth đa nền tảng.
5. **[bug nhỏ] `src/frontend/src/pages/ReadingDetailPage.tsx`**: state `answers`/`submitted` không reset khi chuyển thẳng giữa hai bài đọc bằng lịch sử trình duyệt (cùng route, component không remount). Đi qua trang danh sách thì không gặp. Sửa bằng `key={passageId}` khi làm lại trang đọc hiểu.
6. **[security, rủi ro còn lại]** Mỗi lần gọi đã bị giới hạn, nhưng số bản ghi mỗi người dùng vẫn không có trần (gọi lặp vẫn làm tăng bộ nhớ). Cần trần theo người dùng khi mở rộng nhiều cấp độ JLPT.
7. **[data] `recordReadingResult`**: `bestScore` được so sánh giữa các lần làm có `total` khác nhau nếu bài đọc đổi số câu. Nên lưu tỉ lệ hoặc reset khi `total` đổi.

## Cấu trúc thư mục

Code backend nằm trong `src/backend`, frontend trong `src/frontend`, dataset trong `infra/`, không có file đặt sai chỗ. `src/frontend/src/backend.ts` là binding client sinh tự động, thuộc frontend. Không di chuyển `src/backend`/`src/frontend` lên cấp gốc vì `caffeine.toml`, `mops.toml`, `pnpm-workspace.yaml` và script `bindgen` của nền tảng Caffeine phụ thuộc các đường dẫn này. `desktop/` và `mobile/` còn trống, sẽ chứa vỏ ứng dụng theo kế hoạch.
