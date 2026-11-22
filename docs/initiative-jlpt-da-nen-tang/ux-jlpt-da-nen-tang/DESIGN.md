---
name: Washi & Sumi 3D
description: Bàn học giấy washi, mực sumi, chàm ai-zome và con dấu hanko son; thêm chiều sâu 3D ở các điểm nhấn cho app ôn JLPT trên web, desktop, Android, iOS.
status: draft
created: 2026-11-21
updated: 2026-11-21
colors:
  background: '#F9F6F1'
  foreground: '#13161D'
  card: '#FEFDFB'
  primary: '#203F7C'
  accent: '#D33E21'
  success: '#3E8343'
  destructive: '#C51D28'
  muted: '#F1ECE4'
  desk-wood: '#8A6A4A'
  ink-shadow: '#13161D'
typography:
  display:
    fontFamily: Fraunces
    fontWeight: 600
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    lineHeight: 1.6
  jp-showcase:
    fontFamily: system Mincho (font-jp)
    lineHeight: 1.8
  jp-text:
    fontFamily: system Gothic (font-jp-sans)
    lineHeight: 1.8
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.1em
rounded:
  sm: 4px
  md: 8px
  xl: 14px
  full: 9999px
spacing:
  section-mobile: 48px
  section-desktop: 64px
  card-mobile: 20px
  card-desktop: 24px
  touch-min: 44px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.card}'
    radius: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  hanko-seal:
    background: '{colors.accent}'
    rotate: -4deg
    note: chỉ một con dấu mỗi màn hình
  flashcard-3d:
    surface: '{colors.card}'
    radius: '{rounded.xl}'
    flipDuration: 500ms
  level-chip:
    background: '{colors.muted}'
    activeBackground: '{colors.primary}'
    radius: '{rounded.full}'
  scene-3d:
    paper: '{colors.background}'
    ink: '{colors.foreground}'
    wood: '{colors.desk-wood}'
    accentLight: '{colors.accent}'
---

# DESIGN.md — Washi & Sumi 3D

Kế thừa toàn bộ `DESIGN.md` ở gốc repo (Washi & Sumi) và bộ shadcn/Tailwind trong `src/frontend`. File này chỉ ghi phần mở rộng cho 3D và đa nền tảng. Khi xung đột với mock hay ảnh tham khảo, file này thắng.

## Brand & Style

Bàn học yên tĩnh của người học chữ: giấy washi ngà, mực sumi, nút chàm, con dấu son. 3D không phải "game hoá" mà là thêm độ sâu vật lý cho chính những đồ vật đó: tờ giấy có độ dày, chữ kanji như được khắc nổi, con dấu ấn xuống giấy. Cảm giác cần đạt: tĩnh, chỉn chu, đọc lâu không mỏi.

## Colors

Giữ 8 màu gốc. Thêm hai màu chỉ dùng trong cảnh 3D:

- `{colors.desk-wood}` — mặt bàn gỗ trong cảnh trang chủ. Không dùng cho UI 2D.
- `{colors.ink-shadow}` — bóng mực mềm dưới vật thể 3D, độ mờ 8–15%.

`{colors.accent}` vẫn là con dấu: trong 3D chỉ dùng cho hanko và một nguồn sáng ấm nhỏ, không phủ cả cảnh.

`[ASSUMPTION]` Chế độ tối "Sumi đêm" để giai đoạn sau; khi làm sẽ thêm cặp token `*-dark`.

## Typography

Giữ phân vai gốc: Fraunces cho tiêu đề tiếng Việt, Plus Jakarta Sans cho thân bài, Mincho hệ thống cho kanji trưng bày, Gothic hệ thống cho câu tiếng Nhật. Chữ kanji trong cảnh 3D là hình học dựng từ font Mincho (text geometry hoặc texture SDF), không phải ảnh bitmap, để sắc nét ở mọi tỉ lệ màn hình.

Trên điện thoại: chữ thân bài không nhỏ hơn 16px; câu tiếng Nhật trong bài đọc 18px trở lên.

## Layout & Spacing

- Điện thoại (< 768px): một cột, lề 16px, `{spacing.section-mobile}` giữa các khối, thanh tab dưới đáy.
- Máy tính bảng và desktop (≥ 768px): lưới tối đa 1152px, `{spacing.section-desktop}`, điều hướng trên cùng.
- Desktop Tauri: cửa sổ tối thiểu 960×640; nội dung căn giữa, không kéo giãn quá 1152px.
- Vùng an toàn (safe area) của iOS/Android luôn được chừa cho header và thanh tab.

## Elevation & Depth

2D giữ "giấy phẳng chồng lớp, ngăn bằng đường mảnh". 3D có ba mức sâu:

1. **Bàn** — mặt phẳng nền cảnh, ánh sáng dịu từ trên trái.
2. **Giấy** — thẻ, trang sách nổi 2–6mm trên bàn, bóng `{colors.ink-shadow}` mềm.
3. **Vật nhấn** — chữ kanji khắc nổi, con dấu hanko; chỉ một vật nhấn động tại một thời điểm.

Không bóng phát sáng, không viền neon, không bloom mạnh.

## Shapes

Giữ `{rounded.md}` cho nút, `{rounded.xl}` cho thẻ. Vật thể 3D có cạnh vát nhẹ (bevel) tương ứng `{rounded.sm}`, không bo tròn kiểu đồ chơi.

## Components

- **Cảnh trang chủ:** bàn gỗ, chồng thẻ washi, một chữ kanji khắc nổi đổi theo Cấp độ đang chọn (N4: 漢, N3: 学, …). Camera chuyển động nhẹ theo con trỏ hoặc nghiêng máy, biên độ ≤ 4°.
- **Thẻ 3D (`flashcard-3d`):** lật quanh trục Y trong `{components.flashcard-3d.flipDuration}`, mặt sau có độ dày giấy thấy được khi nghiêng.
- **Hanko (`hanko-seal`):** khi có kết quả, con dấu hạ xuống và "ấn" vào giấy, để lại vết mực; hiệu ứng ≤ 700ms.
- **Chọn Cấp độ (`level-chip`):** dãy chip N5–N1; Cấp độ chưa có nội dung hiện chip nhạt kèm nhãn "Sắp ra mắt".
- **Chuyển cảnh:** trang mới trượt lên như tờ giấy đặt lên chồng giấy, 300–450ms.

## Do's and Don'ts

- Làm: để nội dung 2D hiện ngay, cảnh 3D tải sau và mờ dần vào.
- Làm: có ảnh tĩnh thay thế cho mọi cảnh 3D.
- Không: đặt câu tiếng Nhật dài lên bề mặt 3D.
- Không: dùng hơn một con dấu son trong một màn hình.
- Không: hiệu ứng cuộn mượt (Lenis) trên màn học và màn đọc.
- Không: dùng component React Bits kiểu neon, glitch, gradient sặc sỡ.
