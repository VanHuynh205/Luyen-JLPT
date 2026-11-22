# Addendum: lựa chọn kỹ thuật và phương án đã cân nhắc

Tài liệu đi kèm `prd-jlpt-da-nen-tang.md`. Chứa các quyết định "làm thế nào" mà PRD không ghi, để `bmad-architecture` và `bmad-ux` dùng.

## Quyết định đã chốt với chủ dự án (2026-11-21)

| Chủ đề | Chọn | Phương án loại | Lý do |
| --- | --- | --- | --- |
| Vỏ desktop + di động | Tauri 2 | Capacitor + Electron; React Native/Expo + Electron | Một codebase React cho Windows/macOS/Linux/Android/iOS, tái dùng gần như toàn bộ `src/frontend`, bản cài nhỏ. |
| Backend + đăng nhập | Supabase (Postgres, Auth, Row Level Security) | Giữ ICP canister + Internet Identity; chỉ lưu cục bộ | Đăng nhập email/OAuth quen thuộc trên di động, SQL cho thống kê tiến độ. Phải viết lại tầng lưu tiến độ và chuyển dữ liệu. |
| Mức 3D | Điểm nhấn: trang chủ, chuyển cảnh, Thẻ, hanko | Toàn bộ thế giới 3D | Giữ chữ Nhật rõ, nhẹ cho máy yếu. |
| Thứ tự cấp độ | N4 → N3 → N2 → N1 → N5 | N5 trước | Ưu tiên người học đã qua N4. |
| Ngoại tuyến | Offline-first, Đồng bộ khi có mạng | Bắt buộc có mạng | Người học ôn trên xe, nơi sóng yếu. |

## Hệ quả với mã hiện tại

- Nền tảng Caffeine (ICP) đang build và deploy app. Chuyển sang Supabase nghĩa là rời mô hình deploy Caffeine cho backend; frontend web cần nơi host tĩnh mới (ví dụ Cloudflare Pages, Netlify, Vercel). Cần quyết định có giữ bản ICP chạy song song trong thời gian chuyển không.
- `src/frontend/src/hooks/useProgress.ts` là điểm duy nhất gọi backend (`createActor`). Thay bằng một lớp "kho tiến độ" (progress repository) có hai tầng: lưu cục bộ (IndexedDB trên web, SQLite qua plugin Tauri trên app) và đồng bộ Supabase. Các trang không phải sửa nếu giữ nguyên chữ ký hook.
- Nội dung đang là file TS lớn trong `src/frontend/src/data/`. Mô hình đa Cấp độ cần chuyển sang Gói nội dung dạng JSON sinh từ dataset bằng script (đặt trong `infra/`), tải theo Cấp độ (lazy) thay vì nhúng toàn bộ vào bundle.
- `src/backend` (Motoko) sẽ được thay bằng `backend/` hoặc giữ `src/backend` chứa migration SQL Supabase và Edge Functions. Quy ước thư mục của chủ dự án: backend chỉ chứa code backend, frontend chỉ chứa code frontend, `desktop/` và `mobile/` chứa vỏ Tauri, `infra/` chứa dataset và schema cơ sở dữ liệu, `docs/` chứa tài liệu.

## Thư viện giao diện dự kiến

- `three` (đã có 0.176 trong `src/frontend/package.json`) + `@react-three/fiber` + `@react-three/drei` cho Điểm nhấn 3D.
- GSAP (+ ScrollTrigger, `@gsap/react`) cho timeline chuyển cảnh và hanko "đóng dấu".
- Lenis cho cuộn mượt trên trang chủ dài; tắt trên màn học và khi giảm chuyển động.
- React Bits: chọn một số component chữ/hiệu ứng nền phù hợp Washi & Sumi, không dùng hiệu ứng neon.
- `motion` đang dùng cho chuyển động nhỏ; cân nhắc gộp với GSAP để không có hai thư viện chuyển động chồng nhau.

## Rủi ro kỹ thuật đã thấy

- Tauri 2 trên iOS cần máy macOS + Xcode để build và ký; dự án hiện phát triển trên Windows. Cần máy Mac hoặc dịch vụ CI macOS.
- WebView Android cũ có thể không hỗ trợ WebGL2: cần đường lui ảnh tĩnh (FR-24).
- `moc` không có bản Windows; trong thời gian còn giữ backend ICP, kiểm tra backend qua WSL.
