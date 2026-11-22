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

Windows NSIS và APK Android debug đã qua kiểm ngoại tuyến cục bộ. Chưa đóng epic: cần CI native trên ba runner, iOS Simulator, bản phát hành ký và xác nhận đăng nhập, Đồng bộ, cập nhật trên staging. Xem [plan Epic 3](../../../superpowers/plans/2026-11-22-epic-ung-dung-tauri.md).

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
