---
id: 2
type: epic
title: "Tài khoản Supabase và Đồng bộ ngoại tuyến"
parent: initiative-jlpt-da-nen-tang
covers: [R5, R6, R8, R9, R10, R11, R13]
sources: []
companions: []
after: [epic-goi-noi-dung]
refined: false
risk: high
---

# Tài khoản Supabase và Đồng bộ ngoại tuyến

## Description

Schema Postgres + RLS cho Tiến độ theo Cấp độ, Supabase Auth (đăng ký tên đăng nhập + mật khẩu kèm email xác nhận, hoặc Google; đăng nhập bằng email/tên đăng nhập + mật khẩu hoặc Google; quên mật khẩu), kho Tiến độ hai tầng (cục bộ + Đồng bộ) thay `useProgress.ts`, gộp Tiến độ khách, xoá Tài khoản. Xoá canister ICP và `src/backend` khi Supabase chạy, không chuyển dữ liệu. Phạm vi theo các dòng R5, R6, R8, R9, R10, R11, R13 của initiative.

## Outcome

Tiến độ của người học được lưu cả khi mất mạng và có mặt trên mọi thiết bị của Tài khoản đó.

## Trạng thái thực hiện ngày 22-11-2026

Đã triển khai web, SQL, Edge Functions và bộ kiểm thử. Chưa đóng epic: cần CI chạy với stack Supabase thật, URL web staging và kiểm chứng Google OAuth trên bản deploy. Giữ backend ICP cũ đến khi cắt chuyển thành công. Các bước nghiệm thu nằm trong `docs/superpowers/plans/2026-11-22-epic-tai-khoan-dong-bo.md`.

## Done when

- Test RLS truy cập chéo hai Tài khoản bị từ chối.
- Test ngoại tuyến: ghi khi mất mạng, Đồng bộ trong 30 giây sau khi có mạng.
- Trang Tiến độ hiện số liệu theo Cấp độ.
- Đăng ký/đăng nhập cả hai cách và đăng nhập bằng tên đăng nhập chạy được trên bản web đã deploy.
- Kiểm chứng tích hợp: bộ test của epic chạy xanh trong CI và tính năng chạy trên bản đã deploy.

## Boundaries

- Không chuyển dữ liệu ICP (R12 đã bỏ); không làm vỏ Tauri (epic-ung-dung-tauri).

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
