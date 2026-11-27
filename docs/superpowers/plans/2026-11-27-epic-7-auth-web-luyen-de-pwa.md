# Epic 7: Sửa Đăng nhập Web, Luyện đề Đồng bộ từng phần, Furigana N4 1.1.0, Dark Mode, PWA & In-App Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi đăng nhập bản Web (`FR-46`), hoàn thiện luồng luyện đề đồng bộ từng phần và làm lại nhiều lần (`FR-27`), chấm điểm liệt JLPT 180đ + ôn cấp tốc 10 phút (`FR-29`), bổ sung Furigana kiểm duyệt cho N4 `1.1.0` (`FR-32`), nâng cấp tìm kiếm/mini-drill/ôn chữ sai (`FR-38`), kích hoạt giao diện tối "Sumi đêm" + `MOBILE_TABS` 5 tab (`FR-39`), đóng gói Web PWA ngoại tuyến (`FR-44`) và cập nhật tại chỗ Windows/Android không cần cài đè (`FR-43`).

**Architecture:** Giữ nguyên kiến trúc `ports-and-adapters` (`AD-1..AD-12`) và mở rộng theo `AD-14` & `AD-19`. Lõi thuần TypeScript đặt tại `frontend/src/core/{exam,progress,grammar,content}/`; Dexie `luyen-jlpt` nâng từ v3 lên **v4** không mất dữ liệu (đồng thời khai báo sẵn bộ bảng v4 thống nhất cho Epic 8–11 để tránh xung đột phiên bản); bảng `public.exam_attempts` trên Supabase áp dụng RLS + `has_confirmed_email()` + trigger đơn điệu từng phần; bản Web bổ sung `frontend/public/_headers` + `vite-plugin-pwa` ngoại lệ tuyệt đối cho `*.supabase.co/*`; bản Android thay mở trình duyệt bằng tải APK nội bộ có xác minh SHA-256 + chứng chỉ ký qua `FileProvider`.

**Tech Stack:** React 19, TypeScript 7, TanStack Router `1.131`, TanStack Query `5`, Dexie `4.4.7`, Tailwind CSS `3.4` + shadcn/ui, Vite `8.3.4` + `vite-plugin-pwa`, Supabase Postgres 17 + Edge Functions (Deno) + pgTAP, Tauri `2.12.7` (Desktop NSIS updater + `tauri-plugin-process`, Android `tauri-plugin-http` + Kotlin `FileProvider`), Vitest `5.1.1`, Playwright `1.65.1`, Cloudflare Workers Static Assets (`wrangler.toml`).

**Spec:**
- `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (§3, §5.3, §6.2 FR-27/29/32/38/39/43/44/46, §6.3 AD-14/AD-18/AD-19, §6.4, §6.5 Phase 1, §7)
- `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E7-01..06`, §3 H1..H6, `SEC-T01..05`, `SEC-T08`)

## Global Constraints

- **Thuần offline 0% AI (`AD-18`):** Không gọi bất kỳ API LLM/AI hay tracker/quảng cáo bên thứ ba nào.
- **Bảo toàn tuyến đường tiếng Việt (`AGENTS.md`):** Giữ nguyên toàn bộ route `/tu-vung`, `/kanji`, `/kanji/tra-cuu`, `/ngu-phap`, `/ngu-phap/$patternId`, `/doc-hieu`, `/doc-hieu/$passageId`, `/luyen-de`, `/luyen-de/$examId`, `/tien-do`, `/tai-khoan`, `/gioi-thieu`.
- **Bảo toàn dữ liệu & ID gói N4 (`AGENTS.md`):** Nâng `infra/content/n4/VERSION` từ `1.0.0` lên `1.1.0`; giữ đủ `1.182` từ vựng, `118` kanji, `388` từ ghép (từ `403` dòng nguồn) và `148` mẫu ngữ pháp với ID không đổi; kiểm chứng bằng `pnpm packs:verify`.
- **Chi tiết Ngữ pháp (`AGENTS.md`):** `/ngu-phap/$patternId` không thêm câu trắc nghiệm, chỉ hiển thị `Cách chia`, `Ý nghĩa`, `Cách dùng / Lưu ý`, `Ví dụ` (và so sánh liên quan). Mini-drill đặt ở 3 trang chuyên biệt `/ngu-phap/{cach-chia,kinh-ngu,tu-dong-tha-dong}`.
- **Trang Từ vựng & Tiến độ (`AGENTS.md`):** Bộ đếm thẻ `/tu-vung` giữ định dạng `n / total`; `/tien-do` hiển thị đúng `"Bạn chưa có tiến độ nào ở cấp độ này"` khi chưa có tiến độ (không hiện số `0%`).
- **Giới hạn dữ liệu Supabase (`AD-8`, `AD-12`, `SEC-E7-05`):** `item_id`/`exam_id` `1..128` ký tự; `total_questions` `1..1000`; `answers` JSON `<= 65.536` bytes; `sections` JSON `<= 16.384` bytes; batch sync `<= 100` bản ghi/request.
- **Thẩm mỹ & Trợ năng (`DESIGN.md`):** Washi & Sumi 3D (Sáng + Sumi đêm), giao diện 100% tiếng Việt (chữ Nhật gắn `lang="ja"`, không dùng Fraunces cho chữ Nhật), tối đa **1 dấu `.hanko` son/màn hình**, vùng chạm tối thiểu `44×44px` ở 360px, tôn trọng `prefers-reduced-motion`.
- **Ngân sách & định danh Native (`AD-10`, `AD-19`):** Giữ nguyên `identifier = "vn.luyenjlpt.app"` và release keystore Android; APK cơ bản `<= 30 MB`; không nhúng file `.mp3` vào `frontend/public/`.
- **Mã đề thi (`frontend/src/core/exam/types.ts`):** Giữ nguyên `EXAM_SECTION_KEYS = ["vocab", "grammar_reading", "listening"]` tương thích ngược với 9 đề JSON và dữ liệu Dexie v3.

## Review Focus

1. **Xung đột đồng bộ hai thiết bị trên cùng lượt thi `in_progress`:** Thiết bị A nộp Phần 1 (`submitted`), thiết bị B đang offline ở trạng thái `pending` với đồng hồ máy chạy nhanh hơn 5 phút sau đó lên mạng đồng bộ; kết quả sau gộp phải giữ nguyên Phần 1 `submitted` (điểm, đáp án, `submittedAt` không bị xóa ngược). *Pin ở Task 2 (`engine.test.ts` + `exam_attempts.test.sql`).*
2. **Tải lại trang hoặc hệ điều hành giết app di động giữa giờ thi:** Đang làm dở Phần 2 còn `14:20` và đã chọn 8 câu rồi reload trang; phải khôi phục đúng 8 đáp án và tiếp tục đếm ngược từ `deadlineMs` (nếu đã quá hạn thì tự động chuyển `timed_out` và lưu ngay). *Pin ở Task 3 (`exams.test.ts`) và Task 4 (`exam-practice.spec.ts`).*
3. **Nâng cấp Dexie v3 → v4 khi đã có dữ liệu bài thi cũ:** Người dùng đã có bản ghi `examAttempts` định dạng v3 (không có cột `status`, `attemptNumber`, `startedAt`, `updatedAt`) mở bản v4; migration phải tự điền `status: "completed"`, `attemptNumber` tăng dần theo thời gian, không ném lỗi và không mất lịch sử. *Pin ở Task 3 (`exams.test.ts`).*
4. **Callback OAuth Web bị Service Worker hoặc dấu `/` cuối đường dẫn làm hỏng:** Redirect trả về `/tai-khoan/?code=abc` khi PWA Service Worker đã kích hoạt; SW phải chuyển hướng trả về app shell mà giữ nguyên `?code=abc`, không lưu cache phản hồi `/auth/v1/*`, và `parseWebAuthCallback` chuẩn hóa đúng `/tai-khoan`. *Pin ở Task 1 (`client.test.ts`) và Task 9 (`pwa-offline.spec.ts`).*
5. **Tải cập nhật Android bị đứt mạng hoặc sai chứng chỉ/SHA-256:** Tệp APK tải về thiếu byte, sai `sha256`, vượt `60 MB`, `versionCode <= installedCode`, hoặc ký khác chứng chỉ app đang chạy; phải hủy cài đặt, xóa ngay tệp tạm `cacheDir/updates/pending.apk` và báo lỗi rõ bằng tiếng Việt. *Pin ở Task 10 (`androidUpdate.test.ts` + `android-release.test.mjs`).*

## File Structure Map

- **Auth Web & Bảo mật Edge/Headers (Task 1):** `infra/scripts/src/validate-web-env.mjs`, `frontend/public/_headers`, `.github/workflows/web-deploy.yml`, `frontend/src/adapters/auth/client.ts`, `frontend/src/pages/AccountPage.tsx`, `backend/supabase/functions/_shared/http.ts`.
- **Exam Sync Core & Supabase (Task 2):** `backend/supabase/migrations/20261127000100_exam_attempts_sync.sql`, `backend/supabase/tests/exam_attempts.test.sql`, `frontend/src/core/exam/{types.ts,engine.ts}`, `frontend/src/core/progress/index.ts`, `frontend/src/adapters/supabase-sync/index.ts`.
- **Dexie v4, Draft & Hardened Loader (Task 3):** `frontend/src/adapters/local-store/{db.ts,exams.ts,progress.ts}`, `frontend/src/adapters/content-pack/examSource.ts`, `frontend/src/adapters/auth/AccountProgress.tsx`, `frontend/src/hooks/useExams.ts`.
- **Exam Runner & List UI (Task 4):** `frontend/src/pages/{ExamRunnerPage.tsx,ExamListPage.tsx,ProgressPage.tsx}`.
- **JLPT 180pt Cutoff & 10-Min Remediation (Task 5):** `frontend/src/core/exam/{scoring.ts,remediation.ts}`, `frontend/src/components/exam/{JlptScoreBreakdown.tsx,QuickRemediationModal.tsx}`.
- **Audited Furigana N4 1.1.0 & Keigo Fix (Task 6):** `frontend/src/core/content/{types.ts,validate.ts}`, `infra/content/n4/{VERSION,reading.json,grammar.json}`, `infra/scripts/src/{verify-furigana.ts,packs.ts}`, `frontend/src/hooks/useFuriganaPreference.ts`, `frontend/src/pages/{ReadingDetailPage.tsx,GrammarDetailPage.tsx,GrammarKeigoPage.tsx}`.
- **Vocab Search, Kanji Filter, Mini-Drills & MostMissed (Task 7):** `frontend/src/pages/{VocabularyPage.tsx,KanjiQuizPage.tsx,ProgressPage.tsx,GrammarConjugationsPage.tsx,GrammarKeigoPage.tsx,GrammarVerbPairsPage.tsx}`, `frontend/src/components/kanji-quiz/{quizEngine.ts,QuizStart.tsx}`, `frontend/src/core/grammar/miniDrill.ts`, `frontend/src/components/grammar/MiniDrillPanel.tsx`.
- **Dark Mode Sumi Đêm & 5-Tab Mobile Nav (Task 8):** `frontend/src/hooks/useThemePreference.ts`, `frontend/public/theme-init.js`, `frontend/index.html`, `frontend/src/App.tsx`, `frontend/src/scene/{tokens.ts,DeskHeroCanvas.tsx,DeskHeroFallback.tsx}`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/AccountPage.tsx`.
- **Web PWA Offline (Task 9):** `frontend/package.json`, `frontend/vite.config.js`, `frontend/public/icons/pwa-{192,512}.png`, `frontend/src/components/PwaUpdatePrompt.tsx`, `frontend/src/App.tsx`.
- **In-App Seamless Updater Windows & Android (Task 10):** `mobile/scripts/{android-release.mjs,patch-android-manifest.mjs}`, `mobile/src-tauri/{src/android_updater.rs,src/lib.rs,capabilities/android-update.json}`, `frontend/src/adapters/native/androidUpdate.ts`, `frontend/src/components/NativeUpdates.tsx`, `desktop/src-tauri/{Cargo.toml,src/main.rs,capabilities/default.json}`, `.github/workflows/native.yml`.

---

### Task 1: Chẩn đoán & Sửa lỗi Đăng nhập Web (FR-46) + Security Headers & CORS (`SEC-E7-01..03`)

**Files:**
- Create: `infra/scripts/src/validate-web-env.mjs`
- Create: `infra/scripts/src/validate-web-env.test.ts`
- Create: `frontend/public/_headers`
- Create: `.github/workflows/web-deploy.yml`
- Modify: `frontend/src/adapters/auth/client.ts:7-206`
- Modify: `frontend/src/pages/AccountPage.tsx:75-186`
- Modify: `backend/supabase/functions/_shared/http.ts:1-56`
- Test: `frontend/src/adapters/auth/client.test.ts`
- Test: `backend/supabase/tests/functions.test.ts`
- Test: `tests/web/auth-web-login.spec.ts`

**Interfaces:**
- Consumes: `db.settings` (`frontend/src/adapters/local-store/db.ts`), `isOwnerRetired` (`frontend/src/adapters/local-store/retirement.ts`), `getAuthRedirectUrl` (`frontend/src/adapters/auth/nativeAuth.ts`).
- Produces:
  - `validateWebEnv(env: Record<string, string | undefined>): { url: string; key: string }` in `infra/scripts/src/validate-web-env.mjs`
  - `export type AuthErrorKind = "invalid_credentials" | "email_not_confirmed" | "rate_limited" | "service_unavailable" | "network_offline" | "storage_blocked"` and `export class AuthLoginError extends Error { readonly kind: AuthErrorKind; constructor(kind: AuthErrorKind, message: string) }` in `frontend/src/adapters/auth/client.ts`
  - `parseWebAuthCallback(href: string): { code: string | null; flowId: string | undefined; cleanUrl: string } | null` (normalizing trailing slash on `/tai-khoan/`)
  - `corsHeadersFor(request: Request, allowedOrigins?: readonly string[]): Record<string, string>` in `backend/supabase/functions/_shared/http.ts`

**Security & QA Gate:** `SEC-E7-01`, `SEC-E7-02`, `SEC-E7-03`, `SEC-T01`, `SEC-T02`. Phải thực hiện kiểm tra 6 giả thuyết H1..H6 trên bản deploy Web hiện tại trước khi đóng task.

- [ ] **Step 1: Chạy chẩn đoán 6 giả thuyết H1..H6 trên cấu hình Web deploy & Supabase production**

  Ghi nhận kết quả Có/Không cho từng mục trong biên bản PR/commit:
  1. H1: Kiểm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` trong môi trường build Web (`rg "supabase\.co" frontend/dist/assets` phải khớp sau khi build với env thật).
  2. H2: Gửi `POST /functions/v1/resolve-login` với header `apikey: <sb_publishable_key>` (không có JWT user), xác nhận không bị `401 Invalid JWT` hay `404`.
  3. H3: Kiểm Supabase Dashboard → Authentication → URL Configuration có đủ `https://<web-host>/tai-khoan`.
  4. H4: Gửi `OPTIONS /functions/v1/resolve-login` với `Origin: https://<web-host>`, xác nhận trả `204` + `Access-Control-Allow-Origin: https://<web-host>` + `Vary: Origin`.
  5. H5/H6: Kiểm `email_not_confirmed` không bị nuốt thành `LOGIN_ERROR`, và kiểm `db.settings` không kẹt `retired:<owner>` hay JSON hỏng.

- [ ] **Step 2: Write failing tests cho `validate-web-env`, `client.ts` (auth error classification + callback normalization + corrupted storage) và `http.ts` CORS allowlist**

```ts
// infra/scripts/src/validate-web-env.test.ts
describe("validateWebEnv", () => {
  it("accepts valid https supabase url and sb_publishable key", () => {
    expect(
      validateWebEnv({
        VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valid_key_123",
      }).url,
    ).toBe("https://abcdefghijklmnopqrst.supabase.co");
  });

  it("rejects missing publishable key or service_role JWT", () => {
    const serviceJwt = `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.c`;
    expect(() =>
      validateWebEnv({
        VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: serviceJwt,
      }),
    ).toThrow(/publishable|anon/i);
  });
});

// frontend/src/adapters/auth/client.test.ts (bổ sung test cases)
it("normalizes trailing slash on /tai-khoan/ and rejects mixed error+fragment params", () => {
  const ok = parseWebAuthCallback("https://app.example.test/tai-khoan/?code=pkce123");
  expect(ok).toEqual({ code: "pkce123", flowId: undefined, cleanUrl: "https://app.example.test/tai-khoan/" });

  const bad = parseWebAuthCallback("https://app.example.test/tai-khoan?code=fake&error=access_denied#access_token=leaked");
  expect(bad?.code).toBeNull();
  expect(bad?.cleanUrl).toBe("https://app.example.test/tai-khoan");
});

it("classifies email_not_confirmed, 429, 503 and offline separately while keeping LOGIN_ERROR for wrong credentials", async () => {
  // Mock supabase.auth.signInWithPassword returning error.code = "email_not_confirmed" -> AuthLoginError("email_not_confirmed")
  // Mock resolve-login returning HTTP 429 -> AuthLoginError("rate_limited")
  // Mock resolve-login returning HTTP 503 -> AuthLoginError("service_unavailable")
  // Mock wrong password and unknown username -> both throw AuthLoginError("invalid_credentials", LOGIN_ERROR)
});
```

  Trong `backend/supabase/tests/functions.test.ts`, thêm test kiểm `resolveLogin` và `deleteAccount` trả `Access-Control-Allow-Origin` khớp origin trong `ALLOWED_ORIGINS` kèm `Vary: Origin`, và từ chối origin lạ (không trả `*`), đồng thời chạy thành công khi header chỉ có `apikey: sb_publishable_*` (không có `Authorization` user).

- [ ] **Step 3: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/infra-scripts test -- validate-web-env && pnpm --filter @luyen/frontend test -- src/adapters/auth/client.test.ts`
  Expected: FAIL (`validate-web-env.mjs` chưa tồn tại, `AuthLoginError` chưa định nghĩa, `parseWebAuthCallback` trả `null` cho `/tai-khoan/`).

- [ ] **Step 4: Implement `validate-web-env.mjs`, `client.ts`, `AccountPage.tsx`, `http.ts`, `_headers`, và `web-deploy.yml`**

  1. Tạo `infra/scripts/src/validate-web-env.mjs` xuất `validateWebEnv(env)` (chặn rỗng, chặn non-HTTPS, chặn `service_role`, chấp nhận `sb_publishable_*` hoặc JWT `role: "anon"`). Khi chạy trực tiếp qua CLI `node infra/scripts/src/validate-web-env.mjs`, thoát mã `1` nếu lỗi.
  2. Cập nhật `frontend/src/adapters/auth/client.ts`:
     - Bọc `parseSupabaseUrl(raw)` với `try { return new URL(raw.trim()); } catch { return null; }` để không bao giờ crash trang khi env sai định dạng.
     - Bọc `JSON.parse` trong `sessionStorage.setItem`, `offlineSession`, `clearDeletedSession` bằng `try/catch`; nếu IndexedDB ném lỗi quota/permission khi đăng nhập, ném `new AuthLoginError("storage_blocked", "Trình duyệt đang chặn lưu phiên cục bộ (chế độ ẩn danh hoặc chặn cookie/storage).")`.
     - `parseWebAuthCallback`: đổi kiểm tra đường dẫn sang `parsed.pathname.replace(/\/+$/, "") !== "/tai-khoan"`.
     - `completeWebAuthCallback`: chỉ truyền `{ flowId: callback.flowId }` khi `typeof callback.flowId === "string" && callback.flowId.length > 0`, ngược lại gọi `supabase.auth.exchangeCodeForSession(callback.code)`.
     - `login(identifier, password)`: giữ đúng `LOGIN_ERROR` cho `invalid_credentials` / sai mật khẩu / username không tồn tại (chống dò tài khoản), nhưng phân loại riêng `email_not_confirmed` (`"Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư của bạn."`), `429` (`"Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."`), `503`/`404`/Edge Function unreachable (`"Dịch vụ đăng nhập tạm thời không phản hồi. Vui lòng thử lại sau."`), và `navigator.onLine === false` (`"Thiết bị đang ngoại tuyến. Hãy kết nối mạng để đăng nhập."`).
  3. Cập nhật `frontend/src/pages/AccountPage.tsx:91-169`: trong `run()`, nếu lỗi bắt được là `instanceof AuthLoginError`, hiển thị `error.message` thay vì ghi đè bằng thông báo chung.
  4. Cập nhật `backend/supabase/functions/_shared/http.ts`: bỏ `"access-control-allow-origin": "*"`; đọc `ALLOWED_ORIGINS` (phân tách bằng dấu phẩy) cộng mặc định các origin Tauri (`http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`) và chỉ phản chiếu `Origin` khớp chính xác kèm `"vary": "Origin"`. Trong môi trường local không đặt `ALLOWED_ORIGINS`, chỉ cho phép `http://localhost:5173`, `http://127.0.0.1:5173`, `http://127.0.0.1:4174` và các origin Tauri.
  5. Tạo `frontend/public/_headers` cấu hình Cloudflare Workers Static Assets:
     - `/*`: `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`, có bước thay `*.supabase.co` bằng project ref cụ thể lúc CI build deploy), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
     - `/tai-khoan`: `Cache-Control: no-store`.
  6. Tạo `.github/workflows/web-deploy.yml` (pin SHA 40 ký tự giống `ci.yml`): chạy `node infra/scripts/src/validate-web-env.mjs`, `pnpm packs:verify`, `pnpm --filter @luyen/frontend build`, thay placeholder project ref trong `frontend/dist/_headers`, kiểm tra `frontend/dist/_headers` tồn tại và bundle chứa hostname Supabase đã cấu hình, rồi deploy bằng Wrangler.

- [ ] **Step 5: Run tests, Deno Edge Function checks & Playwright Web Auth E2E, then commit**

  Run: `pnpm --filter @luyen/infra-scripts test && pnpm --filter @luyen/frontend test -- src/adapters/auth/ && deno test --allow-env backend/supabase/tests/functions.test.ts && pnpm typecheck && pnpm check`
  Expected: PASS toàn bộ unit tests, Deno CORS/publishable-key tests, typecheck và biome check.
  Commit:
  ```bash
  git add infra/scripts/src/validate-web-env.mjs infra/scripts/src/validate-web-env.test.ts frontend/public/_headers .github/workflows/web-deploy.yml frontend/src/adapters/auth/client.ts frontend/src/adapters/auth/client.test.ts frontend/src/pages/AccountPage.tsx backend/supabase/functions/_shared/http.ts backend/supabase/tests/functions.test.ts
  git commit -m "fix(auth): harden web login diagnostics, env validation, CORS allowlist and security headers"
  ```

---

### Task 2: Mô hình & Đồng bộ `exam_attempts` theo từng phần + Nhiều lần làm lại (FR-27, AD-14, `SEC-E7-05`)

**Files:**
- Create: `backend/supabase/migrations/20261127000100_exam_attempts_sync.sql`
- Create: `backend/supabase/tests/exam_attempts.test.sql`
- Modify: `frontend/src/core/exam/types.ts:86-112`
- Modify: `frontend/src/core/exam/engine.ts:76-145`
- Modify: `frontend/src/core/progress/index.ts:26-109`
- Modify: `frontend/src/adapters/supabase-sync/index.ts:14-181`
- Test: `frontend/src/core/exam/engine.test.ts`
- Test: `frontend/src/adapters/supabase-sync/index.test.ts`

**Interfaces:**
- Consumes: `EXAM_SECTION_KEYS` (`["vocab", "grammar_reading", "listening"]`), `jlpt_private.has_confirmed_email()`, `jlpt_private.progress_cursors`, `createProgressSync` (`frontend/src/core/sync/index.ts`).
- Produces:
  - Updated `ExamSectionAttemptSummary`: `{ key: ExamSectionKey; status: "pending" | "submitted" | "timed_out" | "skipped"; score: number; total: number; elapsedSeconds: number; submittedAt: string | null }`
  - Updated `ExamAttemptRecord`: `{ id: string; owner: string; level: Level; examId: string; status: "in_progress" | "completed"; attemptNumber: number; startedAt: string; completedAt: string | null; updatedAt: string; totalScore: number; totalQuestions: number; sections: ExamSectionAttemptSummary[]; answers: Record<string, number> }`
  - `buildExamAttemptSnapshot(input: BuildExamAttemptInput): ExamAttemptRecord` and `mergeExamAttempts(local: ExamAttemptRecord, incoming: ExamAttemptRecord): ExamAttemptRecord` in `frontend/src/core/exam/engine.ts`
  - Extended `PROGRESS_KINDS` containing `"exam_attempts"` and `ProgressRow` variant `{ kind: "exam_attempts"; examId: string; status: "in_progress" | "completed"; attemptNumber: number; startedAt: string; completedAt: string | null; totalScore: number; totalQuestions: number; sections: ExamSectionAttemptSummary[]; answers: Record<string, number> }`
  - Postgres table `public.exam_attempts` with monotonic section trigger `jlpt_private.apply_exam_attempt_write()` and answer validator `jlpt_private.valid_exam_answers(jsonb)`.

**Security & QA Gate:** `SEC-E7-05`, `SEC-T05` (6 ca pgTAP từ chối: chưa xác nhận email, sửa chéo user, ghi đè `submitted → pending`, sửa bản `completed`, tạo 2 `in_progress` song song, nhồi JSON `> 65.536B` hoặc `total_score > total_questions`).

- [ ] **Step 1: Write failing unit tests cho `mergeExamAttempts`, `buildExamAttemptSnapshot`, sync wire mapping và pgTAP `exam_attempts.test.sql`**

```ts
// frontend/src/core/exam/engine.test.ts
it("preserves submitted section 1 when merging a newer-clock stale pending snapshot (Review Focus #1)", () => {
  const local = makeSnapshot({
    updatedAt: "2026-11-27T08:00:00.000Z",
    vocab: { status: "submitted", score: 24, total: 28, elapsedSeconds: 900, submittedAt: "2026-11-27T08:00:00.000Z" },
    grammar_reading: { status: "pending", score: 0, total: 29, elapsedSeconds: 0, submittedAt: null },
    listening: { status: "pending", score: 0, total: 28, elapsedSeconds: 0, submittedAt: null },
    answers: { "q-1": 2 },
  });
  const staleRemote = makeSnapshot({
    updatedAt: "2026-11-27T08:05:00.000Z", // đồng hồ thiết bị B chạy nhanh hơn 5 phút
    vocab: { status: "pending", score: 0, total: 28, elapsedSeconds: 0, submittedAt: null },
    grammar_reading: { status: "pending", score: 0, total: 29, elapsedSeconds: 0, submittedAt: null },
    listening: { status: "pending", score: 0, total: 28, elapsedSeconds: 0, submittedAt: null },
    answers: {},
  });
  const merged = mergeExamAttempts(local, staleRemote);
  expect(merged.sections[0].status).toBe("submitted");
  expect(merged.sections[0].score).toBe(24);
  expect(merged.answers["q-1"]).toBe(2);
  expect(merged.status).toBe("in_progress");
});

it("transitions attempt status to completed once all 3 sections are locked and keeps completed immutable", () => {
  // All 3 sections in submitted|timed_out|skipped -> status === "completed", completedAt !== null
  // Merging a completed attempt with any incoming update returns the completed attempt unchanged
});
```

  Tạo `backend/supabase/tests/exam_attempts.test.sql` chứa đủ 6 ca `SEC-T05`:
  1. Unconfirmed email user `INSERT` bị `42501`.
  2. User B `SELECT`/`UPDATE` dòng của User A trả 0 dòng / bị chặn.
  3. `UPDATE` Phần 1 từ `submitted` về `pending` bị `23514` (`Exam section status cannot regress`).
  4. `UPDATE` dòng đã `status = 'completed'` bị `23514` (`Completed exam attempt is immutable`).
  5. `INSERT` dòng thứ 2 `status = 'in_progress'` cùng `(user_id, level, exam_id)` bị `23505` (partial unique index); sau khi dòng 1 lên `completed`, `INSERT` dòng 2 `attempt_number = 2` thành công (`lives_ok`).
  6. `INSERT` `answers` > 65.536 bytes hoặc `total_score > total_questions` hoặc choice `= 4` bị `23514`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/engine.test.ts`
  Expected: FAIL (`mergeExamAttempts` / `buildExamAttemptSnapshot` chưa định nghĩa).

- [ ] **Step 3: Implement Supabase migration `20261127000100_exam_attempts_sync.sql`, core exam merge logic & sync wire adapter**

  1. Viết `backend/supabase/migrations/20261127000100_exam_attempts_sync.sql`:
     - Hàm `jlpt_private.valid_exam_answers(payload jsonb)` (`immutable strict`): phải là JSON object, `octet_length(payload::text) <= 65536`, mọi key dài `1..128` không chứa `\0` và không thuộc `('__proto__', 'constructor', 'prototype')`, mọi giá trị là số nguyên `0..3`.
     - Hàm `jlpt_private.valid_exam_sections(payload jsonb)`: JSON array dài `1..10`, `octet_length(payload::text) <= 16384`, mỗi phần tử có `key IN ('vocab','grammar_reading','listening')`, `status IN ('pending','submitted','timed_out','skipped')`, `0 <= score <= total <= 1000`, `elapsedSeconds >= 0`.
     - Bảng `public.exam_attempts`: cột `id uuid primary key` (UUID v4 CHECK), `user_id uuid not null references auth.users(id) on delete cascade`, `level text`, `exam_id text check (char_length(exam_id) between 1 and 128 and exam_id !~ '[\x00/]' and exam_id not like '%..%')`, `status text check (status in ('in_progress', 'completed'))`, `attempt_number integer not null check (attempt_number between 1 and 10000)`, `total_score integer`, `total_questions integer check (total_questions between 1 and 1000 and total_score between 0 and total_questions)`, `sections jsonb`, `answers jsonb`, `started_at timestamptz`, `completed_at timestamptz`, `client_updated_at timestamptz`, `server_updated_at timestamptz`.
     - Partial unique index `create unique index exam_attempts_one_in_progress_idx on public.exam_attempts (user_id, level, exam_id) where status = 'in_progress'`.
     - Unique cursor index `create unique index on public.exam_attempts (user_id, server_updated_at)`.
     - Gắn statement-level trigger `progress_lock before insert or update on public.exam_attempts for each statement execute function jlpt_private.lock_progress_writer()` (đồng bộ khóa ghi giao dịch giống `card_status`/`grammar_learned`).
     - Trigger `jlpt_private.apply_exam_attempt_write()` (`before insert or update for each row`): khi `UPDATE`, chặn đổi `user_id`/`level`/`exam_id`/`attempt_number`, chặn mọi `UPDATE` nếu `old.status = 'completed'`, kiểm tra từng phần không được thụt lùi từ trạng thái đã chốt (`submitted|timed_out|skipped`) về `pending` hay đổi điểm phần đã chốt, và cấp `server_updated_at` đơn điệu qua `jlpt_private.progress_cursors`.
     - Bật RLS (`own_confirmed_select`, `own_confirmed_insert`, `own_confirmed_update`), `REVOKE ALL`, chỉ `GRANT SELECT/INSERT/UPDATE` trên cột dữ liệu (cấm ghi `server_updated_at`, cấm `DELETE`).
  2. Cập nhật `frontend/src/core/exam/types.ts` và `frontend/src/core/exam/engine.ts`: triển khai `buildExamAttemptSnapshot` (hỗ trợ cả `in_progress` sau khi nộp từng phần lẫn `completed` khi xong cả 3 phần) và `mergeExamAttempts` (gộp đơn điệu theo từng phần, ưu tiên giữ phần đã chốt và hợp nhất `answers` của các phần đã chốt). Giữ wrapper `summarizeExamAttempt` gọi `buildExamAttemptSnapshot` để không vỡ test cũ.
  3. Cập nhật `frontend/src/core/progress/index.ts` & `frontend/src/adapters/supabase-sync/index.ts`: thêm `"exam_attempts"` vào `PROGRESS_KINDS`, bổ sung `validateProgressRow` cho `exam_attempts` (chặn khóa `__proto__`/`constructor`/`prototype` trong `answers` và kiểm tổng byte `<= 65536`), ánh xạ wire `toWire`/`fromWire`, và trong `push()` dùng `upsert(..., { onConflict: "id", ignoreDuplicates: false })` cho `exam_attempts` (nhờ trigger server bảo vệ bất biến khi `completed`).

- [ ] **Step 4: Run Vitest & Supabase pgTAP tests to verify they pass**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/ src/core/progress/ src/adapters/supabase-sync/ && supabase test db --workdir backend`
  Expected: PASS toàn bộ unit tests và 100% ca pgTAP `exam_attempts.test.sql` (`SEC-T05`).

- [ ] **Step 5: Commit**

  ```bash
  git add backend/supabase/migrations/20261127000100_exam_attempts_sync.sql backend/supabase/tests/exam_attempts.test.sql frontend/src/core/exam/ frontend/src/core/progress/index.ts frontend/src/adapters/supabase-sync/
  git commit -m "feat(exam): add monotonic section-by-section exam_attempts sync schema and merge engine"
  ```

---

### Task 3: Nâng cấp Dexie v4, Lưu nháp Tự động, `purgeOwner` đầy đủ & Cứng hóa `examSource.ts` (FR-27, AD-14, `SEC-E7-05`, `SEC-T04`)

**Files:**
- Modify: `frontend/src/adapters/local-store/db.ts:1-43`
- Modify: `frontend/src/adapters/local-store/exams.ts:1-214`
- Modify: `frontend/src/adapters/local-store/progress.ts:161-281`
- Modify: `frontend/src/adapters/content-pack/examSource.ts:1-153`
- Modify: `frontend/src/adapters/auth/AccountProgress.tsx:70-131`
- Modify: `frontend/src/hooks/useExams.ts:1-87`
- Test: `frontend/src/adapters/local-store/exams.test.ts`
- Test: `frontend/src/adapters/local-store/progress.test.ts`
- Test: `frontend/src/adapters/content-pack/examSource.test.ts`

**Interfaces:**
- Consumes: `ExamAttemptRecord`, `mergeExamAttempts` (Task 2), `isOwnerRetired` (`retirement.ts`), `PROGRESS_KINDS` (`core/progress/index.ts`).
- Produces:
  - Dexie `luyen-jlpt` **v4** schema in `frontend/src/adapters/local-store/db.ts` defining unified v2 stores:
    - `examAttempts: "id, owner, [owner+level], [owner+level+examId], [owner+level+examId+status], completedAt"`
    - `activeExamDrafts: "[owner+level+examId], owner"`
    - Reserved AD-14 stores (typed in Epic 8–11, canonical schema):
      - `srsCards: "[owner+level+cardType+itemId], [owner+level+dueAt], [owner+level], owner"`
      - `srsReviews: "id, [owner+level+reviewedAt], [owner+level+cardType+itemId], owner"`
      - `extensionPacks: "[packId+entryKey], packId, entryKey"`
      - `userMnemonics: "[owner+level+kanjiId], owner, [owner+level]"`
      - `notebooks: "id, [owner+updatedAt], owner"`
      - `notebookItems: "id, owner, [owner+notebookId], [owner+notebookId+itemType], [owner+itemType]"`
  - `ActiveExamDraft`: `{ owner: string; level: Level; examId: string; attemptId: string; activeIndex: number; answers: Record<string, number>; startedAtMs: Partial<Record<ExamSectionKey, number>>; deadlineMs: Partial<Record<ExamSectionKey, number>>; listeningScriptMode: boolean; savedAt: string }`
  - `examStore.saveAttemptProgress(record: ExamAttemptRecord): Promise<ExamAttemptRecord>` (writes Dexie `examAttempts` via `mergeExamAttempts`, mirrors/queues into `progressOutbox` for signed-in owners, clears `activeExamDrafts` when `completed`)
  - `examStore.getActiveAttempt(owner: string, level: Level, examId: string): Promise<ExamAttemptRecord | null>`
  - `examStore.saveDraft(draft: ActiveExamDraft): Promise<void>`, `examStore.loadDraft(owner: string, level: Level, examId: string): Promise<ActiveExamDraft | null>`, `examStore.clearDraft(owner: string, level: Level, examId: string): Promise<void>`
  - `ExamSourceError` with explicit `code: "not-found" | "schema" | "duplicate-id" | "hash-mismatch" | "network" | "size-limit"`
  - Hooks `useActiveExamAttempt(examId)`, `useSaveExamProgress()`, `useExamDraft(examId)` in `frontend/src/hooks/useExams.ts`.

**Security & QA Gate:** `SEC-E7-05`, `SEC-T04` (xóa sạch mọi bảng gắn `owner` trong `purgeOwner`, bảo toàn 100% dữ liệu của `ownerB`; timeout 30s + trần byte 1 MB/16 MB ở `examSource.ts`).

- [ ] **Step 1: Write failing tests cho Dexie v3→v4 migration, autosave draft, `purgeOwner` toàn bảng và `examSource` timeout/size/404**

```ts
// frontend/src/adapters/local-store/exams.test.ts
it("upgrades legacy v3 examAttempts records to v4 with status=completed and sequential attemptNumber (Review Focus #3)", async () => {
  // Seed Dexie v3 record missing status/attemptNumber/startedAt/updatedAt -> open v4 -> assert backfilled cleanly
});

it("persists and restores activeExamDraft with answers and deadlineMs across reload (Review Focus #2)", async () => {
  await examStore.saveDraft({
    owner: "u1", level: "n4", examId: "n4-2013-07", attemptId: uuid1,
    activeIndex: 1, answers: { "q-29": 1 },
    startedAtMs: { grammar_reading: 1_700_000_000_000 },
    deadlineMs: { grammar_reading: 1_700_003_300_000 },
    listeningScriptMode: false, savedAt: "2026-11-27T08:00:00.000Z",
  });
  const restored = await examStore.loadDraft("u1", "n4", "n4-2013-07");
  expect(restored?.answers["q-29"]).toBe(1);
  expect(restored?.deadlineMs.grammar_reading).toBe(1_700_003_300_000);
});

it("enqueues signed-in section progress to progressOutbox and wipes ownerA examAttempts/drafts in purgeOwner while preserving ownerB (SEC-T04)", async () => {
  // Save attempt + draft for ownerA and ownerB -> call progressStore.purgeOwner(ownerA)
  // Assert ownerA has 0 examAttempts, 0 activeExamDrafts, 0 outbox entries; ownerB intact
});
```

  Trong `frontend/src/adapters/content-pack/examSource.test.ts`, thêm test kiểm: HTTP `404` trả `{ ok: false, error: { code: "not-found", ... } }`, response vượt `16 MB` trả `code: "size-limit"`, và request treo bị hủy bởi `AbortSignal`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/ src/adapters/content-pack/examSource.test.ts`
  Expected: FAIL (`saveDraft`, `saveAttemptProgress`, `code: "not-found"` chưa tồn tại; `purgeOwner` còn để lại `examAttempts`).

- [ ] **Step 3: Implement Dexie v4 upgrade, `examStore`, `progressStore.purgeOwner/applyPulledPage`, `AccountProgress`, `examSource.ts`, `useExams.ts`**

  1. Cập nhật `frontend/src/adapters/local-store/db.ts`: thêm `db.version(4).stores({ examAttempts: "id, owner, [owner+level], [owner+level+examId], [owner+level+examId+status], completedAt", activeExamDrafts: "[owner+level+examId], owner", srsCards: "[owner+level+cardType+itemId], [owner+level+dueAt], [owner+level], owner", srsReviews: "id, [owner+level+reviewedAt], [owner+level+cardType+itemId], owner", extensionPacks: "[packId+entryKey], packId, entryKey", userMnemonics: "[owner+level+kanjiId], owner, [owner+level]", notebooks: "id, [owner+updatedAt], owner", notebookItems: "id, owner, [owner+notebookId], [owner+notebookId+itemType], [owner+itemType]" }).upgrade(...)` để điền `status: "completed"`, `attemptNumber`, `startedAt`, `updatedAt`, và `submittedAt` cho mọi bản ghi v3 cũ mà không làm mất dữ liệu.
  2. Cập nhật `frontend/src/adapters/local-store/exams.ts`: nới `validateAttemptRecord` cho phép `status: "in_progress"` (phần chưa làm có `status: "pending"`, `score: 0`), thêm `saveAttemptProgress`, `getActiveAttempt`, `nextAttemptNumber`, `saveDraft`, `loadDraft`, `clearDraft`; khi `owner !== GUEST_OWNER`, `saveAttemptProgress` ghi đồng thời vào `db.examAttempts` và hàng đợi `db.progressOutbox` trong 1 transaction Dexie.
  3. Cập nhật `frontend/src/adapters/local-store/progress.ts`:
     - Trong `applyPulledPage`, khi `kind === "exam_attempts"`, gộp vào `db.examAttempts` bằng `mergeExamAttempts(existing, incoming)` (xóa `activeExamDrafts` nếu bản ghi vừa kéo về đã khóa phần đang mở hoặc chuyển `completed`).
     - Trong `purgeOwner(owner)`, mở transaction rw trên toàn bộ bảng gắn `owner` (`progress`, `progressOutbox`, `progressCursors`, `examAttempts`, `activeExamDrafts`, `srsCards`, `srsReviews`, `notebooks`, `notebookItems`, `userMnemonics`, `settings`) và xóa sạch mọi bản ghi của `owner`.
     - Trong `hasGuestProgress()` và `mergeGuest()`, gộp luôn `examAttempts` của khách sang tài khoản đăng nhập và đẩy vào `progressOutbox`.
  4. Cập nhật `frontend/src/adapters/auth/AccountProgress.tsx:99-101`: `onChange` gọi thêm `void cache.invalidateQueries({ queryKey: ["exam-attempts", owner] })`.
  5. Cập nhật `frontend/src/adapters/content-pack/examSource.ts`: trả `code: "not-found"` cho HTTP `404`, thêm `AbortSignal.timeout(30_000)` và đọc stream giới hạn `1 MB` (index) / `16 MB` (exam doc) trả `code: "size-limit"`.
  6. Cập nhật `frontend/src/hooks/useExams.ts`: thêm `useActiveExamAttempt`, `useSaveExamProgress`, `useExamDraft`.

- [ ] **Step 4: Run tests, typecheck & biome check**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/ src/adapters/content-pack/ && pnpm typecheck && pnpm check`
  Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/adapters/local-store/ frontend/src/adapters/content-pack/examSource.ts frontend/src/adapters/content-pack/examSource.test.ts frontend/src/adapters/auth/AccountProgress.tsx frontend/src/hooks/useExams.ts
  git commit -m "feat(local-store): upgrade Dexie to v4 with exam drafts, synced exam_attempts, full purgeOwner and hardened examSource"
  ```

---

### Task 4: Giao diện Luyện đề Từng phần, Khôi phục Nháp & Nhiều lần làm lại (FR-27)

**Files:**
- Modify: `frontend/src/pages/ExamRunnerPage.tsx:237-850`
- Modify: `frontend/src/pages/ExamListPage.tsx:25-248`
- Modify: `frontend/src/pages/ProgressPage.tsx:41-103`
- Test: `tests/web/exam-practice.spec.ts`

**Interfaces:**
- Consumes: `useActiveExamAttempt`, `useSaveExamProgress`, `useExamAttempts`, `examStore.{saveDraft,loadDraft,clearDraft}` (Task 3), `buildExamAttemptSnapshot` (Task 2), `ExamSourceError` (`code: "not-found"`).
- Produces:
  - `ExamRunnerPage`: nút nộp từng phần lưu ngay vào Dexie + outbox và hiện tức thì điểm phần, đáp án đúng/sai, `<RubyText>`, bản dịch, giải thích; tự khôi phục nháp khi reload; nút `"Làm lại đề này"` tạo lượt mới (`Lần N`) giữ nguyên toàn bộ điểm các lần trước; bộ chọn xem lại `Lần 1`, `Lần 2` trên màn hình tổng kết.
  - `ExamListPage`: phân loại 404 bằng `ExamSourceError.code === "not-found"`, mô tả thời lượng động theo `exams`, hiển thị badge `"Đang làm dở (k/3 phần)"` + nút `"Làm tiếp đề"` và thống kê `"Đã làm N lần · Cao nhất X/Y"`.

**Security & QA Gate:** Luồng nộp Phần 1 phải hiện ngay lời giải + lưu tiến độ trước khi sang Phần 2; reload giữa giờ giữ nguyên đáp án & đồng hồ; làm lại lượt 2 không ghi đè điểm lượt 1.

- [ ] **Step 1: Write failing Playwright E2E tests trong `tests/web/exam-practice.spec.ts`**

```ts
// tests/web/exam-practice.spec.ts (thêm 3 kịch bản FR-27)
test("submitting section 1 saves progress immediately, shows instant explanations, and resumes at section 2 after reload", async ({ page }) => {
  // Mở /luyen-de/n4-2013-07 (hoặc đề đầu tiên trong danh sách)
  // Bắt đầu Phần 1, chọn 2 đáp án, bấm Nộp Phần 1
  // Assert hiện ngay [data-ocid="exam_runner.section_result"], [data-ocid^="exam_runner.explanation."], và <ruby><rt>
  // Reload trang -> Assert Phần 1 vẫn trạng thái Đã nộp (xem lại được lời giải), Phần 2 mở khóa sẵn sàng làm tiếp
});

test("reloading mid-section restores selected answers and remaining countdown (Review Focus #2)", async ({ page }) => {
  // Bắt đầu Phần 1, chọn đáp án câu 1 và câu 2, reload trang -> Assert câu 1 & câu 2 vẫn được chọn và đồng hồ vẫn chạy
});

test("retrying a completed exam creates Attempt #2 without overwriting Attempt #1 score", async ({ page }) => {
  // Hoàn tất 3 phần (Lần 1) -> bấm "Làm lại đề này" -> hoàn tất Lần 2 với đáp án khác
  // Assert lịch sử trên /luyen-de và /tien-do hiển thị đủ 2 lượt với điểm riêng biệt (Lần 1, Lần 2)
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

  Run: `pnpm build && pnpm e2e:web -- tests/web/exam-practice.spec.ts`
  Expected: FAIL (hiện tại reload làm mất toàn bộ trạng thái Phần 1 và nháp đang làm).

- [ ] **Step 3: Implement `ExamRunnerPage.tsx`, `ExamListPage.tsx` và `ProgressPage.tsx`**

  1. `ExamRunnerPage.tsx`:
     - Khi mount `ExamRunnerSession`, hydrate từ `activeAttempt` (từ Dexie/sync) và `activeExamDraft`: khôi phục `attemptId`, `attemptNumber`, `statuses` (phần đã chốt giữ nguyên `submitted|timed_out|skipped`, phần kế tiếp là `ready`, nếu có draft đang chạy chưa hết giờ thì khôi phục `in_progress` + `deadlineMs` + `answers`, nếu `deadlineMs <= Date.now()` thì lập tức `finalizeSection(..., "timed_out")`).
     - Trên mỗi `handleSelectChoice` và `handleStartSection`, gọi `examStore.saveDraft(...)` (debounced 150ms cho chọn đáp án, ghi ngay khi bắt đầu phần).
     - Trong `finalizeSection`: tính `buildExamAttemptSnapshot(...)` ngay lập tức (kể cả khi mới xong Phần 1) và gọi `saveProgress.mutate(snapshot)` để lưu vào Dexie + đẩy vào `progressOutbox` đồng bộ lên Supabase, đồng thời giữ nguyên màn hình Phần vừa nộp hiển thị tức thì kết quả + `<RubyText>` + bản dịch + giải thích chi tiết (và xóa draft của phần vừa khóa).
     - Trong `handleRetryExam`: tạo UUID v4 mới, tăng `attemptNumber`, xóa draft cũ, không chạm vào bản ghi `completed` cũ.
     - Trên màn hình tổng kết (`viewingSummary`), hiển thị thêm bộ chuyển xem lại các lần đã hoàn thành (`Lần 1`, `Lần 2`, ...) nếu `completedAttempts.length > 1`.
  2. `ExamListPage.tsx`:
     - Thay `isMissingExamIndexError` kiểm `": 404"` bằng kiểm tra `error instanceof ExamSourceHttpError && error.code === "not-found"` (trả về từ `useExamIndex`).
     - Bỏ chuỗi hardcode thời lượng N4 (`25/55/35 phút`), tính động dải thời lượng từ `exams` hiện có của `level`.
     - Tách riêng `inProgressAttempt` và `completedAttempts`: nếu có `inProgressAttempt`, hiện badge `"Đang làm dở (k/3 phần)"` và nút `"Làm tiếp đề"`; hiển thị số lần hoàn thành và điểm từng lần / điểm cao nhất.
  3. `ProgressPage.tsx:41-103`: trong `ExamAttemptsSection`, chỉ tính và hiển thị các lượt `completed` kèm nhãn `Lần #attemptNumber` (và nếu có lượt `in_progress`, hiện nhãn nhỏ `"Đang làm dở · Tiếp tục"`).

- [ ] **Step 4: Run E2E, unit tests & typecheck**

  Run: `pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/exam-practice.spec.ts`
  Expected: PASS 100% kịch bản luyện đề mới và cũ.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/ExamRunnerPage.tsx frontend/src/pages/ExamListPage.tsx frontend/src/pages/ProgressPage.tsx tests/web/exam-practice.spec.ts
  git commit -m "feat(exam): save and sync exam progress per section, auto-restore drafts, and preserve multi-attempt history"
  ```

---

### Task 5: Mô phỏng Điểm liệt JLPT 180đ & Bộ "Ôn cấp tốc 10 phút" (FR-29)

**Files:**
- Create: `frontend/src/core/exam/scoring.ts`
- Create: `frontend/src/core/exam/scoring.test.ts`
- Create: `frontend/src/core/exam/remediation.ts`
- Create: `frontend/src/core/exam/remediation.test.ts`
- Create: `frontend/src/components/exam/JlptScoreBreakdown.tsx`
- Create: `frontend/src/components/exam/QuickRemediationModal.tsx`
- Modify: `frontend/src/pages/ExamRunnerPage.tsx:579-709`
- Test: `frontend/src/core/exam/scoring.test.ts`, `frontend/src/core/exam/remediation.test.ts`, `tests/web/exam-practice.spec.ts`

**Interfaces:**
- Consumes: `ExamAttemptRecord`, `ExamDocument` (`core/exam/types.ts`), `ContentPack` (`core/content/types.ts`).
- Produces:
  - `JlptScoreReport`: `{ totalScaled: number; totalMax: 180; passThreshold: 90; languageReadingScaled: number; languageReadingMax: 120; languageReadingCutoff: 38; listeningScaled: number; listeningMax: 60; listeningCutoff: 19; listeningSkipped: boolean; passed: boolean; failedByCutoff: "none" | "language_reading" | "listening" | "both"; verdictVi: string; weakestGroup: { label: string; sectionTitle: string; missedCount: number } | null }`
  - `computeJlptScore(attempt: ExamAttemptRecord, exam: ExamDocument): JlptScoreReport` in `frontend/src/core/exam/scoring.ts`
  - `RemediationItem`: `{ id: string; kind: "vocab" | "kanji" | "compound" | "grammar" | "exam_question"; label: string; reading?: string; meaning: string; lesson?: number; sourceQuestionNumber: number; explanation: string }`
  - `buildRemediationSession(attempt: ExamAttemptRecord, exam: ExamDocument, pack: ContentPack, maxItems?: number): RemediationItem[]` in `frontend/src/core/exam/remediation.ts`

**Security & QA Gate:** Thuần offline deterministic 0% AI; không vượt quá 1 dấu `.hanko` son trên màn hình tổng kết `ExamRunnerPage`; màu đỏ son/destructive chỉ dùng cho vạch cảnh báo điểm liệt `< 38/120` và `< 19/60`.

- [ ] **Step 1: Write failing unit tests cho `computeJlptScore` và `buildRemediationSession`**

```ts
// frontend/src/core/exam/scoring.test.ts
it("detects pass when total >= 90 and both cutoffs met (38/120 and 19/60)", () => {
  const report = computeJlptScore(attemptWith(20, 28, 22, 29, 14, 28), examN4);
  expect(report.languageReadingScaled).toBeGreaterThanOrEqual(38);
  expect(report.listeningScaled).toBeGreaterThanOrEqual(19);
  expect(report.totalScaled).toBeGreaterThanOrEqual(90);
  expect(report.passed).toBe(true);
  expect(report.failedByCutoff).toBe("none");
});

it("flags listening cutoff failure even when total >= 90", () => {
  const report = computeJlptScore(attemptWith(28, 28, 29, 29, 5, 28), examN4);
  expect(report.totalScaled).toBeGreaterThanOrEqual(90);
  expect(report.listeningScaled).toBeLessThan(19);
  expect(report.passed).toBe(false);
  expect(report.failedByCutoff).toBe("listening");
  expect(report.verdictVi).toContain("liệt phần Nghe hiểu");
});

it("marks listeningSkipped honestly without inflating total score", () => {
  const report = computeJlptScore(attemptWithSkippedListening(28, 28, 29, 29), examN4);
  expect(report.listeningSkipped).toBe(true);
  expect(report.listeningScaled).toBe(0);
  expect(report.passed).toBe(false);
});
```

  Trong `frontend/src/core/exam/remediation.test.ts`: kiểm `buildRemediationSession` trả tối đa `15` mục ưu tiên từ các câu làm sai/bỏ trống, khớp được kanji/từ vựng/ngữ pháp có trong `pack` kèm số bài Minna, và trả mảng rỗng khi đạt 100% câu đúng.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/scoring.test.ts src/core/exam/remediation.test.ts`
  Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Implement `scoring.ts`, `remediation.ts`, `JlptScoreBreakdown.tsx`, `QuickRemediationModal.tsx` và gắn vào `ExamRunnerPage.tsx`**

  1. `frontend/src/core/exam/scoring.ts`: quy đổi điểm chuẩn JLPT N4 bằng cách gộp Phần 1 (`vocab`) + Phần 2 (`grammar_reading`) theo tỷ lệ đúng về thang `120` (vạch liệt `38`), Phần 3 (`listening`) về thang `60` (vạch liệt `19`), tổng `/180` (ngưỡng đỗ `90`), tìm nhóm `Mondai` sai nhiều nhất để sinh gợi ý hành động cụ thể.
  2. `frontend/src/core/exam/remediation.ts`: duyệt các câu làm sai hoặc bỏ trống trong `attempt`, đối khớp ký tự Kanji/từ vựng/mẫu ngữ pháp trong `pack` (ưu tiên trùng khớp chính xác, không trùng lặp ID, giới hạn mặc định `15` mục cho phiên ôn 10 phút), gắn đường dẫn trực tiếp về bài Minna hoặc xem lại câu đề.
  3. `frontend/src/components/exam/JlptScoreBreakdown.tsx`: 2 thanh điểm ngang (`/120` với vạch đỏ tại `38`, `/60` với vạch đỏ tại `19`) + tổng `/180` (vạch đỗ `90`) + hộp nhận xét tiếng Việt rõ ràng; không thêm dấu `.hanko` thứ hai (màn tổng kết đã có 1 `.hanko`).
  4. `frontend/src/components/exam/QuickRemediationModal.tsx`: dialog (shadcn `Dialog`) lật thẻ nhanh các mục vừa sai kèm nút `"Sang câu tiếp"`, nút nhảy thẳng tới `/ngu-phap/$patternId` hoặc `/kanji/tra-cuu`, đạt chuẩn chạm `>= 44px`.
  5. Gắn `<JlptScoreBreakdown />` và nút `"Ôn cấp tốc 10 phút từ đề này"` (`data-ocid="exam_runner.remediation_button"`) vào màn tổng kết của `ExamRunnerPage.tsx`.

- [ ] **Step 4: Run unit tests, E2E & typecheck**

  Run: `pnpm --filter @luyen/frontend test -- src/core/exam/ && pnpm typecheck && pnpm check`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/exam/scoring.ts frontend/src/core/exam/scoring.test.ts frontend/src/core/exam/remediation.ts frontend/src/core/exam/remediation.test.ts frontend/src/components/exam/JlptScoreBreakdown.tsx frontend/src/components/exam/QuickRemediationModal.tsx frontend/src/pages/ExamRunnerPage.tsx
  git commit -m "feat(exam): add JLPT 180-point cutoff simulator and 10-minute remediation deck"
  ```

---

### Task 6: Bổ sung Furigana Kiểm duyệt N4 `1.1.0`, Công tắc Furigana & Sửa `lang="ja"` (FR-32)

**Files:**
- Modify: `frontend/src/core/content/types.ts:69-128`
- Modify: `frontend/src/core/content/validate.ts:89-162`
- Create: `infra/scripts/src/verify-furigana.ts`
- Create: `infra/scripts/src/verify-furigana.test.ts`
- Modify: `infra/scripts/src/packs.ts:71-151`
- Modify: `infra/content/n4/VERSION` (`1.0.0` → `1.1.0`)
- Modify: `infra/content/n4/reading.json` (bổ sung `textRuby` đã kiểm duyệt cho cả 8 bài đọc)
- Modify: `infra/content/n4/grammar.json` (bổ sung `reading` định dạng `{漢字|かんじ}` đã kiểm duyệt cho các ví dụ có Kanji)
- Create: `frontend/src/hooks/useFuriganaPreference.ts`
- Modify: `frontend/src/pages/ReadingDetailPage.tsx:68-140`
- Modify: `frontend/src/pages/GrammarDetailPage.tsx:215-246`
- Modify: `frontend/src/pages/GrammarKeigoPage.tsx:222-237`
- Test: `frontend/src/core/content/validate.test.ts`, `infra/scripts/src/verify-furigana.test.ts`, `tests/web/furigana-and-keigo.spec.ts`

**Interfaces:**
- Consumes: `parseRubyText` (`frontend/src/core/exam/ruby.ts`), `RubyText` (`frontend/src/components/exam/RubyText.tsx`), `db.settings` (`db.ts`).
- Produces:
  - Extended `ReadingPassage.textRuby?: string` (using `{base|reading}` syntax compatible with `RubyText`)
  - `stripRubyToPlain(rubyText: string): string` and `auditFuriganaString(plain: string, ruby: string): string[]` in `infra/scripts/src/verify-furigana.ts`
  - `useFuriganaPreference(level: Level): { showFurigana: boolean; setShowFurigana: (value: boolean) => void }` (default `true` for N5/N4, persisted in `db.settings` key `furigana:${level}`)
  - Built & verified pack `n4/1.1.0` preserving 100% IDs from `n4/1.0.0`.

**Security & QA Gate:** Không tự đoán furigana bằng AI lúc runtime; `stripRubyToPlain(textRuby) === text` đạt 100% cho toàn bộ bài đọc & ví dụ ngữ pháp; `pnpm packs:verify infra/packs/n4/1.0.0` xanh tuyệt đối; `/ngu-phap/$patternId` không thêm mục quiz (`AGENTS.md`); mọi ô tiếng Nhật ở `GrammarKeigoPage` đều có `lang="ja"`.

- [ ] **Step 1: Write failing tests cho `auditFuriganaString`, `validatePack` với `textRuby` và Playwright kiểm Furigana toggle + `lang="ja"`**

```ts
// infra/scripts/src/verify-furigana.test.ts
describe("auditFuriganaString", () => {
  it("passes when stripping ruby matches plain text and all readings are kana", () => {
    expect(auditFuriganaString("図書館で本を読みます。", "{図書館|としょかん}で{本|ほん}を{読|よ}みます。")).toEqual([]);
  });

  it("fails when base text mismatches plain text or reading contains kanji/latin", () => {
    expect(auditFuriganaString("本を読みます", "{本|book}を{読|よ}みます").length).toBeGreaterThan(0);
    expect(auditFuriganaString("本を読みます", "{紙|かみ}を{読|よ}みます").length).toBeGreaterThan(0);
  });
});
```

  Trong `frontend/src/core/content/validate.test.ts`: thêm test chấp nhận `reading[0].textRuby` kiểu chuỗi và từ chối `textRuby: 123`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/infra-scripts test -- verify-furigana && pnpm --filter @luyen/frontend test -- src/core/content/validate.test.ts`
  Expected: FAIL (`verify-furigana.ts` chưa tồn tại, `validate.ts` chưa kiểm `textRuby`).

- [ ] **Step 3: Implement schema update, `verify-furigana.ts`, biên tập N4 `1.1.0` & cập nhật 3 trang UI**

  1. Cập nhật `frontend/src/core/content/types.ts`: thêm `textRuby?: string` vào `ReadingPassage`; cập nhật chú thích `GrammarExample.reading?: string` ghi rõ hỗ trợ chuỗi `{漢字|かんじ}` đã qua kiểm duyệt (không suy diễn runtime).
  2. Cập nhật `frontend/src/core/content/validate.ts`: thêm `hasOptionalStrings(row, "textRuby")` vào `rowChecks.reading`.
  3. Tạo `infra/scripts/src/verify-furigana.ts` xuất `stripRubyToPlain` và `auditFuriganaString` (kiểm khớp chuỗi gốc 100%, không để `{` hay `}` lệch cặp, mọi `<rt>` chỉ gồm Hiragana/Katakana `^[\u3041-\u3096\u30a1-\u30faー・]+$`), gắn vào `verifyPacks` trong `infra/scripts/src/packs.ts`.
  4. Biên tập và đối soát chuẩn từng chữ `textRuby` cho cả `8` bài đọc trong `infra/content/n4/reading.json` và `reading` định dạng `{base|reading}` cho toàn bộ ví dụ có Kanji trong `infra/content/n4/grammar.json`; nâng `infra/content/n4/VERSION` từ `1.0.0` → `1.1.0`.
  5. Chạy `pnpm packs:build` và `pnpm packs:verify infra/packs/n4/1.0.0` (đối chiếu không mất bất kỳ ID nào so với `1.0.0`).
  6. Tạo `frontend/src/hooks/useFuriganaPreference.ts` lưu vào `db.settings`.
  7. Cập nhật `ReadingDetailPage.tsx` (thêm công tắc `Hiện Furigana`, `data-ocid="reading_detail.furigana.switch"`, khi bật và có `passage.textRuby` thì hiển thị `<RubyText text={passage.textRuby} font="serif" as="p" />`) và `GrammarDetailPage.tsx` (thêm công tắc `Hiện Furigana` trên mục `Ví dụ`, hiển thị `<RubyText>` khi `example.reading` chứa `{...|...}`; giữ nguyên tuyệt đối cấu trúc 4 mục chính của trang).
  8. Sửa `frontend/src/pages/GrammarKeigoPage.tsx:227,235`: truyền `true` vào `renderValueOrDash(entry.kenjogoI, true)` và `renderValueOrDash(entry.kenjogoII, true)` để mọi cột kính ngữ đều gắn `lang="ja"`.

- [ ] **Step 4: Run pack build, verification against 1.0.0, unit tests & Playwright E2E**

  Run: `pnpm packs:build && pnpm packs:verify infra/packs/n4/1.0.0 && pnpm --filter @luyen/infra-scripts test && pnpm --filter @luyen/frontend test && pnpm typecheck && pnpm check`
  Expected: PASS 100% kiểm tra SHA-256, đối soát dataset Minna, kiểm định Furigana và tương thích ID với `1.0.0`.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/content/ infra/content/n4/ infra/packs/ frontend/public/packs/ infra/scripts/src/ frontend/src/hooks/useFuriganaPreference.ts frontend/src/pages/ReadingDetailPage.tsx frontend/src/pages/GrammarDetailPage.tsx frontend/src/pages/GrammarKeigoPage.tsx tests/web/furigana-and-keigo.spec.ts
  git commit -m "feat(content): add audited N4 1.1.0 furigana for reading and grammar examples and fix keigo lang=ja"
  ```

---

### Task 7: Tìm kiếm Từ vựng, Lưu Bộ lọc, Lọc Bài Kanji, Mini-drill Ngữ pháp & Ôn `mostMissed` 1 chạm (FR-38)

**Files:**
- Create: `frontend/src/core/grammar/miniDrill.ts`
- Create: `frontend/src/core/grammar/miniDrill.test.ts`
- Create: `frontend/src/components/grammar/MiniDrillPanel.tsx`
- Modify: `frontend/src/pages/VocabularyPage.tsx:51-370`
- Modify: `frontend/src/components/kanji-quiz/quizEngine.ts:33-307`
- Modify: `frontend/src/components/kanji-quiz/QuizStart.tsx:92-191`
- Modify: `frontend/src/pages/KanjiQuizPage.tsx:18-143`
- Modify: `frontend/src/pages/ProgressPage.tsx:295-332`
- Modify: `frontend/src/pages/GrammarConjugationsPage.tsx`
- Modify: `frontend/src/pages/GrammarKeigoPage.tsx`
- Modify: `frontend/src/pages/GrammarVerbPairsPage.tsx`
- Test: `frontend/src/core/grammar/miniDrill.test.ts`, `frontend/src/components/kanji-quiz/quizEngine.test.ts`, `tests/web/study-upgrades.spec.ts`

**Interfaces:**
- Consumes: `normalize` (`frontend/src/components/kanji-library/search.ts`), `GrammarQuiz` (`frontend/src/components/grammar/GrammarQuiz.tsx`), `db.settings` (`db.ts`).
- Produces:
  - `buildConjugationDrill(rules: readonly ConjugationRule[], count?: number): GrammarQuizQuestion[]`, `buildKeigoDrill(entries: readonly KeigoEntry[], count?: number): GrammarQuizQuestion[]`, `buildVerbPairDrill(pairs: readonly VerbPair[], count?: number): GrammarQuizQuestion[]` in `frontend/src/core/grammar/miniDrill.ts`
  - `filterQuizSourceByLesson(pack: QuizSource, lesson: string): QuizSource` and `generateTargetedQuiz(itemIds: readonly string[], pack: QuizSource): QuizQuestion[]` in `frontend/src/components/kanji-quiz/quizEngine.ts`
  - Route search param `/kanji?retryIds=<comma-separated-ids>` launching targeted drill immediately on `KanjiQuizPage`.

**Security & QA Gate:** Validate & cap `retryIds` query param (`<= 50` IDs, chỉ giữ ID thực sự tồn tại trong `pack.kanji`/`pack.compounds`); giữ nguyên bộ đếm `n / total` ở `/tu-vung` và không thêm quiz vào `/ngu-phap/$patternId`.

- [ ] **Step 1: Write failing unit tests cho `miniDrill.ts` và `quizEngine.ts` (lesson filter + targeted `mostMissed`)**

```ts
// frontend/src/core/grammar/miniDrill.test.ts
it("generates 4-choice distinct questions with valid answerIndex for conjugations, keigo and verbPairs", () => {
  const qs = buildVerbPairDrill(sampleVerbPairs, 5);
  expect(qs.length).toBeGreaterThan(0);
  for (const q of qs) {
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.answerIndex).toBeGreaterThanOrEqual(0);
    expect(q.answerIndex).toBeLessThan(4);
  }
});

// frontend/src/components/kanji-quiz/quizEngine.test.ts
it("filters pool by Minna lesson and builds targeted quiz strictly from valid mostMissed IDs", () => {
  const filtered = filterQuizSourceByLesson(pack, "26");
  expect(filtered.kanji.every((k) => k.lessons.includes("26"))).toBe(true);
  const targeted = generateTargetedQuiz(["kanji-K01", "non-existent-id"], pack);
  expect(targeted.map((q) => q.item.id)).toEqual(["kanji-K01"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/core/grammar/miniDrill.test.ts src/components/kanji-quiz/quizEngine.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement search + filter persistence, Kanji sub-tabs + lesson filter + `mostMissed` 1-tap, và 3 mini-drills**

  1. `VocabularyPage.tsx`: thêm ô tìm kiếm nhanh (`data-ocid="vocabulary.search_input"`, dùng `normalize()` tìm trên `word`, `reading`, `hanViet`, `meaning` không phân biệt dấu/katakana); lưu `{ lesson, section, onlyUnknown }` vào `db.settings` khóa `vocabFilter:${manifest.level}` và khôi phục khi quay lại trang; giữ nguyên `data-ocid="vocabulary.position"` định dạng `${safeIndex + 1} / ${deck.length}`.
  2. `quizEngine.ts` + `QuizStart.tsx` + `KanjiQuizPage.tsx`:
     - Thêm thanh tab đầu trang `KanjiQuizPage` và `KanjiLibraryPage` (`Trắc nghiệm` `/kanji` · `Tra cứu Kanji` `/kanji/tra-cuu`) để lối vào tra cứu luôn hiển thị rõ ràng.
     - Thêm bộ lọc `Bài Minna` (`Tất cả bài` hoặc `Bài 26..50`) trên `QuizStart`, cập nhật `poolSize` động.
     - Hỗ trợ đọc `retryIds` từ search params của `/kanji` (cắt tối đa 50 ID hợp lệ có trong `pack`), tự khởi động phiên trắc nghiệm cho đúng các chữ hay sai.
  3. `ProgressPage.tsx:295-332`: thêm nút 1 chạm `"Luyện lại ${mostMissed.length} chữ hay sai"` (`data-ocid="progress.most_missed.practice_button"`, `min-h-11`) dẫn tới `/kanji?retryIds=...`.
  4. Tạo `frontend/src/core/grammar/miniDrill.ts` và `frontend/src/components/grammar/MiniDrillPanel.tsx` (tái sử dụng `GrammarQuiz` trong khung gập gọn `"Luyện nhanh 5 câu"`), gắn vào `GrammarConjugationsPage.tsx`, `GrammarKeigoPage.tsx` và `GrammarVerbPairsPage.tsx`.

- [ ] **Step 4: Run unit tests, typecheck, biome check & Playwright E2E**

  Run: `pnpm --filter @luyen/frontend test && pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/study-upgrades.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/core/grammar/ frontend/src/components/grammar/MiniDrillPanel.tsx frontend/src/pages/VocabularyPage.tsx frontend/src/pages/KanjiQuizPage.tsx frontend/src/pages/KanjiLibraryPage.tsx frontend/src/pages/ProgressPage.tsx frontend/src/pages/GrammarConjugationsPage.tsx frontend/src/pages/GrammarKeigoPage.tsx frontend/src/pages/GrammarVerbPairsPage.tsx frontend/src/components/kanji-quiz/ tests/web/study-upgrades.spec.ts
  git commit -m "feat(study): add vocab search/filter persistence, kanji lesson & most-missed drill, and grammar mini-drills"
  ```

---

### Task 8: Chế độ tối "Sumi đêm" & `MOBILE_TABS` 5 tab mới (FR-39)

**Files:**
- Create: `frontend/src/hooks/useThemePreference.ts`
- Create: `frontend/src/hooks/useThemePreference.test.ts`
- Create: `frontend/public/theme-init.js`
- Modify: `frontend/index.html:1-17`
- Modify: `frontend/src/App.tsx:38-47`
- Modify: `frontend/src/scene/tokens.ts:1-43`
- Modify: `frontend/src/scene/DeskHeroCanvas.tsx:150-247,447-471`
- Modify: `frontend/src/scene/DeskHeroFallback.tsx:1-160`
- Modify: `frontend/src/pages/AccountPage.tsx:27-73`
- Modify: `frontend/src/components/Layout.tsx:38-62,252-279`
- Test: `frontend/src/hooks/useThemePreference.test.ts`, `frontend/src/scene/tokens.test.ts`, `tests/web/theme-and-mobile-nav.spec.ts`

**Interfaces:**
- Consumes: token `.dark` trong `frontend/src/index.css:101-155`, `db.settings` (`db.ts`).
- Produces:
  - `ThemePreference = "light" | "dark" | "system"`, `ResolvedTheme = "light" | "dark"`
  - `useThemePreference(): { preference: ThemePreference; resolved: ResolvedTheme; setPreference: (next: ThemePreference) => void }` in `frontend/src/hooks/useThemePreference.ts`
  - `DARK_SCENE_TOKENS` & `getSceneTokens(theme: ResolvedTheme): SceneTokens` in `frontend/src/scene/tokens.ts`
  - `MOBILE_TABS` 5 mục trong `Layout.tsx`: `Trang chủ` (`/`), `Ôn tập` (menu nhanh Từ vựng / Kanji / Ngữ pháp), `Luyện đề` (menu nhanh Thi thử JLPT `/luyen-de` & Đọc hiểu `/doc-hieu`), `Tra cứu` (`/kanji/tra-cuu`), `Tiến độ` (`/tien-do`).

**Security & QA Gate:** Không chèn `<script>` inline vào `index.html` (giữ chặt CSP `script-src 'self'` từ `SEC-E7-02` bằng tệp `/theme-init.js`); kiểm tương phản WCAG AA trên cả Light và Dark; kiểm `/doc-hieu` và `/luyen-de` mở trong `<= 2` chạm trên viewport `360×800` với nút chạm `>= 44px`.

- [ ] **Step 1: Write failing unit tests cho `useThemePreference`, `getSceneTokens` và Playwright mobile nav + dark mode**

```ts
// frontend/src/hooks/useThemePreference.test.ts
it("resolves system preference via matchMedia and toggles html.dark class without inline eval", () => {
  // Mock matchMedia("(prefers-color-scheme: dark)") = true
  // preference = "system" -> resolved = "dark", document.documentElement.classList.contains("dark") === true
  // setPreference("light") -> resolved = "light", classList.contains("dark") === false
});

// frontend/src/scene/tokens.test.ts
it("returns dark sumi palette distinct from light washi palette and never pure #000000 background", () => {
  const dark = getSceneTokens("dark");
  expect(dark.background).not.toBe("#000000");
  expect(dark.background).not.toBe(SCENE_TOKENS.background);
  expect(dark.deskWood).not.toBe(SCENE_TOKENS.deskWood);
});
```

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/hooks/useThemePreference.test.ts src/scene/tokens.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement Dark Mode "Sumi đêm", 3D/SVG dark tokens & 5-tab `MOBILE_TABS`**

  1. Tạo `frontend/public/theme-init.js` (thuần ES5, đọc `localStorage.getItem("luyen-jlpt:theme")` và `matchMedia("(prefers-color-scheme: dark)")` để gắn class `dark` trước first paint mà tuân thủ tuyệt đối `script-src 'self'`) và nạp `<script src="/theme-init.js"></script>` trong `frontend/index.html`.
  2. Tạo `frontend/src/hooks/useThemePreference.ts`: đồng bộ trạng thái giữa `localStorage` (phục vụ first paint), `db.settings` (`themePreference`), class `html.dark`, và listener `matchMedia`.
  3. Cập nhật `frontend/src/App.tsx:43`: đổi `<Toaster theme="light" ... />` thành `<Toaster theme={resolved} position="top-center" closeButton />`.
  4. Cập nhật `frontend/src/scene/tokens.ts`: thêm `DARK_SCENE_TOKENS` (nền giấy tối mực nghiên `#1D2028`, gỗ bàn tối `#4E3B2B`, chữ ngà `#F0ECE4`, đèn bàn ấm `#FFD7A8`, chàm sáng `#7B9CE2`) và `getSceneTokens(theme)`; cập nhật `DeskHeroCanvas.tsx` (chuyển cường độ ánh sáng đèn bàn ấm và vật liệu khi `theme === "dark"`) và `DeskHeroFallback.tsx`.
  5. Cập nhật `frontend/src/pages/AccountPage.tsx`: trong `MotionSettingsCard`, thêm cụm 3 nút chọn chủ đề `Sáng` / `Tối (Sumi đêm)` / `Theo hệ thống` (`data-ocid="account.theme.<value>.button"`, `min-h-11`).
  6. Cập nhật `frontend/src/components/Layout.tsx:38-62,252-279`:
     - Chốt `MOBILE_TABS` 5 mục: `Trang chủ`, `Ôn tập`, `Luyện đề`, `Tra cứu`, `Tiến độ`.
     - Chạm `Ôn tập` mở bottom popover/sheet gọn gồm 3 nút lớn (`>= 44px`): `Từ vựng` (`/tu-vung`), `Kanji` (`/kanji`), `Ngữ pháp` (`/ngu-phap`); chạm `Luyện đề` mở popover gọn gồm 2 nút lớn: `Đề thi JLPT` (`/luyen-de`) và `Đọc hiểu` (`/doc-hieu`). Cả `/doc-hieu` và `/luyen-de` đạt chuẩn mở trong `<= 2` chạm mà vẫn giữ thanh điều hướng 5 tab gọn gàng.

- [ ] **Step 4: Run unit tests, typecheck, biome check & Playwright E2E**

  Run: `pnpm --filter @luyen/frontend test && pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/theme-and-mobile-nav.spec.ts`
  Expected: PASS trên cả desktop `1280×800` và mobile `360×800`.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/public/theme-init.js frontend/index.html frontend/src/hooks/useThemePreference.ts frontend/src/hooks/useThemePreference.test.ts frontend/src/App.tsx frontend/src/scene/ frontend/src/pages/AccountPage.tsx frontend/src/components/Layout.tsx tests/web/theme-and-mobile-nav.spec.ts
  git commit -m "feat(ui): enable Sumi dark theme across UI/3D/Toaster and 5-tab mobile navigation"
  ```

---

### Task 9: Web PWA Ngoại tuyến Hoàn chỉnh (FR-44, AD-19, `SEC-E7-04`, `SEC-T03`)

**Files:**
- Modify: `frontend/package.json` (add `vite-plugin-pwa` devDependency)
- Modify: `frontend/vite.config.js:1-41`
- Create: `frontend/public/icons/pwa-192.png`
- Create: `frontend/public/icons/pwa-512.png`
- Create: `frontend/src/components/PwaUpdatePrompt.tsx`
- Modify: `frontend/src/App.tsx:38-47`
- Modify: `frontend/index.html:1-17`
- Test: `tests/web/pwa-offline.spec.ts`

**Interfaces:**
- Consumes: `isTauri()` (`@tauri-apps/api/core`), `toast` (`sonner`), `frontend/public/_headers` (Task 1).
- Produces:
  - Generated `frontend/dist/manifest.webmanifest` and `frontend/dist/sw.js` (only registered on Web, skipped on Tauri native builds or runtime `isTauri()`).
  - `<PwaUpdatePrompt />` listening to `virtual:pwa-register/react` and offering 1-tap reload when a new Web version is waiting.

**Security & QA Gate:** `SEC-E7-04`, `SEC-T03`: Workbox bắt buộc đặt `handler: "NetworkOnly"` cho `/^https:\/\/[^/]+\.supabase\.co\//` (tuyệt đối 0 entry Supabase trong Cache Storage); `navigateFallback` giữ nguyên query params trên `/tai-khoan?code=...`; mở lạnh khi offline tải thành công app shell + gói N4 `1.1.0`.

- [ ] **Step 1: Write failing Playwright E2E test `tests/web/pwa-offline.spec.ts` (kèm `SEC-T03`)**

```ts
// tests/web/pwa-offline.spec.ts
test("registers service worker, loads cold offline, preserves /tai-khoan?code= query and caches zero supabase URLs (SEC-T03)", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => Boolean(navigator.serviceWorker.controller)));
  // Verify manifest link present & valid
  // Simulate auth/supabase fetch & verify caches contain ZERO requests matching supabase.co
  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(req.url);
    }
    return urls;
  });
  expect(cachedUrls.some((u) => u.includes("supabase.co"))).toBe(false);
  await context.setOffline(true);
  await page.goto("/tu-vung");
  await expect(page.getByTestId("vocabulary.page").or(page.locator('[data-ocid="vocabulary.page"]'))).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

  Run: `pnpm e2e:web -- tests/web/pwa-offline.spec.ts`
  Expected: FAIL (`navigator.serviceWorker.controller` là `null`).

- [ ] **Step 3: Configure `vite-plugin-pwa`, manifest icons & `<PwaUpdatePrompt />`**

  1. Cài `vite-plugin-pwa` (ghim phiên bản tương thích Vite 8 trong `frontend/package.json`).
  2. Xuất icon `frontend/public/icons/pwa-192.png` và `pwa-512.png` từ `mobile/app-icon.svg`.
  3. Cấu hình `VitePWA` trong `frontend/vite.config.js`:
     - `registerType: "prompt"`, `injectRegister: null` (chỉ đăng ký chủ động trong `PwaUpdatePrompt.tsx` khi `!isTauri()`).
     - `manifest`: `name: "Ôn JLPT N4"`, `short_name: "Ôn JLPT"`, `lang: "vi"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color: "#F9F6F1"`, `theme_color: "#F9F6F1"`, icons `192` & `512` (`any maskable`).
     - `workbox`: `globPatterns: ["**/*.{js,css,html,woff2,ico,png,svg}", "packs/index.json", "packs/n4/1.1.0/*.json"]`, `navigateFallback: "/index.html"`, `navigateFallbackDenylist: [/^\/packs\//]`, `cleanupOutdatedCaches: true`, và **`runtimeCaching` đầu tiên**: `{ urlPattern: /^https:\/\/[^/]+\.supabase\.co\//i, handler: "NetworkOnly" }` (đảm bảo mọi Auth, REST, Edge Function và Signed URL không bao giờ vào Cache Storage).
  4. Tạo `frontend/src/components/PwaUpdatePrompt.tsx`: trả `null` khi `isTauri()`; gọi `useRegisterSW` khi trên Web, hiện toast `"Có bản cập nhật mới cho Web"` với nút `"Tải lại"`. Gắn vào `RootShell` trong `frontend/src/App.tsx`.
  5. Thêm `<link rel="apple-touch-icon" href="/icons/pwa-192.png" />` và `<meta name="theme-color" ... />` (light `#F9F6F1`, dark `#1D2028`) vào `frontend/index.html`.

- [ ] **Step 4: Run build, typecheck, biome check & Playwright PWA offline test**

  Run: `pnpm typecheck && pnpm check && pnpm build && pnpm e2e:web -- tests/web/pwa-offline.spec.ts`
  Expected: PASS (mở lạnh khi offline chạy trơn tru, 0 cache entry `supabase.co`).

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/package.json pnpm-lock.yaml frontend/vite.config.js frontend/public/icons/ frontend/src/components/PwaUpdatePrompt.tsx frontend/src/App.tsx frontend/index.html tests/web/pwa-offline.spec.ts
  git commit -m "feat(pwa): configure offline-first Web PWA with strict NetworkOnly Supabase boundary"
  ```

---

### Task 10: Cập nhật Phiên bản Tại chỗ Windows & Android không cần cài đè (FR-43, AD-19, `SEC-E7-06`, `SEC-T08`)

**Files:**
- Modify: `mobile/scripts/android-release.mjs:22-116`
- Create: `mobile/scripts/patch-android-manifest.mjs`
- Create: `mobile/src-tauri/src/android_updater.rs`
- Modify: `mobile/src-tauri/src/lib.rs:1-15`
- Modify: `mobile/src-tauri/capabilities/android-update.json:1-24`
- Modify: `desktop/src-tauri/Cargo.toml:13-20`
- Modify: `desktop/src-tauri/src/main.rs:1-28`
- Modify: `desktop/src-tauri/capabilities/default.json:7-32`
- Modify: `frontend/package.json` (add `@tauri-apps/plugin-process` pinned to Tauri 2 series)
- Modify: `frontend/src/adapters/native/androidUpdate.ts:1-73`
- Modify: `frontend/src/components/NativeUpdates.tsx:1-99`
- Modify: `frontend/src/pages/AccountPage.tsx` (add `"Phiên bản & Cập nhật"` card on Tauri)
- Modify: `.github/workflows/native.yml:62,193-223`
- Test: `frontend/src/adapters/native/androidUpdate.test.ts`
- Test: `tests/mobile/android-release.test.mjs`

**Interfaces:**
- Consumes: `nativeReleases`, `versionToCode`, `verifyReleaseSigner` (`mobile/scripts/android-release.mjs`), `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` (`relaunch`), `@tauri-apps/api/core` (`invoke`).
- Produces:
  - Extended `android-latest.json` schema: `{ version: string; versionCode: number; url: string; sha256: string; sizeBytes: number }`
  - `availableAndroidUpdate(current: string, metadata: unknown): AndroidUpdate | undefined` (strictly requiring 64-hex `sha256`, `1 <= sizeBytes <= 62_914_560`, exact pinned GitHub release URL, `nextCode > installedCode`)
  - `downloadAndInstallAndroidUpdate(update: AndroidUpdate, onProgress?: (percent: number) => void): Promise<void>` in `frontend/src/adapters/native/androidUpdate.ts` calling Tauri command `install_android_apk`
  - Tauri Android command `install_android_apk(url: String, expected_sha256: String, expected_size_bytes: u64, expected_version_code: u64)` verifying SHA-256 + `packageName == "vn.luyenjlpt.app"` + `versionCode == expected_version_code > installed` + `signingInfo` cert match before invoking `FileProvider` + `ACTION_INSTALL_PACKAGE`.

**Security & QA Gate:** `SEC-E7-06`, `SEC-T08` (6 ca kiểm tra: URL ngoài GitHub, downgrade `versionCode <= installed`, sai 1 byte `sha256`, vượt `sizeBytes`/`60 MB`, sai cert ký, và kiểm manifest `usesCleartextTraffic="false"`, không debuggable, `FileProvider exported="false"`). Windows giữ `requireSignedVersion: true` và chỉ thêm quyền `process:allow-restart`.

- [ ] **Step 1: Write failing tests cho `androidUpdate.ts` và `android-release.mjs` (`SEC-T08`)**

```ts
// frontend/src/adapters/native/androidUpdate.test.ts
it("rejects metadata missing sha256/sizeBytes, oversize > 60MB, downgrade, or unpinned URL (SEC-T08)", () => {
  const valid = {
    version: "0.4.0", versionCode: 4000,
    url: "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v0.4.0/Luyen-JLPT-android.apk",
    sha256: "a".repeat(64), sizeBytes: 24_000_000,
  };
  expect(availableAndroidUpdate("0.3.1", valid)).toEqual(valid);
  expect(availableAndroidUpdate("0.3.1", { ...valid, sha256: "bad" })).toBeUndefined();
  expect(availableAndroidUpdate("0.3.1", { ...valid, sizeBytes: 63_000_000 })).toBeUndefined();
  expect(availableAndroidUpdate("0.4.0", valid)).toBeUndefined();
  expect(availableAndroidUpdate("0.3.1", { ...valid, url: "https://evil.example/app.apk" })).toBeUndefined();
});
```

  Trong `tests/mobile/android-release.test.mjs`, bổ sung test kiểm `createMetadata(config)` vẫn giữ tương thích ngược khi gọi 1 tham số (phục vụ `mobile/scripts/validate-scaffold.mjs:10` và test cũ `android-release.test.mjs:41`), còn `createMetadata(config, apkInfo)` xuất đủ `sha256` + `sizeBytes`, từ chối APK `> 60 MB`, và kiểm `assertApkBadging` từ chối `usesCleartextTraffic="true"` hoặc `application-debuggable`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/native/androidUpdate.test.ts && node --test tests/mobile/android-release.test.mjs`
  Expected: FAIL (`sha256` & `sizeBytes` chưa được kiểm tra/xuất).

- [ ] **Step 3: Implement Windows & Android In-App Seamless Updater**

  1. **Android release metadata (`mobile/scripts/android-release.mjs`):** Giữ `createMetadata(config, apkInfo?)` tương thích ngược khi gọi 1 tham số (`validate-scaffold.mjs:10` chỉ truyền `config` nên vẫn trả `{ version, versionCode, url }`); khi truyền `apkInfo = { sha256, sizeBytes }` (từ lệnh `metadata <signed-release.apk>` đọc file APK đã ký, chặn nếu `sizeBytes > 62_914_560`), xuất `{ version, versionCode, url, sha256, sizeBytes }`. Kiểm `usesCleartextTraffic` không phải `true` trong `assertApkBadging`.
  2. **Android native installer, capability thu gọn & manifest hardening (`mobile/scripts/patch-android-manifest.mjs`, `mobile/src-tauri/src/android_updater.rs`, `mobile/src-tauri/capabilities/android-update.json`):**
     - `mobile/src-tauri/capabilities/android-update.json`: gỡ bỏ hoàn toàn khối `opener:allow-open-url` (vì không còn mở trình duyệt tải APK) và gỡ `https://release-assets.githubusercontent.com/github-production-release-asset/*` khỏi `http:default` (chỉ giữ 2 URL đọc metadata `android-latest.json`), đồng thời cấp quyền invoke lệnh nội bộ `install_android_apk` khi Kotlin/Rust tự tải APK HTTPS an toàn.
     - `patch-android-manifest.mjs` (chạy ngay sau `tauri android init` trong `native.yml`): khai báo `REQUEST_INSTALL_PACKAGES`, `android:usesCleartextTraffic="false"`, `android:networkSecurityConfig="@xml/network_security_config"` (chỉ tin `<certificates src="system" />`), `FileProvider` với `android:authorities="${applicationId}.fileprovider"`, `android:exported="false"`, `android:grantUriPermissions="true"`, `res/xml/file_paths.xml` chỉ mở `<cache-path name="updates" path="updates/" />`, và cài plugin Kotlin `ApkInstallerPlugin.kt`.
     - Kotlin `ApkInstallerPlugin.kt` + Rust `android_updater.rs`: tải thẳng luồng HTTPS vào `context.cacheDir/updates/pending.apk` với kiểm trần byte `min(expectedSizeBytes, 62_914_560)`, phát sự kiện tiến độ `%` về frontend, đóng file rồi tính SHA-256 (xóa file ngay nếu lệch), kiểm `PackageManager.getPackageArchiveInfo(..., GET_SIGNING_CERTIFICATES)` xác minh `packageName == "vn.luyenjlpt.app"`, `longVersionCode == expectedVersionCode > installedVersionCode`, và chứng chỉ ký khớp 100% app đang cài; mở Intent `ACTION_INSTALL_PACKAGE` / `ACTION_VIEW` với `FileProvider.getUriForFile` + `FLAG_GRANT_READ_URI_PERMISSION`. Xóa sạch `cacheDir/updates/*.apk` mỗi lần khởi động app.
  3. **Windows updater (`desktop/src-tauri/`):** Thêm `tauri-plugin-process` vào `Cargo.toml` và `main.rs`; chỉ cấp thêm quyền `"process:allow-restart"` trong `desktop/src-tauri/capabilities/default.json` (giữ `requireSignedVersion: true` trong `tauri.release.conf.example.json`).
  4. **Frontend UI (`androidUpdate.ts`, `NativeUpdates.tsx`, `AccountPage.tsx`):**
     - Cập nhật `NativeUpdates.tsx`:
       - Windows: theo dõi `event.event === "Started" | "Progress" | "Finished"` từ `update.downloadAndInstall(onEvent)` để hiện `%` tải trong toast, sau đó hiện nút `"Khởi động lại để áp dụng"` gọi `relaunch()`.
       - Android: thay `openUrl(update.url)` bằng `downloadAndInstallAndroidUpdate(update, setPercent)` hiển thị tiến độ tải & trạng thái kiểm tra SHA-256 trước khi hệ điều hành bật hộp thoại `"Cập nhật"`.
     - Cập nhật `AccountPage.tsx`: thêm thẻ `"Phiên bản & Cập nhật"` (chỉ hiển thị khi `isTauri()`) hiển thị phiên bản hiện tại (`getVersion()`) và nút `"Kiểm tra cập nhật"` thủ công.
  5. Cập nhật `.github/workflows/native.yml`: ghim `runs-on: windows-2025` (thay `windows-latest`), chạy `node mobile/scripts/patch-android-manifest.mjs` sau `tauri android init`, kiểm `android-latest.json` chứa đủ `sha256` và `sizeBytes`.

- [ ] **Step 4: Run tests, typecheck, Rust check & mobile contract checks**

  Run: `pnpm --filter @luyen/frontend test -- src/adapters/native/androidUpdate.test.ts && node --test tests/mobile/android-release.test.mjs && node mobile/scripts/validate-scaffold.mjs --config-only && pnpm typecheck && pnpm check`
  Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

  ```bash
  git add mobile/scripts/ mobile/src-tauri/ desktop/src-tauri/ frontend/package.json pnpm-lock.yaml frontend/src/adapters/native/ frontend/src/components/NativeUpdates.tsx frontend/src/pages/AccountPage.tsx .github/workflows/native.yml tests/mobile/android-release.test.mjs
  git commit -m "feat(updater): implement verified in-app Android APK installer and Windows progress/relaunch updater"
  ```

---

## Epic 7 Verification Gate (Trước khi mở Epic 8)

- [ ] Chạy trọn bộ kiểm chứng cuối Epic:
  - `pnpm packs:build && pnpm packs:verify infra/packs/n4/1.0.0`
  - `pnpm typecheck && pnpm check && pnpm test`
  - `deno test --allow-env backend/supabase/tests/functions.test.ts`
  - `supabase test db --workdir backend` (bao gồm `progress.test.sql` + `exam_attempts.test.sql`)
  - `pnpm build && pnpm e2e:web`
  - `node --test tests/mobile/android-release.test.mjs && node mobile/scripts/validate-scaffold.mjs`
- [ ] Xác nhận tay trên bản Web deploy: đăng nhập thành công cả 3 cách (Email, Tên đăng nhập, Google), nộp Phần 1 đề thi hiện ngay lời giải + đồng bộ sang thiết bị khác để làm tiếp Phần 2–3, làm lại Lần 2 giữ riêng điểm Lần 1, và Web PWA mở lạnh khi tắt mạng.
