---
title: Trải nghiệm Luyện JLPT đa nền tảng
status: draft
created: 2026-11-21
updated: 2026-11-21
---

# EXPERIENCE.md

## Foundation

- Bề mặt: web, desktop (Windows/macOS/Linux qua Tauri 2), Android, iOS (Tauri 2 mobile). Một giao diện React dùng chung, khác nhau ở điều hướng và đầu vào.
- Hệ UI: shadcn/ui + Tailwind trong `src/frontend`. Hình ảnh theo `DESIGN.md` cùng thư mục (kế thừa `DESIGN.md` gốc).
- Lớp 3D: React Three Fiber + drei; chuyển cảnh GSAP; Lenis chỉ trên trang chủ. Hướng dẫn kỹ thuật lấy từ các skill `threejs-react-three-fiber`, `gsap-core`, `lenis`, `react-bits`, `impeccable`.

## Information Architecture

| Bề mặt | Đường dẫn | Ghi chú |
| --- | --- | --- |
| Trang chủ 3D | `/` | Cảnh bàn học, chọn Cấp độ, 4 lối vào học, tóm tắt Tiến độ |
| Từ vựng | `/tu-vung` | Flashcard theo Bài/mục |
| Kanji trắc nghiệm | `/kanji` | |
| Tra cứu kanji | `/kanji/tra-cuu` | |
| Ngữ pháp | `/ngu-phap`, `/ngu-phap/$patternId` | |
| So sánh ngữ pháp | `/ngu-phap/so-sanh`, `/ngu-phap/so-sanh/$id` | Mới (FR-10) |
| Bảng chia | `/ngu-phap/cach-chia` | Mới (FR-11) |
| Kính ngữ | `/ngu-phap/kinh-ngu` | Mới (FR-12) |
| Tự/tha động từ | `/ngu-phap/tu-dong-tha-dong` | Mới (FR-13) |
| Đọc hiểu | `/doc-hieu`, `/doc-hieu/$passageId` | |
| Tiến độ | `/tien-do` | Tab theo Cấp độ |
| Tài khoản & Cài đặt | `/tai-khoan` | Mới: đăng nhập, Đồng bộ, hiệu ứng, xoá Tài khoản |

Cấp độ đang chọn là trạng thái toàn cục (lưu cục bộ + theo Tài khoản), không nằm trong URL. `[ASSUMPTION: giữ URL hiện có không đổi theo FR-20; nếu cần chia sẻ link theo cấp độ thì thêm query `?cap=n3` sau]`

Điều hướng:

- Điện thoại: thanh tab dưới 5 mục (Trang chủ, Từ vựng, Kanji, Ngữ pháp, Tiến độ); Đọc hiểu và Tài khoản trong Trang chủ và header.
- Desktop/web rộng: thanh điều hướng trên cùng như hiện tại + chip Cấp độ trong header.

## Voice and Tone

Tiếng Việt, xưng "bạn", câu ngắn. Thông báo lỗi nói việc cần làm ("Chưa lưu được. App sẽ thử lại khi có mạng."). Trạng thái ngoại tuyến nói sự thật, không gây lo lắng.

## Component Patterns

- **Chọn Cấp độ:** chạm chip → toàn app đổi nội dung, chữ kanji trên cảnh 3D đổi theo; vị trí đang học của từng Cấp độ được nhớ riêng.
- **Thẻ 3D:** chạm/nhấn Space để lật; vuốt trái/phải (di động) hoặc phím ←/→ (desktop) để chuyển thẻ; nút "Đã thuộc"/"Chưa thuộc" cố định dưới thẻ.
- **Chỉ báo Đồng bộ:** biểu tượng nhỏ trong header: đã đồng bộ / đang chờ (số thao tác) / ngoại tuyến.
- **Trang so sánh:** bảng hai cột trên desktop, xếp chồng trên điện thoại; câu đối chiếu đặt cạnh nhau.

## State Patterns

| Trạng thái | Hành vi |
| --- | --- |
| Đang tải Gói nội dung | Khung xương 2D; không chặn bởi cảnh 3D |
| Ngoại tuyến | Học bình thường; ghi Tiến độ vào hàng đợi; chỉ báo "Ngoại tuyến" |
| Đồng bộ lỗi | Giữ hàng đợi, thử lại theo lùi dần; không bật hộp thoại chặn |
| Khách | Học đầy đủ, Tiến độ chỉ trên máy, lời mời đăng nhập dạng thẻ nhỏ (giữ `SignInPrompt`) |
| Cấp độ chưa có nội dung | Chip nhạt, nhãn "Sắp ra mắt" |
| Không hỗ trợ WebGL / máy chậm | Ảnh tĩnh của cảnh, không thông báo lỗi |
| Chưa có Tiến độ | "Bạn chưa có tiến độ nào" |

## Interaction Primitives

- Chạm tối thiểu 44×44px. Mọi thao tác bằng vuốt có nút tương đương.
- Desktop: phím tắt Space (lật), ←/→ (chuyển), 1–4 (chọn đáp án), Enter (câu tiếp).
- Chuyển cảnh trang 300–450ms; không chặn thao tác trong lúc chuyển.

## Accessibility Floor

- `prefers-reduced-motion` hoặc tắt "Hiệu ứng" trong Cài đặt: tắt camera động, lật thẻ thành mờ dần, hanko hiện tĩnh, tắt Lenis.
- Cảnh 3D có `aria-hidden`; mọi thông tin trong cảnh có bản chữ 2D.
- Chữ tiếng Nhật có `lang="ja"`; furigana dùng `<ruby>`.
- Thứ tự tab hợp lý; focus nhìn thấy được trên nền giấy.

## Responsive & Platform

- Tauri desktop: menu hệ thống tối giản (Tệp → Thoát, Trợ giúp → Giới thiệu/ghi nguồn KANJIDIC); cập nhật tự động thông báo dạng thẻ nhỏ.
- Android: nút Back hệ thống đi lùi trong lịch sử route; ở Trang chủ thì thoát app.
- iOS: vuốt cạnh trái để lùi; tôn trọng safe area và Dynamic Type ở mức hệ điều hành cho phép trong WebView.

## Key Flows

1. **Lan ôn từ vựng ngoại tuyến (UJ-1):** mở app → Trang chủ hiện ngay từ cache → Từ vựng → Bài 31 → lật và đánh dấu 12 thẻ → chỉ báo "Chờ đồng bộ 12" → **cao trào:** "Đã thuộc 12/48" cập nhật tức thì → có mạng, chỉ báo về "Đã đồng bộ".
2. **Minh làm trắc nghiệm kanji (UJ-2):** Kanji → chọn "Trộn" → 10 câu, sau mỗi câu có giải thích Hán Việt → **cao trào:** con dấu hanko 3D ấn điểm số → Tiến độ.
3. **Hà phân biệt mẫu ngữ pháp (UJ-3):** chi tiết 〜ようにする → liên kết "So sánh" → **cao trào:** hai câu đối chiếu đặt cạnh nhau làm rõ khác biệt → Bảng chia thể ý chí.
4. **Tuấn chuyển lên N3 (UJ-4):** chạm chip N3 → **cao trào:** chữ kanji trên bàn đổi, toàn bộ menu sang nội dung N3 → Tiến độ hiện tab N4 và N3 riêng.
5. **Người dùng cũ chuyển Tài khoản (UJ-5):** banner "Chuyển tiến độ từ bản cũ" → đăng nhập bản cũ + Tài khoản mới → **cao trào:** bảng so số liệu trước/sau khớp nhau.

## Open Questions

- `[NOTE FOR UX]` Cần mock thật cho Trang chủ 3D và Thẻ 3D trước khi build (dùng `impeccable` nhánh `shape`/`new-work`).
- `[NOTE FOR UX]` Chế độ tối để giai đoạn sau.
