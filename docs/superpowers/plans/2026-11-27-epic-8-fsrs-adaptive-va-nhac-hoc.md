# Epic 8: Động cơ FSRS-5, Streak/Heatmap, Adaptive Furigana & Nhắc học Cục bộ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng động cơ ôn tập lặp lại ngắt quãng FSRS-5 thuần TypeScript chạy 100% offline có đồng bộ hai chiều Supabase và chuyển tiếp mềm dữ liệu `card_status` cũ (`FR-30`), thêm chuỗi ngày học (Streak), mục tiêu ngày và lịch nhiệt 12 tuần giữ nguyên trạng thái trống sạch (`FR-40`), kích hoạt Adaptive Furigana tự ẩn `<rt>` cho chữ đã vững và nhắc học cục bộ qua `tauri-plugin-notification` (`FR-45`).

**Architecture:** Thuật toán FSRS-5 đặt thuần trong `frontend/src/core/srs/` (0 phụ thuộc React/SDK/mạng) theo `AD-14`, dùng chung cho từ vựng, kanji, từ ghép và thẻ Cloze (Epic 11). Lưu trữ cục bộ chạy trên các bảng `srsCards` và `srsReviews` đã cấp sẵn trong Dexie `luyen-jlpt` v4 (từ Epic 7 Task 3), đồng bộ qua hàng đợi `progressOutbox` hiện hành tới `public.srs_cards` (LWW) và `public.srs_reviews` (append-only UUID v4). Thống kê Streak & Heatmap dẫn xuất trực tiếp từ lịch sử lượt học theo đúng `AD-7`/`AD-14` (không tạo bảng tổng hợp trùng nguồn sự thật). Nhắc học cục bộ dùng `tauri-plugin-notification` hoàn toàn trên thiết bị (`0` push server, `0₫`, không đưa dữ liệu cá nhân ra màn hình khóa).

**Tech Stack:** React 19, TypeScript 7, Dexie `4.4.7`, TanStack Query `5`, Tailwind CSS `3.4` + shadcn/ui, Supabase Postgres 17 + pgTAP, Tauri `2.12.7` + `tauri-plugin-notification`, Vitest `5.1.1`, Playwright `1.65.1`.

**Spec:**
- `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (§3.1, §4.6, §6.2 FR-30/FR-40/FR-45, §6.3 AD-14/AD-18/AD-19, §6.4, §6.5 Phase 2, §7)
- `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E8-01..03`, `SEC-T04`, `SEC-T07`)
- Phụ thuộc trực tiếp: `docs/superpowers/plans/2026-11-27-epic-7-auth-web-luyen-de-pwa.md` (Dexie v4, `useFuriganaPreference`, N4 `1.1.0` `textRuby`). *(Lưu ý: phần `MediaSession` audio nền của FR-45 thuộc Epic 9 cùng `AudioPort`.)*

## Global Constraints

- **Thuần offline 0% AI (`AD-18`):** Toàn bộ tính lịch FSRS-5, Adaptive Furigana, Heatmap và Local Notification chạy cục bộ 100%, không gọi AI hay dịch vụ push bên ngoài.
- **Tương thích ngược v1 (`FR-30`, `AD-14`):** Không làm mất dữ liệu `card_status` của người dùng v1; khi ôn thẻ FSRS, đồng thời cập nhật gương `card_status.known = (rating >= 3)` để các thống kê cũ hoạt động trơn tru.
- **Trạng thái trống trang Tiến độ (`AGENTS.md`, `FR-40`):** Khi người dùng chưa có bất kỳ tiến độ nào ở cấp độ hiện tại, `/tien-do` bắt buộc chỉ hiển thị `"Bạn chưa có tiến độ nào ở cấp độ này"`, **tuyệt đối không** vẽ heatmap rỗng, không hiện `"0 ngày liên tiếp"` hay số `0%`.
- **Giới hạn dữ liệu & Bảo mật (`SEC-E8-01..03`):** `item_id` `1..128` ký tự không chứa `\0`; `stability ∈ [0, 100000]`, `difficulty ∈ [0, 10]`, `reps/lapses ∈ [0, 100000]`, `rating ∈ {1, 2, 3, 4}`, `duration_ms ∈ [0, 3600000]`; batch sync `<= 100` bản ghi/request; thông báo màn hình khóa không chứa email, tên đăng nhập hay ghi chú cá nhân.
- **Thẩm mỹ & Trợ năng (`DESIGN.md`):** Washi & Sumi (hỗ trợ cả Light & Dark Sumi đêm từ Epic 7), phím tắt `1–4` trên Desktop, vùng chạm `>= 44px` trên màn 360px, heatmap dùng thang chàm ai-zome, giữ nguyên bộ đếm `n / total` trên `/tu-vung`.

## Review Focus

1. **Đồng hồ thiết bị lệch múi giờ hoặc thay đổi DST khi tính Streak & Heatmap:** Người dùng ở UTC+7 học lúc 23:55 hôm nay và 00:05 ngày mai; phải tính là **2 ngày liên tiếp** theo múi giờ cục bộ, không gộp nhầm sang cùng 1 ngày UTC. *Pin ở Task 5 (`activity.test.ts`).*
2. **Chuyển tiếp mềm `card_status` chạy lặp nhiều lần hoặc song song hai thiết bị:** Người dùng v1 đăng nhập thiết bị mới kéo `card_status` về trước khi kéo `srs_cards`; hàm chuyển tiếp mềm phải idempotent (không ghi đè thẻ `srs_cards` đã có lịch ôn thật và không sinh vòng lặp outbox vô hạn). *Pin ở Task 3 (`srs.test.ts`).*
3. **Đánh giá FSRS với giá trị biên (`elapsedDays < 0` do đồng hồ máy lùi lại, hoặc `stability`/`difficulty` cực trị):** Thiết bị đổi giờ lùi về quá khứ trước `lastReviewAt` rồi bấm `Tốt`; `scheduleCard` phải kẹp `elapsedDays >= 0`, kết quả `stability`, `difficulty`, `dueAt` luôn hữu hạn nằm đúng khoảng CHECK của Postgres (`SEC-E8-01`). *Pin ở Task 1 (`fsrs.test.ts`).*
4. **Adaptive Furigana trên từ ghép nhiều chữ Kanji khi chỉ mới vững 1 chữ:** Từ ghép `{図書館|としょかん}` có 3 chữ `図`, `書`, `館`; người học mới vững `書` nhưng chưa vững `館`, nên Adaptive Furigana **phải giữ nguyên `<rt>としょかん</rt>`** và chỉ ẩn khi toàn bộ chữ Kanji trong `base` (hoặc chính từ ghép/từ vựng đó) đã đạt ngưỡng thành thạo. *Pin ở Task 6 (`adaptiveRuby.test.ts`).*
5. **Từ chối quyền thông báo trên Android 13+ / Windows:** Người dùng bấm "Từ chối" hộp thoại quyền thông báo của hệ điều hành khi bật nhắc học; ứng dụng không được crash hay hiện vòng lặp xin quyền liên tục, mà đưa công tắc về tắt kèm thông báo tiếng Việt hướng dẫn mở lại trong Cài đặt thiết bị. *Pin ở Task 7 (`localNotifications.test.ts`).*

## File Structure Map

- **FSRS-5 Pure Core (Task 1):** `frontend/src/core/srs/{types.ts,fsrs.ts,migration.ts,validate.ts}` + unit tests.
- **Supabase FSRS Migration & Sync Adapter (Task 2):** `backend/supabase/migrations/20261127000200_srs_fsrs.sql`, `backend/supabase/tests/srs.test.sql`, `frontend/src/core/progress/index.ts`, `frontend/src/adapters/supabase-sync/index.ts`.
- **Dexie v4 `srsStore`, Soft Migration & `purgeOwner` (Task 3):** `frontend/src/adapters/local-store/{db.ts,srs.ts,progress.ts}`, `frontend/src/hooks/useSrs.ts`, `frontend/src/adapters/auth/AccountProgress.tsx`.
- **FSRS 4-Level UI & Home Due Counter (Task 4):** `frontend/src/components/vocabulary/FsrsRatingBar.tsx`, `frontend/src/pages/{VocabularyPage.tsx,HomePage.tsx}`, `frontend/src/components/home/ProgressPanel.tsx`.
- **Streak, Daily Goals & 12-Week Heatmap (Task 5):** `frontend/src/core/progress/activity.ts`, `frontend/src/components/progress/{StudyHeatmap.tsx,DailyGoalCard.tsx}`, `frontend/src/pages/{ProgressPage.tsx,AccountPage.tsx}`.
- **Adaptive Furigana (Task 6):** `frontend/src/core/exam/adaptiveRuby.ts`, `frontend/src/components/exam/RubyText.tsx`, `frontend/src/hooks/{useFuriganaPreference.ts,useMasteredKanji.ts}`, `frontend/src/pages/{ReadingDetailPage.tsx,GrammarDetailPage.tsx,AccountPage.tsx}`.
- **Local Notifications via Tauri 2 (Task 7):** `frontend/src/core/notifications/reminder.ts`, `frontend/src/adapters/native/localNotifications.ts`, `desktop/src-tauri/{Cargo.toml,src/main.rs,capabilities/default.json}`, `mobile/src-tauri/{Cargo.toml,src/lib.rs,capabilities/default.json}`, `frontend/src/pages/AccountPage.tsx`, `frontend/src/App.tsx`.

---

### Task 1: Động cơ FSRS-5 Thuần TypeScript trong `frontend/src/core/srs/` (FR-30, AD-14)

**Files:**
- Create: `frontend/src/core/srs/types.ts`
- Create: `frontend/src/core/srs/fsrs.ts`
- Create: `frontend/src/core/srs/migration.ts`
- Create: `frontend/src/core/srs/validate.ts`
- Test: `frontend/src/core/srs/fsrs.test.ts`
- Test: `frontend/src/core/srs/migration.test.ts`
- Test: `frontend/src/core/srs/validate.test.ts`

**Interfaces:**
- Consumes: `Level`, `LEVELS` (`frontend/src/core/content/types.ts`), `timestampKey` (`frontend/src/core/progress/index.ts`).
- Produces:
  - `SrsCardType = "vocab" | "kanji" | "compound" | "cloze"`, `SrsState = 0 | 1 | 2 | 3`, `SrsRating = 1 | 2 | 3 | 4`
  - `SrsCardRecord`: `{ owner: string; level: Level; cardType: SrsCardType; itemId: string; state: SrsState; stability: number; difficulty: number; reps: number; lapses: number; dueAt: string; lastReviewAt: string | null; updatedAt: string }`
  - `SrsReviewRecord`: `{ id: string; owner: string; level: Level; cardType: SrsCardType; itemId: string; rating: SrsRating; stateBefore: SrsState; stateAfter: SrsState; stabilityAfter: number; difficultyAfter: number; durationMs: number; reviewedAt: string }`
  - `createEmptyCard(owner: string, level: Level, cardType: SrsCardType, itemId: string, nowIso?: string): SrsCardRecord`
  - `scheduleCard(card: SrsCardRecord, rating: SrsRating, nowIso: string): { card: SrsCardRecord; intervalDays: number }`
  - `previewIntervals(card: SrsCardRecord, nowIso: string): Record<SrsRating, { intervalDays: number; labelVi: string }>`
  - `seedCardFromLegacyStatus(row: { owner: string; level: Level; id: string; known: boolean; updatedAt: string }): SrsCardRecord`
  - `validateSrsCard(card: SrsCardRecord): void` and `validateSrsReview(review: SrsReviewRecord): void`

**Security & QA Gate:** Thuần TS 0 phụ thuộc ngoài; mọi giá trị đầu ra kẹp trong đúng biên CHECK Postgres (`SEC-E8-01`: `stability ∈ [0, 100000]`, `difficulty ∈ [0, 10]`, `reps/lapses ∈ [0, 100000]`, `durationMs ∈ [0, 3600000]`, không `NaN`/`Infinity`).

- [ ] **Step 1: Write failing unit tests cho FSRS-5, đồng hồ lùi, soft migration và validator**

```ts
// frontend/src/core/srs/fsrs.test.ts
it("schedules increasing intervals across ratings 1..4 for a new card and formats Vietnamese labels", () => {
  const now = "2026-11-27T08:00:00.000Z";
  const card = createEmptyCard("u1", "n4", "vocab", "vocab-001", now);
  const preview = previewIntervals(card, now);
  expect(preview[1].intervalDays).toBeLessThan(preview[2].intervalDays);
  expect(preview[2].intervalDays).toBeLessThanOrEqual(preview[3].intervalDays);
  expect(preview[3].intervalDays).toBeLessThanOrEqual(preview[4].intervalDays);
  expect(preview[1].labelVi).toMatch(/phút|giờ|ngày/);
});

it("handles negative elapsed time from backward clock skew without NaN or out-of-bounds values (Review Focus #3)", () => {
  const card = {
    ...createEmptyCard("u1", "n4", "vocab", "vocab-001", "2026-11-27T10:00:00.000Z"),
    state: 2 as const, stability: 12, difficulty: 5, reps: 3, lapses: 0,
    lastReviewAt: "2026-11-27T10:00:00.000Z", dueAt: "2026-12-09T10:00:00.000Z",
  };
  const { card: next } = scheduleCard(card, 3, "2026-11-27T09:00:00.000Z"); // 1h earlier
  expect(Number.isFinite(next.stability)).toBe(true);
  expect(next.stability).toBeGreaterThanOrEqual(0);
  expect(next.stability).toBeLessThanOrEqual(100_000);
  expect(next.difficulty).toBeGreaterThanOrEqual(0);
  expect(next.difficulty).toBeLessThanOrEqual(10);
  expect(() => validateSrsCard(next)).not.toThrow();
});

// frontend/src/core/srs/migration.test.ts
it("seeds legacy known=true card into Review state due +7 days and known=false into Learning due immediately", () => {
  const known = seedCardFromLegacyStatus({ owner: "u1", level: "n4", id: "vocab-1", known: true, updatedAt: "2026-11-20T00:00:00.000Z" });
  expect(known.state).toBe(2);
  expect(known.stability).toBe(7);
  expect(known.dueAt).toBe("2026-11-27T00:00:00.000Z");

  const unknown = seedCardFromLegacyStatus({ owner: "u1", level: "n4", id: "vocab-2", known: false, updatedAt: "2026-11-20T00:00:00.000Z" });
  expect(unknown.state).toBe(1);
  expect(unknown.dueAt).toBe("2026-11-20T00:00:00.000Z");
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/srs/`
  Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Implement `types.ts`, `fsrs.ts`, `migration.ts`, `validate.ts`**

  1. `types.ts`: định nghĩa hằng `SRS_CARD_TYPES = ["vocab", "kanji", "compound", "cloze"] as const`, `SrsState`, `SrsRating`, `SrsCardRecord`, `SrsReviewRecord`.
  2. `fsrs.ts`: cài đặt công thức FSRS-5 tiêu chuẩn (19 trọng số mặc định `FSRS5_DEFAULT_WEIGHTS`, `REQUEST_RETENTION = 0.9`, `MAX_INTERVAL_DAYS = 36500`, `DECAY = -0.5`, `FACTOR = 19 / 81`), kẹp `elapsedDays = Math.max(0, ...)`, kẹp `difficulty ∈ [1, 10]`, `stability ∈ [0.1, 100000]`, bước ngắn học lại `10 phút` cho `Again` (`rating = 1`), và định dạng nhãn tiếng Việt (`"10 phút"`, `"1 ngày"`, `"4 ngày"`, `"2 tháng"`).
  3. `migration.ts`: triển khai `seedCardFromLegacyStatus` ánh xạ mềm không mất tiến độ v1.
  4. `validate.ts`: triển khai `validateSrsCard` và `validateSrsReview` đối chiếu chính xác toàn bộ ràng buộc `SEC-E8-01` (bao gồm kiểm `itemId` không chứa `\0`, UUID v4 cho `SrsReviewRecord.id`, timestamp hữu hạn).

- [ ] **Step 4: Run unit tests, typecheck & biome check**

  Run: `pnpm --filter @luyen/frontend test -- src/core/srs/ && pnpm typecheck && pnpm check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/srs/
  git commit -m "feat(srs): implement pure TypeScript FSRS-5 scheduler, validators and v1 legacy migration"
  ```

---

### Task 2: Supabase Migration `srs_cards` & `srs_reviews` + Mở rộng Đồng bộ (FR-30, AD-14, `SEC-E8-01`, `SEC-T07`)

**Files:**
- Create: `backend/supabase/migrations/20261127000200_srs_fsrs.sql`
- Create: `backend/supabase/tests/srs.test.sql`
- Modify: `frontend/src/core/progress/index.ts:26-109`
- Modify: `frontend/src/adapters/supabase-sync/index.ts:14-181`
- Test: `backend/supabase/tests/srs.test.sql`
- Test: `frontend/src/adapters/supabase-sync/index.test.ts`

**Interfaces:**
- Consumes: `SrsCardRecord`, `SrsReviewRecord`, `validateSrsCard`, `validateSrsReview` (Task 1), `jlpt_private.has_confirmed_email()`, `jlpt_private.progress_cursors`.
- Produces:
  - Postgres tables `public.srs_cards` (LWW theo `client_updated_at`, PK `(user_id, level, card_type, item_id)`) và `public.srs_reviews` (append-only UUID v4 PK `id`).
  - Extended `PROGRESS_KINDS` chứa `"srs_cards"` và `"srs_reviews"`.
  - Updated `createSupabaseProgressRemote` hỗ trợ `push`/`pull` hai bảng mới trong giới hạn batch `<= 100`.

**Security & QA Gate:** `SEC-E8-01`, `SEC-T07` (pgTAP chứng minh: chặn user chưa xác nhận email, chặn đọc/ghi chéo user, chặn ghi `server_updated_at`, chặn `stability = -1` / `NaN` / `Infinity`, chặn `rating = 5`, chặn `UPDATE`/`DELETE` trên `srs_reviews`, khóa bất biến `(user_id, level, card_type, item_id)`).

- [ ] **Step 1: Write failing pgTAP tests `backend/supabase/tests/srs.test.sql` và Vitest sync tests**

```sql
-- backend/supabase/tests/srs.test.sql (trích các ca bắt buộc SEC-T07)
select throws_ok($$insert into srs_cards (user_id, level, card_type, item_id, state, stability, difficulty, reps, lapses, due_at, client_updated_at)
  values (auth.uid(), 'n4', 'vocab', 'vocab-1', 2, -1, 5, 1, 0, now(), now())$$, '23514', null, 'rejects negative stability');
select throws_ok($$insert into srs_cards (user_id, level, card_type, item_id, state, stability, difficulty, reps, lapses, due_at, client_updated_at)
  values (auth.uid(), 'n4', 'vocab', 'vocab-1', 2, 'NaN'::double precision, 5, 1, 0, now(), now())$$, '23514', null, 'rejects NaN stability');
select throws_ok($$insert into srs_reviews (id, user_id, level, card_type, item_id, rating, state_before, state_after, stability_after, difficulty_after, duration_ms, client_updated_at)
  values ('30000000-0000-4000-8000-000000000001', auth.uid(), 'n4', 'vocab', 'vocab-1', 5, 0, 1, 1, 5, 1200, now())$$, '23514', null, 'rejects rating 5');
select throws_ok($$update srs_reviews set rating = 4$$, '42501', null, 'srs_reviews is append-only (no UPDATE)');
select throws_ok($$delete from srs_reviews$$, '42501', null, 'srs_reviews is append-only (no DELETE)');
```

  Trong `frontend/src/adapters/supabase-sync/index.test.ts`: thêm test kiểm `push` cho `srs_cards` dùng `onConflict: "user_id,level,card_type,item_id"` (`ignoreDuplicates: false`) và `srs_reviews` dùng `onConflict: "id"` (`ignoreDuplicates: true`), đồng thời kiểm `pull` ánh xạ đủ trường và xác thực qua `validateProgressRow`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/supabase-sync/`
  Expected: FAIL (`"srs_cards"` và `"srs_reviews"` chưa nằm trong `PROGRESS_KINDS`).

- [ ] **Step 3: Implement migration `20261127000200_srs_fsrs.sql` và mở rộng `core/progress` + `supabase-sync`**

  1. Tạo `backend/supabase/migrations/20261127000200_srs_fsrs.sql`:
     - `public.srs_cards`: PK `(user_id, level, card_type, item_id)`, CHECK `card_type IN ('vocab', 'kanji', 'compound', 'cloze')`, `char_length(item_id) BETWEEN 1 AND 128 AND position(E'\x00' in item_id) = 0`, `state IN (0, 1, 2, 3)`, `stability = stability AND stability BETWEEN 0 AND 100000`, `difficulty = difficulty AND difficulty BETWEEN 0 AND 10`, `reps BETWEEN 0 AND 100000`, `lapses BETWEEN 0 AND 100000`, `due_at` và `client_updated_at` trong `0001..9999`, `last_review_at` null hoặc trong `0001..9999`. Gắn statement-level trigger `progress_lock before insert or update on public.srs_cards for each statement execute function jlpt_private.lock_progress_writer()` và row-level trigger `jlpt_private.apply_srs_card_write()` khóa bất biến `(user_id, level, card_type, item_id)`, LWW theo `client_updated_at`, và cấp `server_updated_at` đơn điệu qua `jlpt_private.progress_cursors`.
     - `public.srs_reviews`: PK `id uuid` (UUID v4 CHECK), cột `user_id`, `level`, `card_type`, `item_id`, `rating IN (1, 2, 3, 4)`, `state_before/state_after IN (0, 1, 2, 3)`, `stability_after BETWEEN 0 AND 100000`, `difficulty_after BETWEEN 0 AND 10`, `duration_ms BETWEEN 0 AND 3600000`, `client_updated_at` (`reviewed_at`), `server_updated_at`. Gắn statement-level trigger `progress_lock before insert on public.srs_reviews for each statement execute function jlpt_private.lock_progress_writer()` và row-level trigger `BEFORE INSERT` cấp `server_updated_at` đơn điệu; không có policy/grant `UPDATE` hoặc `DELETE`.
     - Bật RLS (`user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`), `REVOKE ALL`, chỉ `GRANT` trên cột dữ liệu (cấm ghi `server_updated_at`), tạo `unique index (user_id, server_updated_at)` cho cả 2 bảng.
  2. Cập nhật `frontend/src/core/progress/index.ts`: thêm biến thể `"srs_cards"` (với `id = "${cardType}:${itemId}"` làm khóa cursor ổn định) và `"srs_reviews"` vào `ProgressRow` & `PROGRESS_KINDS`; `isState` trả `true` cho `"srs_cards"`; nối `validateSrsCard`/`validateSrsReview` vào `validateProgressRow`.
  3. Cập nhật `frontend/src/adapters/supabase-sync/index.ts`: thêm cột wire, `toWire`, `fromWire`; cấu hình bảng ánh xạ theo từng `kind` với `srs_cards` dùng `cursorIdColumn: "item_id"` trong `pull()` (vì `public.srs_cards` không có cột `id`), `onConflict: "user_id,level,card_type,item_id"` và `ignoreDuplicates: false` trong `push()`; `srs_reviews` dùng `cursorIdColumn: "id"`, `onConflict: "id"` và `ignoreDuplicates: true`.

- [ ] **Step 4: Run Vitest & Supabase pgTAP tests**

  Run: `pnpm --filter @luyen/frontend test -- src/core/progress/ src/adapters/supabase-sync/ && supabase test db --workdir backend`
  Expected: PASS 100% unit tests và pgTAP (`progress.test.sql`, `exam_attempts.test.sql`, `srs.test.sql`).

- [ ] **Step 5: Commit**

  ```bash
  git add backend/supabase/migrations/20261127000200_srs_fsrs.sql backend/supabase/tests/srs.test.sql frontend/src/core/progress/index.ts frontend/src/adapters/supabase-sync/
  git commit -m "feat(srs): add Supabase srs_cards and srs_reviews migrations with RLS and sync remote support"
  ```

---

### Task 3: Dexie v4 `srsStore`, Chuyển tiếp mềm `card_status` & `purgeOwner` đầy đủ (FR-30, `SEC-E8-02`, `SEC-T04`)

**Files:**
- Create: `frontend/src/adapters/local-store/srs.ts`
- Create: `frontend/src/adapters/local-store/srs.test.ts`
- Create: `frontend/src/hooks/useSrs.ts`
- Modify: `frontend/src/adapters/local-store/db.ts:1-43`
- Modify: `frontend/src/adapters/local-store/progress.ts:161-281`
- Modify: `frontend/src/adapters/auth/AccountProgress.tsx:99-126`
- Test: `frontend/src/adapters/local-store/srs.test.ts`, `frontend/src/adapters/local-store/progress.test.ts`

**Interfaces:**
- Consumes: `SrsCardRecord`, `SrsReviewRecord`, `scheduleCard`, `seedCardFromLegacyStatus` (Task 1), `db.srsCards`, `db.srsReviews` (Dexie v4 từ Epic 7 Task 3).
- Produces:
  - `srsStore.reviewCard(scope: ProgressScope, input: { cardType: SrsCardType; itemId: string; rating: SrsRating; durationMs: number; nowIso?: string }): Promise<{ card: SrsCardRecord; review: SrsReviewRecord }>`
  - `srsStore.ensureSoftMigrated(scope: ProgressScope): Promise<number>` (idempotent, never overwrites existing `srsCards` row)
  - `srsStore.listCards(scope: ProgressScope, cardType?: SrsCardType): Promise<SrsCardRecord[]>`
  - `srsStore.listDueCards(scope: ProgressScope, nowIso: string, cardType?: SrsCardType): Promise<SrsCardRecord[]>`
  - `srsStore.listReviews(scope: ProgressScope, sinceIso?: string): Promise<SrsReviewRecord[]>`
  - Hooks: `useSrsCards(cardType?)`, `useDueSrsCards(cardType?)`, `useDueSrsCount()`, `useReviewSrsCard()`, `useSrsReviews(sinceIso?)` in `frontend/src/hooks/useSrs.ts`.

**Security & QA Gate:** `SEC-E8-02`, `SEC-T04`: `progressStore.purgeOwner(owner)` xóa sạch `srsCards` và `srsReviews` của `owner` trong cùng transaction Dexie v4, bảo toàn 100% `ownerB`.

- [ ] **Step 1: Write failing tests cho `srsStore`, soft migration idempotency và `purgeOwner`**

```ts
// frontend/src/adapters/local-store/srs.test.ts
it("migrates legacy card_status rows once without overwriting existing FSRS progress (Review Focus #2)", async () => {
  await progressStore.setCardStatus({ owner: "u1", level: "n4" }, "vocab-1", true);
  await srsStore.reviewCard({ owner: "u1", level: "n4" }, { cardType: "vocab", itemId: "vocab-1", rating: 4, durationMs: 1500 });
  const before = (await srsStore.listCards({ owner: "u1", level: "n4" }, "vocab"))[0];
  const migratedCount = await srsStore.ensureSoftMigrated({ owner: "u1", level: "n4" });
  const after = (await srsStore.listCards({ owner: "u1", level: "n4" }, "vocab"))[0];
  expect(migratedCount).toBe(0);
  expect(after.reps).toBe(before.reps);
  expect(after.stability).toBe(before.stability);
});

it("mirrors rating >= 3 to card_status, queues both srs_cards and srs_reviews to outbox, and purges cleanly in purgeOwner (SEC-T04)", async () => {
  await srsStore.reviewCard({ owner: "u1", level: "n4" }, { cardType: "vocab", itemId: "vocab-9", rating: 3, durationMs: 2000 });
  const summary = await progressStore.getSummary({ owner: "u1", level: "n4" });
  expect(summary.flashcards.find((f) => f.cardId === "vocab-9")?.known).toBe(true);
  await progressStore.purgeOwner("u1");
  expect(await srsStore.listCards({ owner: "u1", level: "n4" })).toHaveLength(0);
  expect(await srsStore.listReviews({ owner: "u1", level: "n4" })).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/srs.test.ts`
  Expected: FAIL (`srs.ts` chưa tồn tại).

- [ ] **Step 3: Implement `srs.ts`, `useSrs.ts` và nối `progress.ts` + `AccountProgress.tsx`**

  1. Cập nhật kiểu TypeScript cho `db.srsCards: Table<SrsCardRecord, [string, Level, SrsCardType, string]>` và `db.srsReviews: Table<SrsReviewRecord, string>` trong `frontend/src/adapters/local-store/db.ts`.
  2. Tạo `frontend/src/adapters/local-store/srs.ts`:
     - `reviewCard`: kiểm `isOwnerRetired`, đọc thẻ hiện tại (hoặc `createEmptyCard`), chạy `scheduleCard`, ghi `db.srsCards` + `db.srsReviews` + gương `card_status` (`known = rating >= 3` khi `cardType === "vocab"`) + thêm mục vào `db.progressOutbox` (khi `owner !== GUEST_OWNER`) trong **1 transaction Dexie**.
     - `ensureSoftMigrated`: trong transaction rw, quét `db.progress` có `kind === "card_status"` ở `(owner, level)`, chỉ chèn `seedCardFromLegacyStatus` cho những `itemId` chưa tồn tại trong `db.srsCards` (không đẩy outbox thừa nếu chưa có tương tác mới, hoặc đánh dấu cờ `srsMigrated:${owner}:${level}` để tránh quét lại).
     - `listDueCards`: truy vấn index `[owner+level+dueAt]` với `dueAt <= nowIso`, sắp theo `dueAt` tăng dần.
  3. Cập nhật `frontend/src/adapters/local-store/progress.ts`:
     - `applyPulledPage`: xử lý `kind === "srs_cards"` (LWW vào `db.srsCards`) và `kind === "srs_reviews"` (append-only vào `db.srsReviews`).
     - `hasGuestProgress` và `mergeGuest`: bao gồm `db.srsCards` & `db.srsReviews`.
     - Xác nhận `purgeOwner` xóa `db.srsCards`, `db.srsReviews` và xóa cờ `srsMigrated:${owner}:*`.
  4. Tạo `frontend/src/hooks/useSrs.ts` và cập nhật `AccountProgress.tsx` `onChange` để invalidate `["srs", owner]` & `["activity", owner]`.

- [ ] **Step 4: Run unit tests, typecheck & biome check**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/ && pnpm typecheck && pnpm check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/adapters/local-store/ frontend/src/hooks/useSrs.ts frontend/src/adapters/auth/AccountProgress.tsx
  git commit -m "feat(srs): add Dexie v4 srsStore, idempotent legacy card_status migration and purgeOwner coverage"
  ```

---

### Task 4: Giao diện Ôn tập FSRS 4 mức trên `/tu-vung` & Bộ đếm Đến hạn trên Trang chủ (FR-30)

**Files:**
- Create: `frontend/src/components/vocabulary/FsrsRatingBar.tsx`
- Modify: `frontend/src/pages/VocabularyPage.tsx:51-469`
- Modify: `frontend/src/pages/HomePage.tsx:54-182`
- Modify: `frontend/src/components/home/ProgressPanel.tsx:17-129`
- Modify: `tests/web/routes.spec.ts:55-70`
- Modify: `tests/web/guest-progress.spec.ts:1-20`
- Modify: `tests/web/accounts.local.spec.ts:70-90`
- Modify: `tests/desktop/smoke.mjs:265-285`
- Test: `tests/web/fsrs-review.spec.ts`

**Interfaces:**
- Consumes: `previewIntervals` (Task 1), `useDueSrsCards`, `useDueSrsCount`, `useReviewSrsCard`, `useSrsCards` (Task 3).
- Produces:
  - `<FsrsRatingBar previews={...} disabled={...} onRate={(rating: SrsRating) => void} />` với 4 nút `Quên · 1`, `Khó · 2`, `Tốt · 3`, `Dễ · 4` (`min-h-11`, hiển thị gợi ý khoảng thời gian ôn tiếp).
  - `/tu-vung` hỗ trợ 2 chế độ: `"Ôn đến hạn (FSRS)"` (`?mode=due`) và `"Duyệt theo bài"` (giữ nguyên lọc Bài/Mục, tìm kiếm và bộ đếm `n / total`).
  - Trang chủ hiển thị số thẻ cần ôn hôm nay trên `ProgressPanel` (có nút `"Ôn ngay N thẻ"` khi `dueCount > 0`).

**Security & QA Gate:** Không thêm `.hanko` thứ hai trên `HomePage`/`VocabularyPage`; phím tắt `1–4` chỉ kích hoạt khi thẻ đã lật và không focus trong ô nhập liệu; vùng chạm `>= 44px` trên 360px (4 nút xếp lưới `grid-cols-2 sm:grid-cols-4`).

- [ ] **Step 1: Write failing Playwright E2E test `tests/web/fsrs-review.spec.ts`**

```ts
// tests/web/fsrs-review.spec.ts
test("flips flashcard, displays 4 FSRS buttons with interval hints, supports keyboard 1-4 and updates due count offline", async ({ page }) => {
  await page.goto("/tu-vung");
  await page.locator('[data-ocid="flashcard.card"]').click();
  await expect(page.locator('[data-ocid="vocabulary.fsrs.rate_1"]')).toContainText("Quên");
  await expect(page.locator('[data-ocid="vocabulary.fsrs.rate_3"]')).toContainText("Tốt");
  await page.keyboard.press("3"); // Đánh giá "Tốt"
  // Xác nhận thẻ chuyển tiếp và trạng thái lưu thành công vào Dexie (vẫn tồn tại sau reload)
  await page.reload();
  await page.goto("/");
  await expect(page.locator('[data-ocid="home.progress.panel"]')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

  Run: `pnpm build && pnpm e2e:web -- tests/web/fsrs-review.spec.ts`
  Expected: FAIL (`vocabulary.fsrs.rate_1` chưa tồn tại).

- [ ] **Step 3: Implement `FsrsRatingBar.tsx`, cập nhật `VocabularyPage.tsx`, `HomePage.tsx`, `ProgressPanel.tsx`**

  1. Tạo `frontend/src/components/vocabulary/FsrsRatingBar.tsx`: 4 nút ngang gọn (`grid-cols-2 sm:grid-cols-4 gap-2`), mỗi nút `min-h-12` hiển thị nhãn (`Quên` / `Khó` / `Tốt` / `Dễ`), phím tắt `1`–`4` (ẩn trên mobile), và khoảng thời gian dự kiến từ `previewIntervals(card, nowIso)`.
  2. Cập nhật `frontend/src/pages/VocabularyPage.tsx`:
     - Chạy `ensureSoftMigrated` một lần khi vào trang.
     - Thêm bộ chuyển chế độ nhỏ phía trên bộ lọc: `Duyệt theo bài` (mặc định, giữ toàn bộ trải nghiệm tìm kiếm/lọc Bài/Mục và bộ đếm `n / total`) và `Ôn đến hạn (N)` (hàng đợi FSRS `dueAt <= now`).
     - Khi mặt sau thẻ đang lật (`flipped === true`), thay 2 nút nhị phân cũ bằng `<FsrsRatingBar />` (khi mặt trước chưa lật vẫn hiện gợi ý `"Nhấn thẻ hoặc Space để lật rồi đánh giá mức nhớ"`), ghi nhận `durationMs` kể từ lúc hiện thẻ (`Date.now() - cardShownAtRef.current`, kẹp `<= 3_600_000`), và gắn phím tắt `1`–`4` trong `useEffect` (bỏ qua khi `isInteractiveTarget(event.target)` hoặc `!flipped`).
  3. Cập nhật `frontend/src/components/home/ProgressPanel.tsx` & `HomePage.tsx`: nhận `dueCount?: number`; hiển thị 1 dòng gọn `"Thẻ FSRS đến hạn hôm nay: N thẻ"` kèm link `/tu-vung?mode=due` khi `dueCount > 0`.
  4. Cập nhật 4 bộ kiểm thử hiện có đang bấm trực tiếp `[data-ocid="vocabulary.mark_known_button"]` khi chưa lật thẻ (`tests/web/routes.spec.ts:63`, `tests/web/guest-progress.spec.ts:7`, `tests/web/accounts.local.spec.ts:79`, `tests/desktop/smoke.mjs:276`): đổi sang lật `[data-ocid="flashcard.card"]` rồi bấm `[data-ocid="vocabulary.fsrs.rate_3"]` (`"Tốt"`), đồng thời giữ nguyên assertion kiểm `[data-ocid="flashcard.status_badge"]` hiển thị `"Đã thuộc"` (do `reviewCard` gương `rating >= 3` sang `card_status.known = true`).

- [ ] **Step 4: Run unit tests, typecheck, biome check & Playwright E2E**

  Run: `pnpm typecheck && pnpm check && pnpm test && pnpm build && pnpm e2e:web -- tests/web/fsrs-review.spec.ts tests/web/routes.spec.ts tests/web/guest-progress.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/vocabulary/FsrsRatingBar.tsx frontend/src/pages/VocabularyPage.tsx frontend/src/pages/HomePage.tsx frontend/src/components/home/ProgressPanel.tsx tests/web/fsrs-review.spec.ts tests/web/routes.spec.ts tests/web/guest-progress.spec.ts tests/web/accounts.local.spec.ts tests/desktop/smoke.mjs
  git commit -m "feat(vocab): integrate FSRS 4-level rating bar, due queue, home due counter and update E2E selectors"
  ```

---

### Task 5: Chuỗi ngày học (Streak), Mục tiêu ngày & Lịch nhiệt 12 tuần trên `/tien-do` (FR-40, AD-14)

**Files:**
- Create: `frontend/src/core/progress/activity.ts`
- Create: `frontend/src/core/progress/activity.test.ts`
- Create: `frontend/src/components/progress/StudyHeatmap.tsx`
- Create: `frontend/src/components/progress/DailyGoalCard.tsx`
- Modify: `frontend/src/pages/ProgressPage.tsx:137-295`
- Modify: `frontend/src/pages/AccountPage.tsx` (cài đặt mục tiêu ngày: mặc định `20` lượt ôn/ngày)
- Test: `frontend/src/core/progress/activity.test.ts`
- Test: `tests/web/progress-streak-heatmap.spec.ts`

**Interfaces:**
- Consumes: `SrsReviewRecord` (Task 3), `KanjiQuizResult`, `ReadingResult` (`core/progress/types.ts`), `ExamAttemptRecord` (Epic 7), `db.settings` (`dailyGoal:${owner}`).
- Produces:
  - `ActivityEvent = { occurredAtIso: string; weight: number }`
  - `HeatmapCell = { dateKey: string; count: number; level: 0 | 1 | 2 | 3 | 4 }`
  - `StudyActivitySummary = { currentStreak: number; longestStreak: number; todayCount: number; dailyGoal: number; totalEvents: number; heatmap: HeatmapCell[] }` (luôn 84 ô = 12 tuần)
  - `toLocalDateKey(iso: string, tzOffsetMinutes?: number): string` và `computeStudyActivity(events: readonly ActivityEvent[], now: Date, dailyGoal: number, tzOffsetMinutes?: number): StudyActivitySummary` in `frontend/src/core/progress/activity.ts`.

**Security & QA Gate:** **Bắt buộc giữ trạng thái trống (`AGENTS.md`, `FR-40`):** khi `isEmpty === true` (bao gồm `srsReviews.length === 0`), `/tien-do` chỉ hiện `"Bạn chưa có tiến độ nào ở cấp độ này"`, tuyệt đối không hiện `StudyHeatmap`, không hiện `DailyGoalCard`, không hiện `0%` hay `0 ngày`.

- [ ] **Step 1: Write failing unit tests cho `computeStudyActivity` và Playwright kiểm empty-state vs populated heatmap**

```ts
// frontend/src/core/progress/activity.test.ts
it("computes consecutive days across midnight in local timezone UTC+7 (Review Focus #1)", () => {
  // 2026-11-26 23:55 UTC+7 = 2026-11-26T16:55:00Z
  // 2026-11-27 00:05 UTC+7 = 2026-11-26T17:05:00Z (same UTC day, different local day!)
  const summary = computeStudyActivity(
    [
      { occurredAtIso: "2026-11-26T16:55:00.000Z", weight: 1 },
      { occurredAtIso: "2026-11-26T17:05:00.000Z", weight: 1 },
    ],
    new Date("2026-11-27T02:00:00.000Z"),
    20,
    -420, // JS getTimezoneOffset() for UTC+7 is -420
  );
  expect(summary.currentStreak).toBe(2);
  expect(summary.todayCount).toBe(1);
  expect(summary.heatmap).toHaveLength(84);
});

it("does not break active streak if user has studied yesterday and not yet today", () => {
  const summary = computeStudyActivity(
    [{ occurredAtIso: "2026-11-26T10:00:00.000Z", weight: 5 }],
    new Date("2026-11-27T08:00:00.000Z"),
    20,
    0,
  );
  expect(summary.currentStreak).toBe(1);
  expect(summary.todayCount).toBe(0);
});
```

  Trong `tests/web/progress-streak-heatmap.spec.ts`:
  - Case 1 (người mới 0 tiến độ): mở `/tien-do` → thấy `"Bạn chưa có tiến độ nào ở cấp độ này"`, `[data-ocid="progress.heatmap"]` không tồn tại, không có chuỗi `"0%"`.
  - Case 2 (sau khi ôn 1 thẻ FSRS): mở `/tien-do` → thấy `[data-ocid="progress.daily_goal"]` và `[data-ocid="progress.heatmap"]` đủ 84 ô với `1 ngày liên tiếp`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/progress/activity.test.ts`
  Expected: FAIL (`activity.ts` chưa tồn tại).

- [ ] **Step 3: Implement `activity.ts`, `StudyHeatmap.tsx`, `DailyGoalCard.tsx` và nối vào `ProgressPage.tsx` & `AccountPage.tsx`**

  1. Tạo `frontend/src/core/progress/activity.ts`: dẫn xuất thuần từ danh sách sự kiện hoàn thành (`srsReviews`, `kanjiResults`, `readingResults`, `examAttempts` có phần đã nộp/hoàn thành), gom theo khóa ngày cục bộ `YYYY-MM-DD`, tính `currentStreak`, `longestStreak`, `todayCount`, và 84 ô gần nhất (12 tuần) với 5 mức đậm `0..4` theo tỷ lệ so với `dailyGoal`.
  2. Tạo `frontend/src/components/progress/DailyGoalCard.tsx`: hiển thị tiến độ mục tiêu ngày (`todayCount / dailyGoal lượt ôn`), chuỗi hiện tại (`currentStreak ngày liên tiếp`) và kỷ lục (`longestStreak ngày`).
  3. Tạo `frontend/src/components/progress/StudyHeatmap.tsx`: lưới 12 cột × 7 hàng (tuần × thứ) màu chàm ai-zome nhạt → đậm (tương thích Light & Dark `.dark`), mỗi ô có `title` và `aria-label` tiếng Việt (vd `"27/11/2026: 12 lượt ôn"`).
  4. Cập nhật `frontend/src/pages/ProgressPage.tsx`: nạp `useSrsReviews` (90 ngày gần nhất), thêm `srsReviews.length === 0` vào điều kiện `isEmpty` (vẫn giữ nguyên màn hình trống khi chưa có tiến độ nào), và chỉ render `<DailyGoalCard />` + `<StudyHeatmap />` khi `!isEmpty`.
  5. Cập nhật `frontend/src/pages/AccountPage.tsx`: thêm mục chọn mục tiêu ngày (`10 / 20 / 30 / 50` lượt ôn/ngày, mặc định `20`) lưu vào `db.settings`.

- [ ] **Step 4: Run unit tests, typecheck, biome check & Playwright E2E**

  Run: `pnpm --filter @luyen/frontend test -- src/core/progress/ && pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/progress-streak-heatmap.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/progress/activity.ts frontend/src/core/progress/activity.test.ts frontend/src/components/progress/StudyHeatmap.tsx frontend/src/components/progress/DailyGoalCard.tsx frontend/src/pages/ProgressPage.tsx frontend/src/pages/AccountPage.tsx tests/web/progress-streak-heatmap.spec.ts
  git commit -m "feat(progress): add derived study streak, daily goals and 12-week heatmap while preserving empty state"
  ```

---

### Task 6: Adaptive Furigana theo độ thành thạo FSRS (FR-45)

**Files:**
- Create: `frontend/src/core/exam/adaptiveRuby.ts`
- Create: `frontend/src/core/exam/adaptiveRuby.test.ts`
- Create: `frontend/src/hooks/useMasteredKanji.ts`
- Modify: `frontend/src/hooks/useFuriganaPreference.ts`
- Modify: `frontend/src/components/exam/RubyText.tsx:8-60`
- Modify: `frontend/src/pages/ReadingDetailPage.tsx`
- Modify: `frontend/src/pages/GrammarDetailPage.tsx`
- Modify: `frontend/src/pages/AccountPage.tsx`
- Test: `frontend/src/core/exam/adaptiveRuby.test.ts`
- Test: `tests/web/adaptive-furigana.spec.ts`

**Interfaces:**
- Consumes: `RubySegment` (`core/exam/ruby.ts`), `SrsCardRecord` (Task 1), `useSrsCards` (Task 3), `ContentPack` (`core/content/types.ts`).
- Produces:
  - `ADAPTIVE_STABILITY_DAYS = 21` (ngưỡng mặc định coi là đã vững: `state === 2 && stability >= 21 && lapses <= 1`)
  - `FuriganaMode = "always" | "adaptive" | "off"`
  - `extractMasteredTerms(cards: readonly SrsCardRecord[], pack: Pick<ContentPack, "vocabulary" | "kanji" | "compounds">, minStabilityDays?: number): { words: ReadonlySet<string>; kanjiChars: ReadonlySet<string> }` in `frontend/src/core/exam/adaptiveRuby.ts`
  - `shouldHideFurigana(base: string, mastered: { words: ReadonlySet<string>; kanjiChars: ReadonlySet<string> }): boolean`
  - Updated `RubyTextProps`: thêm `furiganaMode?: FuriganaMode` và `mastered?: { words: ReadonlySet<string>; kanjiChars: ReadonlySet<string> }`; từ bị ẩn `<rt>` cho phép bấm/chạm để lật xem tạm cách đọc.

**Security & QA Gate:** Thuần thuật toán cục bộ 0% AI; không bao giờ ẩn furigana của từ ghép khi còn chữ Kanji chưa vững (Review Focus #4); giữ `lang="ja"` chuẩn trợ năng.

- [ ] **Step 1: Write failing unit tests cho `extractMasteredTerms` và `shouldHideFurigana` (Review Focus #4)**

```ts
// frontend/src/core/exam/adaptiveRuby.test.ts
it("keeps furigana visible on compound when only a subset of its kanji are mastered (Review Focus #4)", () => {
  const mastered = {
    words: new Set<string>(),
    kanjiChars: new Set(["図", "書"]), // thiếu chữ "館"
  };
  expect(shouldHideFurigana("図書館", mastered)).toBe(false);
  expect(shouldHideFurigana("書", mastered)).toBe(true);
});

it("hides furigana when exact word is mastered or all kanji characters in base are mastered", () => {
  const mastered = {
    words: new Set(["図書館"]),
    kanjiChars: new Set(["食"]),
  };
  expect(shouldHideFurigana("図書館", mastered)).toBe(true);
  expect(shouldHideFurigana("食", mastered)).toBe(true);
  expect(shouldHideFurigana("飲", mastered)).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/adaptiveRuby.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `adaptiveRuby.ts`, `useMasteredKanji.ts`, nâng cấp `useFuriganaPreference.ts`, `RubyText.tsx` và UI**

  1. Tạo `frontend/src/core/exam/adaptiveRuby.ts`: trích xuất danh sách từ và chữ Kanji đã đạt `state === 2 && stability >= minStabilityDays && lapses <= 1` từ `srsCards` đối chiếu với `pack.{vocabulary,kanji,compounds}`; trong `shouldHideFurigana(base, mastered)` kiểm: nếu `mastered.words.has(base)` thì trả `true`; nếu không, trích tất cả ký tự Kanji (`[\u4e00-\u9faf\u3400-\u4dbf]`) trong `base` và chỉ trả `true` khi có ít nhất 1 Kanji và **mọi** chữ Kanji đó đều nằm trong `mastered.kanjiChars`.
  2. Nâng cấp `frontend/src/hooks/useFuriganaPreference.ts` sang 3 chế độ `FuriganaMode = "always" | "adaptive" | "off"` (tương thích ngược nếu `db.settings` cũ lưu boolean `true`/`false`).
  3. Tạo `frontend/src/hooks/useMasteredKanji.ts` memo hóa `extractMasteredTerms`.
  4. Cập nhật `frontend/src/components/exam/RubyText.tsx`: khi `furiganaMode === "off"`, chỉ render `segment.base`; khi `furiganaMode === "adaptive"` và `shouldHideFurigana(segment.base, mastered)` đúng, ẩn `<rt>` mặc định nhưng gắn nút/span có thể chạm/bấm (`aria-label="Hiện cách đọc ..."`) để hiện lại `<rt>` tạm thời nếu người học quên đột xuất.
  5. Cập nhật `ReadingDetailPage.tsx`, `GrammarDetailPage.tsx` và `AccountPage.tsx` dùng bộ chọn 3 chế độ (`Luôn hiện` / `Thông minh` / `Ẩn`).

- [ ] **Step 4: Run unit tests, typecheck, biome check & Playwright E2E**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/adaptiveRuby.test.ts && pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/adaptive-furigana.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/exam/adaptiveRuby.ts frontend/src/core/exam/adaptiveRuby.test.ts frontend/src/hooks/useMasteredKanji.ts frontend/src/hooks/useFuriganaPreference.ts frontend/src/components/exam/RubyText.tsx frontend/src/pages/ReadingDetailPage.tsx frontend/src/pages/GrammarDetailPage.tsx frontend/src/pages/AccountPage.tsx tests/web/adaptive-furigana.spec.ts
  git commit -m "feat(furigana): add FSRS-driven Adaptive Furigana mode with tap-to-peek"
  ```

---

### Task 7: Nhắc học Cục bộ với `tauri-plugin-notification` (FR-45, AD-19, `SEC-E8-03`)

**Files:**
- Create: `frontend/src/core/notifications/reminder.ts`
- Create: `frontend/src/core/notifications/reminder.test.ts`
- Create: `frontend/src/adapters/native/localNotifications.ts`
- Create: `frontend/src/adapters/native/localNotifications.test.ts`
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/src/main.rs`
- Modify: `desktop/src-tauri/capabilities/default.json`
- Modify: `mobile/src-tauri/Cargo.toml`
- Modify: `mobile/src-tauri/src/lib.rs`
- Modify: `mobile/src-tauri/capabilities/default.json`
- Modify: `frontend/package.json` (add `@tauri-apps/plugin-notification` pinned to Tauri 2 series)
- Modify: `frontend/src/pages/AccountPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/core/notifications/reminder.test.ts`
- Test: `frontend/src/adapters/native/localNotifications.test.ts`

**Interfaces:**
- Consumes: `isTauri()` (`@tauri-apps/api/core`), `useDueSrsCount()` (Task 3), `db.settings` (`reminderConfig`).
- Produces:
  - `ReminderConfig = { enabled: boolean; hour: number; minute: number }` (mặc định `{ enabled: false, hour: 20, minute: 0 }`)
  - `ReminderPayload = { id: number; title: string; body: string; at: Date }`
  - `buildReminderPayload(dueCount: number, level: Level, config: ReminderConfig, now: Date): ReminderPayload` in `frontend/src/core/notifications/reminder.ts`
  - `syncLocalStudyReminder(config: ReminderConfig, dueCount: number, level: Level): Promise<{ ok: boolean; reason?: "not-native" | "permission-denied" }>` in `frontend/src/adapters/native/localNotifications.ts`

**Security & QA Gate:** `SEC-E8-03`: nội dung thông báo màn hình khóa tuyệt đối tổng quát (không email, không username, không ghi chú/sổ tay); quyền `notification` chỉ cấp cho cửa sổ `"main"` ở cả Desktop và Mobile; không có máy chủ push hay kết nối mạng ngoài; xử lý từ chối quyền mượt mà không crash (Review Focus #5).

- [ ] **Step 1: Write failing unit tests cho `buildReminderPayload` (`SEC-E8-03`) và `syncLocalStudyReminder` (Review Focus #5)**

```ts
// frontend/src/core/notifications/reminder.test.ts
it("builds privacy-safe generic reminder text with due count and schedules next occurrence", () => {
  const now = new Date(2026, 10, 27, 21, 0, 0); // 21:00 -> đã qua 20:00 hôm nay -> hẹn ngày mai 20:00
  const payload = buildReminderPayload(15, "n4", { enabled: true, hour: 20, minute: 0 }, now);
  expect(payload.title).toBe("Đến giờ ôn JLPT N4");
  expect(payload.body).toBe("Bạn có 15 thẻ đến hạn ôn hôm nay.");
  expect(payload.at.getDate()).toBe(28);
  expect(payload.at.getHours()).toBe(20);
  // SEC-E8-03: không chứa ký tự '@' hay chuỗi PII
  expect(payload.title).not.toContain("@");
  expect(payload.body).not.toContain("@");
});

// frontend/src/adapters/native/localNotifications.test.ts
it("returns permission-denied cleanly without throwing when OS rejects notification permission (Review Focus #5)", async () => {
  // Mock isTauri() = true, isPermissionGranted() = false, requestPermission() = "denied"
  const result = await syncLocalStudyReminder({ enabled: true, hour: 20, minute: 0 }, 10, "n4");
  expect(result).toEqual({ ok: false, reason: "permission-denied" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/notifications/ src/adapters/native/localNotifications.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `reminder.ts`, `localNotifications.ts`, Tauri plugin wiring & UI trong `AccountPage.tsx`**

  1. Tạo `frontend/src/core/notifications/reminder.ts`: hàm thuần tính thời điểm hẹn tiếp theo (hôm nay nếu chưa tới `hour:minute`, ngược lại +1 ngày) và tạo nội dung thông báo hoàn toàn tổng quát (`dueCount > 0` → `"Bạn có ${dueCount} thẻ đến hạn ôn hôm nay."`, `dueCount === 0` → `"Dành 10 phút ôn tập hôm nay để giữ nhịp học."`), cố định `DAILY_REMINDER_ID = 4001` để lần hẹn sau thay thế sạch lịch cũ.
  2. Thêm `tauri-plugin-notification` (ghim phiên bản Tauri 2 tương thích) vào `desktop/src-tauri/Cargo.toml` + `main.rs`, `mobile/src-tauri/Cargo.toml` + `lib.rs`, và `@tauri-apps/plugin-notification` vào `frontend/package.json`.
  3. Cấp quyền tối thiểu chỉ cho cửa sổ `"main"` trong `desktop/src-tauri/capabilities/default.json` và `mobile/src-tauri/capabilities/default.json`: `notification:allow-is-permission-granted`, `notification:allow-request-permission`, `notification:allow-notify`, `notification:allow-schedule`, `notification:allow-cancel`, `notification:allow-get-pending`.
  4. Tạo `frontend/src/adapters/native/localNotifications.ts`: kiểm `isTauri()` (nếu trên Web trả `{ ok: false, reason: "not-native" }`), kiểm/xin quyền khi `config.enabled === true`, hủy lịch cũ (`cancel([DAILY_REMINDER_ID])`), rồi đặt lịch mới bằng `sendNotification({ ...payload, schedule: Schedule.at(payload.at, false, true) })`; khi `config.enabled === false` chỉ hủy lịch cũ.
  5. Cập nhật `frontend/src/pages/AccountPage.tsx` (thêm thẻ `"Nhắc học hằng ngày"` có công tắc bật/tắt + ô chọn giờ `<input type="time">` khi `isTauri()`, báo rõ tiếng Việt nếu người dùng từ chối quyền thông báo; trên Web hiện ghi chú nhẹ nhắc học cục bộ có trên bản app Desktop/Android) và `frontend/src/App.tsx` (đồng bộ lại lịch khi `dueCount` thay đổi).

- [ ] **Step 4: Run unit tests, typecheck, biome check & scaffold verification**

  Run: `pnpm --filter @luyen/frontend test -- src/core/notifications/ src/adapters/native/localNotifications.test.ts && pnpm typecheck && pnpm check && node mobile/scripts/validate-scaffold.mjs --config-only`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/notifications/ frontend/src/adapters/native/localNotifications.ts frontend/src/adapters/native/localNotifications.test.ts desktop/src-tauri/ mobile/src-tauri/ frontend/package.json pnpm-lock.yaml frontend/src/pages/AccountPage.tsx frontend/src/App.tsx
  git commit -m "feat(notifications): add privacy-safe on-device FSRS study reminders via tauri-plugin-notification"
  ```

---

## Epic 8 Verification Gate (Trước khi nối Epic 9 & 11)

- [ ] Chạy trọn bộ kiểm chứng cuối Epic:
  - `pnpm typecheck && pnpm check && pnpm test`
  - `supabase test db --workdir backend` (`progress.test.sql`, `exam_attempts.test.sql`, `srs.test.sql`)
  - `pnpm build && pnpm e2e:web` (`fsrs-review.spec.ts`, `progress-streak-heatmap.spec.ts`, `adaptive-furigana.spec.ts` + toàn bộ regression suite)
  - `node mobile/scripts/validate-scaffold.mjs`
- [ ] Xác nhận tay: ôn 20 thẻ FSRS khi tắt mạng → mở lại thấy lịch ôn giữ nguyên → lên mạng đồng bộ sang thiết bị thứ hai không mất lịch sử `srs_reviews`; `/tien-do` giữ đúng `"Bạn chưa có tiến độ nào ở cấp độ này"` khi chưa học; Adaptive Furigana ẩn đúng `<rt>` chữ đã vững và giữ nguyên chữ ghép chưa vững; nhắc học cục bộ trên Android/Desktop hiển thị đúng số thẻ đến hạn không lộ dữ liệu cá nhân.
