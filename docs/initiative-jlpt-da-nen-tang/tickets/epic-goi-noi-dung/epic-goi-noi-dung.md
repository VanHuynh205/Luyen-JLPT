---
id: 1
type: epic
title: "Nội dung theo Cấp độ"
parent: initiative-jlpt-da-nen-tang
covers: [R1, R2, R3, R4, R14]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# Nội dung theo Cấp độ

## Description

Dựng nền: cấu trúc thư mục theo quy ước, CI chạy typecheck/lint/test, test harness unit. Script trong infra sinh Gói nội dung JSON theo Cấp độ từ dataset (N4 đủ 7 bảng), frontend tải Gói theo Cấp độ thay cho file TS nhúng, thêm bộ chọn Cấp độ. Phạm vi theo các dòng R1, R2, R3, R4, R14 của initiative.

## Outcome

Người học chọn N4 và học từ Gói nội dung sinh từ dataset; thêm Gói mới không sửa màn hình.

## Done when

- CI so số lượng và mã Mục giữa dataset và Gói N4.
- Gói N3 mẫu (vài mục giả) hiện được trong bộ chọn Cấp độ khi bật cờ thử nghiệm.
- Mọi đường dẫn tiếng Việt hiện có vẫn hoạt động.
- Kiểm chứng tích hợp: bộ test của epic chạy xanh trong CI và tính năng chạy trên bản đã deploy.

## Boundaries

- Không làm trang ngữ pháp mới (epic-ngu-phap-mo-rong) hay lưu Tiến độ (epic-tai-khoan-dong-bo).

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
