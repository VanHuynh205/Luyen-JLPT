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

Chưa đóng epic. Run `45130724256` đã qua Windows, Android và iOS Simulator trên revision `9f6a06e` (trước thay đổi UI 3D, sửa callback Auth và đồng nhất app ID `vn.luyenjlpt.app`). Bản QA `0.1.2` đã cài đè trên Windows và Android thật: xác nhận Google, đăng ký/xác nhận email, đặt lại mật khẩu và đồng bộ hai chiều giữa hai tài khoản QA Windows–Android. Còn mở: kiểm cập nhật từ bản ký cũ sang bản ký mới qua feed công khai, CI native trên revision `0.2.0`, phát hành bản đầu `0.2.0` trên `VanHuynh205/Luyen-JLPT-Releases`, xác nhận sao lưu khóa và quyền phân phối dataset. Xem [bằng chứng và checkpoint phát hành](../../../superpowers/plans/2026-11-22-epic-ung-dung-tauri.md#bản-nghiệm-thu-nội-bộ-không-phát-công-khai).

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
