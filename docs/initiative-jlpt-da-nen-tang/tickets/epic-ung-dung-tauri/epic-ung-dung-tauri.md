---
id: 3
type: epic
title: "App desktop, Android, iOS"
parent: initiative-jlpt-da-nen-tang
covers: [R15, R16, R17]
sources: []
companions: []
after: [epic-tai-khoan-dong-bo]
refined: false
risk: high
---

# App desktop, Android, iOS

## Description

Bản dùng thử cho bạn bè: `.exe` Windows và `.apk` Android phát trực tiếp, không qua store; iOS sau Android. Vỏ Tauri 2 trong `desktop/` và `mobile/` bọc frontend; cửa sổ desktop, Android, iOS; mở ngoại tuyến; tự cập nhật desktop; đăng nhập OAuth qua deep link; ghi nguồn KANJIDIC. Phạm vi theo các dòng R15, R16, R17 của initiative.

## Outcome

Bạn bè nhận file `.exe`/`.apk`, cài được và học được khi không có mạng.

## Done when

- CI xuất `.exe` (NSIS) và `.apk` ký bằng keystore riêng làm artifact tải về; iOS dựng được trên runner macOS.
- App Android báo khi có `.apk` mới; desktop tự cập nhật.
- E2E chạy trên giả lập Android và iOS Simulator.
- Mở app ở chế độ máy bay học được Gói N4.
- Kiểm chứng tích hợp: bộ test của epic chạy xanh trong CI và tính năng chạy trên bản đã deploy.

## Boundaries

- Không phát hành App Store/Google Play (prd OQ-1 đã chốt).

## Nghiệm thu

Đã hoàn tất nghiệm thu và phát hành bản công khai đầu tiên **`v0.2.0`** ngày 25-11-2026 tại [VanHuynh205/Luyen-JLPT-Releases v0.2.0](https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/tag/v0.2.0) (tag `v0.2.0` trên `master` `7cbea40`).

- **CI trên revision phát hành (`d610e78`, PR #2):** `CI` (`45561612272`) và `Native apps` (`45561612418` — Windows NSIS smoke, Android build + offline smoke API 34, iOS Simulator + Maestro N4 smoke) đều PASS.
- **Auth và đồng bộ trên thiết bị thật (QA `0.1.2`):** Xác nhận Google OAuth, đăng ký/xác nhận email, đặt lại mật khẩu và đồng bộ hai chiều Windows–Android với hai tài khoản QA.
- **Cập nhật qua feed HTTPS công khai:** Windows `0.1.2` → `0.2.0` tự tải, xác minh chữ ký Ed25519 + `requireSignedVersion` và cài đè đúng chỗ giữ nguyên dữ liệu người dùng; Android `0.1.1` (`1001`) → `0.2.0` (`2000`, multi-ABI `arm64-v8a` + `x86_64`) nhận toast từ `android-latest.json` và cài đè trên AVD giữ nguyên `userId`, `dataDir` và tiến độ `1/1182`.
- **Ghi chú vận hành:** Chủ dự án duy trì bản sao phục hồi độc lập của khóa ký ngoài máy tạo khóa; tùy chọn kiểm thêm cài đè trực tiếp trên điện thoại ARM64 thật. Xem chi tiết tại [plan Epic 3](../../../superpowers/plans/2026-11-22-epic-ung-dung-tauri.md#phát-hành-công-khai-đầu-tiên-v020-25-11-2026) và [biên bản nghiệm thu](../../../2026-11-23-nghiem-thu-auth-staging-native.md).

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
