# Dataset Minna no Nihongo Sơ cấp II

Bộ dữ liệu được biên soạn từ 146 ảnh trong `dataset_n4.zip`. Phần từ vựng và ngữ pháp đi theo bài 26–50. Kanji đi theo nhóm bài ghi trên từng trang vở. 3A Corporation xếp kiến thức sau khi học Sơ cấp II vào mức gần N4. JLPT hiện hành công bố mô tả năng lực và câu mẫu. Danh sách từ, kanji và ngữ pháp trong bộ này theo giáo trình, ghi chép và phần ôn bổ sung.

## Mở và tra cứu

Mở `dataset_n4.xlsx` để tra cứu bằng bộ lọc. Khi cần kiểm tra một dòng, lấy mã ở cột **Ảnh**, tìm trong bảng **Ảnh nguồn**, rồi mở đường dẫn tương ứng bên trong ZIP gốc.

Dùng `jsonl/` khi nhập vào ứng dụng hoặc xử lý bằng Python. Mỗi dòng là một đối tượng JSON UTF-8. Dùng `csv/` khi cần bảng phẳng, có BOM để Excel nhận đúng tiếng Việt và tiếng Nhật. Tệp Excel chọn các cột phục vụ tra cứu. CSV và JSONL giữ đầy đủ các trường dữ liệu.

## Nội dung

| Tên bảng | Số dòng | Trường chính |
| --- | ---: | --- |
| `tu_vung` | 1.182 | Bài, kana, hiragana quy đổi, kanji, âm Hán Việt, nghĩa, cụm đi kèm và ghi chú. Có 1.141 mục từ phần in và 41 mục ghi tay đọc rõ. |
| `kanji` | 118 | Chữ chính, âm Hán Việt, nghĩa chữ, âm On, âm Kun, bài và ảnh. |
| `tu_ghep_kanji` | 403 | Từ/cụm minh họa, hiragana, âm Hán Việt và nghĩa tiếng Việt. Một cụm xuất hiện dưới nhiều chữ chính hoặc nhiều bài có thể có nhiều dòng. |
| `ngu_phap` | 148 | Cấu trúc, cách nối riêng cho V/Aい/Aな/N, nghĩa, cách dùng và ví dụ Nhật–Việt. Có 141 mục bám ảnh và 7 mục bổ sung. |
| `cach_chia` | 22 | Cách chia theo nhóm động từ, tính từ và danh từ, ví dụ và ngoại lệ. |
| `kinh_ngu` | 17 | Tôn kính, khiêm nhường I/II, cách nhận biết, cách nói lịch sự và ví dụ. |
| `so_sanh` | 27 | Mẫu gần nghĩa, mẫu dễ nhầm, điểm khác nhau và câu đối chiếu. |
| `tu_dong_tha_dong` | 12 | Cặp tự động từ và tha động từ, trợ từ và nghĩa. |
| `chuan_hoa` | 12 | Một số điểm cụ thể đã sửa hoặc giải thích thêm. |
| `anh_nguon` | 146 | Mã ảnh, đường dẫn trong ZIP gốc và số mục gắn với ảnh. |
| `doi_chieu_ocr` | 206 | Những dòng tiếng Nhật có độ khớp OCR thấp. |
| `nguon` | 17 | Mã, đường dẫn và vai trò của từng nguồn đối chiếu. |

## Quy ước dữ liệu

- `id` phân biệt từng bản ghi trong một bảng. `image_ids` liên kết với `anh_nguon.id`. `reference_ids` liên kết với `nguon.id`. Trong bảng cụm kanji, `kanji_id` liên kết với `kanji.id`.
- `kana` giữ hiragana hoặc katakana theo cách viết của mục. `hiragana` quy đổi katakana sang hiragana để hỗ trợ tìm kiếm. Từ mượn nên học theo trường `kana`.
- `han_viet` ghi âm từng chữ Hán theo thứ tự xuất hiện để hỗ trợ ghi nhớ. Chữ chưa có âm thông dụng được giữ trong dấu 〔 〕 khi đi cùng chữ có âm. Âm Hán Việt khác với âm On/Kun tiếng Nhật và với nghĩa dịch tiếng Việt. Trong `kun_yomi`, dấu chấm đánh dấu ranh giới giữa phần đọc thuộc chữ và phần kana đi kèm. Hậu tố hoặc tiền tố có thể dùng dấu gạch ngang.
- `kanji_origin=viet_the_bo_sung` đánh dấu cách viết có kanji được thêm cho mục trong ảnh viết bằng kana. Một số cách viết thêm, như 暫く hoặc 薔薇, thường được viết bằng kana trong tài liệu sơ cấp.
- Trong bảng ngữ pháp, `v`, `a_i`, `a_na`, `n` lần lượt là cách nối với động từ, tính từ い, tính từ な và danh từ. Trường trống nghĩa là mẫu đó không có cách nối trực tiếp tương ứng. `examples` là mảng đối tượng có `ja`, `vi`, `origin`. Ví dụ lấy từ ảnh có thể đã được chuẩn hóa kana/kanji, chính tả hoặc dấu câu.
- `origin=bo_sung` ở bảng ngữ pháp đánh dấu mẫu thêm để làm rõ các nhóm đang học. Ví dụ biên soạn có nhãn riêng, kể cả khi mẫu có trong ảnh. Các dạng có trong ảnh và kiến thức ôn bổ sung nằm cùng bảng để tiện tra.
- Những mục trong `doi_chieu_ocr` đã được đối chiếu theo trang, thứ tự từ và tài liệu tham chiếu, nhưng nên so lại ảnh nếu cần bản chép sát từng ký tự. Một số chú thích viết tay nhỏ, bị gạch xóa hoặc mờ chưa được đưa thành bản ghi.

## Nguồn

Thông tin xuất bản, phạm vi JLPT, tài liệu Japan Foundation, Đại học Ngoại ngữ Tokyo và hướng dẫn kính ngữ của Cơ quan Văn hóa Nhật Bản có trong `nguon`. Các trường âm On/Kun lấy từ KANJIDIC2 của Electronic Dictionary Research and Development Group, phát hành theo CC BY-SA 4.0. Âm Hán Việt được đối chiếu với KANJIDIC2, Unicode Unihan và cách ghi trong ảnh. Bản quyền nội dung giáo trình thuộc nhà xuất bản.
