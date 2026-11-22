---
id: 6
type: epic
title: "Chuyển Tiến độ từ ICP"
parent: initiative-jlpt-da-nen-tang
covers: [R12]
sources: []
companions: []
after: [epic-tai-khoan-dong-bo]
refined: false
status: dropped
risk: medium
---

# Chuyển Tiến độ từ ICP

## Description

Xuất Tiến độ của người dùng từ canister ICP và nhập vào Tài khoản Supabase của chính họ; ngừng ghi vào canister. Phạm vi theo các dòng R12 của initiative.

## Outcome

Người dùng cũ không mất Tiến độ khi chuyển sang app mới.

## Done when

- Số Trạng thái thẻ, Lượt trắc nghiệm, Mẫu đã học, kết quả Bài đọc trước và sau chuyển bằng nhau.
- Kiểm chứng tích hợp: bộ test của epic chạy xanh trong CI và tính năng chạy trên bản đã deploy.

## Boundaries

- Bị bỏ nếu không có người dùng ICP thật (prd OQ-3).

## Notes

- Dropped: 2026-11-21 chủ dự án xác nhận chưa có người dùng ICP; R12 bỏ. Canister ICP được xoá trong epic-tai-khoan-dong-bo.

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
