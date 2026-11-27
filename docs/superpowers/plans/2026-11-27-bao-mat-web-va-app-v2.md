---
title: "Kiểm toán Bảo mật & Yêu cầu Kiểm soát Web + App v2 (Epic 7–12)"
type: security-audit-and-controls
parent: docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md
status: ready-for-epic-integration
created: 2026-11-27
scope: "Web (Cloudflare Workers + PWA), Tauri 2 Desktop (Windows/macOS/Linux), Mobile (Android/iOS), Supabase (Auth, Postgres RLS, Private Storage, Edge Functions), Data & CI/CD Supply Chain"
methodology: "Read-only source audit (sharp-edges + differential-review)"
---

# Kiểm toán Bảo mật & Kiểm soát Bắt buộc: Web + App v2

Tài liệu này là kết quả kiểm toán mã nguồn chỉ đọc toàn bộ dự án `Luyen_JLPTN4` tính đến commit `5706275` (`v0.3.1`), đối chiếu trực tiếp với phạm vi mở rộng v2 (`FR-27..FR-46`, `AD-13..AD-19`, **Epic 7–12**). Mọi phát hiện đều gắn đường dẫn tệp và số dòng cụ thể.

> **Đánh giá nền v1 (Baseline):** Nền v1 được thiết kế chặt ở nhiều điểm trọng yếu: schema `jlpt_private` khóa quyền truy cập, RLS kiểm tra `jlpt_private.has_confirmed_email()` theo dữ liệu sống trong `auth.users`, `GRANT` theo cột chặn client ghi `server_updated_at`, không có `dangerouslySetInnerHTML`/`eval`, và GitHub Actions đã ghim 40 ký tự commit SHA. Rủi ro thực tế tập trung ở **lỗi cấu hình/triển khai Web (`FR-46`)**, **thiếu HTTP security headers trên Web**, **mở rộng bề mặt mới ở v2** (In-App Android APK Updater, bucket riêng tư `audio-packs`, bảng `exam_attempts` cập nhật từng phần, KanjiVG SVG, Import/Export Anki, Deep-Link đa host và cửa sổ Desktop Quick Lookup).

---

## 1. Ma trận Mô hình Đe dọa (Threat Model Matrix)

Giả định 3 nhóm đối tượng (theo `sharp-edges`): **(A) Kẻ tấn công ngoài mạng/cùng thiết bị** (MITM Wi-Fi, app độc hại trên Android, gửi payload giả tới Supabase REST/Edge Function), **(B) Người dùng hợp lệ cố tình lạm dụng hoặc lỗi đồng bộ** (replay, ghi đè điểm đề thi, spam dung lượng Free Tier), và **(C) Lỗi cấu hình/quên bước khi phát hành** (build Web thiếu env, deploy Edge Function quên `--no-verify-jwt`, lộ quyền capability).

| ID | Bề mặt | Kịch bản tấn công / Lỗi thực tế | Phân loại | Mức rủi ro | Biện pháp kiểm soát bắt buộc | Epic sở hữu |
| --- | --- | --- | --- | --- | --- | --- |
| **TM-01** | Web Deploy & Auth (`FR-46`) | Build Web thiếu `VITE_SUPABASE_PUBLISHABLE_KEY`, Edge Function `resolve-login` chạy với `verify_jwt=true`, hoặc sai Redirect URL làm gãy đăng nhập Web; lỗi bị nuốt thành thông báo sai mật khẩu. | Availability / Auth | **Critical** | Kiểm định env lúc build Web, ghim `verify_jwt = false` khi deploy, tách mã lỗi vận hành khỏi lỗi sai mật khẩu (vẫn chống dò tài khoản). | Epic 7 |
| **TM-02** | Web Origin & Dexie Token | Token Supabase (`access_token`, `refresh_token`) lưu trong IndexedDB (`db.settings`); Web Cloudflare Workers hiện có **0 header bảo mật** (`_headers` không tồn tại). Bất kỳ XSS nào đều đọc trực tiếp `refresh_token`. | Elevation / Session Theft | **Critical** | Bổ sung `frontend/public/_headers` với CSP chặt, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `HSTS`; tuyệt đối không dùng `dangerouslySetInnerHTML`. | Epic 7 |
| **TM-03** | PWA Service Worker (`FR-44`) | Workbox lỡ cache phản hồi `/auth/v1/*`, `/rest/v1/*`, `/functions/v1/*` hoặc Signed URL `/storage/v1/object/sign/*` chứa `?token=`, gây lộ phiên giữa tài khoản trên máy dùng chung hoặc đóng băng dữ liệu cũ. | Info Disclosure / Spoofing | **High** | Ép chiến lược `NetworkOnly` cho mọi đường dẫn Supabase Auth/REST/Functions/Storage Signed URL; `navigateFallbackDenylist` cho callback auth; xóa cache khi đổi/xóa tài khoản. | Epic 7 |
| **TM-04** | In-App Android APK Updater (`FR-43`, `AD-19`) | Tải APK trong app mà không kiểm `sha256` + `sizeBytes` + chữ ký cert khớp bản đang cài, tải ra `/sdcard` (TOCTOU bị app khác tráo file), hoặc cho phép cleartext HTTP/downgrade. | Supply Chain / Tampering | **Critical** | Bổ sung `sha256` + `sizeBytes` (+ chữ ký Ed25519 trên `android-latest.json`), tải vào `cacheDir/updates/` (`0600`), kiểm `packageName` + `versionCode > installed` + `signingInfo` trước `FileProvider` (`FLAG_GRANT_READ_URI_PERMISSION`), khóa `usesCleartextTraffic="false"`. | Epic 7 |
| **TM-05** | Postgres `exam_attempts` (`FR-27`, `AD-14`) | Client gửi bản cập nhật đảo ngược phần thi đã nộp (`submitted → pending`), sửa đề đã `completed`, tạo nhiều lượt `in_progress` song song, hoặc nhồi JSON `answers` hàng chục MB đánh sập DB. | Tampering / DoS | **High** | Trigger `BEFORE UPDATE` đơn điệu theo từng `section` và bất biến khi `completed`; partial unique index tối đa 1 `in_progress` mỗi `(user_id, level, exam_id)`; CHECK `octet_length(answers::text) <= 65536`, `total_questions 1..1000`. | Epic 7 |
| **TM-06** | Supabase Private Storage `audio-packs` (`FR-28`) | Đặt nhầm bucket `public = true` làm lộ audio Choukai bản quyền ra công khai; mở policy ghi cho `authenticated` cho phép người dùng ghi đè gói audio của mọi người; Signed URL sống quá lâu bị chia sẻ ngoài nhóm kín. | Info Disclosure / Tampering | **High** | `public = false`; chỉ cấp `SELECT` qua RLS (`has_confirmed_email()`), 0 quyền `INSERT/UPDATE/DELETE` cho `authenticated`; phát Signed URL TTL `<= 300s` qua Edge Function có rate-limit (`30 req/giờ/user`). | Epic 9 |
| **TM-07** | Tauri 2 CSP (`AD-15`, `AD-16`) | Mở rộng CSP bằng wildcard (`media-src *`, `connect-src https://*`, `'unsafe-eval'`) để phát audio hoặc chạy WASM làm mất hàng rào chống XSS/exfiltration. | XSS / Exfiltration | **High** | Chốt `media-src 'self' blob: https://<ref>.supabase.co`, `worker-src 'self'`, ghim đúng project ref trong `connect-src` khi build release (thay `*.supabase.co`), tuyệt đối không dùng `'unsafe-eval'`. | Epic 9, Epic 12 |
| **TM-08** | Dữ liệu cục bộ sau khi xóa tài khoản | `progressStore.purgeOwner()` hiện bỏ sót `db.examAttempts` (và nếu không cập nhật sẽ bỏ sót bảng Dexie v4), để lại dữ liệu cá nhân trên máy sau khi bấm "Xoá tài khoản". | Privacy / Residual Data | **High** | Mở rộng `purgeOwner()` xóa đồng bộ toàn bộ bảng gắn `owner` trong một transaction Dexie v4 (`progress`, `examAttempts`, `activeExamDrafts`, `srsCards`, `srsReviews`, `notebooks`, `notebookItems`, `userMnemonics`). | Epic 7, Epic 8, Epic 11 |
| **TM-09** | FSRS, Sổ tay & Mẹo nhớ (`FR-30`, `FR-33`, `FR-36`) | Người dùng A chèn `notebook_items` vào `notebook_id` của người dùng B (IDOR); hoặc spam hàng trăm nghìn dòng làm cạn hạn mức 500 MB Supabase Free Tier. | IDOR / DoS | **High** | Khóa ngoại kép `(user_id, notebook_id) REFERENCES notebooks(user_id, id)` chặn IDOR ở tầng DB; bật RLS + `has_confirmed_email()`; CHECK độ dài chuỗi (`<= 1000` ký tự), giới hạn bản ghi/user và batch `<= 100`. | Epic 8, Epic 10, Epic 11 |
| **TM-10** | KanjiVG SVG & Nội dung nạp ngoài (`FR-33`) | Render trực tiếp tệp SVG KanjiVG bằng `dangerouslySetInnerHTML` đưa `<script>`, `onload`, `<foreignObject>`, hoặc `<use>` vào DOM, đánh cắp token trong Dexie. | Stored/Pack XSS | **Critical** | Biên dịch KanjiVG thành JSON thuần chứa danh sách path `d` đã lọc regex tại `infra/scripts/`; frontend render bằng React `<svg><path d={...} /></svg>`, cấm hoàn toàn `innerHTML`/`dangerouslySetInnerHTML`. | Epic 10 |
| **TM-11** | Xuất/Nhập Anki `.csv`/`.tsv`/`.json` (`FR-36`) | Ô dữ liệu bắt đầu bằng `=`, `+`, `-`, `@` chạy công thức độc hại khi mở bằng Excel/Calc (CSV Formula Injection); tệp JSON import chứa khóa `__proto__`/`constructor` gây Prototype Pollution hoặc file lớn gây treo trình duyệt. | Injection / DoS | **High** | Trung hòa ký tự đầu công thức khi xuất CSV/TSV; hàm `safeJsonParse` loại bỏ `__proto__`/`constructor`/`prototype`; giới hạn tệp import `<= 5 MB`, `<= 5.000` dòng, `<= 1.000` ký tự/ô; strip HTML thay vì render thô. | Epic 11 |
| **TM-12** | Deep-Link đa host, Android Intent & Quick Lookup (`FR-42`, `AD-17`) | App khác gửi Intent `ACTION_PROCESS_TEXT` chứa 5 MB rác hoặc URL giả `luyenjlpt://auth-callback?...` làm rối luồng đăng nhập; cửa sổ `quick-lookup` dùng chung `main-capability` thừa quyền `updater`/`opener`; đọc clipboard tự động làm lộ mật khẩu/OTP. | Privilege Escalation / Privacy | **High** | Tách `deepLinkDispatcher` theo đúng `host` (`auth-callback` vs `lookup`); sanitize & cắt `<= 120` ký tự ở native Kotlin trước khi `Uri.encode`; capability riêng ít quyền nhất cho `quick-lookup`; đọc clipboard chỉ khi người dùng nhấn phím tắt (opt-in) và không lưu log/DB. | Epic 12 |
| **TM-13** | Edge Function CORS & Rate-Limit Global DoS | `http.ts` đặt `Access-Control-Allow-Origin: *` cho `resolve-login` và `delete-account`; kẻ xấu gửi 120 username ngẫu nhiên làm cạn bucket toàn cục (`bucket = ''`) trong 5 phút, khóa đăng nhập username của mọi người dùng. | CORS / Availability | **Medium** | Thu hẹp CORS theo danh sách origin được phép (Web domain + Tauri origins); tách hoặc nới bucket toàn cục kết hợp giới hạn theo IP/subnet tại Edge/Cloudflare; log cảnh báo khi chạm ngưỡng 429. | Epic 7 |
| **TM-14** | CI/CD & Chuỗi cung ứng gói | Thiếu workflow deploy Web (dễ đẩy nhầm bản `dist` rỗng env); `native.yml` dùng `windows-latest` trôi nổi và `brew install xcodegen` chưa ghim bản; thiếu bước quét lỗ hổng phụ thuộc (`pnpm audit`, `cargo audit`). | Supply Chain | **Medium** | Thêm workflow `web-deploy.yml` có bước `validate-web-env.mjs` + kiểm tra `_headers`; ghim runner Windows cố định; duy trì tách biệt `native-signing` / `native-publish`; chạy `pnpm audit --prod` và kiểm chứng `usesCleartextTraffic="false"` trong CI. | Epic 7, Epic 12 |

---

## 2. Phát hiện Cụ thể trong Mã nguồn (Concrete Codebase Findings)

### 2.1 Nhóm Web & Xác thực (Auth)

1. **`[CRITICAL]` Bản build Web cục bộ không nhúng Supabase env và không có rào chắn kiểm tra trước deploy**
   - **Bằng chứng:** `frontend/src/adapters/auth/client.ts:26-30,87-98`, `wrangler.toml:5-7`, `frontend/dist/assets/index-*.js` (kiểm tra tĩnh không chứa chuỗi `supabase.co`).
   - **Phân tích:** `client.ts:27` đọc đúng tên biến `VITE_SUPABASE_PUBLISHABLE_KEY` (không đọc `VITE_SUPABASE_ANON_KEY`). Trong khi `native.yml:83,188` có chạy `infra/scripts/src/validate-native-env.mjs`, quy trình deploy Web qua `wrangler.toml` hoàn toàn không có script hay workflow kiểm tra env trước `wrangler deploy`. Nếu build thiếu 1 trong 2 biến, `supabase` âm thầm bằng `null` và `AccountPage.tsx:182-186` khóa luôn form đăng nhập. Ngoài ra, nếu `VITE_SUPABASE_URL` chứa khoảng trắng hoặc thiếu scheme `https://`, lệnh `new URL(url)` tại `client.ts:29` ném ngoại lệ ở top-level module khiến toàn bộ ứng dụng trắng trang.
   - **Khắc phục:** Viết `infra/scripts/src/validate-web-env.mjs` (kiểm tra `VITE_SUPABASE_URL` chuẩn HTTPS, `VITE_SUPABASE_PUBLISHABLE_KEY` là `sb_publishable_*` hoặc JWT `role: "anon"`, tuyệt đối chặn `service_role`), bọc `new URL(url.trim())` an toàn trong `client.ts`, và chạy bắt buộc trong CI Web deploy.

2. **`[HIGH]` Nuốt lỗi đăng nhập & OAuth khiến không chẩn đoán được nguyên nhân thật**
   - **Bằng chứng:** `frontend/src/adapters/auth/client.ts:185-206`, `frontend/src/pages/AccountPage.tsx:91-106,163-167`.
   - **Phân tích:** Trong `client.ts:193,198-204`, mọi lỗi khi đăng nhập bằng email hay username đều bị ép thành `new Error(LOGIN_ERROR)` (`"Tên đăng nhập, email hoặc mật khẩu không đúng."`). Trong `AccountPage.tsx:101-102`, khối `catch {}` không phân loại lỗi. Hệ quả là lỗi mạng, lỗi CORS, Edge Function `resolve-login` trả `401/404/503`, chạm giới hạn `429`, hoặc tài khoản chưa xác nhận email (`email_not_confirmed`) đều hiện y hệt "sai mật khẩu".
   - **Khắc phục:** Giữ nguyên chống dò tài khoản (sai mật khẩu và không tồn tại email/username vẫn trả chung `LOGIN_ERROR`), nhưng tách rõ các lỗi hạ tầng/trạng thái: `offline`/lỗi mạng, `429` quá nhiều lượt thử, `503`/lỗi dịch vụ `resolve-login`, và `email_not_confirmed` (kèm hướng dẫn kiểm tra hộp thư xác nhận).

3. **`[HIGH]` `resolve-login` dùng CORS `*`, rủi ro lệch cờ `verify_jwt` khi deploy, và DoS bucket toàn cục**
   - **Bằng chứng:** `backend/supabase/functions/_shared/http.ts:3-9`, `backend/supabase/config.toml:49-53`, `backend/supabase/migrations/20261122000200_username_login.sql:22-32`.
   - **Phân tích:**
     - `http.ts:4` đặt `"access-control-allow-origin": "*"` cho cả `resolve-login` lẫn `delete-account`.
     - `config.toml:50,53` đặt `verify_jwt = false`, nhưng nếu lệnh deploy thủ công `supabase functions deploy resolve-login` chạy thiếu cờ `--no-verify-jwt`, Gateway Supabase sẽ chặn yêu cầu đăng nhập username ở tầng ngoài bằng `401 Invalid JWT`, đặc biệt chắc chắn xảy ra nếu client dùng khóa mới dạng `sb_publishable_*` (không phải JWT) như `validate-native-env.mjs:5` đã cho phép!
     - `20261122000200_username_login.sql:29` khóa cứng `global_bucket.attempts >= 120` trong cửa sổ 5 phút cho toàn hệ thống. Kẻ tấn công chỉ cần gửi 120 request với tên đăng nhập ngẫu nhiên là vô hiệu hóa đăng nhập bằng username của tất cả người dùng trong 5 phút.
   - **Khắc phục:** Chuyển `http.ts` sang kiểm tra `Origin` theo allowlist cấu hình qua biến môi trường `ALLOWED_ORIGINS` (kèm `Vary: Origin`); ghim quy trình deploy Edge Functions luôn kiểm tra `verify_jwt = false` bằng bài test smoke; kết hợp Cloudflare WAF / IP rate-limit phía trước và tách thông báo `429` rõ ràng.

4. **`[HIGH]` Hoàn toàn thiếu HTTP Security Headers và Web CSP trên Cloudflare Workers**
   - **Bằng chứng:** `wrangler.toml:1-7`, `frontend/index.html:1-17`, không tồn tại tệp `frontend/public/_headers`.
   - **Phân tích:** `client.ts:7-24` lưu cả `access_token` và `refresh_token` trong IndexedDB (`db.settings`, khóa `auth:sb-*-auth-token`). Trên Desktop/Mobile đã có Tauri CSP bảo vệ lớp vỏ, nhưng bản Web deploy trên Cloudflare Workers hiện không gửi bất kỳ header phòng vệ nào (`CSP`, `HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). Nếu phát sinh XSS ở v2, toàn bộ phiên tài khoản bị đánh cắp ngay lập tức.
   - **Khắc phục:** Tạo `frontend/public/_headers` (Cloudflare Workers Static Assets hỗ trợ trực tiếp `_headers`) với CSP chặt khớp đúng origin Supabase, chặn framing (`frame-ancestors 'none'`), tắt MIME sniffing (`nosniff`), đặt `Referrer-Policy: strict-origin-when-cross-origin` (tránh rò query `?code=` sang trang ngoài), và kiểm chứng header này trong Web E2E.

5. **`[MEDIUM]` `parseWebAuthCallback` nhạy cảm với dấu `/` cuối đường dẫn và thiếu kiểm tra độ bền JSON lưu trữ**
   - **Bằng chứng:** `frontend/src/adapters/auth/client.ts:15,49,80-85,104-105,154,163`.
   - **Phân tích:**
     - `client.ts:49` so sánh cứng `parsed.pathname !== "/tai-khoan"`. Nếu redirect trả về `/tai-khoan/` hoặc rơi về `/` (do thiếu Redirect URL trên Dashboard Supabase), callback bị bỏ qua hoàn toàn mà không báo lỗi.
     - `client.ts:15,154,163` gọi `JSON.parse(value)` trực tiếp không bọc `try/catch`; nếu mục `auth:sb-*-auth-token` trong IndexedDB bị hỏng cục bộ, `setItem`/`clearDeletedSession` sẽ throw.
     - `client.ts:105` truyền `{ flowId: callback.flowId }` kể cả khi `callback.flowId === undefined` (luồng Web vì `L95` chỉ bật `appendPkceFlowIdToRedirects` trên Tauri). Cần đảm bảo chỉ truyền `options` khi `callback.flowId` thực sự là chuỗi không rỗng để tránh hành vi lệch giữa các phiên bản `@supabase/supabase-js`.

6. **`[HIGH]` `progressStore.purgeOwner` bỏ sót `db.examAttempts` khi xóa tài khoản**
   - **Bằng chứng:** `frontend/src/adapters/local-store/progress.ts:167-185`, `frontend/src/adapters/local-store/db.ts:40-43`.
   - **Phân tích:** `purgeOwner(owner)` chỉ mở transaction trên `progress`, `progressOutbox`, `progressCursors`, `settings`. Bảng `examAttempts` thêm ở Dexie v3 không bị xóa khi người dùng xóa tài khoản ở `AccountPage.tsx:252`. Khi lên Dexie v4 (Epic 7–11), lỗi này sẽ lan sang `srsCards`, `srsReviews`, `notebooks`, `notebookItems`, `userMnemonics`, `activeExamDrafts` nếu không gom sạch về một hàm dọn chủ sở hữu duy nhất.

### 2.2 Nhóm Supabase Postgres & Private Storage

7. **`[HIGH]` Chưa có schema bảo vệ server-side cho `exam_attempts` (`FR-27`)**
   - **Bằng chứng:** `backend/supabase/migrations/20261122000100_profiles_and_progress.sql:53-188`, `frontend/src/adapters/local-store/exams.ts:45-119`.
   - **Phân tích:** Hiện `exam_attempts` mới chỉ nằm ở Dexie v3, và hàm `validateAttemptRecord` (`exams.ts:87`) đang ép cả 3 phần đều phải nằm trong `FINAL_STATUSES`. Khi nâng cấp sang đồng bộ từng phần (`status: 'in_progress' | 'completed'`) và làm lại nhiều lần, nếu chỉ dùng LWW theo `client_updated_at` như `card_status`:
     - Thiết bị A nộp xong Phần 1 (`submitted`), thiết bị B đang offline ở trạng thái `pending` sau đó đồng bộ lên với đồng hồ chạy nhanh hơn có thể **ghi đè xóa sạch Phần 1 đã chấm**.
     - Client độc hại có thể sửa lại đáp án của lượt thi đã `completed` hoặc nhồi payload JSON `answers` hàng chục MB.
     - Hàm trigger cũ `jlpt_private.apply_progress_write()` (`20261122000100:115-139`) đọc trực tiếp `new.item_id` và `new.level`, sẽ lỗi ngay nếu gắn thẳng cho bảng không có cột `item_id` như `exam_attempts` hoặc `notebooks`.
   - **Khắc phục:** Viết trigger riêng `jlpt_private.apply_exam_attempt_write()` kiểm tra tiến độ đơn điệu theo từng `section`, khóa bất biến khi `old.status = 'completed'`, đặt partial unique index tối đa 1 `in_progress` cho mỗi `(user_id, level, exam_id)`, và bổ sung đầy đủ CHECK kích thước JSON (`<= 65536` bytes cho `answers`, `<= 16384` bytes cho `sections`).

8. **`[HIGH]` Thiếu kiến trúc RLS & cấp phát Signed URL cho bucket riêng tư `audio-packs` (`FR-28`)**
   - **Bằng chứng:** `backend/supabase/config.toml:1-53` (chưa khai báo Storage bucket và policy).
   - **Phân tích:** Gói audio Choukai (nén Opus từ 145,4 MB nguồn) chứa tài liệu bản quyền chỉ dành cho nhóm kín đã đăng nhập và xác nhận email. Nếu mở nhầm `public = true`, cấp quyền ghi cho `authenticated`, hoặc ký URL sống dài ngày không có giới hạn tốc độ, sẽ vừa lộ tài liệu bản quyền vừa phát sinh nguy cơ bơm file độc hại hoặc cạn băng thông egress.
   - **Khắc phục:** Tạo bucket `audio-packs` (`public = false`) trong migration; bật RLS `storage.objects` chỉ cho phép `SELECT` khi `jlpt_private.has_confirmed_email()` đúng và đường dẫn khớp regex an toàn; phát Signed URL TTL `<= 300s` qua Edge Function `sign-audio-pack` có kiểm tra JWT thật + `has_confirmed_email()` + rate-limit `30 req/giờ/user` trong `jlpt_private`.

### 2.3 Nhóm Tauri 2 Desktop & Android/iOS

9. **`[CRITICAL]` Chuỗi cập nhật Android (`FR-43`) thiếu kiểm chứng toàn vẹn `sha256`, `sizeBytes` và chữ ký chứng chỉ trước khi cài trong app**
   - **Bằng chứng:** `mobile/scripts/android-release.mjs:22-28`, `frontend/src/adapters/native/androidUpdate.ts:6,20-43`, `frontend/src/components/NativeUpdates.tsx:50-67`, `mobile/src-tauri/capabilities/android-update.json:9-16`.
   - **Phân tích:**
     - `android-latest.json` hiện chỉ có `{ version, versionCode, url }`, chưa có `sha256` và `sizeBytes`.
     - `android-update.json:14` cho phép `tauri-plugin-http` tải từ `https://release-assets.githubusercontent.com/github-production-release-asset/*` (chấp nhận mọi asset trên host CDN chung của GitHub).
     - Khi chuyển từ `openUrl()` sang tải ngầm + gọi `ACTION_INSTALL_PACKAGE` trong app, thiếu kiểm SHA-256 trên byte tải xong, thiếu kiểm `signingInfo` khớp chứng chỉ đang cài, hoặc thiếu `android:usesCleartextTraffic="false"` sẽ biến updater thành lỗ hổng thực thi mã từ xa/tráo APK (MITM hoặc TOCTOU).
   - **Khắc phục:** Bắt buộc bổ sung `sha256` + `sizeBytes` (và khuyến nghị mạnh chữ ký Ed25519 dùng cùng cặp khóa updater CI) vào `android-latest.json`; tải vào `cacheDir/updates/` nội bộ; kiểm SHA-256 + `sizeBytes <= 60 MB` + `packageName === "vn.luyenjlpt.app"` + `versionCode === nextCode > installedCode` + chứng chỉ ký APK khớp app đang chạy; chỉ chia sẻ qua `FileProvider` (`exported="false"`, `FLAG_GRANT_READ_URI_PERMISSION`); khóa `usesCleartextTraffic="false"` + `network_security_config.xml` chỉ tin CA hệ thống.

10. **`[HIGH]` CSP Tauri Desktop/Mobile quá rộng ở `connect-src` và chưa sẵn sàng cho `media-src` / Web Worker**
    - **Bằng chứng:** `desktop/src-tauri/tauri.conf.json:26-27`, `mobile/src-tauri/tauri.conf.json:13`.
    - **Phân tích:**
      - Cả Desktop và Mobile đều đặt `connect-src ... https://*.supabase.co` (Mobile thêm `wss://*.supabase.co` dù ứng dụng không dùng Realtime WebSocket). Ký tự đại diện `*.supabase.co` cho phép kết nối tới bất kỳ dự án Supabase nào của kẻ tấn công nếu có XSS.
      - Thiếu `media-src`, khiến `<audio>` phát Blob cục bộ (`blob:`) hoặc Signed URL cho `FR-28`/`FR-31` bị chặn bởi `default-src 'self'`.
    - **Khắc phục:** Trong bản release (`native.yml`), tiêm đúng project ref `https://<20-char-ref>.supabase.co` vào `connect-src` và `media-src` (kèm `media-src 'self' blob:`), xóa `wss://*.supabase.co` nếu không dùng Realtime, khai báo `worker-src 'self'` cho Web Worker đóng gói cục bộ, và chỉ thêm `'wasm-unsafe-eval'` ở Epic 12 nếu WebView thật yêu cầu (tuyệt đối không dùng `'unsafe-eval'`).

11. **`[HIGH]` Deep-link chưa tách theo `host` và thiếu thiết kế cô lập quyền cho Quick Lookup / Android Intent (`FR-42`)**
    - **Bằng chứng:** `mobile/src-tauri/tauri.conf.json:34-38`, `desktop/src-tauri/tauri.conf.json:45-49`, `frontend/src/App.tsx:188-211`, `desktop/src-tauri/capabilities/default.json:5-32`.
    - **Phân tích:**
      - `mobile/src-tauri/tauri.conf.json:36` mới chỉ đăng ký `host: "auth-callback"`; `App.tsx:188` gắn trực tiếp `listenForNativeAuth` vào `onOpenUrl`. Nếu thêm `luyenjlpt://lookup?q=...` mà không tách dispatcher theo `host`, link tra từ có thể kích hoạt nhầm luồng auth hoặc làm rò tham số auth vào lịch sử tìm kiếm.
      - `desktop/src-tauri/capabilities/default.json:5` đang gán quyền `updater`, `opener`, `deep-link` cho `"windows": ["main"]`. Nếu gắn cửa sổ phụ `"quick-lookup"` vào chung capability này sẽ vi phạm nguyên tắc ít quyền nhất.
    - **Khắc phục:** Tách `deepLinkDispatcher.ts` định tuyến nghiêm ngặt theo `host`; trên Android chỉ nhận `text/plain` từ `ACTION_PROCESS_TEXT`/`ACTION_SEND`, lọc ký tự điều khiển, cắt `<= 120` ký tự rồi `Uri.encode()`; tạo capability riêng `desktop/src-tauri/capabilities/quick-lookup.json` không có `updater`/`opener`/`fs`/`http`.

### 2.4 Nhóm Dữ liệu & Chuỗi cung ứng CI/CD

12. **`[HIGH]` `examSource.ts` thiếu timeout & giới hạn dung lượng response; nguy cơ Prototype Pollution ở JSON động**
    - **Bằng chứng:** `frontend/src/adapters/content-pack/examSource.ts:56,64,108,116`, `frontend/src/adapters/local-store/exams.ts:108`.
    - **Phân tích:** Trong khi `packTransport.ts:16-18,54-95` giới hạn 30 giây và 1 MB/16 MB, `examSource.ts` gọi `fetch()` trực tiếp rồi `response.arrayBuffer()` / `response.json()` không có `AbortSignal` và không có trần dung lượng. Ngoài ra, `validate.ts` đã kiểm `Object.getPrototypeOf`, nhưng chưa chặn khóa `"__proto__"`, `"constructor"`, `"prototype"` xuất hiện dưới dạng own property trong các bản đồ động (`answers`, JSON import Sổ tay, gói từ điển mở rộng).
    - **Khắc phục:** Đưa `examSource.ts` và `ExtensionPackStore` dùng chung hàm tải có `AbortSignal` + trần byte + kiểm SHA-256 trên byte thô trước khi giải nén/parse; bổ sung `safeJsonParse()` lọc bỏ khóa nguy hiểm và giới hạn độ sâu lồng nhau `<= 16`.

13. **`[MEDIUM]` Khoảng trống nhỏ trong `.github/workflows/native.yml` và thiếu CI Web deploy**
    - **Bằng chứng:** `.github/workflows/native.yml:62,360`, `.github/workflows/ci.yml:1-54`.
    - **Phân tích:** Pin SHA của toàn bộ Action và cơ chế tách môi trường `native-signing`/`native-publish`, `umask 077` + `trap rm` keystore (`mobile/scripts/package-release.sh:8-12`) đều rất tốt. Tuy nhiên `native.yml:62` đang dùng `windows-latest` thay vì phiên bản cố định (`windows-2025`), dòng `360` gọi `brew install xcodegen` không ghim bản, chưa có `pnpm audit`/`cargo audit`, và chưa có workflow deploy Web.

---

## 3. Danh sách Kiểm tra Nguyên nhân Gốc Lỗi Đăng nhập Web (`FR-46`)

Khi điều tra lỗi **"không đăng nhập được trên bản Web deploy"** ở đầu Epic 7, thực hiện đúng thứ tự 6 giả thuyết từ xác suất cao nhất xuống thấp nhất. Không đoán mò: mỗi giả thuyết có phép kiểm tra cụ thể trả lời Có/Không trong 2 phút.

| Thứ tự | Giả thuyết nguyên nhân gốc | Vị trí mã nguồn / Cấu hình liên quan | Cách kiểm tra tức thì (Evidence Check) | Cách sửa dứt điểm |
| --- | --- | --- | --- | --- |
| **H1 (Khả năng cao nhất)** | **Build Web deploy thiếu `VITE_SUPABASE_URL` hoặc dùng nhầm tên `VITE_SUPABASE_ANON_KEY` thay cho `VITE_SUPABASE_PUBLISHABLE_KEY`** | `frontend/src/adapters/auth/client.ts:26-27,87-98`, `wrangler.toml:6`, `frontend/dist/assets/index-*.js` (hiện xác nhận thiếu `supabase.co`) | Mở `/tai-khoan` trên bản Web deploy: nếu thấy dòng *"Bản này chưa cấu hình dịch vụ tài khoản"* hoặc kiểm DevTools → Sources tìm `supabase.co` không có kết quả → **khớp 100% H1**. | Đặt đủ 2 biến lúc build Web, thêm `infra/scripts/src/validate-web-env.mjs` và workflow `web-deploy.yml` chặn deploy nếu thiếu env. |
| **H2 (Rất cao với đăng nhập Username)** | **Edge Function `resolve-login` chưa deploy lên project Supabase production, hoặc bị deploy thiếu `--no-verify-jwt`** | `backend/supabase/config.toml:49-50`, `backend/supabase/functions/resolve-login/index.ts`, `frontend/src/adapters/auth/client.ts:195-199` | Mở DevTools → Network, thử đăng nhập bằng username. Xem request `POST /functions/v1/resolve-login`: nếu trả `404` (chưa deploy), `401 Invalid JWT` (bật nhầm `verify_jwt`, đặc biệt khi dùng khóa `sb_publishable_*`), hoặc `503` (thiếu migration `resolve_username_login` / lỗi DB) → **khớp H2**. | Deploy bằng `supabase functions deploy resolve-login --no-verify-jwt` (và `delete-account --no-verify-jwt`), kiểm migration `20261122000200` đã chạy, thêm smoke test vào pipeline. |
| **H3 (Rất cao với Google OAuth & Xác nhận Email)** | **Supabase Auth `Site URL` / `Additional Redirect URLs` thiếu đúng origin Web production (`https://<host>/tai-khoan`)** | `frontend/src/adapters/auth/nativeAuth.ts:8-10`, `frontend/src/adapters/auth/client.ts:47-54,121` | Bấm `Tiếp tục với Google` → sau khi đồng ý, quan sát URL trả về trên thanh địa chỉ. Nếu bị chuyển về `/` (hoặc `localhost:5173`) thay vì `https://<host>/tai-khoan?code=...` → `parseWebAuthCallback` trả `null` và không báo lỗi → **khớp H3**. | Thêm đúng `https://<web-host>/tai-khoan` vào Supabase Dashboard → Authentication → URL Configuration → Redirect URLs; chuẩn hóa `pathname.replace(/\/+$/, "") === "/tai-khoan"`. |
| **H4 (Cao với CORS / Preflight)** | **Lỗi CORS preflight (`OPTIONS`) trên Edge Function hoặc header `x-client-info` / `apikey` bị chặn** | `backend/supabase/functions/_shared/http.ts:3-9,15-18` | DevTools → Console/Network: thấy lỗi `CORS policy` trên `OPTIONS /functions/v1/resolve-login`. Lưu ý nếu `verify_jwt` bật trên gateway hoặc Cloudflare Proxy chặn `OPTIONS`, browser sẽ báo lỗi CORS trước khi thấy HTTP 401. | Đảm bảo `OPTIONS` trả `204` kèm `Access-Control-Allow-Origin` khớp origin Web, `Access-Control-Allow-Headers` đủ `authorization, apikey, content-type, x-client-info, x-confirmed-owner`, và `verify_jwt = false`. |
| **H5 (Trung bình: PKCE & Tài khoản chưa xác nhận)** | **Tài khoản chưa bấm link xác nhận email (`enable_confirmations = true`), hoặc mở link xác nhận/Google ở trình duyệt khác (mất PKCE `code_verifier` trong Dexie)** | `backend/supabase/config.toml:38`, `frontend/src/adapters/auth/client.ts:104-110,189-193`, `frontend/src/adapters/auth/session.tsx:107-109` | DevTools → Network: `POST /auth/v1/token?grant_type=password` trả `400` với `error_code: "email_not_confirmed"`; hoặc `POST /auth/v1/token?grant_type=pkce` trả `400` thiếu `code_verifier` (hoặc truyền `{ flowId: undefined }` gây lỗi ở bản SDK). | Hiển thị riêng thông báo *"Email chưa được xác nhận; hãy kiểm tra hộp thư hoặc gửi lại thư xác nhận"*; chỉ truyền `{ flowId }` vào `exchangeCodeForSession` khi `flowId` có giá trị; giữ hướng dẫn mở link trên cùng trình duyệt. |
| **H6 (Thấp: Lưu trữ trình duyệt / Tài khoản đã xóa)** | **Trình duyệt chặn IndexedDB (Safari Private cũ / chế độ chặn storage) hoặc `owner` từng bị đánh dấu `retired:<id>` trong `db.settings`** | `frontend/src/adapters/auth/client.ts:7-24,150-157`, `frontend/src/adapters/local-store/retirement.ts:6-9` | DevTools → Application → IndexedDB → `luyen-jlpt` → `settings`: kiểm tra xem key `auth:sb-*-auth-token` có ghi được không và có tồn tại `retired:<user_id>` không. | Bọc `try/catch` đọc/ghi `sessionStorage`, thông báo rõ nếu trình duyệt chặn lưu trữ cục bộ; khi người dùng đăng nhập thành công tài khoản hợp lệ, kiểm tra không ghi đè nhầm trạng thái retired. |

**Nguyên tắc hiển thị lỗi bắt buộc sau khi sửa `FR-46`:**
- **Không làm lộ tài khoản tồn tại hay chưa:** Sai mật khẩu, sai email chưa đăng ký, và sai username không tồn tại **vẫn dùng chung 1 thông báo `LOGIN_ERROR`**.
- **Không che giấu lỗi hệ thống:** Lỗi mất mạng/CORS, HTTP `429`, HTTP `503`/Edge Function lỗi, `email_not_confirmed`, và cấu hình thiếu env **phải hiển thị thông báo tiếng Việt tách biệt** để người dùng và người vận hành biết chính xác bước xử lý.

---

## 4. Kiểm soát Bảo mật Bắt buộc theo từng Epic (Epic 7–12)

Mọi mục có nhãn **`[BẮT BUỘC]`** phải được đưa trực tiếp vào tiêu chí nghiệm thu của từng Task trong các kế hoạch Epic tương ứng và được kiểm chứng trước khi đóng Phase.

### Epic 7: Luyện đề Đồng bộ, Sửa Login Web, PWA & In-App Updater (`FR-46, FR-27, FR-29, FR-32, FR-38, FR-39, FR-43, FR-44`)

- **`SEC-E7-01` `[BẮT BUỘC]` Khóa kiểm định Web Env & Workflow Deploy Web (`FR-46`):**
  - Tạo `infra/scripts/src/validate-web-env.mjs` xác thực `VITE_SUPABASE_URL` (`https://<20-char>.supabase.co`) và `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*` hoặc JWT `role: "anon"`, từ chối `service_role`).
  - Sửa `frontend/src/adapters/auth/client.ts` bọc `new URL(url.trim())` an toàn, chuẩn hóa pathname `/tai-khoan` (bỏ dấu `/` cuối), chỉ truyền `{ flowId }` khi có giá trị, tách lỗi hệ thống (`network/429/503/email_not_confirmed`) khỏi `LOGIN_ERROR` mà không làm lộ sự tồn tại tài khoản.
  - Tạo workflow `.github/workflows/web-deploy.yml` chạy `validate-web-env.mjs` → `pnpm packs:verify` → `pnpm build` → kiểm tra `_headers` tồn tại trong `frontend/dist` → deploy Cloudflare Workers.
- **`SEC-E7-02` `[BẮT BUỘC]` Thiết lập HTTP Security Headers & Web CSP (`frontend/public/_headers`):**
  - Thêm `frontend/public/_headers` áp dụng cho `/*`:
    - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<ref>.supabase.co; media-src 'self' blob: https://<ref>.supabase.co; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` (khóa chặt `microphone=()` ở Epic 7; khi Epic 9 Task 6 bật tính năng thu giọng so sánh cục bộ trên RAM thì cập nhật tường minh sang `microphone=(self)`).
  - Thêm `Cache-Control: no-store` cho `/tai-khoan` để ngăn proxy/trình duyệt lưu trang callback.
- **`SEC-E7-03` `[BẮT BUỘC]` Thu hẹp CORS Edge Functions & Xác minh `verify_jwt = false`:**
  - Cập nhật `backend/supabase/functions/_shared/http.ts` kiểm tra `Origin` theo `ALLOWED_ORIGINS` (Web domain + `http://tauri.localhost` + `https://tauri.localhost` + `tauri://localhost` + dev localhost khi cục bộ) kèm `Vary: Origin`, thay cho `*`.
  - Bổ sung kiểm tra tự động xác nhận `resolve-login` và `delete-account` trả đúng status khi gọi bằng khóa `sb_publishable_*` (không phụ thuộc JWT gateway).
- **`SEC-E7-04` `[BẮT BUỘC]` Ngoại lệ Cache tuyệt đối cho PWA Service Worker (`FR-44`):**
  - Trong cấu hình `vite-plugin-pwa` (`frontend/vite.config.js`), mọi URL khớp `https://*.supabase.co/*` (Auth, REST, Functions, Storage Signed URLs) phải cấu hình `handler: "NetworkOnly"` (tuyệt đối không lưu Cache Storage).
  - Đặt `navigateFallbackDenylist` không nuốt API/tài nguyên tĩnh; đảm bảo `/tai-khoan?code=...` giữ nguyên query params qua navigation fallback để `parseWebAuthCallback` đọc được.
- **`SEC-E7-05` `[BẮT BUỘC]` Bảo vệ Server-Side cho `public.exam_attempts` (`FR-27`, `AD-14`):**
  - Bật RLS (`user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`), chỉ `GRANT SELECT/INSERT/UPDATE` trên các cột dữ liệu (cấm ghi `server_updated_at`, cấm `DELETE`).
  - Partial unique index: tối đa 1 bản ghi `status = 'in_progress'` cho mỗi `(user_id, level, exam_id)`.
  - Trigger `BEFORE UPDATE`: (1) nếu `old.status = 'completed'` → từ chối mọi sửa đổi; (2) tiến độ từng phần chỉ đi một chiều `pending → submitted|timed_out|skipped`, không bao giờ ghi đè ngược phần đã chốt; (3) không đổi `user_id`, `level`, `exam_id`, `attempt_number`.
  - CHECK constraints: UUID v4 cho `id`, `exam_id` `1..128` ký tự (không chứa `\0`, `/`, `..`), `total_questions BETWEEN 1 AND 1000`, `total_score BETWEEN 0 AND total_questions`, `jsonb_array_length(sections) BETWEEN 1 AND 10`, `octet_length(sections::text) <= 16384`, `octet_length(answers::text) <= 65536`, và hàm `jlpt_private.valid_exam_answers(answers)` kiểm tra key `1..128` ký tự và giá trị nguyên `0..3`.
  - Mở rộng `progressStore.purgeOwner(owner)` xóa sạch `db.examAttempts` và `db.activeExamDrafts` của `owner` (cập nhật tiếp khi thêm bảng v4 ở Epic 8–11).
  - Bổ sung timeout (`30s`) + giới hạn dung lượng (`16 MB`) cho `frontend/src/adapters/content-pack/examSource.ts`.
- **`SEC-E7-06` `[BẮT BUỘC]` Chuỗi phòng vệ In-App Updater Android & Windows (`FR-43`, `AD-19`):**
  - **Android metadata (`mobile/scripts/android-release.mjs`):** Bổ sung `sha256` (64 hex của APK đã ký), `sizeBytes` (số nguyên dương `<= 62_914_560`), và khuyến nghị ký tệp `android-latest.json` bằng Ed25519 (tái sử dụng khóa updater CI).
  - **Android tải & xác minh (`androidUpdate.ts` + mã Kotlin native):**
    1. Giữ chặt URL pin `https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v${version}/Luyen-JLPT-android.apk` và `nextCode > installedCode`.
    2. Tải thẳng vào thư mục riêng `context.cacheDir/updates/pending.apk` (quyền nội bộ, cấm `/sdcard`), ngắt ngay nếu luồng byte vượt `sizeBytes` hoặc 60 MB.
    3. Tính SHA-256 trên tệp đã đóng và so khớp không phân biệt hoa thường với `sha256` kỳ vọng (xóa tệp ngay nếu lệch).
    4. Dùng `PackageManager.getPackageArchiveInfo(..., GET_SIGNING_CERTIFICATES)` xác minh `packageName == "vn.luyenjlpt.app"`, `longVersionCode == nextCode > installedCode`, và **chứng chỉ ký APK mới trùng khớp 100% chứng chỉ của app đang cài**.
    5. Khai báo `FileProvider` (`android:exported="false"`, `android:grantUriPermissions="true"`, chỉ giới hạn `<cache-path name="updates" path="updates/" />`), phát Intent chỉ với `FLAG_GRANT_READ_URI_PERMISSION`, và dọn tệp `updates/*.apk` cũ lúc khởi động app.
    6. Khai báo `android:usesCleartextTraffic="false"` trong `AndroidManifest.xml` và `network_security_config.xml` chỉ tin cậy chứng chỉ hệ thống (`<certificates src="system"/>`) cho bản release.
  - **Windows (`NativeUpdates.tsx` + `desktop/src-tauri/capabilities/default.json`):** Giữ `requireSignedVersion: true` + chữ ký Ed25519; chỉ bổ sung đúng quyền `process:allow-restart` (nếu dùng `tauri-plugin-process` cho nút `Khởi động lại để áp dụng`); ghim runner Windows cố định trong `native.yml`.

### Epic 8: Động cơ FSRS-5, Adaptive Furigana & Local Notification (`FR-30, FR-40, FR-45`)

- **`SEC-E8-01` `[BẮT BUỘC]` Schema RLS & Giới hạn dữ liệu cho `srs_cards` và `srs_reviews` (`AD-14`):**
  - Cả 2 bảng bật RLS với `user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`, `GRANT` theo cột (cấm client ghi `server_updated_at`), khóa ngoại `ON DELETE CASCADE` vào `auth.users`.
  - `srs_cards`: CHECK `item_id` `1..128` ký tự (không `\0`), `card_type IN ('vocab', 'kanji', 'compound', 'cloze')`, `state IN (0, 1, 2, 3)`, `stability BETWEEN 0 AND 100000`, `difficulty BETWEEN 0 AND 10`, `reps BETWEEN 0 AND 100000`, `lapses BETWEEN 0 AND 100000`, `due_at` và `client_updated_at` hữu hạn (`0001..9999`), trigger LWW + bất biến `(user_id, level, card_type, item_id)`.
  - `srs_reviews`: append-only UUID v4 (`on conflict (id) do nothing`), cấm `UPDATE`/`DELETE`, CHECK `rating IN (1, 2, 3, 4)`, `duration_ms BETWEEN 0 AND 3600000`.
  - Giữ trần batch đồng bộ `<= 100` bản ghi/request (`core/sync/index.ts`).
- **`SEC-E8-02` `[BẮT BUỘC]` Mở rộng `purgeOwner()` cho bảng FSRS:**
  - Cập nhật `progressStore.purgeOwner(owner)` xóa sạch `srsCards` và `srsReviews` theo `owner` trong cùng transaction Dexie v4.
- **`SEC-E8-03` `[BẮT BUỘC]` Bảo vệ Quyền riêng tư trên Local Notification (`FR-45`):**
  - Nội dung thông báo `tauri-plugin-notification` hiển thị ngoài màn hình khóa chỉ chứa thông tin tổng quát (ví dụ *"Bạn có 15 thẻ JLPT đến hạn ôn hôm nay"*), tuyệt đối không chèn email, tên đăng nhập, hay nội dung ghi chú/sổ tay cá nhân.
  - Capability thông báo chỉ cấp cho cửa sổ `"main"`.

### Epic 9: Hạ tầng Gói Mở rộng, Audio Choukai Bucket Riêng tư & MediaSession (`AD-13, AD-15, FR-28, FR-31, FR-45`)

- **`SEC-E9-01` `[BẮT BUỘC]` Kiểm chứng Toàn vẹn & Chống Bom Dung lượng trên `ExtensionPackStore` (`AD-13`):**
  - Mọi gói tải về từ `extensions-index.json` phải kiểm tra URL `https:` thuộc nguồn tin cậy (chỉ cho `http://127.0.0.1` trong dev/test), giới hạn `sizeBytes` trước và trong khi stream, tính **SHA-256 trên byte thô** khớp `extensions-index.json` **trước khi** giải nén/JSON.parse/lưu vào Dexie v4 hoặc `tauri-plugin-fs`.
  - Nếu gói ở dạng nén (`.gz`/`.zip`), áp đặt giới hạn tỷ lệ/dung lượng sau giải nén (tối đa 100 MB) để chống decompression bomb.
  - Nếu dùng `tauri-plugin-fs` trên native, giới hạn scope capability chặt trong `$APPDATA/extensions/**` (cấm tuyệt đối quyền đọc/ghi ngoài thư mục app).
- **`SEC-E9-02` `[BẮT BUỘC]` Khóa chặt Bucket Riêng tư `audio-packs` & Edge Function `sign-audio-pack` (`FR-28`):**
  - Tạo bucket `audio-packs` với `public = false`, `file_size_limit = 52428800`, chỉ cho phép MIME audio/JSON hợp lệ.
  - RLS `storage.objects`: **chỉ `SELECT`** cho `authenticated` thỏa `jlpt_private.has_confirmed_email()` và `name` khớp `^[a-z0-9/_.-]+$` (cấm `..`); **0 policy `INSERT/UPDATE/DELETE`** cho `anon`/`authenticated`.
  - Tạo Edge Function `sign-audio-pack` xác thực Bearer JWT qua `/auth/v1/user` + kiểm tra `email_confirmed_at is not null`, đối chiếu `pack_id` với danh sách hợp lệ, áp rate-limit `<= 30 req/giờ/user` trong `jlpt_private`, phát Signed URL với **TTL `<= 300` giây**, trả `Cache-Control: private, no-store`, và không log URL có `?token=`.
- **`SEC-E9-03` `[BẮT BUỘC]` Cập nhật CSP Media chặt trên Web, Desktop và Mobile (`AD-15`):**
  - Desktop (`desktop/src-tauri/tauri.conf.json`) & Mobile (`mobile/src-tauri/tauri.conf.json`): thêm `media-src 'self' blob: https://<ref>.supabase.co;` (bản release tiêm đúng 20 ký tự ref thay vì `*.supabase.co`), gỡ `wss://*.supabase.co` nếu không dùng Realtime, thu hồi (`URL.revokeObjectURL`) mọi Audio Blob URL ngay khi đổi bài/unmount.
  - Web (`frontend/public/_headers`): khi bật tính năng Shadowing ghi âm so sánh cục bộ bằng `MediaRecorder` trong Epic 9 Task 6, cập nhật `Permissions-Policy` từ `microphone=()` sang `microphone=(self)` và chỉ giữ bản ghi tạm trong RAM (tuyệt đối không tải lên máy chủ hay lưu vĩnh viễn).
  - `MediaSession` chỉ hiển thị tên bài/đề chung, không đưa Signed URL hay thông tin tài khoản vào metadata màn hình khóa.

### Epic 10: KanjiVG Nét động, Bộ thủ, Mẹo nhớ & Viết tay Tự do Offline (`FR-33, FR-34, AD-16`)

- **`SEC-E10-01` `[BẮT BUỘC]` Diệt XSS KanjiVG bằng Đường ống Dữ liệu Thuần JSON (`FR-33`):**
  - **Cấm tuyệt đối** `dangerouslySetInnerHTML`, `innerHTML`, `<object>`, `<embed>`, hay `<iframe srcdoc>` khi hiển thị KanjiVG.
  - Tại bước build gói (`infra/scripts/`), trích xuất dữ liệu KanjiVG sang JSON thuần chỉ giữ các lệnh đường dẫn `d` của `<path>` đã qua kiểm duyệt regex `^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$` (tối đa 2.048 ký tự/nét, tối đa 40 nét/chữ), loại bỏ toàn bộ `<script>`, `<foreignObject>`, thuộc tính `on*`, `<use>`, `<image>`, và thực thể XML (chống XXE).
  - Frontend render hoàn toàn bằng React JSX `<svg viewBox="0 0 109 109"><path d={stroke.d} ... /></svg>`.
- **`SEC-E10-02` `[BẮT BUỘC]` RLS & Giới hạn cho `user_mnemonics` (`FR-33`):**
  - Bảng `public.user_mnemonics` bật RLS (`user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`), riêng tư từng tài khoản (không chia sẻ liên người dùng), CHECK `kanji_id` `1..128` ký tự, `mnemonic` `1..1000` ký tự (không chứa `\0`), LWW theo `client_updated_at` + `server_updated_at` do trigger cấp, và xóa sạch trong `purgeOwner()`.
- **`SEC-E10-03` `[BẮT BUỘC]` Cách ly Web Worker Nhận dạng Viết tay (`FR-34`, `AD-16`):**
  - Worker `kanjiStrokeMatcher` đóng gói thành tài nguyên static cùng origin (`worker-src 'self'`), không gửi nét vẽ ra mạng (`0` request ngoài), giới hạn đầu vào tối đa `40` nét × `500` điểm/nét và timeout xử lý `<= 2.000 ms` để tránh treo/OOM trên điện thoại tầm trung.

### Epic 11: Từ điển Hợp nhất, Sổ tay Không giới hạn, Anki Export/Import & Sentence Mining (`FR-35, FR-36, FR-37`)

- **`SEC-E11-01` `[BẮT BUỘC]` Chống IDOR & Cạn Dung lượng trên `notebooks` và `notebook_items` (`FR-36`):**
  - `public.notebooks`: `UNIQUE (user_id, id)`, RLS `user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`, CHECK `title` `1..120` ký tự, `description` `<= 500` ký tự, giới hạn chống lạm dụng `<= 200` sổ tay/người dùng (kiểm qua trigger DB).
  - `public.notebook_items`: khóa ngoại kép `FOREIGN KEY (user_id, notebook_id) REFERENCES public.notebooks(user_id, id) ON DELETE CASCADE` (ngăn tuyệt đối User A chèn item vào `notebook_id` của User B!), CHECK `item_type IN ('vocab', 'kanji', 'compound', 'grammar', 'cloze', 'custom')`, `note <= 1000` ký tự, `octet_length(payload::text) <= 4096`, giới hạn chống lạm dụng `<= 20.000` mục/người dùng.
  - Mở rộng `purgeOwner()` xóa sạch `notebooks` và `notebookItems` cục bộ.
- **`SEC-E11-02` `[BẮT BUỘC]` Chống CSV/TSV Formula Injection & XSS khi Xuất/Nhập Anki (`FR-36`):**
  - **Xuất `.csv`/`.tsv`:** Mọi ô văn bản có ký tự đầu (hoặc ký tự đầu sau khoảng trắng dẫn đầu) thuộc tập `[=+\-@\t\r]` phải được trung hòa bằng tiền tố `'` trước khi trích dẫn RFC 4180; không để lọt ký tự xuống dòng/tab chưa thoát phá vỡ cột TSV; thêm UTF-8 BOM cho `.csv`.
  - **Nhập `.csv`/`.tsv`/`.json`:**
    - Chặn tệp `> 5 MB`, quá `5.000` dòng/lần nhập, hoặc ô `> 1.000` ký tự; giải mã UTF-8 nghiêm ngặt (`TextDecoder("utf-8", { fatal: true })`).
    - Dùng `safeJsonParse()` loại bỏ mọi khóa `__proto__`, `constructor`, `prototype` và giới hạn độ sâu lồng nhau `<= 16`.
    - Mọi thẻ HTML trong bộ Anki nhập vào (`<b>`, `<img onerror=...>`, `<script>`) phải bị bóc sạch thành văn bản thuần (strip tags) và luôn render qua React text node.
- **`SEC-E11-03` `[BẮT BUỘC]` Kiểm chứng Toàn vẹn Gói Từ điển Mở rộng (`FR-35`):**
  - Gói từ điển JA↔VI mở rộng tải qua `ExtensionPackStore` phải qua cùng bước kiểm SHA-256 + `safeJsonParse()` + kiểm tra schema (không chấp nhận khóa nguyên mẫu, không chứa HTML thực thi). Không gọi bất kỳ endpoint bên thứ ba nào khi tra từ.

### Epic 12: Trình đọc Tự nhập Offline WASM, Tiện ích Tauri 2 OS & Nhập Dữ liệu N3 (`FR-41, FR-42, AD-17, AD-18`)

- **`SEC-E12-01` `[BẮT BUỘC]` Cô lập WASM Tokenizer & Giới hạn Văn bản Tự đọc (`FR-41`, `AD-16`):**
  - Bộ tách từ WASM chạy hoàn toàn trong Web Worker (`worker-src 'self'`), 0 kết nối mạng ngoài (`AD-18`), kiểm SHA-256 trước khi nạp bộ từ điển BSD-3 IPADIC/UniDic.
  - Giới hạn văn bản dán/nhập tối đa `50.000` ký tự (tệp `.txt`/`.md` `<= 512 KB`), chỉ đọc UTF-8 thuần, render `<ruby>` bằng React JSX (`RubySegment[]`), tuyệt đối không dùng `innerHTML`.
  - Nếu WebView yêu cầu biên dịch WASM trong CSP, chỉ cho phép thêm `'wasm-unsafe-eval'` (tuyệt đối cấm `'unsafe-eval'`).
- **`SEC-E12-02` `[BẮT BUỘC]` Tách Bộ Điều phối Deep-Link theo `host` & Lọc Sạch Android Intent (`FR-42`, `AD-17`):**
  - Cập nhật `mobile/src-tauri/tauri.conf.json:35-37` khai báo rõ hai host riêng: `"auth-callback"` và `"lookup"`.
  - Thay gắn thẳng `listenForNativeAuth` trong `frontend/src/App.tsx:188` bằng `deepLinkDispatcher.ts` kiểm tra chặt `host`: chỉ `luyenjlpt://auth-callback` mới gọi `completeNativeSignIn`; chỉ `luyenjlpt://lookup?q=...` mới mở tra từ (chỉ đọc, không bao giờ chuyển sang `/tai-khoan`, không ghi DB, không để lộ tham số `code`/`sb_flow_id` vào tìm kiếm). Mọi host khác bỏ qua im lặng.
  - Cầu nối Android Kotlin (`ACTION_PROCESS_TEXT` / `ACTION_SEND`): chỉ nhận `mimeType == "text/plain"`, bỏ qua `EXTRA_STREAM`, tách chuỗi văn bản, xóa `\0` và ký tự điều khiển `[\u0000-\u001F\u007F]`, cắt cứng `<= 120` code point, mã hóa bằng `Uri.encode()` rồi phát `luyenjlpt://lookup?q=<encoded>`.
- **`SEC-E12-03` `[BẮT BUỘC]` Capability Ít Quyền Nhất cho Desktop Quick Lookup & Bảo vệ Clipboard (`FR-42`):**
  - Tạo `desktop/src-tauri/capabilities/quick-lookup.json` gắn riêng `"windows": ["quick-lookup"]`, `"local": true`, chỉ cấp quyền tối thiểu điều khiển cửa sổ & lắng nghe sự kiện (`core:window:allow-hide`, `core:window:allow-set-focus`, `core:event:allow-listen`, `core:event:allow-unlisten`). **Cấm tuyệt đối** thêm `"quick-lookup"` vào `main-capability` (không có `updater`, `opener`, `deep-link`, `fs`, `http`).
  - Tính năng đọc clipboard khi bấm `Ctrl+Shift+J` phải là **opt-in** (bật trong `/tai-khoan` hoặc chỉ đọc đúng lúc người dùng chủ động nhấn phím tắt), cắt `<= 120` ký tự, tự động bỏ qua nếu chuỗi mang dạng URL/JWT (`^https?://`, `^eyJ`), và không bao giờ lưu clipboard vào Dexie, Supabase, hay log.
- **`SEC-E12-04` `[BẮT BUỘC]` Cổng Bảo mật Chuỗi Cung ứng CI/CD & Gói N3:**
  - Gói N3 thật đi qua nguyên vẹn đường ống kiểm chứng `pnpm packs:verify` + SHA-256 + `validatePack()`/`validateExamDocument()`.
  - Bổ sung kiểm tra `pnpm audit --prod --audit-level=high` và `cargo audit` trong CI; ghim phiên bản `xcodegen` (hoặc cài từ release có checksum) và cố định `windows-2025` trong `.github/workflows/native.yml`.

---

## 5. Bộ Ca Kiểm thử Lạm dụng Bảo mật cho QA (Security Abuse Test Cases)

Dành cho `@qa-lead` nhúng trực tiếp vào `2026-11-27-ke-hoach-qa-tester-v2.md`. Mỗi ca nêu rõ lớp kiểm thử tự động tương ứng và kỳ vọng từ chối an toàn (fail-closed).

| Mã ca | Nhóm / FR | Kịch bản kiểm thử lạm dụng (Abuse Case) | Tầng thực thi | Kết quả kỳ vọng (Pass Criteria) |
| --- | --- | --- | --- | --- |
| **SEC-T01** | Web Auth (`FR-46`) | Gửi đăng nhập sai mật khẩu của tài khoản có thật vs tên đăng nhập không tồn tại; gửi `resolve-login` với `username` chứa ký tự lạ hoặc `password` dài `8.192` ký tự. | Deno (`functions.test.ts`) + Vitest (`client.test.ts`) | Cùng mã `401` và thông báo `LOGIN_ERROR` (chống dò tài khoản); payload quá khổ bị chặn ngay không gọi upstream; lỗi mạng/`429`/`503`/`email_not_confirmed` hiện thông báo tách biệt rõ nguyên nhân. |
| **SEC-T02** | Web Auth (`FR-46`) | Truy cập `/tai-khoan?code=fake&error=access_denied#access_token=leaked` và `/tai-khoan/?code=valid_format` trên Web; kiểm tra địa chỉ URL và trạng thái phiên cũ. | Vitest (`client.test.ts`) + Playwright Web E2E | Mọi tham số auth bị xóa sạch khỏi `window.location` qua `replaceState`; phiên cũ không bị hỏng khi gặp mã sai; `/tai-khoan/` chuẩn hóa đúng; không rò `?code=` qua header `Referer`. |
| **SEC-T03** | Web Headers & PWA (`FR-44`) | Kiểm tra HTTP response headers của `/` và `/tai-khoan` trên bản Web build/preview; thực hiện đăng nhập rồi kiểm tra toàn bộ `caches.keys()` và mục bên trong Cache Storage của Service Worker. | Playwright Web E2E | Có đủ `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; Cache Storage chứa **0** entry thuộc `*.supabase.co` (`/auth/v1`, `/rest/v1`, `/functions/v1`, `/storage/v1/object/sign`). |
| **SEC-T04** | Account Deletion Privacy (`FR-27, FR-30, FR-36`) | Tạo dữ liệu mẫu ở tất cả bảng Dexie v4 (`progress`, `examAttempts`, `activeExamDrafts`, `srsCards`, `srsReviews`, `notebooks`, `notebookItems`, `userMnemonics`) cho `ownerA`, chạy `purgeOwner(ownerA)` và kiểm tra đồng thời `ownerB` vẫn còn nguyên. | Vitest (`local-store`) | `ownerA` còn **0** bản ghi trên mọi bảng Dexie v4 và được đánh dấu `retired:ownerA`; toàn bộ dữ liệu `ownerB` nguyên vẹn 100%. |
| **SEC-T05** | Postgres `exam_attempts` (`FR-27`) | (a) Tài khoản chưa xác nhận email chèn `exam_attempts`; (b) User B đọc/sửa lượt thi User A; (c) Ghi đè `submitted → pending` ở Phần 1; (d) Sửa lượt thi đã `completed`; (e) Chèn 2 lượt `in_progress` cho cùng `(level, exam_id)`; (f) Chèn JSON `answers` nặng `70 KB` hoặc `total_score > total_questions`. | pgTAP (`backend/supabase/tests/`) | Cả 6 kịch bản đều bị Postgres từ chối bằng mã lỗi quyền/ràng buộc (`42501`, `23505`, `23514`); không có dòng nào bị ghi đè ngược hay thay đổi `server_updated_at`. |
| **SEC-T06** | Private Storage `audio-packs` (`FR-28`) | (a) Gọi trực tiếp URL công khai vào bucket `audio-packs` không có token; (b) User chưa xác nhận email gọi `sign-audio-pack`; (c) User đã xác nhận email thử `INSERT`/`DELETE` vào `storage.objects` của `audio-packs`; (d) Gửi `31` yêu cầu ký URL trong 1 giờ; (e) Truyền `pack_id` chứa `../other-bucket/file`. | pgTAP + Deno (`functions.test.ts`) | (a) `400/401/403`; (b) `401/403`; (c) `42501` bị chặn bởi RLS; (d) Request thứ 31 trả `429`; (e) Bị từ chối `400`, Signed URL hợp lệ có TTL `<= 300s` và `Cache-Control: private, no-store`. |
| **SEC-T07** | FSRS, Notebooks & Mnemonics IDOR/DoS (`FR-30, FR-33, FR-36`) | (a) User A chèn `notebook_items` trỏ vào `notebook_id` của User B; (b) Chèn `mnemonic` dài `1.001` ký tự hoặc chứa `\0`; (c) Chèn `srs_reviews` rating `5` hoặc `UPDATE` sửa lịch sử `srs_reviews`; (d) Chèn `srs_cards` với `stability = -1` hoặc `NaN`/`Infinity`. | pgTAP (`backend/supabase/tests/`) | (a) Chặn bởi FK kép `(user_id, notebook_id)` + RLS; (b)-(d) Chặn bởi CHECK/GRANT (`23514` / `42501`). |
| **SEC-T08** | Android In-App Updater (`FR-43`) | Kiểm thử metadata & bộ tải với: (a) `url` trỏ domain ngoài GitHub repo gốc; (b) `versionCode <= installedCode` (downgrade); (c) Tệp APK bị sửa 1 byte làm sai `sha256`; (d) Luồng tải vượt `sizeBytes` / `60 MB`; (e) APK ký bằng chứng chỉ khác `ANDROID_SIGNING_CERT_SHA256`; (f) Kiểm manifest APK không có `usesCleartextTraffic="true"` và `debuggable`. | Vitest (`androidUpdate.test.ts`) + Node (`android-release.test.mjs`) + Android Smoke | Mọi kịch bản (a)–(e) đều hủy cài đặt và xóa tệp tạm trong `cacheDir/updates/`; kiểm tra `aapt2` xác nhận không debuggable, không cleartext, `FileProvider` có `exported="false"`. |
| **SEC-T09** | Tauri CSP & Capability Isolation (`AD-15, AD-17`) | Kiểm tra cấu hình `desktop/src-tauri/tauri.conf.json`, `mobile/src-tauri/tauri.conf.json`, `capabilities/*.json` và bản release config: không có wildcard `*` ở `media-src`/`script-src`, không có `'unsafe-eval'`, bản release không có `*.supabase.co`, và `quick-lookup.json` không chứa `updater`/`opener`/`fs`/`http`/`deep-link`. | Node/Vitest config contract test | 100% assertion cấu hình đạt; thử gọi IPC `updater:check` hoặc `opener:open_url` từ cửa sổ `quick-lookup` bị Tauri ACL từ chối. |
| **SEC-T10** | KanjiVG SVG Sanitization (`FR-33`) | Nạp tệp KanjiVG đầu vào chứa `<script>alert(1)</script>`, `<path onclick="alert(1)" d="M0 0"/>`, `<foreignObject>...</foreignObject>`, và chuỗi `d` chứa ký tự tiêm nhiễm vào script build gói + validator frontend. | Vitest (`infra/scripts` + `frontend`) | Build script loại bỏ/từ chối sạch mọi thẻ/thuộc tính nguy hiểm; validator từ chối chuỗi `d` sai regex; DOM kết xuất không chứa `<script>`, `on*`, hay `<foreignObject>`. |
| **SEC-T11** | CSV/TSV Formula Injection & Prototype Pollution (`FR-36`) | (a) Xuất Sổ tay chứa ô bắt đầu bằng `=1+1`, `+cmd`, `-2+3`, `@SUM(A1)` ra `.csv`/`.tsv`; (b) Nhập tệp JSON chứa `{"__proto__":{"polluted":true}}` và tệp `.tsv` có `<img src=x onerror=alert(1)>` hoặc dung lượng `> 5 MB`. | Vitest (`core/notebook` + `adapters`) | (a) Mọi ô nguy hiểm được trung hòa bằng tiền tố `'` an toàn; (b) `({}).polluted === undefined`, HTML bị strip thành văn bản thuần, tệp quá `5 MB` bị từ chối trước khi parse. |
| **SEC-T12** | Deep-Link Split & Android Intent Sanitization (`FR-42`) | (a) Gửi `luyenjlpt://lookup?q=食べる&code=fake&sb_flow_id=12345678`; (b) Gửi `luyenjlpt://unknown-host?x=1`; (c) Gửi Android Intent `ACTION_PROCESS_TEXT` chứa chuỗi dài `50.000` ký tự kèm `\0` và `javascript:alert(1)`; (d) Kích hoạt `Ctrl+Shift+J` khi clipboard chứa `https://secret.test/?token=abc` hoặc JWT `eyJ...`. | Vitest (`deepLinkDispatcher.test.ts`) + Android/Desktop smoke | (a) Chỉ mở tra từ, không kích hoạt auth hay chuyển sang `/tai-khoan`; (b) Bỏ qua im lặng; (c) Cắt sạch còn `<= 120` ký tự không ký tự điều khiển và encode đúng query; (d) Không nạp URL/JWT vào ô tra cứu hay lưu vào Dexie/log. |

---

## 6. Ghi chú Phạm vi & Minh bạch Kiểm toán

- **Độ phủ đã xác minh trực tiếp trong mã nguồn:** Toàn bộ luồng Auth Web/Native (`client.ts`, `session.tsx`, `nativeAuth.ts`, `AccountPage.tsx`, `App.tsx`), Edge Functions (`http.ts`, `resolve-login.ts`, `delete-account.ts`), Supabase SQL migrations & pgTAP/Deno tests, Dexie v3 & sync adapters (`db.ts`, `progress.ts`, `exams.ts`, `supabase-sync/index.ts`), pack/exam validators & loaders, Tauri 2 Desktop/Mobile configs & capabilities, release signing scripts, và 2 workflow `.github/workflows/{ci,native}.yml`.
- **Giới hạn kiểm toán chỉ đọc:** Không truy cập trực tiếp bảng điều khiển Cloudflare Workers hay Supabase Dashboard production (nên các giả thuyết H1–H4 ở Mục 3 cần chủ dự án/người triển khai Epic 7 xác nhận nhanh trong 5 phút bằng DevTools & Supabase CLI trước khi viết bản vá). Không có tệp mã nguồn ứng dụng nào bị chỉnh sửa trong quá trình kiểm toán này.
