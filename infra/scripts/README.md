# Đóng gói nội dung

Từ gốc dự án, chạy `pnpm packs:build`, sau đó `pnpm packs:verify`. Lệnh build đọc phiên bản từ `infra/content/n4/VERSION`, ghi gói vào `infra/packs/` và chép sang `frontend/public/packs/`. Hai thư mục này chứa đầu ra được sinh lại, không lưu trong Git.

`infra/content/n4/` là nguồn cho cả chín bảng N4. Năm bảng từ vựng, kanji, từ ghép, ngữ pháp và đọc hiểu được chỉnh trực tiếp ở đây. Lệnh `pnpm --filter @luyen/infra-scripts content:n4` chỉ tạo lại bốn bảng so sánh, chia từ, kính ngữ và cặp động từ từ JSONL.

Đặt `EXPERIMENTAL_LEVELS=1` trước khi build để thêm mẫu N3. Build lại khi tắt cờ để bỏ mẫu khỏi bản phát hành. Không dùng dữ liệu mẫu làm giáo trình N3.

Lệnh verify so các bảng với nguồn hiện tại, kiểm cả hai bản gói và đối chiếu N4 với JSONL gốc. Mã thoát là 1 khi có lỗi. Khi đổi dữ liệu N4, tăng `VERSION` để thiết bị đã lưu gói biết cần cập nhật.

Trên CI sạch, truyền thư mục chứa manifest của lần phát hành trước: `pnpm --filter @luyen/infra-scripts packs:verify <previous-n4-pack-dir>`. Lệnh này kiểm thêm mã mục bị xóa và phát hiện hai bộ dữ liệu dùng chung một phiên bản. Lần phát hành đầu tiên không cần gói đối chiếu.

## Nguồn gói cho frontend

Trước khi build frontend từ checkout sạch, chạy `packs:build` như trên để có gói dự phòng tại `/packs`. Adapter mặc định dùng chính thư mục này. Để kiểm tra bản cập nhật từ nguồn khác, đặt `VITE_CONTENT_INDEX_URL` khi build, trỏ tới thư mục gói hoặc tệp `index.json` của nguồn đó. Phục vụ qua HTTPS (localhost khi phát triển) để trình duyệt dùng được Web Crypto; nếu nguồn khác origin, cho phép frontend đọc cả index, manifest và các bảng qua CORS.

Adapter chỉ ghi phiên bản mới vào IndexedDB sau khi cả 9 bảng đạt kiểm tra SHA-256 và schema. Khi cập nhật lỗi, adapter dùng bản cache hợp lệ gần nhất; nếu cache không dùng được, nó thử gói đóng kèm. Có thể học với gói vừa tải ngay cả khi trình duyệt không cho lưu cache.

## Kiểm tra web cục bộ

Chạy `pnpm exec playwright install chromium` một lần. Sau `pnpm packs:build`, `pnpm packs:verify` và `pnpm build`, chạy `pnpm e2e:web`. Bộ test tự khởi động Vite preview trên `127.0.0.1:4174` và chạy bộ test khách với IndexedDB thật. Bộ test hai tài khoản cần Supabase local; xem kế hoạch Epic 2.

Để thử N3, đặt `EXPERIMENTAL_LEVELS=1` cho cả lần dựng gói và lần chạy E2E; chạy lại `pnpm build` giữa hai bước. GitHub Actions chạy cả chế độ mặc định và chế độ thử nghiệm.
