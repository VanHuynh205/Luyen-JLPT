---
id: 4
type: epic
title: "Ngữ pháp mở rộng"
parent: initiative-jlpt-da-nen-tang
covers: [R7]
sources: []
companions: []
after: [epic-goi-noi-dung]
refined: true
risk: low
---

# Ngữ pháp mở rộng

## Description

Bốn trang mới đọc từ Gói N4: Bài so sánh, Bảng chia, Kính ngữ, Tự/tha động từ; liên kết hai chiều với Mẫu ngữ pháp. Phạm vi theo các dòng R7 của initiative.

## Outcome

Người học phân biệt mẫu dễ nhầm, tra cách chia và kính ngữ ngay trong app.

## Done when

- 27 Bài so sánh, 22 Bảng chia, 17 Mục kính ngữ, 12 cặp tự/tha hiển thị đủ.
- Trang Mẫu ngữ pháp có liên kết tới mọi Bài so sánh chứa nó.
- Kiểm chứng tích hợp: bộ test của epic chạy xanh trong CI và tính năng chạy trên bản đã deploy.

## Boundaries

- Không thêm quiz ngữ pháp mới.

## Kiểm chứng & Hoàn thành (2026-11-25)

Đã hoàn tất triển khai cục bộ theo [plan Epic 4](../../../superpowers/plans/2026-11-25-epic-ngu-phap-mo-rong.md) và biên bản review [2026-11-25-epic-4-review.md](../../../code-review/2026-11-25-epic-4-review.md) (chờ review/merge và CI trên nhánh):

- **Đủ 4 trang mở rộng từ Gói N4 `1.0.0` (không đổi `infra/content/n4/*.json` hay `VERSION`):** `/ngu-phap/so-sanh` (27 bài + chi tiết `/ngu-phap/so-sanh/$comparisonId`), `/ngu-phap/cach-chia` (22 quy tắc), `/ngu-phap/kinh-ngu` (17 mục, ô trống hiển thị `—`), `/ngu-phap/tu-dong-tha-dong` (12 cặp), kèm thanh điều hướng phụ `GrammarSubNav` đạt vùng chạm ≥ 44px và không tràn ngang ở 360px.
- **Liên kết hai chiều:** `comparisonLinks.ts` liên kết 64/74 phần so sánh N4 (10 phần meta/N5 chưa khớp được in cảnh báo trong `pnpm packs:build` mà không chặn build); `GrammarDetailPage` hiển thị mục "So sánh liên quan" dẫn tới mọi bài so sánh chứa mẫu, và `GrammarComparisonDetailPage` dẫn ngược về các mẫu `/ngu-phap/$patternId`. Không thêm quiz ngữ pháp mới.
- **Sửa lỗi review #5:** `ReadingDetailPage` tách `ReadingDetailContent` với `key={passage.id}` để reset `answers`, `submitted`, `StudyAids` và trạng thái mutation khi đổi bài đọc trực tiếp, kèm unit test (`ReadingDetailPage.test.tsx`) và E2E (`grammar-extended.spec.ts`).
- **Còn mở:** chạy CI trên PR và kiểm tra tính năng trên bản đã deploy sau khi merge.

## References

- parent — docs/initiative-jlpt-da-nen-tang/initiative-jlpt-da-nen-tang.md, section Requirements
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
