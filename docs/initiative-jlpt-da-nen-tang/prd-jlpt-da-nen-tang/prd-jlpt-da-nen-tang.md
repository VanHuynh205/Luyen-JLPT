---
title: Luyện JLPT đa nền tảng
status: draft
created: 2026-11-21
updated: 2026-11-21
---

# PRD: Luyện JLPT đa nền tảng
*Tên làm việc, cần xác nhận.*

## 0. Mục đích tài liệu

PRD này mô tả giai đoạn mở rộng ứng dụng ôn thi JLPT hiện có (web ôn N4 theo Minna no Nihongo bài 26–50) thành sản phẩm chạy trên web, desktop, Android và iOS, có giao diện 3D ở các điểm nhấn và mở rộng dần sang N3, N2, N1, sau đó N5. Người đọc là chủ dự án, người viết ticket (Sofia, `bmad-agent-po`) và người thiết kế kiến trúc (`bmad-architecture`). Thuật ngữ dùng theo §3. Chức năng nhóm theo tính năng, mỗi yêu cầu chức năng (FR) đánh số toàn cục. Chỗ suy luận chưa được xác nhận gắn `[ASSUMPTION]` và liệt kê ở §11.

Đầu vào đã có: `AGENTS.md` (yêu cầu đã chấp nhận), `DESIGN.md` (định hướng thẩm mỹ Washi & Sumi), `project.json`, `docs/code-review/2026-11-21-code-review.md`, dataset `infra/dataset_n4_minnanihongo/`. Lựa chọn công nghệ nằm trong `addendum.md` cùng thư mục.

## 1. Tầm nhìn

Người Việt học tiếng Nhật theo giáo trình Minna no Nihongo cần một chỗ ôn tập bám đúng giáo trình, giải thích bằng tiếng Việt, có âm Hán Việt cho từng chữ kanji. Bản web hiện tại làm được điều đó cho N4: 1.182 từ vựng, 118 kanji, 388 từ ghép, 148 mẫu ngữ pháp, bài đọc hiểu và tiến độ theo tài khoản.

Giai đoạn này đưa cùng trải nghiệm đó lên máy tính và điện thoại để người học ôn được trên xe buýt, giờ nghỉ trưa, cả khi mất mạng, và tiến độ đi theo họ giữa các thiết bị. Nội dung được tổ chức theo cấp độ để thêm N3, N2, N1 mà không phải sửa lại app. Giao diện giữ tinh thần "bàn học giấy washi" của `DESIGN.md`, thêm chiều sâu 3D ở trang chủ, lúc chuyển cảnh và khi lật thẻ, còn màn học và đọc giữ 2D để chữ Nhật luôn rõ.

## 2. Người dùng mục tiêu

### 2.1 Việc cần làm (JTBD)

- Ôn từ vựng, kanji, ngữ pháp của đúng bài vừa học trên lớp, theo số bài Minna.
- Hiểu kanji qua âm Hán Việt và nghĩa, nhớ được từ ghép nhờ liên hệ âm Hán Việt.
- Phân biệt các mẫu ngữ pháp dễ nhầm, nắm cách chia và kính ngữ trước kỳ thi.
- Tranh thủ thời gian ngắn trên điện thoại, kể cả khi không có mạng.
- Thấy mình đã thuộc bao nhiêu, còn yếu chỗ nào, trên mọi thiết bị.
- Học tiếp lên cấp độ cao hơn trong cùng một app khi đã qua N4.

### 2.2 Không phải người dùng (v1)

- Người học không theo Minna no Nihongo hoặc không dùng tiếng Việt.
- Giáo viên cần quản lý lớp, giao bài, chấm điểm học viên.

### 2.3 Hành trình người dùng chính

- **UJ-1. Lan ôn từ vựng bài 31 trên xe buýt không có mạng.**
  - **Bối cảnh:** Lan, sinh viên năm hai, học Minna buổi tối ở trung tâm; sáng đi xe buýt 40 phút.
  - **Trạng thái đầu:** đã đăng nhập trên Android từ hôm trước; điện thoại đang mất sóng.
  - **Diễn biến:** mở app, trang chủ hiện ngay (không chờ mạng); chọn N4 → Từ vựng → Bài 31; lật thẻ, đánh dấu 12 từ "đã thuộc".
  - **Cao trào:** bộ đếm "Đã thuộc 12/48" cập nhật ngay dù không có mạng.
  - **Kết thúc:** tối về mở bản desktop, 12 từ đó đã hiện là "đã thuộc".
  - **Trường hợp biên:** nếu trước đó Lan đã đánh dấu "chưa thuộc" một từ trên desktop sau thời điểm đánh dấu trên điện thoại, bản ghi mới hơn thắng.

- **UJ-2. Minh làm trắc nghiệm kanji và đọc giải thích Hán Việt.**
  - Minh mở bản Windows, chọn Trắc nghiệm Kanji kiểu trộn, làm 10 câu. Sau mỗi câu, app hiện âm Hán Việt, nghĩa và từ ghép liên quan. Kết thúc, điểm được "đóng dấu" hanko và lưu vào lịch sử; Minh vào Tiến độ xem các chữ hay sai.

- **UJ-3. Hà phân biệt hai mẫu ngữ pháp dễ nhầm trước kỳ thi.**
  - Hà xem mẫu 〜ようにする, thấy liên kết "So sánh với 〜ようになる"; mở trang so sánh có điểm khác nhau và câu đối chiếu. Từ đó vào bảng cách chia thể ý chí và trang kính ngữ cho bài 49–50.

- **UJ-4. Tuấn đã qua N4 chuyển sang học N3.**
  - Tuấn mở bộ chọn cấp độ, chọn N3. Toàn bộ menu Từ vựng/Kanji/Ngữ pháp/Đọc hiểu chuyển sang nội dung N3; tiến độ N4 vẫn giữ nguyên và xem được ở trang Tiến độ theo từng cấp.

- **UJ-5. Nam, bạn của chủ dự án, cài bản dùng thử.**
  - Nam nhận file `.apk` qua tin nhắn, cài trên Android (cho phép cài từ nguồn ngoài), tạo Tài khoản bằng Google, học thử bài 26. Tối đó Nam cài file `.exe` trên laptop Windows, đăng nhập cùng Tài khoản và thấy tiến độ đã có.

## 3. Thuật ngữ

- **Cấp độ** — một mức JLPT: N5, N4, N3, N2, N1. Mỗi Cấp độ có nhiều Bài.
- **Bài** — đơn vị giáo trình (ví dụ Minna bài 26). Thuộc đúng một Cấp độ.
- **Gói nội dung** — toàn bộ Từ vựng, Kanji, Từ ghép, Mẫu ngữ pháp, Bài so sánh, Bảng chia, Mục kính ngữ, Cặp tự/tha động từ và Bài đọc của một Cấp độ, có số phiên bản.
- **Mục nội dung** — một bản ghi trong Gói nội dung, có mã ổn định (ví dụ `vocab-TV-26-01`).
- **Thẻ** — một Từ vựng hiển thị dạng flashcard hai mặt.
- **Trạng thái thẻ** — "đã thuộc" hoặc "chưa thuộc", gắn với một Tài khoản và một Thẻ.
- **Lượt trắc nghiệm** — một lần làm bài trắc nghiệm kanji, gồm điểm, tổng số câu, các Mục sai, thời điểm.
- **Bài so sánh** — so sánh hai hoặc nhiều Mẫu ngữ pháp gần nghĩa (bảng `so_sanh`).
- **Bảng chia** — quy tắc chia động từ/tính từ/danh từ (bảng `cach_chia`).
- **Tài khoản** — danh tính người học, dùng để đồng bộ Tiến độ.
- **Tiến độ** — tập Trạng thái thẻ, Lượt trắc nghiệm, Mẫu ngữ pháp đã học, kết quả Bài đọc của một Tài khoản, tách theo Cấp độ.
- **Đồng bộ** — đưa Tiến độ ghi khi ngoại tuyến lên máy chủ và kéo Tiến độ từ thiết bị khác về.
- **Ứng dụng vỏ** — bản cài đặt desktop hoặc di động bọc cùng giao diện web.
- **Điểm nhấn 3D** — cảnh hoặc hiệu ứng 3D ở trang chủ, chuyển cảnh, Thẻ và kết quả; không dùng cho màn đọc nội dung dài.

## 4. Tính năng

### 4.1 Nội dung theo Cấp độ

**Mô tả:** Mọi màn học đọc nội dung từ Gói nội dung của Cấp độ đang chọn. Gói N4 phải chứa đủ các bảng của dataset hiện có, gồm bốn bảng chưa dùng: Bài so sánh, Bảng chia, Mục kính ngữ, Cặp tự/tha động từ. Thêm Cấp độ mới chỉ cần thêm Gói nội dung, không sửa màn hình. Realizes UJ-3, UJ-4.

#### FR-1: Chọn Cấp độ
Người học chọn Cấp độ đang học; lựa chọn được nhớ trên thiết bị và theo Tài khoản.
- Chỉ hiện các Cấp độ đã có Gói nội dung; Cấp độ chưa có hiện "Sắp ra mắt" và không bấm được.
- Đổi Cấp độ làm mọi menu Từ vựng/Kanji/Ngữ pháp/Đọc hiểu đổi nội dung mà không tải lại app.

#### FR-2: Gói nội dung N4 đầy đủ theo dataset
Gói N4 chứa toàn bộ bản ghi của `infra/dataset_n4_minnanihongo/jsonl` dùng cho học tập.
- Số lượng khớp `manifest.json`: 1.182 từ vựng, 118 kanji, 148 mẫu ngữ pháp, 27 Bài so sánh, 22 Bảng chia, 17 Mục kính ngữ, 12 Cặp tự/tha động từ; 403 dòng từ ghép (gộp trùng được phép nếu giữ liên kết tới mọi kanji gốc).
- Có kiểm tra tự động so số lượng và mã Mục nội dung giữa dataset và Gói nội dung; chạy trong CI.
**Ngoài phạm vi:** `anh_nguon`, `doi_chieu_ocr`, `nguon`, `chuan_hoa` là dữ liệu biên soạn, không hiển thị cho người học.

#### FR-3: Mã Mục nội dung ổn định
Mỗi Mục nội dung có mã không đổi qua các phiên bản Gói nội dung.
- Tiến độ đã lưu vẫn khớp đúng Mục sau khi cập nhật Gói.
- Mục bị xoá khỏi Gói không làm lỗi trang Tiến độ; được bỏ qua khi tính phần trăm.

#### FR-4: Cập nhật Gói nội dung không cần phát hành lại app
Gói nội dung mới (sửa lỗi, thêm Cấp độ) đến được người dùng desktop/di động mà không bắt buộc cập nhật bản cài. `[ASSUMPTION]`
- App vẫn dùng được Gói đã tải khi ngoại tuyến.

### 4.2 Từ vựng

**Mô tả:** Giữ nguyên flashcard hiện có: lọc theo Bài và mục, xáo trộn, chỉ ôn thẻ chưa thuộc, đánh dấu Trạng thái thẻ. Mặt sau có cách đọc, âm Hán Việt, nghĩa tiếng Việt, ghi chú. Realizes UJ-1.

#### FR-5: Flashcard theo Bài và mục
Người học lọc Thẻ theo Bài và mục, lật thẻ, đi tới/lui, xáo trộn.
- Bộ đếm hiện "vị trí / tổng" và "Đã thuộc n/tổng" trong lựa chọn.

#### FR-6: Đánh dấu Trạng thái thẻ khi ngoại tuyến
Người học đánh dấu "đã thuộc"/"chưa thuộc" cả khi mất mạng; Trạng thái được Đồng bộ sau.
- Giao diện cập nhật ngay, không chờ máy chủ.

### 4.3 Kanji

**Mô tả:** Thư viện tra cứu kanji/từ ghép (tìm bằng kanji, kana, Hán Việt không dấu, nghĩa) và trắc nghiệm ba kiểu (đơn, ghép, trộn), mỗi câu có giải thích âm Hán Việt và nghĩa. Realizes UJ-2.

#### FR-7: Tra cứu kanji và từ ghép
- Tìm "hoc" khớp "học"; tìm katakana khớp hiragana tương ứng.

#### FR-8: Trắc nghiệm kanji
- 10 câu mỗi lượt; không có hai đáp án trùng nhau; không hiện ký hiệu thô của dữ liệu (dấu `.` hoặc `-` trong âm Kun).
- Lượt trắc nghiệm được lưu vào Tiến độ, kể cả khi ngoại tuyến.

### 4.4 Ngữ pháp

**Mô tả:** Mỗi Mẫu ngữ pháp có cách nối với V/Aい/Aな/N, ý nghĩa, cách dùng, ví dụ Nhật–Việt và nút "Đã học". Bổ sung ba loại trang từ dataset. Realizes UJ-3.

#### FR-9: Chi tiết Mẫu ngữ pháp (giữ nguyên hiện có)

#### FR-10: Bài so sánh
Người học mở trang so sánh các Mẫu ngữ pháp gần nghĩa: điểm khác nhau và câu đối chiếu.
- Trang Mẫu ngữ pháp có liên kết tới mọi Bài so sánh chứa nó.

#### FR-11: Bảng chia
Người học xem quy tắc chia theo nhóm động từ, tính từ, danh từ, với ví dụ và ngoại lệ.

#### FR-12: Kính ngữ
Người học xem tôn kính ngữ, khiêm nhường ngữ I/II, cách nhận biết và ví dụ.

#### FR-13: Cặp tự động từ / tha động từ
Người học xem các cặp kèm trợ từ và nghĩa.

### 4.5 Đọc hiểu

#### FR-14: Bài đọc có câu hỏi
Người học đọc đoạn văn, trả lời hết câu hỏi rồi nộp, xem đáp án và hỗ trợ học (từ vựng trong bài).
- Kết quả lưu số lần làm, điểm gần nhất, điểm cao nhất.
- Chuyển trực tiếp giữa hai bài đọc phải bắt đầu bài mới ở trạng thái trống (lỗi #5 trong báo cáo review).

### 4.6 Tài khoản, Tiến độ và Đồng bộ

**Mô tả:** Tài khoản chuyển từ Internet Identity sang dịch vụ đăng nhập mới. Tiến độ lưu cục bộ trước, Đồng bộ khi có mạng. Khách (không đăng nhập) vẫn học được, Tiến độ chỉ ở máy. Realizes UJ-1, UJ-5.

#### FR-15: Đăng ký và đăng nhập
Người học đăng ký theo một trong hai cách: tên đăng nhập + mật khẩu kèm email, hoặc bằng tài khoản Google. Đăng nhập bằng email hoặc tên đăng nhập kèm mật khẩu, hoặc bằng Google.
- Tên đăng nhập là duy nhất; email được xác nhận qua thư trước khi Đồng bộ.
- Có "Quên mật khẩu" gửi liên kết đặt lại qua email.
- Phiên đăng nhập được giữ giữa các lần mở app.
- Mỗi Tài khoản chỉ đọc/ghi được Tiến độ của chính mình (kiểm chứng bằng test truy cập chéo hai tài khoản).

#### FR-16: Lưu Tiến độ ngoại tuyến và Đồng bộ
- Mọi thao tác ghi Tiến độ thành công cục bộ khi không có mạng và được gửi lên trong vòng 30 giây sau khi có mạng lại.
- Xung đột trên cùng Mục: bản ghi có thời điểm mới hơn thắng; Lượt trắc nghiệm và lần làm Bài đọc chỉ cộng thêm, không ghi đè.
- Khách đăng nhập lần đầu được hỏi có gộp Tiến độ trên máy vào Tài khoản không.

#### FR-17: Tiến độ theo Cấp độ
Trang Tiến độ hiện số liệu từng Cấp độ: từ đã thuộc, kanji/từ ghép hay sai, ngữ pháp đã học, bài đọc đã làm.
- Tài khoản chưa có Tiến độ thấy "Bạn chưa có tiến độ nào" (giữ hành vi hiện có).

#### FR-18: (đã bỏ 2026-11-21)
Không chuyển Tiến độ từ bản ICP: bản ICP chưa có người dùng ngoài chủ dự án. Canister ICP ngừng dùng khi Supabase chạy.

#### FR-19: Xoá Tài khoản
Người học tự xoá Tài khoản và toàn bộ Tiến độ trong app (bạn bè dùng thử phải xoá được dữ liệu của mình).

### 4.7 Ứng dụng đa nền tảng

#### FR-20: Bản web
Bản web giữ mọi tính năng, các đường dẫn tiếng Việt hiện có (`/tu-vung`, `/kanji`, `/kanji/tra-cuu`, `/ngu-phap`, `/doc-hieu`, `/tien-do`) không đổi.

#### FR-21: Bản desktop
Phân phối file cài `.exe` cho Windows 10+ trực tiếp cho bạn bè (không qua store); tự kiểm tra và cài bản cập nhật. macOS và Linux dựng được nhưng không phải mục tiêu bản dùng thử đầu. `[ASSUMPTION]`

#### FR-22: Bản Android và iOS
File `.apk` cài trực tiếp trên Android 8+ (không qua Google Play); app báo khi có `.apk` mới. iOS 15+ làm sau bản Android, vì cần macOS để build và chưa có kế hoạch App Store. Giao diện dùng được bằng một tay trên màn 360px; nút bấm tối thiểu 44×44px.

#### FR-23: Mở app khi ngoại tuyến
App đã cài mở được và học được mọi nội dung của Gói nội dung đã tải mà không cần mạng.

### 4.8 Giao diện 3D điểm nhấn

**Mô tả:** Thêm chiều sâu cho trải nghiệm theo `DESIGN.md` mà không làm khó đọc chữ Nhật. Điểm nhấn: trang chủ 3D (ví dụ bàn học washi với chữ kanji nổi khối), chuyển cảnh giữa các mục, Thẻ lật 3D, con dấu hanko 3D khi có kết quả. Màn đọc bài, chi tiết ngữ pháp, danh sách tra cứu giữ 2D. `[ASSUMPTION: hình ảnh cụ thể do bmad-ux chốt]`

#### FR-24: Trang chủ 3D
- Có ảnh tĩnh thay thế khi thiết bị không hỗ trợ WebGL hoặc tốc độ khung hình dưới ngưỡng ở §5.

#### FR-25: Tôn trọng giảm chuyển động
Khi hệ điều hành bật "giảm chuyển động" hoặc người học tắt hiệu ứng trong Cài đặt, mọi Điểm nhấn 3D và chuyển cảnh chuyển sang dạng tĩnh hoặc mờ dần.

#### FR-26: 3D không chặn việc học
Nội dung học hiển thị và dùng được trước khi cảnh 3D tải xong.

## 5. Yêu cầu phi chức năng chung

- **Hiệu năng:** màn học tương tác được trong 2 giây trên điện thoại tầm trung khi đã có Gói nội dung; Điểm nhấn 3D giữ ≥ 50 fps trên điện thoại tầm trung, nếu không thì hạ chất lượng hoặc chuyển ảnh tĩnh. `[ASSUMPTION: "tầm trung" = cấu hình tương đương Android 2022 giá phổ thông]`
- **Kích thước:** gói tải cảnh 3D lần đầu ≤ 3 MB nén; bản cài di động ≤ 30 MB. `[ASSUMPTION]`
- **Tiếp cận:** đạt WCAG 2.1 AA cho màn 2D; chữ Nhật có `lang="ja"`; hỗ trợ phóng to chữ hệ điều hành.
- **Bảo mật:** dữ liệu Tiến độ tách theo Tài khoản ở tầng cơ sở dữ liệu; mọi dữ liệu người dùng gửi lên có giới hạn độ dài và kích thước (tiếp nối sửa lỗi review #1); không lưu bí mật trong bản cài.
- **Ngôn ngữ:** toàn bộ giao diện tiếng Việt.
- **Độ tin cậy:** không mất Tiến độ khi app bị tắt giữa chừng hoặc mất mạng khi đang Đồng bộ.

## 6. Thẩm mỹ và giọng văn

Giữ hướng Washi & Sumi: nền giấy ngà, chữ mực sumi, nút chàm ai-zome, con dấu hanko son. 3D dùng vật liệu giấy, mực, gỗ bàn học; không ánh neon, không gradient sặc sỡ. Chữ Nhật không bao giờ hiển thị bằng font tiêu đề. Giọng văn ngắn, thân thiện, xưng "bạn".

## 7. Ràng buộc

- **Phạm vi phân phối:** dùng cá nhân và bạn bè, phát file `.exe`/`.apk` trực tiếp. Không đưa lên App Store/Google Play trong giai đoạn này; dataset ghi "bản quyền nội dung giáo trình thuộc nhà xuất bản", nên phát hành công khai cần xem lại bản quyền trước.
- **Giấy phép dữ liệu:** âm On/Kun lấy từ KANJIDIC2 (CC BY-SA 4.0): app phải ghi nguồn và giữ giấy phép tương ứng cho phần dữ liệu đó.
- **Dữ liệu bạn bè:** có xoá Tài khoản trong app (FR-19); không thu thập gì ngoài Tài khoản và Tiến độ.
- **Chi phí:** vận hành ở mức gói miễn phí hoặc chi phí thấp. `[ASSUMPTION]`

## 8. Không làm (rõ ràng)

- Không làm tính năng lớp học, giáo viên, mạng xã hội, bảng xếp hạng.
- Không làm luyện nghe/nói, nhận dạng giọng nói, viết tay kanji trong giai đoạn này.
- Không tạo nội dung N3/N2/N1/N5 bằng AI để phát hành mà không có nguồn đối chiếu.
- Không làm toàn bộ app thành không gian 3D.
- Không thu phí trong giai đoạn này. `[ASSUMPTION]`

## 9. Phạm vi

### 9.1 Trong phạm vi giai đoạn này

- Mô hình nội dung theo Cấp độ, Gói N4 đầy đủ 7 bảng học tập (FR-1 đến FR-4).
- Bốn trang ngữ pháp mới (FR-10 đến FR-13).
- Supabase thay ICP, ngoại tuyến + Đồng bộ (FR-15 đến FR-17, FR-19).
- Bản dùng thử cho bạn bè: `.exe` Windows và `.apk` Android (FR-20 đến FR-23); iOS sau Android.
- Điểm nhấn 3D (FR-24 đến FR-26).
- Bộ test tự động: unit, tích hợp cơ sở dữ liệu, E2E web và kiểm thử trên giả lập di động.

### 9.2 Ngoài phạm vi giai đoạn này

- Gói nội dung N3, N2, N1, N5: kiến trúc phải sẵn sàng, nội dung thêm ở các giai đoạn sau theo thứ tự N3 → N2 → N1 → N5. Dataset N3 do chủ dự án biên soạn từ giáo trình và ghi chép đang học, cùng định dạng với dataset N4 (`jsonl` + `manifest.json`).
- Phát hành App Store/Google Play; chuyển dữ liệu ICP (FR-18 đã bỏ).
- Ôn tập lặp lại ngắt quãng (SRS). `[NOTE FOR PM: giá trị cao cho việc nhớ từ, cân nhắc giai đoạn sau]`
- Thông báo nhắc học.

## 10. Chỉ số thành công

**Chính**
- **SM-1**: Người học ôn trên từ hai loại thiết bị trở lên mỗi tuần — mục tiêu ≥ 30% người dùng đăng nhập. Validates FR-16, FR-21, FR-22.
- **SM-2**: Tỉ lệ thao tác Tiến độ ghi ngoại tuyến được Đồng bộ thành công trong 24 giờ — ≥ 99,5%. Validates FR-16.

**Phụ**
- **SM-3**: Số Trạng thái thẻ "đã thuộc" trung bình mỗi người học hoạt động sau 30 ngày. Validates FR-5, FR-6.
- **SM-4**: Tỉ lệ người học mở trang Bài so sánh hoặc Bảng chia ít nhất một lần. Validates FR-10, FR-11.

**Chỉ số đối trọng (không tối ưu)**
- **SM-C1**: Thời gian xem cảnh 3D. Hiệu ứng đẹp không được kéo người học khỏi việc học; tăng chỉ số này không phải mục tiêu. Đối trọng SM-3.
- **SM-C2**: Số lần mở app. Mở nhiều mà Trạng thái thẻ không tăng nghĩa là app gây xao nhãng. Đối trọng SM-1.

`[ASSUMPTION: chỉ số đo bằng thống kê ẩn danh có sự đồng ý của người dùng; nếu không bật thống kê thì chỉ dùng SM-2 qua log máy chủ]`

## 11. Câu hỏi mở

1. ~~OQ-1~~ Đã chốt 2026-11-21: dùng cá nhân và bạn bè, phát `.exe`/`.apk` trực tiếp, chưa lên store.
2. ~~OQ-2~~ Đã chốt 2026-11-21: đăng ký tên đăng nhập + mật khẩu kèm email, hoặc Google; đăng nhập bằng email/tên đăng nhập + mật khẩu hoặc Google.
3. ~~OQ-3~~ Đã chốt 2026-11-21: chưa có người dùng ICP; bỏ FR-18. Bạn bè dùng thử khi có bản cài chạy thật.
4. ~~OQ-4~~ Đã chốt 2026-11-21: dataset N3 do chủ dự án bổ sung sau, từ giáo trình và ghi chép tay.
5. **OQ-5** Gói nội dung cập nhật qua mạng (FR-4) hay đóng gói cố định trong mỗi bản phát hành? (kiến trúc đang giả định: cả hai)
6. **OQ-6** Có cần bản desktop macOS/Linux cho bạn bè không?
7. **OQ-7** Ngưỡng tài khoản Google: dùng Supabase gói miễn phí (giới hạn email xác nhận/giờ) có đủ cho nhóm bạn dùng thử không?

## 12. Danh mục giả định

- FR-4 — Gói nội dung cập nhật không cần phát hành lại app.
- FR-21 — bản dùng thử đầu chỉ cần Windows trên desktop.
- FR-21, FR-22 — phiên bản hệ điều hành tối thiểu.
- §4.8 — hình ảnh 3D cụ thể do `bmad-ux` chốt.
- §5 — ngưỡng hiệu năng và kích thước.
- §7 — chi phí vận hành thấp.
- §8 — không thu phí.
- §10 — đo chỉ số bằng thống kê ẩn danh có đồng ý.
