---
type: initiative
title: "Người học ôn JLPT theo Minna trên web, desktop, Android, iOS, ngoại tuyến, sẵn sàng thêm cấp độ"
parent: none
sources:
  - docs/initiative-jlpt-da-nen-tang/prd-jlpt-da-nen-tang/prd-jlpt-da-nen-tang.md
companions:
  - docs/initiative-jlpt-da-nen-tang/prd-jlpt-da-nen-tang/addendum.md
  - docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/DESIGN.md
  - docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/EXPERIENCE.md
  - docs/code-review/2026-11-21-code-review.md
  - docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md
after: []
risk: high
---

# Người học ôn JLPT theo Minna trên web, desktop, Android, iOS, ngoại tuyến, sẵn sàng thêm cấp độ

## Description

Bản web ôn N4 (Minna bài 26–50) trên nền ICP/Caffeine được mở rộng thành một sản phẩm chạy trên web, desktop và di động qua Tauri 2, lưu tiến độ trên Supabase với chế độ ngoại tuyến, nội dung tổ chức theo Cấp độ để thêm N3/N2/N1/N5 sau, và có Điểm nhấn 3D theo hướng Washi & Sumi. Nguồn: PRD `prd-jlpt-da-nen-tang`, UX `ux-jlpt-da-nen-tang`.

## Outcome

Người học Minna nói tiếng Việt ôn N4 đầy đủ trên mọi thiết bị, cả khi mất mạng, tiến độ đi theo tài khoản; đo bằng SM-1 và SM-2 của PRD.

## Requirements

- R1 (prd FR-1): Người học chọn Cấp độ; chỉ Cấp độ có Gói nội dung mới chọn được; đổi Cấp độ đổi mọi menu học mà không tải lại app.
- R2 (prd FR-2): Gói nội dung N4 chứa mọi bảng học tập của dataset, số lượng bằng `manifest.json`, kiểm tra trong CI.
- R3 (prd FR-3): Mã Mục nội dung ổn định qua các phiên bản Gói; Mục bị xoá không làm lỗi trang Tiến độ.
- R4 (prd FR-4): Gói nội dung mới đến app đã cài mà không cần phát hành lại app, và dùng được ngoại tuyến.
- R5 (prd FR-5, FR-6): Flashcard theo Bài và mục; đánh dấu Trạng thái thẻ khi ngoại tuyến cập nhật giao diện ngay.
- R6 (prd FR-7, FR-8): Tra cứu kanji bỏ dấu và quy đổi kana; trắc nghiệm 10 câu không trùng đáp án, không ký hiệu thô, lưu được khi ngoại tuyến.
- R7 (prd FR-9..FR-13): Chi tiết Mẫu ngữ pháp cùng các trang Bài so sánh, Bảng chia, Kính ngữ, Tự/tha động từ, có liên kết từ Mẫu ngữ pháp.
- R8 (prd FR-14): Bài đọc lưu số lần làm, điểm gần nhất, điểm cao nhất; chuyển giữa hai bài bắt đầu trạng thái trống.
- R9 (prd FR-15): Đăng ký bằng tên đăng nhập + mật khẩu kèm email đã xác nhận, hoặc Google; đăng nhập bằng email/tên đăng nhập + mật khẩu hoặc Google, trên mọi nền tảng; có quên mật khẩu; phiên được giữ; tài khoản này không đọc được Tiến độ của tài khoản khác.
- R10 (prd FR-16): Ghi Tiến độ thành công khi ngoại tuyến, Đồng bộ trong 30 giây sau khi có mạng; trạng thái mới hơn thắng; Lượt trắc nghiệm và lần làm Bài đọc chỉ cộng thêm; khách được hỏi gộp Tiến độ khi đăng nhập.
- R11 (prd FR-17): Trang Tiến độ theo Cấp độ; tài khoản trống hiện "Bạn chưa có tiến độ nào".
- R12 (prd FR-18): Đã bỏ 2026-11-21 — chưa có người dùng ICP cần chuyển Tiến độ.
- R13 (prd FR-19): Người học tự xoá Tài khoản và toàn bộ Tiến độ trong app.
- R14 (prd FR-20): Bản web giữ mọi tính năng và các đường dẫn tiếng Việt hiện có.
- R15 (prd FR-21): File cài `.exe` Windows 10+ phát trực tiếp, tự cập nhật; macOS/Linux dựng được nhưng không bắt buộc cho bản dùng thử.
- R16 (prd FR-22): File `.apk` Android 8+ cài trực tiếp, báo khi có bản mới; iOS 15+ sau Android; dùng được một tay ở 360px, vùng chạm 44px.
- R17 (prd FR-23): App đã cài mở và dạy được các Gói đã tải khi ngoại tuyến.
- R18 (prd FR-24..FR-26): Điểm nhấn 3D có ảnh tĩnh thay thế, tôn trọng giảm chuyển động, nội dung học không chờ 3D.

## Constraints

- Giao diện tiếng Việt; chữ Nhật có `lang="ja"`, không dùng font tiêu đề cho chữ Nhật (prd §5, DESIGN.md).
- Tiến độ tách theo Tài khoản ở tầng cơ sở dữ liệu; mọi trường người dùng gửi lên có giới hạn kích thước (prd §5, code review #1).
- Hiệu năng: màn học tương tác trong 2 giây trên điện thoại tầm trung; 3D ≥ 50 fps hoặc hạ cấp; tải 3D lần đầu ≤ 3 MB; bản cài di động ≤ 30 MB (prd §5).
- Ghi nguồn KANJIDIC2 (CC BY-SA 4.0) trong app (prd §7).
- Quy ước thư mục: code backend chỉ trong thư mục backend, frontend chỉ trong frontend, `desktop/` và `mobile/` chứa vỏ app, `infra/` chứa dataset và cơ sở dữ liệu, `docs/` chứa tài liệu (chỉ dẫn của chủ dự án, 2026-11-21).
- Phân phối: dùng cá nhân và bạn bè, phát `.exe`/`.apk` trực tiếp; không phát hành App Store/Google Play (prd §7, OQ-1).
- Dataset cấp độ mới dùng cùng định dạng dataset N4 (`jsonl` + `manifest.json`) để script nhập chạy lại được (prd §9.2, OQ-4).

## Done when

- Bản web, `.exe` Windows và `.apk` Android dựng từ cùng một frontend, cài được trên máy bạn bè và qua bộ E2E chung; iOS dựng được trên macOS.
- Gói N4 qua kiểm tra số lượng so với `manifest.json` trong CI.
- Học ngoại tuyến trên điện thoại rồi có mạng: Tiến độ xuất hiện trên desktop của cùng Tài khoản (UJ-1).
- Test truy cập chéo hai Tài khoản trên Supabase không đọc được dữ liệu của nhau.
- Thêm một Gói nội dung thử nghiệm (N3 mẫu) không cần sửa màn hình nào.
- Điểm nhấn 3D đạt ngưỡng hiệu năng hoặc tự hạ cấp trên máy thử tầm trung.

## Boundaries

- Không gồm nội dung N3/N2/N1/N5 thật; mỗi Cấp độ là initiative riêng khi có dataset (thứ tự N3 → N2 → N1 → N5).
- Không gồm SRS, thông báo nhắc học, tính năng lớp học, thu phí.
- Touch point: `src/frontend/src/data/*` — nguồn nội dung hiện tại, thay bằng Gói nội dung; owner: epic-goi-noi-dung.
- Touch point: `src/frontend/src/hooks/useProgress.ts` — điểm gọi backend duy nhất, thay bằng kho Tiến độ; owner: epic-tai-khoan-dong-bo.
- Touch point: `src/backend` (Motoko) — giữ chạy đến khi Supabase thay thế, rồi xoá, không chuyển dữ liệu; owner: epic-tai-khoan-dong-bo.
- Must not change: các đường dẫn `/tu-vung`, `/kanji`, `/kanji/tra-cuu`, `/ngu-phap`, `/doc-hieu`, `/tien-do`; hành vi khách học không cần đăng nhập.
- Tracer path: dataset trong `infra/` → script sinh Gói nội dung → frontend tải Gói theo Cấp độ → người học đánh dấu Thẻ → kho Tiến độ cục bộ → Đồng bộ Supabase → hiển thị trên app Tauri ở thiết bị khác.

## References

- prd — docs/initiative-jlpt-da-nen-tang/prd-jlpt-da-nen-tang/prd-jlpt-da-nen-tang.md, §4 Tính năng, §5, §7
- addendum — docs/initiative-jlpt-da-nen-tang/prd-jlpt-da-nen-tang/addendum.md, quyết định kỹ thuật đã chốt
- design — docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/DESIGN.md
- experience — docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/EXPERIENCE.md
- review — docs/code-review/2026-11-21-code-review.md
- architecture — docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md, AD-1..AD-12

## Notes

- Open question: Gói nội dung tải qua mạng hay đóng gói theo bản phát hành? (prd OQ-5) — kiến trúc đang làm cả hai (AD-4).
- Open question: Bạn bè có cần bản macOS/Linux không? (prd OQ-6)
- Decision: 2026-11-21 dùng cá nhân và bạn bè, phát `.exe`/`.apk` trực tiếp, chưa lên store (OQ-1).
- Decision: 2026-11-21 đăng ký tên đăng nhập + mật khẩu kèm email hoặc Google; đăng nhập email/tên đăng nhập + mật khẩu hoặc Google (OQ-2).
- Decision: 2026-11-21 chưa có người dùng ICP, bỏ R12 và epic-chuyen-du-lieu-icp (OQ-3).
- Decision: 2026-11-21 dataset N3 do chủ dự án bổ sung sau từ giáo trình và ghi chép tay (OQ-4).
- Dropped: R12 — không có dữ liệu ICP cần chuyển.
- Decision: 2026-11-21 chủ dự án chọn Tauri 2, Supabase, 3D điểm nhấn, thứ tự cấp độ N3 → N2 → N1 → N5.
- Decision: 2026-11-21 chia 6 epic theo "một năng lực nguồn, triển khai cùng nhau"; nền tảng (cấu trúc thư mục, CI, test) là các story đầu của epic-goi-noi-dung.
