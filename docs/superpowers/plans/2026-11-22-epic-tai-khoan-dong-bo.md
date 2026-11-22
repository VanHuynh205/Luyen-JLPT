# Epic 2: tài khoản và đồng bộ ngoại tuyến

**Trạng thái: chưa nghiệm thu.** Việc triển khai và kiểm tra cục bộ không thay cho lần chạy CI với Supabase thật và lần đăng nhập trên bản staging. Không chuyển dữ liệu ICP.

| Hạng mục | Điểm kiểm tra |
| --- | --- |
| Web tĩnh | Workspace `frontend/`, đường dẫn cũ và `/tai-khoan`; output `frontend/dist`. |
| Postgres | `backend/supabase/migrations` và `tests/progress.test.sql`: mỗi người chỉ thấy dữ liệu của mình, email đã xác nhận mới có quyền ghi, giới hạn 128 ký tự/1.000 câu, xoá theo tài khoản. |
| Lưu cục bộ | `frontend/src/core/progress` và `adapters/local-store`: ghi tiến độ và hàng đợi trong một giao dịch, tách theo tài khoản và cấp độ. |
| Đồng bộ | `core/sync` và `adapters/supabase-sync`: gửi lại khi có mạng, lượt làm có UUID, trạng thái mới hơn thắng, kéo từng trang theo dấu thời gian máy chủ. |
| Tài khoản | Đăng ký tên/email/mật khẩu, email xác nhận, Google PKCE, đặt lại mật khẩu, gộp khách có xác nhận, xoá có xác nhận. Phiên lưu trong Dexie. |
| Giao diện | Học cả bốn phần khi chưa đăng nhập; trang Tiến độ lọc theo cấp độ, gồm cả bài Kanji đúng hết và danh sách mục hay sai. |
| Cắt chuyển ICP | Frontend không gọi canister. Giữ mã nguồn và bản triển khai ICP cũ đến khi bản thay thế chạy thật. |

Hai thay đổi so với phác thảo: khoá trạng thái gồm `(user_id, level, item_id)` để hai gói có thể dùng cùng mã; `resolve-login` không trả email cho người tra tên. Chỉ khi mật khẩu hợp lệ mới trả token phiên.

## Cổng nghiệm thu

**Bổ sung kiểm chứng trên Supabase local chạy bằng Docker:** hai E2E tài khoản đạt (xác nhận email, đặt lại mật khẩu, đồng bộ trong 30 giây, cách ly tài khoản và xoá tài khoản thử). `supabase test db --workdir backend` đạt 60 assertion pgTAP trên stack local đã có dữ liệu. Kết quả local chưa thay thế CI từ xa hoặc kiểm thử trên web staging.

**Kết quả cục bộ ngày 22-11-2026:** 178 test frontend và 93 test đóng gói đạt. Typecheck, Biome, build và kiểm gói đạt. Chromium: 15 E2E khách đạt ở mỗi chế độ N4/N3 thử nghiệm. Deno: 8 test Edge Functions dùng upstream giả lập đạt. Chưa chạy Semgrep.

**Staging:** `https://luyen-jlpt.vanhuynh20050808.workers.dev`. `/tai-khoan` và `/tai-khoan?type=recovery` trả HTTP 200 khi điều hướng trực tiếp; `/packs/index.json` trả HTTP 200 và JSON. `JLPT_STAGING_URL` + `pnpm e2e:web`: 15/15 bài khách đạt. Nút Google dùng PKCE S256; Supabase trả 302 tới màn hình đăng nhập Google với callback cùng project và đích quay về `/tai-khoan`. Chưa đăng nhập Google, chưa kiểm tra việc tạo phiên sau callback hoặc các luồng tài khoản khác trên staging.

Hai Edge Functions `resolve-login` và `delete-account` trả HTTP 204 cho yêu cầu CORS preflight từ staging và cho phép POST. Kiểm tra này không tạo tài khoản và không chứng minh đăng nhập hoặc xoá tài khoản thành công.

**GitHub Actions:** Workflow `ci.yml` có sẵn; checkout chưa có commit hoặc remote. Chưa có kết quả CI từ xa. Cần push mã và workflow tới repo GitHub đã bật Actions.

1. Chạy `pnpm install --frozen-lockfile`, `pnpm packs:build`, `pnpm packs:verify`, `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`, `pnpm e2e:web`. Lặp lại build và E2E với `EXPERIMENTAL_LEVELS=1`.
2. Trên máy có Docker/Podman, chạy `supabase start --workdir backend` và `supabase test db --workdir backend`. Chạy test Edge theo `backend/supabase/README.md`. Job CI dựng frontend bằng URL và public key của stack cục bộ; `JLPT_LOCAL_AUTH=1` bật E2E hai tài khoản, hai trình duyệt và đồng bộ trong 30 giây. Service-role của stack cục bộ chỉ cấp cho test runner sau bước build.
3. Staging: quản trị viên cấu hình Google provider, xác nhận email, SMTP và redirect chính xác tới `/tai-khoan`; áp migrations và triển khai hai Edge Functions. Không đưa service role, mật khẩu DB hay Google secret vào frontend.
4. Trên host web tĩnh, build từ repo root bằng `pnpm build`, xuất `frontend/dist`. Cấu hình `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` **trước** khi build. Hai biến trống cho phép chạy bản khách, không phải bản nghiệm thu tài khoản.
5. Ghi URL staging và kết quả: email chưa xác nhận, đăng nhập bằng tên/email/Google, đặt lại mật khẩu, gộp hoặc giữ riêng tiến độ khách, lưu ngoại tuyến rồi đồng bộ sang thiết bị thứ hai, tài khoản khác không thấy dữ liệu, xoá tài khoản thử. Không dùng tài khoản cá nhân để test xoá.
6. Sau khi các cổng trên xanh: bỏ `src/backend`, `mops.toml`, `mops.lock`, `caffeine.toml`, `deployed/` và `.old/` theo roadmap. Sau đó bắt đầu **Epic 3**: `desktop/src-tauri`, build Windows `.exe`, rồi Android `.apk`; iOS sau khi có macOS.

Để chạy lại E2E khách trên bản đã deploy, đặt `JLPT_STAGING_URL` bằng origin HTTPS của staging rồi chạy `pnpm e2e:web`. Runner không khởi động Vite và chỉ chọn bốn tệp test khách. Đặt `EXPERIMENTAL_LEVELS=1` nếu bản staging có gói N3 mẫu. Không bật `JLPT_LOCAL_AUTH`; bộ này không xác minh đăng nhập, đồng bộ sang thiết bị khác hay xoá tài khoản.
