# Lộ trình code và kiểm thử: initiative-jlpt-da-nen-tang

> Tài liệu điều phối. Mỗi epic có một plan riêng theo `superpowers:writing-plans`, viết khi Sofia (`bmad-agent-po`) đã refine epic đó. Plan đã viết: `2026-11-21-epic-goi-noi-dung.md`.

**Spec:** `docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md`, `tickets/tickets.toml`, `architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md`.

## Thứ tự và điều kiện bắt đầu

| # | Epic | Plan | Bắt đầu khi |
| --- | --- | --- | --- |
| 1 | epic-goi-noi-dung | `2026-11-21-epic-goi-noi-dung.md` (đã viết) | Ngay |
| 2 | epic-tai-khoan-dong-bo | `2026-11-22-epic-tai-khoan-dong-bo.md` (chờ nghiệm thu staging) | Epic 1 xong; có dự án Supabase staging và OAuth client Google |
| 3 | epic-ung-dung-tauri | viết sau refine | Epic 2 xong luồng đăng nhập; `.exe` + `.apk` trước, iOS khi có macOS |
| 4 | epic-ngu-phap-mo-rong | viết sau refine | Epic 1 xong (chạy song song với 2–3 được, khác file) |
| 5 | epic-giao-dien-3d | viết sau refine; trước đó chạy `impeccable` (shape/new-work) để có mock Trang chủ 3D và Thẻ 3D | Epic 1 xong |
| 6 | ~~epic-chuyen-du-lieu-icp~~ | đã bỏ 2026-11-21 | Chưa có người dùng ICP (OQ-3) |

Mốc bạn bè dùng thử: sau epic 3 (có `.exe`/`.apk` cài được, đăng nhập và Đồng bộ chạy thật). Epic 4, 5 có thể ra sau mốc này.

Thêm Cấp độ N3: khi chủ dự án có dataset N3 (cùng định dạng `jsonl` + `manifest.json` như `infra/dataset_n4_minnanihongo`), mở initiative N3 riêng; plan đầu tiên dùng lại `import-dataset` của epic 1 để sinh `infra/content/n3/`.

## Khung task cho các plan sau

### Epic 2 — Tài khoản Supabase và Đồng bộ
1. Chuyển thư mục theo AD-1: `src/frontend` → `frontend/`; giữ `src/backend` chạy đến task 6 rồi xoá cùng `mops.toml`, `caffeine.toml` (không chuyển dữ liệu); deploy web lên host tĩnh (Cloudflare Pages, giả định). Kiểm: E2E web của epic 1 xanh trên URL mới.
2. `backend/supabase`: `supabase init`, migration bảng `profiles`, `card_status`, `grammar_learned`, `kanji_quiz_attempts`, `reading_attempts` theo AD-7/AD-8 (có cột `level`, `client_updated_at`, `server_updated_at`, CHECK giới hạn). Test pgTAP: RLS chặn đọc/ghi chéo; LWW không ghi đè bản mới hơn; insert lượt trùng UUID không nhân đôi; CHECK từ chối `item_id` 129 ký tự.
3. Lõi `core/progress` + `core/sync`: kiểu Tiến độ, outbox, hợp nhất LWW, tổng hợp lần làm/điểm cao nhất. Unit test thuần (không mạng).
4. Adapter `local-store` (bảng Dexie `progress_*`, `outbox`) + `supabase-sync` (đẩy outbox, kéo theo `server_updated_at`). Test tích hợp với `supabase start` cục bộ: ghi offline → bật mạng → dữ liệu lên trong 30 giây.
5. Đăng ký/đăng nhập (AD-9): bảng `profiles.username` unique; Edge Function `resolve-login`; adapter `auth` (Email + mật khẩu có xác nhận email, Google PKCE, quên mật khẩu, session lưu Dexie); màn `/tai-khoan`; gộp Tiến độ khách khi đăng nhập. Test: tên đăng nhập trùng bị từ chối (không phân biệt hoa thường); đăng nhập bằng tên đăng nhập và bằng email đều được; sai tên đăng nhập và sai mật khẩu trả cùng một thông báo; email chưa xác nhận không Đồng bộ được.
6. Thay `hooks/useProgress.ts` bằng hook đọc `ProgressRepository`; giữ nguyên chữ ký hook để trang không đổi. Xoá gọi ICP, xoá `src/backend`, `mops.toml`, `mops.lock`, `caffeine.toml`, `deployed/`, `.old/`.
7. Edge Function `delete-account` + nút xoá Tài khoản. Test: sau xoá, query mọi bảng của user trả 0 dòng.
8. Trang Tiến độ theo Cấp độ. E2E: hai người dùng (giữ kịch bản `second-learner-isolated`, `second-user-empty-progress`).

### Epic 3 — App desktop, Android, iOS
1. `desktop/src-tauri` (Tauri 2.12): cửa sổ, capabilities tối thiểu, `frontendDist = ../../frontend/dist`; build bộ cài NSIS `.exe` cục bộ trên Windows.
2. Deep link `luyenjlpt://auth-callback` cho Google, xác nhận email, đặt lại mật khẩu trên desktop. Test E2E bằng WebDriver (`tauri-driver`) trên Windows.
3. Updater desktop (plugin-updater, `latest.json`, khoá ký cập nhật giữ ngoài repo).
4. `mobile/src-tauri`: `tauri android init`, chạy trên Android Emulator; `.apk` ký bằng keystore riêng; kiểm `android-latest.json` và báo bản mới.
5. Chế độ máy bay: mở app, học Gói N4 đóng kèm. E2E trên emulator.
6. Màn Giới thiệu ghi nguồn KANJIDIC2 (CC BY-SA 4.0) và hướng dẫn cài `.apk` (cho phép nguồn ngoài) / bỏ qua cảnh báo SmartScreen.
7. CI: windows-latest xuất `.exe`, ubuntu-latest xuất `.apk`, đăng lên trang phát hành (GitHub Releases hoặc bucket `releases`).
8. iOS (sau, khi có macOS): `tauri ios init`, chạy iOS Simulator; không lên App Store.

### Epic 4 — Ngữ pháp mở rộng
1. Liên kết `comparisons.patterns` → `grammar` id (tách theo `／`, so khớp chuỗi mẫu); mẫu không khớp liệt kê trong báo cáo build, không chặn.
2. Bốn trang `/ngu-phap/so-sanh`, `/ngu-phap/cach-chia`, `/ngu-phap/kinh-ngu`, `/ngu-phap/tu-dong-tha-dong` + liên kết từ chi tiết Mẫu.
3. Sửa lỗi review #5: `ReadingDetailPage` reset khi đổi `passageId`.
4. E2E: số mục hiển thị bằng 27/22/17/12.

### Epic 5 — Điểm nhấn 3D
1. Mock bằng `impeccable` theo `ux-jlpt-da-nen-tang/DESIGN.md`; chủ dự án duyệt.
2. `core/motionPreference` + `useMotionPreference()` (reduced motion, cài đặt, phát hiện WebGL, đo fps).
3. `scene/HomeDesk` (R3F 9.8, drei 10.7, three 0.187), lazy; ảnh tĩnh thay thế.
4. Thẻ 3D, hanko 3D, chuyển cảnh GSAP 3.15; Lenis 1.3 chỉ ở `/`.
5. Ngân sách: đo kích thước chunk 3D (≤ 3 MB nén) trong CI; đo fps bằng Playwright + `requestAnimationFrame` trên CPU throttle 4×.
6. E2E giảm chuyển động: `page.emulateMedia({ reducedMotion: "reduce" })` → không có canvas WebGL động.

### Epic 6 — đã bỏ
Không chuyển dữ liệu ICP; xoá code ICP nằm ở epic 2 task 6.

## Chiến lược kiểm thử

| Tầng | Công cụ | Chạy ở | Phạm vi |
| --- | --- | --- | --- |
| Unit | Vitest 5.1.1 | mọi commit | `core/*`, `infra/scripts/*`, logic component thuần (quiz, search) |
| Adapter | Vitest + fake-indexeddb, `fetch` giả | mọi commit | `adapters/content-pack`, `adapters/local-store` |
| Cơ sở dữ liệu | pgTAP qua `supabase test db` | mọi commit đổi `backend/supabase` | RLS, CHECK, LWW, idempotent insert |
| Tích hợp đồng bộ | Vitest + `supabase start` (Docker) | PR | outbox → Postgres → kéo về thiết bị thứ hai |
| E2E web | Playwright 1.65.1 | PR | route, chọn Cấp độ, flashcard, quiz, đọc hiểu, hai tài khoản |
| E2E desktop | WebdriverIO + `tauri-driver` | PR nhánh release | mở app, đăng nhập deep link, ngoại tuyến |
| E2E di động | Android Emulator (API 34); iOS Simulator khi có macOS | nhánh release | cài `.apk`, mở ngoại tuyến, học, Đồng bộ |
| Dùng thử thật | Bạn bè cài `.exe`/`.apk` | sau epic 3 | lỗi cài đặt, đăng ký, Đồng bộ giữa máy tính và điện thoại |
| Hiệu năng 3D | Playwright + CPU throttle | PR đụng `scene/` | fps, kích thước chunk |
| Bảo mật | `differential-review` (Trail of Bits) + Semgrep | PR đụng auth, RLS, sync | theo AD-8, AD-12 |

E2E sinh bởi Caffeine trong `tests/e2e` chỉ chạy trên hạ tầng Caffeine; giữ đến khi rời Caffeine (epic 2 task 1), sau đó chuyển các kịch bản sang `tests/web` Playwright.

## Môi trường điện thoại ảo

- Không cần tải repo GitHub nào. Android: cài Android Studio hoặc Android SDK command-line tools (từ developer.android.com), tạo AVD API 34 x86_64; Tauri dùng `ANDROID_HOME`, `NDK_HOME`. Máy Windows hiện tại chạy được.
- iOS: Tauri iOS bắt buộc macOS + Xcode; iOS Simulator không chạy trên Windows. Phương án: máy Mac, Mac thuê, hoặc runner `macos-latest` của GitHub Actions.
- Chỉ dựng môi trường khi bắt đầu epic 3.

## Cổng hoàn thành mỗi epic

- Mọi task trong plan của epic xanh; lệnh CI chạy cục bộ exit 0.
- `superpowers:verification-before-completion` trước khi báo xong.
- Review cuối nhánh bằng `open-code-review-delegate`; epic 2, 3 thêm `differential-review`.
- Sofia cập nhật trạng thái epic trong `tickets/`.
