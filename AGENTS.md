# Project Guidance

## User Preferences

- Nội dung bám theo chuẩn JLPT N4 của Nhật Bản
- Giải thích kanji gồm âm Hán Việt và nghĩa
- Ngữ pháp có nghĩa rõ ràng và nhiều ví dụ
- Giao diện tiếng Việt
- Nội dung từ vựng, kanji, ngữ pháp lấy đầy đủ từ dataset Minna no Nihongo bài 26-50

## Accepted Requirements

- Flashcard từ vựng N4
- Trắc nghiệm kanji gồm từ đơn và từ ghép, có giải thích âm Hán Việt và nghĩa
- Ôn tập cấu trúc ngữ pháp N4 với nghĩa rõ ràng và nhiều ví dụ
- Ôn tập đọc hiểu đoạn văn
- Toàn bộ nội dung dựa trên chuẩn JLPT N4 của Nhật Bản
- Lưu tiến độ theo tài khoản
- Bổ sung từ vựng, ngữ pháp, kanji đầy đủ y như trong file dataset

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **Supabase tests**: see `backend/supabase/README.md` for local database and Edge Function checks.
- **web build and E2E**: `pnpm packs:build`, `pnpm packs:verify`, `pnpm build`, then `pnpm e2e:web`. See `infra/scripts/README.md` for Chromium setup and the N3 test mode.

## Learnings

- In E2E tests, open `/kanji/tra-cuu` directly; a running kanji quiz does not link to it.
- Tien do page shows 'Bạn chưa có tiến độ nào' for a user with no progress (no 0% figures).
- Edit pack content in `infra/content/n4/`; the frontend loads generated JSON from `/packs`. Supabase stores per-user progress keyed by content IDs.
- Routes are /tu-vung, /kanji, /kanji/tra-cuu, /ngu-phap, /ngu-phap/$patternId, /doc-hieu, /doc-hieu/$passageId and /tien-do (not English paths).
- Supabase limits progress item IDs to 128 characters and quiz totals to 1,000.
- N4 preserves 1,182 vocabulary, 118 kanji, 388 compound and 148 grammar IDs. `pnpm packs:verify` checks the pack against `infra/dataset_n4_minnanihongo/jsonl/`, including all 403 source compound rows.
- Grammar patterns have no quiz questions, so the detail page shows only Cách chia, Ý nghĩa, Cách dùng and Ví dụ.
- Vocabulary page filters by lesson (Bài học) and section (Mục); card counter shows 'n / total'.
