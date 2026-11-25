# Luyện JLPT N4

Ứng dụng ôn luyện tiếng Nhật trình độ **JLPT N4** bám sát giáo trình **Minna no Nihongo (bài 26–50)**, giao diện hoàn toàn bằng tiếng Việt. Dự án chạy trên **Web**, **Windows Desktop** và **Android** (kèm cấu hình dựng thử trên **iOS Simulator**) từ cùng một mã nguồn frontend, học **ngoại tuyến ngay lần đầu mở** và đồng bộ tiến độ giữa các thiết bị qua tài khoản.

- **Trang phát hành chính thức:** https://github.com/VanHuynh205/Luyen-JLPT/releases/latest
- **Giấy phép mã nguồn:** GNU Affero General Public License v3.0 ([`LICENSE`](LICENSE))

---

## Tính năng chính

- **Từ vựng (1.182 từ):** Thẻ ghi nhớ (flashcard), lọc theo Bài học (bài 26–50) và Mục, đánh dấu đã thuộc và lưu trạng thái tức thì khi ngoại tuyến.
- **Kanji (118 chữ Hán & 388 từ ghép):**
  - Tra cứu Kanji hỗ trợ bỏ dấu tiếng Việt và quy đổi kana.
  - Trắc nghiệm từ đơn và từ ghép tùy chỉnh số câu, giải thích kèm âm Hán Việt, âm On/Kun và nghĩa.
- **Ngữ pháp (148 mẫu):** Trình bày rõ **Cách chia**, **Ý nghĩa**, **Cách dùng** và nhiều ví dụ minh họa.
- **Đọc hiểu:** Luyện đọc đoạn văn kèm câu hỏi, tự động lưu số lần làm, điểm gần nhất và điểm cao nhất.
- **Học ngoại tuyến & đồng bộ hai chiều:**
  - Học ngay ở chế độ khách mà không cần đăng nhập (lưu cục bộ trên IndexedDB).
  - Đăng nhập bằng Email / Tên đăng nhập hoặc Google PKCE (`luyenjlpt://auth-callback` trên ứng dụng native), hỗ trợ gộp tiến độ khách, quên mật khẩu, tự xóa tài khoản và đồng bộ hai chiều giữa Windows, Android và Web qua Supabase.
- **Bàn học 3D tối ưu hiệu năng:** Cảnh 3D (React Three Fiber / Three.js) chỉ tải riêng ở trang chủ, tôn trọng thiết lập `prefers-reduced-motion` của hệ điều hành và tự hạ cấp sang SVG tĩnh khi thiết bị không hỗ trợ WebGL2.

---

## Tải và cài đặt (dành cho người dùng)

| Nền tảng | Liên kết tải trực tiếp (luôn trỏ bản mới nhất) | Ghi chú cài đặt |
| --- | --- | --- |
| **Windows (x64)** | [Luyen-JLPT-windows-x64-setup.exe](https://github.com/VanHuynh205/Luyen-JLPT/releases/latest/download/Luyen-JLPT-windows-x64-setup.exe) | Windows 10 trở lên. Tích hợp sẵn WebView2 offline và tự cập nhật đã ký Ed25519. |
| **Android (ARM64 / x86_64)** | [Luyen-JLPT-android.apk](https://github.com/VanHuynh205/Luyen-JLPT/releases/latest/download/Luyen-JLPT-android.apk) | Android 8.0 (API 26) trở lên. Báo bản mới và mở trang tải trong ứng dụng. |
| **iOS (Simulator)** | Không phát hành qua App Store | Chỉ dựng bản iOS Simulator (iOS 15+) trên macOS từ mã nguồn. |

### Hướng dẫn cài đặt nhanh

1. **Đối chiếu mã kiểm tra (khuyến nghị):** Tải thêm tệp `SHA256SUMS.txt` tại [trang Releases](https://github.com/VanHuynh205/Luyen-JLPT/releases/latest) để đối chiếu mã SHA-256 trước khi cài.
2. **Trên Windows:**
   - Chạy tệp `Luyen-JLPT-windows-x64-setup.exe`.
   - Bộ cài chưa dùng chứng thư số thương mại (Authenticode), nên Windows SmartScreen có thể hiện cảnh báo. Kiểm tra đúng nguồn phát hành từ `VanHuynh205/Luyen-JLPT`, chọn **Thông tin thêm (More info)** rồi chọn **Vẫn chạy (Run anyway)**.
   - Từ phiên bản `0.2.1` trở đi, khi có bản mới, ứng dụng sẽ thông báo tự động và tải/cài đè trực tiếp ngay trong app.
3. **Trên Android:**
   - Tải `Luyen-JLPT-android.apk` và mở để cài đặt.
   - Bật quyền cho phép cài ứng dụng không rõ nguồn gốc đối với trình duyệt hoặc trình quản lý tệp bạn vừa dùng để mở `.apk`, cài đặt xong nên tắt lại quyền này.
   - Các bản nâng cấp về sau giữ nguyên mã ứng dụng (`vn.luyenjlpt.app`) và chữ ký để cài đè mà không mất tiến độ ngoại tuyến.

---

## Cách sử dụng

- **Chế độ khách (mặc định):** Mở ứng dụng và học ngay mọi phần từ vựng, kanji, ngữ pháp, đọc hiểu khi không có kết nối mạng. Tiến độ được lưu ngay trên thiết bị.
- **Đăng nhập & Đồng bộ:** Vào mục **Tài khoản** (`/tai-khoan`) để đăng ký hoặc đăng nhập (Email, Tên đăng nhập hoặc Google). Khi đăng nhập lần đầu từ chế độ khách, ứng dụng cho phép gộp tiến độ hiện có lên tài khoản để đồng bộ giữa laptop và điện thoại.
- **Các màn hình chính:**
  - `/tu-vung` — Flashcard từ vựng theo Bài học và Mục
  - `/kanji` & `/kanji/tra-cuu` — Trắc nghiệm và tra cứu Kanji
  - `/ngu-phap` — Danh sách và chi tiết 148 mẫu ngữ pháp
  - `/doc-hieu` — Luyện đọc hiểu theo đoạn văn
  - `/tien-do` — Thống kê tiến độ theo cấp độ
  - `/tai-khoan` — Đăng nhập, đăng ký, khôi phục mật khẩu, xóa tài khoản
  - `/gioi-thieu` — Nguồn dữ liệu và hướng dẫn cài đặt

---

## Phát triển và build từ mã nguồn

### Yêu cầu môi trường

- **Chung (Web & gói nội dung):** Node.js `^22.12 || ^24 || >=26`, `pnpm >= 10` (`corepack enable`).
- **Windows Desktop (Tauri 2):** Rust `1.100.0` (tối thiểu `1.90`), Visual Studio Build Tools (*Desktop development with C++* + Windows SDK). Xem chi tiết tại [`desktop/README.md`](desktop/README.md).
- **Android (Tauri 2):** JDK 21, Android SDK (`platforms;android-36`, `platforms;android-37.0`, `build-tools;37.0.0`), NDK 29, Rust target `aarch64-linux-android` / `x86_64-linux-android`. Xem chi tiết tại [`mobile/README.md`](mobile/README.md).
- **Backend cục bộ (tùy chọn):** Supabase CLI, Docker và Deno. Xem chi tiết tại [`backend/supabase/README.md`](backend/supabase/README.md).

### Chạy cục bộ từ clone sạch

```sh
# 1. Cài dependencies workspace
pnpm install --frozen-lockfile

# 2. Sinh và kiểm tra toàn vẹn Gói nội dung N4
pnpm packs:build
pnpm packs:verify

# 3. Chạy bản Web dev server (học chế độ khách ngay không cần Supabase)
pnpm --filter @luyen/frontend dev
```

Nếu muốn kết nối Supabase khi chạy dev hoặc build frontend, sao chép [`frontend/.env.example`](frontend/.env.example) thành `frontend/.env` và điền `VITE_SUPABASE_URL` cùng `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Kiểm thử và build

```sh
pnpm check         # Kiểm tra lint/format bằng Biome
pnpm typecheck     # Kiểm tra TypeScript toàn repo
pnpm test          # Chạy unit & integration test bằng Vitest
pnpm build         # Đóng gói nội dung N4 và build frontend/dist
pnpm e2e:web       # Chạy E2E Playwright (cần chạy: pnpm exec playwright install chromium)
```

### Cấu trúc thư mục

```text
.
├── frontend/          # Giao diện React, Vite, Tailwind, 3D scene (dùng chung Web/Desktop/Mobile)
├── desktop/           # Vỏ Tauri 2 cho Windows (NSIS, deep link, tự cập nhật)
├── mobile/            # Vỏ Tauri 2 cho Android và iOS Simulator
├── backend/           # Cấu hình Supabase, Postgres migrations, Edge Functions & pgTAP tests
├── infra/             # Dataset nguồn, nội dung N4 và script đóng gói/kiểm chứng gói học tập
├── tests/             # Bộ kiểm thử E2E web (Playwright), desktop smoke và mobile smoke
└── docs/              # Đặc tả kiến trúc, kế hoạch triển khai và biên bản nghiệm thu
```

---

## Nguồn dữ liệu và ghi công

- Dữ liệu âm **On** và **Kun** của Kanji sử dụng từ **KANJIDIC2** của *Electronic Dictionary Research and Development Group (EDRDG)*, phân phối theo giấy phép **CC BY-SA 4.0** (`https://creativecommons.org/licenses/by-sa/4.0/`).
- Xem đầy đủ ghi công và thông tin nguồn dữ liệu tại [`NOTICE`](NOTICE).

---

## Giấy phép và bản quyền

Copyright (C) 2026 **VanHuynh205**.

Toàn bộ mã nguồn trong kho lưu trữ này được phát hành theo giấy phép **GNU Affero General Public License v3.0 (`AGPL-3.0-only`)**. Xem toàn văn trong tệp [`LICENSE`](LICENSE).

Tóm tắt quyền và nghĩa vụ chính:

- Bạn có quyền sao chép, sửa đổi và sử dụng lại mã nguồn cho mục đích cá nhân hoặc thương mại.
- **Bắt buộc giữ nguyên thông báo bản quyền, tên tác giả gốc và tệp `LICENSE` / `NOTICE`** trong mọi bản sao hoặc bản phái sinh.
- **Bắt buộc công khai toàn bộ mã nguồn đã sửa đổi** dưới cùng giấy phép `AGPL-3.0` nếu bạn phân phối bản dựng (`.exe`, `.apk`, v.v.) **hoặc** vận hành phiên bản đã sửa đổi trên máy chủ mạng (web/cloud) cho người dùng khác sử dụng.
