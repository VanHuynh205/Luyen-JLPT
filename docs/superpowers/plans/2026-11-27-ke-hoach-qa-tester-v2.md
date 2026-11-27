# Kế hoạch QA & Tester Playbook v2 (`FR-27..FR-46`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:verification-before-completion`, `open-code-review-delegate`, and `differential-review` when executing QA gates and validating Phase 1–4 deliverables. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập sổ tay kiểm thử toàn diện theo tháp 8 tầng, ma trận kịch bản (gồm 12 ca lạm dụng bảo mật `SEC-T01..SEC-T12`) cho toàn bộ `FR-27..FR-46` và cổng phát hành từng Phase trên Web (kèm PWA), Desktop Windows (`.exe`), Android (`.apk`) và iOS (Simulator/PWA).

**Architecture:** Tổ chức kiểm thử bám ranh giới `ports-and-adapters` (`core/*` thuần TypeScript, `adapters/*` với `fake-indexeddb`, Supabase pgTAP/Deno cho DB & Edge Functions, Playwright cho Web/PWA, `tauri-driver` cho Desktop, ADB/UIAutomator/Maestro cho Mobile), đồng bộ 1-1 tên tệp test với 6 Epic plan (`Epic 7–12`) và 12 ca lạm dụng bảo mật (`SEC-T01..SEC-T12`) từ `2026-11-27-bao-mat-web-va-app-v2.md`.

**Tech Stack:** Vitest 5.1.1, `fake-indexeddb` 6.2.8, Node `--test`, Supabase CLI 3.2.0 + pgTAP, Deno 2.9.6, Playwright 1.65.1, `tauri-driver` 2.1.0 + Edge WebDriver, Android SDK API 34 Emulator + `adb`/`uiautomator`, Maestro 2.12.1 (iOS Simulator), Semgrep, `open-code-review-delegate`, `differential-review`.

**Spec:**
- `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (`FR-27..FR-46`, `AD-13..AD-19`, NFR Delta, 10 quyết định đã chốt)
- `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`TM-01..TM-14`, `H1..H6`, `SEC-E7..E12`, `SEC-T01..SEC-T12`)
- `docs/superpowers/plans/2026-11-27-lo-trinh-code-bao-mat-qa-v2.md` (Master Coordinator Index & Hợp đồng chéo Epic 7–12)
- `docs/superpowers/plans/2026-11-21-lo-trinh-code-va-kiem-thu.md`
- `docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/DESIGN.md`
- `AGENTS.md`

## Global Constraints

- **Giữ nguyên bất biến v1:** Toàn bộ 18 route tiếng Việt hiện có giữ nguyên đường dẫn (bổ sung route v2 `/so-tay`, `/tu-doc`, `/tra-nhanh`); `/ngu-phap/$patternId` không gắn quiz; `/tien-do` của người dùng chưa có dữ liệu bắt buộc hiện `"Bạn chưa có tiến độ nào ở cấp độ này"` (không hiện `0%` hay heatmap rỗng).
- **Ngân sách kích thước & hiệu năng:** `.apk` Android release **≤ 30 MB**; chunk cảnh 3D (`scene-three`/`DeskHeroCanvas`) **≤ 3 MB** nén; khung hình 3D **≥ 50 fps** (tụt `< 50 fps` trong 2 giây → hạ DPR → ảnh tĩnh SVG); tra từ cục bộ **< 50 ms** trên `30.000` mục; phát audio cục bộ **< 150 ms**; `0` domain ad-tech/theo dõi bên thứ ba; **0% AI** trong v2 (`AD-18`).
- **Ngân sách tiếp cận (a11y):** Vùng chạm nút chính tối thiểu **44×44px** trên viewport `360×640`; không tràn ngang (`scrollWidth === 360`); mọi chữ Nhật gắn `lang="ja"` và không dùng font Fraunces; tôn trọng `prefers-reduced-motion` và tắt hiệu ứng trong `/tai-khoan`; đạt tương phản **WCAG 2.1 AA** cho cả Light (Washi) và Dark (`Sumi đêm`); tối đa `1` con dấu `.hanko` mỗi màn hình.
- **Bảo mật & Toàn vẹn dữ liệu (`SEC-E7..E12`):** Mọi bảng mới có RLS `user_id = (select auth.uid())` + `(select jlpt_private.has_confirmed_email())`, `GRANT` theo cột (cấm ghi `server_updated_at`), trigger khóa bất biến `completed` và tiến đơn điệu trên `exam_attempts`; không cache `*.supabase.co/*` trong PWA SW (`NetworkOnly`); APK updater kiểm `sha256` + `sizeBytes` + chữ ký cert khớp bản cài (`usesCleartextTraffic="false"`); KanjiVG biên dịch JSON `<path d>` thuần (0 `dangerouslySetInnerHTML`); Anki export trung hòa `[=+\-@\t\r]` và import dùng `safeJsonParse()` (cấm `__proto__`); Deep-link tách chặt `host` (`auth-callback` vs `lookup`).
- **N3 Gate:** Giữ `EXPERIMENTAL_LEVELS=1` cho fixture mẫu ở Phase 1–2; chỉ mở kiểm thử dataset N3 thật ở Phase 4 (`Epic 12`) sau khi Phase 2 hoàn tất.
- **Luật thép kiểm chứng:** Cấm báo cáo hoàn thành nếu chưa chạy lệnh kiểm chứng mới nhất sau lần sửa cuối và đọc trọn vẹn exit code + kết quả (`verification-before-completion`).

## Review Focus

1. **Xung đột Service Worker & Auth/Signed URL (`FR-44`, `FR-46`, `FR-28`, `SEC-E7-04`, `SEC-T03`):** `tests/web/playwright.config.ts#L42` đang đặt `serviceWorkers: "block"`, nên bộ E2E thường sẽ bỏ sót lỗi Workbox cache nhầm callback `/tai-khoan?code=...`, `/auth/v1/*`, `/functions/v1/*` hoặc Signed URL `/storage/v1/object/sign/*` gây lộ phiên khi dùng chung máy.
2. **Build Web thiếu Env / CORS `resolve-login` (`FR-46`, `SEC-E7-01..03`, `SEC-T01..02`):** `frontend/src/adapters/auth/client.ts#L26-L27` đọc `VITE_SUPABASE_PUBLISHABLE_KEY`, hiện bản `frontend/dist` cục bộ chưa nhúng `supabase.co`; thiếu `validate-web-env.mjs` hoặc quên `--no-verify-jwt` sẽ làm gãy đăng nhập Web mà `AccountPage.tsx` trước đó nuốt thành lỗi sai mật khẩu.
3. **Mất bài thi dở, đứt quãng đồng bộ hoặc rò dữ liệu sau xóa tài khoản (`FR-27`, `SEC-E7-05`, `SEC-T04..05`):** Nộp Phần 1 trên Android khi offline rồi mở Web trước khi outbox đẩy xong dễ ghi đè ngược `pending` nếu thiếu trigger đơn điệu; `progressStore.purgeOwner` hiện cũng chưa xóa `db.examAttempts` và các bảng Dexie v4 mới.
4. **Nâng cấp Android `.apk` và bảo toàn dữ liệu Dexie (`FR-43`, `AD-19`, `SEC-E7-06`, `SEC-T08`):** Tải APK không kiểm `sha256` + `sizeBytes` + `signingInfo` hoặc sai `vn.luyenjlpt.app` mở rủi ro tráo nhị phân MITM/TOCTOU hoặc mất sạch dữ liệu FSRS trong WebView.
5. **XSS từ gói KanjiVG/Anki & Treo Main Thread trên điện thoại (`FR-33`, `FR-34`, `FR-36`, `FR-41`, `SEC-T10..T11`):** Render SVG thô có `<script>`/`on*`/`<foreignObject>`, nhập JSON có `__proto__`, xuất CSV chứa công thức `=CMD|...`, hoặc chạy WASM/khớp nét ngoài Web Worker sẽ gây XSS hoặc kẹt WebView.

---

## 1. Tháp kiểm thử 8 tầng & Lệnh thực thi chuẩn

Bảng dưới ánh xạ chính xác 8 tầng kiểm thử với lệnh chạy thực tế trong repo (`package.json`, `.github/workflows/ci.yml`, `.github/workflows/native.yml`, `backend/supabase/README.md`, `infra/scripts/README.md`).

| Tầng | Phạm vi kiểm chứng | Lệnh thực thi chính xác | Điều kiện chạy & Ghi chú |
| :--- | :--- | :--- | :--- |
| **Tầng 1: Unit & Adapter** | Lõi `core/*` (FSRS-5, chia 13 thể, chấm đề/điểm liệt, đồng bộ LWW, `safeJsonParse`, `ankiCodec`, `svgSanitizer`, `strokeMatcher`, `clipboardGuard`), `adapters/*` với `fake-indexeddb`, `infra/scripts/*` (`validate-web-env.mjs`, `verify-furigana`, `verify-n3`, `tauri-csp-contract`), hợp đồng Android/Desktop | `pnpm packs:build && pnpm packs:verify && pnpm typecheck && pnpm check && pnpm test && pnpm --filter @luyen/mobile-shell test && node --test tests/desktop/capability-contract.test.mjs tests/mobile/android-intent-bridge.test.mjs` | Chạy mỗi commit; kiểm thêm `EXPERIMENTAL_LEVELS=1 pnpm packs:build && EXPERIMENTAL_LEVELS=1 pnpm packs:verify` và `pnpm --filter @luyen/mobile-shell validate`. |
| **Tầng 2: DB & Edge Functions** | Migration Postgres, RLS (`has_confirmed_email()`), LWW trigger, monotonic `exam_attempts`, CHECK giới hạn, bucket riêng tư `audio-packs`, Edge Functions (`resolve-login`, `delete-account`, `sign-audio-pack`) | `pnpm dlx supabase@3.2.0 --workdir backend start && pnpm dlx supabase@3.2.0 --workdir backend test db && pnpm dlx deno@2.9.6 test --no-config --no-lock --node-modules-dir=none backend/supabase/tests/functions.test.ts` | Cần Docker + Deno; chạy mọi PR đụng `backend/supabase/`. Bao phủ `progress.test.sql`, `exam_attempts.test.sql`, `srs.test.sql`, `audio_packs.test.sql`, `user_mnemonics.test.sql`, `notebooks.test.sql` (`SEC-T01`, `SEC-T05`, `SEC-T06`, `SEC-T07`). |
| **Tầng 3: Sync Integration** | Đẩy outbox (`<= 100` dòng/lô) → Postgres → kéo theo composite cursor `(server_updated_at, id)` về thiết bị 2 trong `<= 30s`, gộp tiến độ khách, cô lập 2 tài khoản, xóa sạch tài khoản (`purgeOwner` + `delete-account`) | `pnpm --filter @luyen/frontend exec vitest run src/adapters/supabase-sync/index.test.ts src/core/sync/sync.test.ts` (contract) và:<br>`vars="$(pnpm dlx supabase@3.2.0 --workdir backend status -o json)" && VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY="$(jq -er '.ANON_KEY' <<<"$vars")" pnpm build && SUPABASE_TEST_SERVICE_ROLE_KEY="$(jq -er '.SERVICE_ROLE_KEY' <<<"$vars")" JLPT_LOCAL_AUTH=1 pnpm e2e:web accounts.local.spec.ts account-mail.local.spec.ts` | Chạy từ bash có Docker Supabase đang chạy (`.github/workflows/ci.yml#L45-L54`). Mở rộng spec đồng bộ cho `exam_attempts`, `srs_cards`/`srs_reviews`, `user_mnemonics`, `notebooks`/`notebook_items`. |
| **Tầng 4: Web E2E & PWA** | Toàn bộ 18+ route tiếng Việt (kèm `/so-tay`, `/tu-doc`, `/tra-nhanh`), luồng khách, `FR-46` Web auth, làm đề từng phần & làm lại, chế độ tối, mini-drill, tra cứu, sổ tay, HTTP `_headers`, và **PWA offline mở lạnh không mạng** | Thường + N3 thử nghiệm:<br>`pnpm build && pnpm e2e:web`<br>`EXPERIMENTAL_LEVELS=1 pnpm packs:build && EXPERIMENTAL_LEVELS=1 pnpm packs:verify && EXPERIMENTAL_LEVELS=1 pnpm build && EXPERIMENTAL_LEVELS=1 pnpm e2e:web`<br>PWA offline (SW bật):<br>`pnpm build && pnpm e2e:web pwa-offline.spec.ts`<br>Staging:<br>`JLPT_STAGING_URL=https://<origin>/ pnpm e2e:web` | Lưu ý `tests/web/playwright.config.ts#L42` chặn SW (`serviceWorkers: "block"`), nên `tests/web/pwa-offline.spec.ts` khai báo `test.use({ serviceWorkers: "allow" })` để kiểm `SEC-T03` và cold offline boot. |
| **Tầng 5: Desktop Tauri 2** | Cài NSIS, cold/warm deep-link (`auth-callback` vs `lookup`), offline flashcard, `tauri-plugin-updater` ký Ed25519 + `relaunch()`, global shortcut `Ctrl+Shift+J` (`/tra-nhanh`) & capability `quick-lookup.json` | `pnpm --filter @luyen/frontend build && pnpm packs:verify && pnpm tauri:desktop build --bundles nsis --ci '--' --locked`<br>`pwsh -File tests/desktop/ci-smoke.ps1`<br>`pwsh -File tests/desktop/updater-build.ps1`<br>`node tests/desktop/updater-smoke.mjs .cache/epic3-updater/<tag>`<br>`node tests/desktop/quick-lookup-smoke.mjs` | Yêu cầu Windows + WebView2 Runtime + `tauri-driver` + `msedgedriver` đúng version WebView2 (`.github/workflows/native.yml#L110-L135`). |
| **Tầng 6: Mobile (Android & iOS)** | Cài `.apk` trên Android API 34 Emulator, bật chế độ máy bay học offline, tải gói mở rộng, `MediaSession` nền, Local Notification, In-App APK Updater (`sha256` + `FileProvider`), Share Intent; iOS Simulator Maestro smoke | Android:<br>`node mobile/scripts/validate-scaffold.mjs && pnpm tauri:mobile android init --ci --skip-targets-install && pnpm tauri:mobile android build --ci --apk --debug --target x86_64 -- --locked`<br>`bash tests/mobile/android-ci-smoke.sh` (hoặc `node tests/mobile/android-offline-smoke.mjs <apk> --required`)<br>iOS (chỉ `macos-15` arm64):<br>`bash tests/mobile/ios/ci-smoke.sh` | Emulator `avd luyen-jlpt` (`system-images;android-34;google_apis;x86_64`, `1080x1920`, density `480`). Release APK kiểm chữ ký qua `node mobile/scripts/android-release.mjs metadata <apk>`. |
| **Tầng 7: Security Abuse & Supply Chain** | Toàn bộ 12 ca `SEC-T01..SEC-T12`, kiểm mạng ẩn danh (`tests/web/fixtures.ts` = 0 domain ngoài), kiểm phụ thuộc (`pnpm audit`, `cargo audit`), rà diff bảo mật | Tự động: `supabase test db --workdir backend`, `deno test ... functions.test.ts`, `pnpm test`, `pnpm e2e:web`<br>Supply chain: `pnpm audit --prod --audit-level=high && cargo audit --file desktop/src-tauri/Cargo.lock && cargo audit --file mobile/src-tauri/Cargo.lock`<br>Diff & SAST: chạy skill `differential-review` + `semgrep --config auto` | Bắt buộc trên mọi PR đụng auth, RLS, sync, Storage, Tauri capabilities/CSP, native updater, importer/sanitizer. |
| **Tầng 8: Accessibility & Performance Budgets** | Touch target `>= 44×44px` ở 360px, `lang="ja"`, `prefers-reduced-motion`, WCAG AA Light+Dark, `<= 1` `.hanko`/màn, APK `<= 30 MB`, 3D chunk `<= 3 MB`, 3D `>= 50 fps`, lookup `< 50 ms`, audio `< 150 ms` | `pnpm e2e:web routes.spec.ts exam-practice.spec.ts motion-scene.spec.ts theme-and-mobile-nav.spec.ts`<br>Đo APK: `stat -c%s <release.apk>` (`<= 31457280` bytes)<br>Đo 3D chunk: kiểm `frontend/dist/assets/*` sau `pnpm build` (gzip `<= 3145728` bytes)<br>Benchmark lookup: `pnpm --filter @luyen/frontend test -- src/core/dictionary/search.test.ts` | Chạy trên cả `.dark` và `:root` (Light). Trên Windows kiểm size APK qua `(Get-Item <apk>).Length -le 30MB`. |

### Chi tiết kiểm tra Ngân sách Tầng 8 (Ngưỡng bắt buộc)

- [ ] **APK size budget:** Bản `.apk` release (multi-ABI `aarch64`, `armv7`, `x86_64` sau `mobile/scripts/package-release.sh`) có dung lượng **≤ 30 MB** (`31.457.280` bytes). Mọi audio Opus, KanjiVG mở rộng, từ điển JMdict và WASM tokenizer đi qua `ExtensionPackStore`.
- [ ] **3D bundle & frame budget:** Tổng dung lượng nén (gzip/br) của chunk 3D (`DeskHeroCanvas`/`three`) **≤ 3 MB**; trên Playwright `motion-scene.spec.ts` (kèm throttle CPU 4× khi rà PR chạm `scene/`), khung hình giữ **≥ 50 fps** hoặc chuyển DPR `1` → ảnh tĩnh SVG sau `2s` nếu không đạt, không phát sinh `pageerror`.
- [ ] **Lookup & Audio latency:** Truy vấn tìm kiếm từ điển cục bộ trên `30.000` mục hoàn tất **< 50 ms** (khóa trong `frontend/src/core/dictionary/search.test.ts`); phát audio cục bộ từ `ExtensionPackStore` phát ra khung âm thanh đầu tiên **< 150 ms**.
- [ ] **Accessibility (`44px`, `lang="ja"`, WCAG AA, Reduced Motion):** Mọi nút/tab/choice chính ở viewport `360×640` đạt chiều cao **≥ 44px**, `document.documentElement.scrollWidth === 360`; mọi chữ Nhật (gồm `GrammarKeigoPage.tsx:227,235` `kenjogoI`/`kenjogoII`) gắn `lang="ja"`; tỷ lệ tương phản chữ/nền **≥ 4.5:1** (văn bản thường) và **≥ 3:1** (chữ lớn/icon) trên cả Washi sáng và `.dark` Sumi đêm.

---

## 2. Ma trận kiểm thử theo từng tính năng (`FR-27..FR-46`)

### Bảng 2.1: Ánh xạ Toàn bộ Kiểm soát Bảo mật & Ca Lạm dụng (`SEC-T01..SEC-T12`)

| Mã ca QA | Kiểm soát liên kết | FR / Epic | Tệp test tự động gánh trách nhiệm (khớp Epic 7–12) | Tiêu chí đạt (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-T01** | `SEC-E7-01`, `SEC-E7-03` | `FR-46` / Epic 7 | `backend/supabase/tests/functions.test.ts`, `frontend/src/adapters/auth/client.test.ts`, `infra/scripts/src/validate-web-env.test.ts` | Sai mật khẩu vs username không tồn tại trả cùng `401` + `LOGIN_ERROR`; payload `8.192` ký tự bị chặn trước upstream; lỗi mạng/`429`/`503`/`email_not_confirmed` hiện thông báo tách biệt. |
| **SEC-T02** | `SEC-E7-01`, `SEC-E7-02` | `FR-46` / Epic 7 | `frontend/src/adapters/auth/client.test.ts`, `tests/web/auth-web-login.spec.ts` | `?code=`/`#access_token=`/`?error=` bị dọn sạch khỏi URL qua `replaceState`; `/tai-khoan/` chuẩn hóa đúng; `Referrer-Policy` không rò `?code=`; phiên cũ không bị hỏng. |
| **SEC-T03** | `SEC-E7-02`, `SEC-E7-04` | `FR-44`, `FR-46` / Epic 7 | `tests/web/pwa-offline.spec.ts` | Response headers đủ `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; Cache Storage có **0** entry thuộc `*.supabase.co`. |
| **SEC-T04** | `SEC-E7-05`, `SEC-E8-02`, `SEC-E10-02`, `SEC-E11-01` | `FR-27, FR-30, FR-33, FR-36` / Epic 7–11 | `frontend/src/adapters/local-store/{exams,progress,srs,mnemonics,notebooks}.test.ts` | `purgeOwner(ownerA)` xóa sạch 0 dòng trên mọi bảng Dexie v4 (`progress`, `examAttempts`, `activeExamDrafts`, `srsCards`, `srsReviews`, `userMnemonics`, `notebooks`, `notebookItems`) và giữ nguyên 100% `ownerB`. |
| **SEC-T05** | `SEC-E7-05` | `FR-27` / Epic 7 | `backend/supabase/tests/exam_attempts.test.sql` | 6 kịch bản lạm dụng `exam_attempts` (chưa xác nhận email, chéo user, hạ `submitted→pending`, sửa `completed`, 2 lượt `in_progress`, `answers` > `65.536B` / `total_score > total_questions`) đều bị Postgres từ chối (`42501`/`23505`/`23514`). |
| **SEC-T06** | `SEC-E9-02` | `FR-28` / Epic 9 | `backend/supabase/tests/audio_packs.test.sql`, `backend/supabase/tests/functions.test.ts` | Bucket `audio-packs` private: URL công khai trả `400/401/403`; chưa xác nhận email gọi `sign-audio-pack` trả `401/403`; client ghi/xóa `storage.objects` trả `42501`; request thứ 31/giờ trả `429`; path traversal `../` trả `400`; TTL `<= 300s`, `Cache-Control: private, no-store`. |
| **SEC-T07** | `SEC-E8-01`, `SEC-E10-02`, `SEC-E11-01` | `FR-30, FR-33, FR-36` / Epic 8, 10, 11 | `backend/supabase/tests/srs.test.sql`, `backend/supabase/tests/user_mnemonics.test.sql`, `backend/supabase/tests/notebooks.test.sql` | Chèn `notebook_items` sang `notebook_id` user khác bị khóa ngoại kép `(user_id, notebook_id)` + RLS chặn; `mnemonic` `1.001` ký tự/`\0`, `srs_reviews` rating `5`/`UPDATE`, `srs_cards` `stability = -1`/`NaN` bị từ chối (`23514`/`42501`). |
| **SEC-T08** | `SEC-E7-06` | `FR-43` / Epic 7 | `frontend/src/adapters/native/androidUpdate.test.ts`, `tests/mobile/android-release.test.mjs` | URL ngoài GitHub repo, `versionCode <= installedCode`, lệch 1 byte `sha256`, vượt `sizeBytes`/`60 MB`, hoặc khác `ANDROID_SIGNING_CERT_SHA256` đều hủy cài và xóa `cacheDir/updates/*.apk`; `aapt2` xác nhận không debuggable, `usesCleartextTraffic="false"`, `FileProvider` `exported="false"`. |
| **SEC-T09** | `SEC-E9-03`, `SEC-E12-03` | `FR-28, FR-41, FR-42` / Epic 9, 12 | `infra/scripts/src/tauri-csp-contract.test.ts`, `tests/desktop/capability-contract.test.mjs` | Không có `*` ở `media-src`/`script-src`, không `'unsafe-eval'`, bản release không có `*.supabase.co`, `quick-lookup.json` không chứa `updater`/`opener`/`fs`/`http`/`deep-link`. |
| **SEC-T10** | `SEC-E10-01` | `FR-33` / Epic 10 | `infra/scripts/src/kanjivg-pack.test.ts`, `frontend/src/core/kanji/svgSanitizer.test.ts`, `frontend/src/components/kanji-library/KanjiStrokePlayer.test.tsx` | `<script>`, `onclick=`, `<foreignObject>`, `<use>`, `<!ENTITY>` và `d` sai regex `^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$` bị loại/từ chối sạch; DOM chỉ render `<svg><path d=... /></svg>`. |
| **SEC-T11** | `SEC-E11-02`, `SEC-E11-03` | `FR-35, FR-36` / Epic 11 | `frontend/src/core/notebook/ankiCodec.test.ts`, `frontend/src/core/extensions/validate.test.ts`, `frontend/src/core/dictionary/validate.test.ts` | Xuất `.csv`/`.tsv` trung hòa ô dẫn đầu `[=+\-@\t\r]` bằng `'`; `safeJsonParse()` chặn `__proto__`/`constructor`/`prototype` & độ sâu `> 16`; HTML bị strip sạch; tệp `> 5 MB` hoặc `> 5.000` dòng bị từ chối trước parse. |
| **SEC-T12** | `SEC-E12-02`, `SEC-E12-03` | `FR-42` / Epic 12 | `frontend/src/adapters/native/deepLinkDispatcher.test.ts`, `frontend/src/core/native/clipboardGuard.test.ts`, `tests/desktop/quick-lookup-smoke.mjs`, `tests/mobile/android-intent-bridge.test.mjs` | `luyenjlpt://lookup?q=食べる&code=fake` không gọi auth; `unknown-host` bị bỏ qua; Intent `ACTION_PROCESS_TEXT` cắt `<= 120` ký tự và lọc `\0`/control chars; `Ctrl+Shift+J` bỏ qua URL/JWT trong clipboard. |

---

### FR-27: Lưu & Đồng bộ bài thi thử theo từng phần riêng + Nhiều lần làm lại
- **Thuộc:** Phase 1 / Epic 7 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E7-05`, `SEC-T04`, `SEC-T05`
- **Interfaces:** Consumes `ExamDocument`, `activeExamDrafts` (Dexie v4), `public.exam_attempts` (Supabase + RLS); Produces `ExamAttemptRecord` (`status: 'in_progress' | 'completed'`, `attemptNumber`, `sections[]`).
- **Happy Path:**
  1. Mở `/luyen-de/n4-2013-07`, làm xong Phần 1 (*Từ vựng & Chữ Hán*), bấm **Nộp Phần 1** → hiện ngay điểm Phần 1, `<RubyText>`, bản dịch và giải thích từng câu; lưu đồng thời vào `examAttempts` (`status: "in_progress"`, Phần 1 `"submitted"`, 2 phần sau `"pending"`) và đưa vào `progressOutbox`.
  2. Tải lại trang (F5) hoặc mở lại từ `/luyen-de` → nút hiển thị **Tiếp tục làm đề** (mở thẳng Phần 2 đã mở khóa, Phần 1 xem lại được lời giải).
  3. Hoàn thành đủ 3 phần → chuyển `status: "completed"`, lưu điểm Lần 1 ở `/luyen-de` và `/tien-do`.
  4. Bấm **Làm lại đề này** → tạo UUID v4 mới (`attemptNumber: 2`); hoàn thành Lần 2 → cả Lần 1 và Lần 2 giữ riêng điểm và chi tiết trên đa thiết bị.
- **Edge & Failure Cases:**
  - Đang làm dở Phần 2 (đã chọn 12/35 câu, đồng hồ còn `41:10`), reload trình duyệt hoặc bị OS tắt app → `activeExamDrafts` khôi phục đúng 12 đáp án và thời gian còn lại theo `deadlineMs` (nếu đã quá hạn khi tắt máy thì tự nộp `timed_out`).
  - Mất mạng khi bấm Nộp Phần 1 → UI hiển thị ngay giải thích và lưu cục bộ + xếp hàng `progressOutbox` không báo lỗi chặn học.
  - `ExamListPage.tsx` lấy thời lượng động theo cấp độ và nhận diện thiếu chỉ mục bằng mã lỗi `ExamSourceError` `code: "not-found"` (không kiểm tra chuỗi `": 404"`).
  - `examSource.ts` áp đặt `AbortSignal` `30s` + trần byte `16 MB` theo `SEC-E7-05`.
- **Offline / Cross-Device Sync Scenarios:**
  - Nộp Phần 1 trên Android khi bật Chế độ máy bay → bật Wi-Fi → trong `<= 30s`, đăng nhập cùng tài khoản trên Web thấy ngay đề `2013-07` đã xong Phần 1 (kèm điểm và lời giải) và làm tiếp Phần 2 trên Web.
  - Hai thiết bị mở cùng lượt `in_progress`: partial unique index cho tối đa `1` bản ghi `in_progress` cho `(user_id, level, exam_id)`; đồng bộ chỉ tiến đơn điệu `pending -> submitted|timed_out|skipped`.
- **Security Abuse Cases (`SEC-T04`, `SEC-T05`):**
  - Tài khoản chưa xác nhận email hoặc User B cố đọc/ghi `exam_attempts` của User A → `42501`.
  - Gửi `UPDATE` đẩy ngược `submitted → pending` hoặc sửa đề đã `completed` → trigger `BEFORE UPDATE` từ chối.
  - Gửi JSON `answers` `70 KB` (> `65.536 B`), `sections` > `10` phần tử, `total_questions = 1001`, hoặc `total_score > total_questions` → CHECK `23514` từ chối.
  - Bấm "Xoá tài khoản" → `purgeOwner()` xóa sạch `db.examAttempts` và `db.activeExamDrafts` của `owner` đó (`SEC-T04`).
- **Automated Tests:**
  - Unit/Adapter: `frontend/src/core/exam/engine.test.ts`, `frontend/src/adapters/local-store/exams.test.ts`, `frontend/src/adapters/local-store/progress.test.ts`, `frontend/src/adapters/content-pack/examSource.test.ts`, `frontend/src/adapters/supabase-sync/index.test.ts`
  - DB pgTAP: `backend/supabase/tests/exam_attempts.test.sql` (`SEC-T05`)
  - Web/Sync E2E: `tests/web/exam-practice.spec.ts`, `tests/web/accounts.local.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Mở đề `2013-07` trên Android, nộp Phần 1 → kiểm tra thấy ngay `<RubyText>` + giải thích; tắt hẳn app mở lại → kiểm tra vào tiếp Phần 2 không mất điểm Phần 1.
  - [ ] Đăng nhập cùng tài khoản trên Web → làm tiếp Phần 2 & 3 → bấm Làm lại tạo Lần 2 → kiểm tra cả Lần 1 & Lần 2 hiển thị riêng trên `/tien-do`.

### FR-28: Gói Audio Choukai (Bucket riêng tư Opus) & Shadowing A–B
- **Thuộc:** Phase 2 / Epic 9 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E9-01`, `SEC-E9-02`, `SEC-E9-03`, `SEC-T06`, `SEC-T09`
- **Interfaces:** Consumes private bucket `audio-packs` (`public = false`), Edge Function `sign-audio-pack` (`TTL <= 300s`), `ExtensionPackStore` (Dexie v4 `extensionPacks` / `$APPDATA/extensions/**`), `AudioPort`; Produces offline Opus tracks + `ChoukaiPlayer` Shadowing (`0.75×..1.25×`, loop `A–B`).
- **Happy Path:**
  1. Tài khoản đã xác nhận email mở `/tai-khoan` → quản lý gói mở rộng (`ExtensionPackManagerCard`) → bấm **Tải gói Audio Đề thi N4** → `sign-audio-pack` cấp Signed URL ngắn hạn (`<= 300s`), tải file Opus (`24–32 kbps`), kiểm khớp `sha256` trên byte thô trước khi lưu vào `ExtensionPackStore`.
  2. Tắt mạng, mở đề có audio nguồn (`n4-2013-07`, `n4-2017-07`, `n4-2018-12`, `n4-2021-12`, `n4-2024-07`) ở chế độ **Thi thật** → phát âm thanh cục bộ `< 150 ms`, chỉ phát 1 lần chuẩn JLPT (khóa nút tua).
  3. Sau khi nộp Phần 3 hoặc mở lại bài đã nộp → bật **Chế độ Shadowing**: chọn điểm A–B theo câu thoại, đổi tốc độ `0.75×..1.25×`, bật lặp đoạn, ẩn/hiện script có furigana.
- **Edge & Failure Cases:**
  - Đề `n4-2024-12` (`hasListeningScript: true`, `hasSourceAudio: false`) và `n4-2021-07` (`hasSourceAudio: true`, `listening: 0`) hiển thị đúng trạng thái từ `manifest.json` (dùng Script nghe cho `2024-12`, không lỗi crash).
  - Khách chưa đăng nhập hoặc chưa xác nhận email → UI hướng dẫn đăng nhập/xác nhận email và giữ chế độ Script nghe làm đường lui.
  - Trên iOS Safari / WKWebView, lượt phát đầu tiên kích hoạt trong sự kiện chạm của người dùng; thu hồi `URL.revokeObjectURL` ngay khi đổi bài hoặc unmount (`SEC-E9-03`).
- **Offline / Cross-Device Sync Scenarios:**
  - Tải gói `audio-n4-exams` khi có Wi-Fi, bật chế độ máy bay, đóng hẳn app và mở lại → vẫn nghe đủ toàn bộ đề Choukai offline với `0` request mạng thoát ra ngoài.
- **Security Abuse Cases (`SEC-T03`, `SEC-T06`, `SEC-T09`):**
  - Truy cập public URL tới `audio-packs` không có token → `400/401/403`.
  - User chưa xác nhận email gọi `sign-audio-pack` → `401/403`; user xác nhận email thử `INSERT/DELETE` lên `storage.objects` → `42501`; gọi `31` lần/giờ → `429`; `objectPath` chứa `../` → `400`.
  - PWA Service Worker không cache `sign-audio-pack` hay Signed URL có `?token=` (`SEC-T03`); CSP Desktop/Mobile dùng `media-src 'self' blob: https://<ref>.supabase.co`, không dùng `*` (`SEC-T09`).
  - Sai 1 byte `sha256` hoặc giải nén vượt `100 MB` → `ExtensionPackStore` từ chối lưu (`SEC-E9-01`).
- **Automated Tests:**
  - Infra/Unit: `frontend/src/core/extensions/validate.test.ts`, `infra/scripts/src/{extensions,build-audio-packs,tauri-csp-contract}.test.ts`, `frontend/src/adapters/extensions/{extensionTransport,dexieExtensionStore}.test.ts`, `frontend/src/adapters/audio/webAudioAdapter.test.ts`, `frontend/src/components/exam/ChoukaiPlayer.test.tsx`, `frontend/src/components/account/ExtensionPackManagerCard.test.tsx`
  - Backend pgTAP & Deno: `backend/supabase/tests/audio_packs.test.sql`, `backend/supabase/tests/functions.test.ts` (`SEC-T06`)
  - Web E2E: `tests/web/audio-choukai.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Đăng nhập tài khoản đã xác nhận email trên Android/iOS → tải gói audio → bật chế độ máy bay → mở đề `2024-07` kiểm tra chạm phát trong `< 150 ms`.
  - [ ] Chế độ Thi thật: xác nhận không tua được; Shadowing: đặt A–B và tốc độ `0.75×` / `1.25×` nghe mượt, không rò âm khi thoát trang.

### FR-29: Mô phỏng điểm liệt JLPT 180đ & Bộ ôn cấp tốc 10 phút
- **Thuộc:** Phase 1 / Epic 7 (`Web`, `Desktop`, `Mobile`) | **Specs:** `mazii-benchmark-va-ke-hoach-phat-trien.md` §5.3 & §6.2
- **Interfaces:** Consumes `ExamAttemptRecord` (`sections[]`, `answers`); Produces điểm quy đổi `/120`, `/60`, `/180`, cảnh báo điểm liệt (`< 38/120`, `< 19/60`) và danh sách mục ôn 10 phút (`QuickRemediationModal`).
- **Happy Path:**
  1. Hoàn thành đề 3 phần → màn Tổng kết hiển thị `JlptScoreBreakdown` gồm 3 thanh điểm: **Kiến thức ngôn ngữ & Đọc hiểu (`/120`, vạch liệt `38`)**, **Nghe hiểu (`/60`, vạch liệt `19`)**, **Tổng (`/180`, vạch đỗ `90`)**.
  2. Tổng `>= 90` nhưng `Nghe hiểu < 19` → hiển thị cảnh báo đỏ son (`destructive`): *"Đủ tổng điểm nhưng liệt phần Nghe hiểu"*.
  3. Bấm **"Ôn cấp tốc 10 phút từ đề này"** → mở `QuickRemediationModal` tập trung tối đa `15` mục từ vựng, kanji, ngữ pháp liên quan đến câu làm sai.
- **Edge & Failure Cases:**
  - Đề bỏ qua Nghe (`skipped`) hoặc đề 57 câu không có Nghe (`2023-07`, `2025-07`, `2021-07`) → hiển thị rõ nhãn chưa tính điểm Nghe, không gán nhầm nhãn trượt liệt oan.
  - Đạt 100% câu đúng → ẩn nút ôn cấp tốc hoặc báo *"Không có câu sai trong lượt thi này"*.
- **Offline / Cross-Device Sync Scenarios:**
  - Tính toán điểm liệt 180đ và trích xuất bộ ôn 10 phút chạy 100% cục bộ từ `core/exam/{scoring,remediation}.ts`; xem lại lịch sử đồng bộ trên máy thứ 2 vẫn hiển thị đúng biểu đồ điểm liệt.
- **Security Abuse Cases:**
  - Chỉ hiển thị tối đa `1` con dấu `.hanko` trên màn Tổng kết; không dùng `dangerouslySetInnerHTML` khi render ghi chú câu sai.
- **Automated Tests:**
  - Unit: `frontend/src/core/exam/scoring.test.ts` (`37/120` vs `38/120`, `18/60` vs `19/60`, `89/180` vs `90/180`), `frontend/src/core/exam/remediation.test.ts`
  - Web E2E: `tests/web/exam-practice.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Nộp đề có Phần 1+2 cao nhưng Phần 3 điểm thấp → xác nhận cảnh báo liệt `< 19/60` hiển thị rõ trên màn `360px` và bấm **"Ôn cấp tốc 10 phút"** vào đúng câu sai.

### FR-30: Động cơ ôn tập lặp lại ngắt quãng (FSRS-5)
- **Thuộc:** Phase 2 / Epic 8 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E8-01`, `SEC-E8-02`, `SEC-T04`, `SEC-T07`
- **Interfaces:** Consumes `card_status` (v1), `srsCards`/`srsReviews` (Dexie v4), `srs_cards`/`srs_reviews` (Supabase); Produces `scheduleCard(card, rating: 1|2|3|4, now)` và gương `card_status.known = (rating >= 3)`.
- **Happy Path:**
  1. Migration Dexie v3 → v4 + `srsStore.ensureSoftMigrated()` ánh xạ mềm `card_status.known = true` sang thẻ FSRS khởi tạo (giữ nguyên số từ đã thuộc trên `/tien-do` và `/tu-vung`).
  2. Lật thẻ `/tu-vung` → hiện 4 nút ngang `FsrsRatingBar` (**Quên (1) · Khó (2) · Tốt (3) · Dễ (4)**) kèm gợi ý khoảng thời gian (`10 phút`, `1 ngày`, `4 ngày`, `7 ngày`); phím tắt `1–4` trên Desktop và chạm 1 tay trên Mobile → ghi `srsReviews` (UUID v4) + cập nhật `srsCards`.
  3. Trang chủ (`ProgressPanel`) và `/tu-vung` hiển thị chính xác `dueCount`.
- **Edge & Failure Cases:**
  - Bấm lặp phím `3` nhanh liên tiếp lúc chuyển thẻ → debounce chống đánh giá nhầm sang thẻ kế tiếp.
  - Đồng hồ thiết bị lùi hoặc lệch ngày → `core/srs/` kẹp `elapsedDays >= 0`, `stability ∈ [0, 100000]`, `difficulty ∈ [0, 10]`, timestamp ISO chuẩn 4 chữ số năm (`0001..9999`).
- **Offline / Cross-Device Sync Scenarios:**
  - Ôn 20 thẻ FSRS khi tắt mạng → bật mạng trong `<= 30s` đồng bộ `srs_cards` (LWW) và `srs_reviews` (append-only `on conflict do nothing`) lên Supabase; máy thứ 2 kéo về giảm đúng `dueCount`.
- **Security Abuse Cases (`SEC-T04`, `SEC-T07`):**
  - Chèn `srs_reviews` với `rating = 5` hoặc gửi `UPDATE` sửa lịch sử `srs_reviews` → từ chối (`23514`/`42501`).
  - Chèn `srs_cards` với `stability = -1`, `NaN`/`Infinity`, hoặc `item_id` `129` ký tự → CHECK từ chối.
  - `purgeOwner()` xóa sạch `srsCards` và `srsReviews` theo `owner` (`SEC-T04`).
- **Automated Tests:**
  - Unit: `frontend/src/core/srs/{fsrs,migration,validate}.test.ts`, `frontend/src/adapters/local-store/{srs,progress}.test.ts`
  - DB pgTAP: `backend/supabase/tests/srs.test.sql` (`SEC-T07`)
  - Web/Sync/Desktop E2E: `tests/web/fsrs-review.spec.ts`, `tests/web/routes.spec.ts`, `tests/web/guest-progress.spec.ts`, `tests/web/accounts.local.spec.ts`, `tests/desktop/smoke.mjs` (cập nhật luồng FSRS từ Epic 8: bỏ `mark_known_button` khi chưa lật thẻ; lật thẻ rồi bấm `vocabulary.fsrs.rate_3` `"Tốt"` và giữ nguyên `[data-ocid="flashcard.status_badge"]` `"Đã thuộc"`).
- **Manual Tester Steps:**
  - [ ] Nâng cấp từ dữ liệu v1 có sẵn 10 từ đã thuộc → kiểm tra bảo toàn 10 từ; đánh giá 5 thẻ trên màn `360px` kiểm tra 4 nút cao `>= 44px`, không tràn ngang.

### FR-31: Phát âm chuẩn (TTS / Audio) & Nhấn âm (Pitch Accent)
- **Thuộc:** Phase 2 / Epic 9 & Phase 3 / Epic 11 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E9-01`, `SEC-E9-03`, `SEC-T09`
- **Interfaces:** Consumes `AudioPort`, `ExtensionPackStore` (`audio-n4-vocab`), Kanjium pitch table (`CC BY-SA 4.0`); Produces `SpeakButton` + `PitchBadge`.
- **Happy Path:**
  1. Từ vựng, ví dụ ngữ pháp và mục tra cứu hiển thị ký hiệu Pitch Accent (`PitchBadge`) khi gói dữ liệu có sẵn.
  2. Bấm `SpeakButton` → `AudioPort` phát Opus cục bộ (`< 150 ms`) → nếu chưa tải gói thì stream khi online → nếu không có audio gói thì lùi sang `speechSynthesis` `ja-JP`.
- **Edge & Failure Cases:**
  - Máy chưa cài giọng `ja-JP` và chưa tải gói Opus → hiện gợi ý nhẹ hướng dẫn tải gói Audio hoặc cài TTS tiếng Nhật, không im lặng/crash.
  - Bấm phát liên tiếp 3 từ → dừng audio trước (`stop()`), không chồng âm.
- **Offline / Cross-Device Sync Scenarios:**
  - Khi đã tải `audio-n4-vocab`, tắt mạng hoàn toàn trên Web/Desktop/Mobile → mọi từ vựng đều phát bằng Opus cục bộ.
- **Security Abuse Cases (`SEC-T09`):**
  - CSP Desktop/Mobile khóa `media-src 'self' blob: https://<ref>.supabase.co`, không dùng `*`; `/gioi-thieu` (`AboutPage.tsx`) và `NOTICE` ghi rõ nguồn `Kanjium (CC BY-SA 4.0)`.
- **Automated Tests:**
  - Unit: `frontend/src/core/audio/pitch.test.ts`, `frontend/src/adapters/audio/webAudioAdapter.test.ts`, `infra/scripts/src/build-pitch-pack.test.ts`
  - Web E2E: `tests/web/audio-choukai.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Tắt mạng Android sau khi tải gói audio từ vựng → bấm loa 5 thẻ liên tiếp kiểm tra `< 150 ms` và không chồng tiếng; thử trên máy không có giọng `ja-JP` kiểm tra thông báo gợi ý.

### FR-32: Furigana toàn diện & Chạm để tra từ (Click-to-Lookup)
- **Thuộc:** Phase 1 / Epic 7 (Furigana N4 `1.1.0`) & Phase 3 / Epic 11 (Popup tra từ `WordLookupHost`) | **Specs:** `build-packs.ts:63`, `core/content/types.ts:71`, `GrammarKeigoPage.tsx`
- **Interfaces:** Consumes `ContentPack` (`1.1.0` có `textRuby`/`reading` kiểm duyệt), `DictionaryRepository`; Produces `<RubyText>` + công tắc `Hiện Furigana` + `InteractiveJaText` & `WordLookupHost` (Desktop Popover / Mobile Bottom Sheet `<= 45dvh`).
- **Happy Path:**
  1. Gói N4 nâng `1.0.0` → `1.1.0`; ví dụ Ngữ pháp (`GrammarExample.reading`) và 8 bài Đọc hiểu (`passage.textRuby`) hiển thị `<ruby><rt>...</rt></ruby>` chuẩn xác.
  2. Công tắc **Hiện Furigana** mặc định bật ở `/doc-hieu` và `/ngu-phap` (tắt lúc đang làm đề thi, chỉ bật sau nộp); tắt công tắc ẩn `<rt>` mượt mà.
  3. Tại `/doc-hieu`, `/ngu-phap` và chữa đề `/luyen-de` (chỉ khi `activeStatus !== "in_progress"`): chạm từ → Desktop mở Popover sát từ, Mobile mở Bottom Sheet (`<= 45%` chiều cao màn hình) hiện nghĩa, Hán Việt, Pitch, nút Nghe, Chia 13 thể, Lưu Sổ tay, Tạo Cloze.
- **Edge & Failure Cases:**
  - `GrammarKeigoPage.tsx:227,235` (`kenjogoI` & `kenjogoII`) bổ sung đủ `lang="ja"`.
  - Chạm dấu câu (`。`, `、`, `「`) hoặc khoảng trắng → không bật popup rác; khi đang làm đề thi tính giờ (`activeStatus === "in_progress"`), chạm vào từ không mở popup để tránh lộ đáp án.
- **Offline / Cross-Device Sync Scenarios:**
  - Dữ liệu `textRuby` thuộc gói `1.1.0` lưu Dexie; công tắc Furigana lưu `db.settings`; tra từ offline đọc từ gói Minna + gói từ điển mở đã tải.
- **Security Abuse Cases:**
  - Chuỗi `{base|reading}` chứa `<img src=x onerror=alert(1)>` → `RubyText.tsx` render thuần React text node, không dùng `dangerouslySetInnerHTML`.
  - `pnpm packs:verify` xác nhận giữ nguyên 1.182 vocab, 118 kanji, 388 compounds, 148 grammar, 8 reading IDs gốc.
- **Automated Tests:**
  - Infra/Unit: `infra/scripts/src/verify-furigana.test.ts`, `frontend/src/core/content/validate.test.ts`, `frontend/src/core/exam/ruby.test.ts`, `frontend/src/components/lookup/WordLookupHost.test.tsx`
  - Web E2E: `tests/web/furigana-and-keigo.spec.ts`, `tests/web/dictionary-notebooks.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Chạy `pnpm packs:verify` kiểm N4 `1.1.0`; mở `/ngu-phap/kinh-ngu` kiểm tra font tiếng Nhật của cả Khiêm nhường ngữ I & II.
  - [ ] Trên điện thoại `360px`, chạm động từ trong Bài đọc 01 → kiểm tra Bottom Sheet chiếm `<= 45%` chiều cao màn hình.

### FR-33: Kanji nâng cao (Nét động KanjiVG, Bộ thủ & Mẹo nhớ cá nhân)
- **Thuộc:** Phase 2 / Epic 10 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E10-01`, `SEC-E10-02`, `SEC-T04`, `SEC-T07`, `SEC-T10`
- **Interfaces:** Consumes `ExtensionPackStore` (`kanjivg-n4`, `kanjivg-joyo`), `user_mnemonics` (Dexie v4 + Supabase); Produces `KanjiStrokePlayer` (`<svg><path d=... /></svg>` + nút `Vẽ lại`), `KanjiRadicalTree`, `KanjiDetailSheet` + Mẹo nhớ cá nhân đồng bộ.
- **Happy Path:**
  1. Tải gói `kanjivg-n4` (~250 KB) → mở chữ `食` tại `/kanji/tra-cuu` hoặc sau câu trả lời `/kanji` → hiển thị hoạt ảnh SVG thứ tự nét kèm số thứ tự, nút **Vẽ lại**, cây phân tách bộ thủ và từ ghép nhóm theo Kun/On.
  2. Nhập **Mẹo nhớ cá nhân** cho chữ `食` → lưu cục bộ và đồng bộ lên `user_mnemonics`.
- **Edge & Failure Cases:**
  - Chưa tải `kanjivg-n4` khi offline → vẫn hiện đầy đủ Hán Việt, On/Kun, Nghĩa, Từ ghép như v1 kèm nút gợi ý tải gói.
  - Mẹo nhớ `> 1.000` ký tự → UI chặn và báo giới hạn trước khi sync.
  - `prefers-reduced-motion: reduce` → hiển thị tĩnh đầy đủ nét kèm số `1..N`, không chạy animation nét.
- **Offline / Cross-Device Sync Scenarios:**
  - Nhập Mẹo nhớ offline trên Desktop → bật mạng → đồng bộ LWW lên Supabase; Android kéo về thấy đúng mẹo nhớ.
- **Security Abuse Cases (`SEC-T04`, `SEC-T07`, `SEC-T10`):**
  - **KanjiVG Sanitization (`SEC-T10`):** Đường ống build biên dịch KanjiVG sang JSON thuần `<path d>` lọc regex `^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$` (`<= 2.048` ký tự/nét, `<= 40` nét); frontend dùng React JSX thuần (cấm `dangerouslySetInnerHTML`, `<script>`, `on*`, `<foreignObject>`, `<use>`, `<!ENTITY>`).
  - **RLS & Bounds (`SEC-T07`, `SEC-T04`):** `user_mnemonics` riêng tư từng user (`user_id = auth.uid()` + `has_confirmed_email()`), CHECK `1..1000` ký tự không chứa `\0`, xóa sạch trong `purgeOwner()`.
  - **Giấy phép:** Phân phối KanjiVG (`CC BY-SA 3.0`) thành gói tĩnh tách rời khỏi mã `AGPL-3.0-only`, ghi nguồn Ulrich Apel / KanjiVG ở `/gioi-thieu` (`AboutPage.tsx`) và `NOTICE-KANJIVG.txt`.
- **Automated Tests:**
  - Infra/Unit: `infra/scripts/src/kanjivg-pack.test.ts`, `frontend/src/core/kanji/svgSanitizer.test.ts`, `frontend/src/components/kanji-library/KanjiStrokePlayer.test.tsx`, `frontend/src/adapters/local-store/mnemonics.test.ts` (`SEC-T10`, `SEC-T04`)
  - DB pgTAP: `backend/supabase/tests/user_mnemonics.test.sql` (`SEC-T07`)
  - Web E2E: `tests/web/kanji-kanjivg.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Kiểm chữ `食` khi bật và tắt `prefers-reduced-motion`; nhập Mẹo nhớ tiếng Việt có dấu + kiểm tra đồng bộ sang thiết bị 2; thử nhập 1.001 ký tự kiểm tra chặn đúng.

### FR-34: Nhận dạng viết tay Kanji tự do offline & Phiếu tập viết PDF
- **Thuộc:** Phase 2 / Epic 10 (viết tay offline) & Phase 3 / Epic 11 (phiếu PDF từ Sổ tay) | **Kiểm soát:** `SEC-E10-03`
- **Interfaces:** Consumes `ExtensionPackStore` (chỉ mục nét KanjiVG), Dedicated Web Worker (`strokeMatcher.worker.ts`) sau `adapters/kanji-worker/strokeMatcherClient.ts`; Produces Top-K ứng viên Kanji + `GenkoyoshiCanvas` + `KanjiWritingSheetDialog` (`@media print`).
- **Happy Path:**
  1. Vẽ chữ `食` hoặc `語` bằng chuột/ngón tay trên `GenkoyoshiCanvas` tại `/kanji/tra-cuu` → Worker trả top ứng viên đúng chữ trong `< 100 ms`, chạm vào mở `KanjiDetailSheet`.
  2. Tab **Tập đồ theo nét** cho đồ theo nét mẫu mờ.
  3. Chọn Bài Minna (hoặc mở Sổ tay `/so-tay` ở Epic 11) → bấm **In / Xuất phiếu tập viết PDF** → `KanjiWritingSheetDialog` sinh lưới Genkoyoshi A4 sạch sắc nét qua `window.print()`.
- **Edge & Failure Cases:**
  - Vẽ 1 điểm chấm, nét nguệch ngoạc, hoặc bấm Hoàn tác/Xóa liên tục → không lỗi `NaN`, không lag main thread.
  - Khung canvas đặt `touch-action: none` để điện thoại không bị trượt cuộn dọc khi kéo nét.
  - Trên Mobile WebView không hỗ trợ `window.print()`, vẫn xem trước bảng Genkoyoshi và hiện hướng dẫn rõ thay vì lỗi im lặng.
- **Offline / Cross-Device Sync Scenarios:**
  - Bật Chế độ máy bay → vẽ tay tra 10 chữ liên tiếp hoạt động 100% offline, `0` request tới `inputtools.google.com` hay server ngoài.
- **Security Abuse Cases (`SEC-E10-03`):**
  - Worker static `worker-src 'self'`, `0` network, giới hạn cứng đầu vào tối đa `40` nét × `500` điểm/nét và timeout `<= 2.000 ms` chống DoS/OOM trên WebView di động.
- **Automated Tests:**
  - Unit: `frontend/src/core/kanji/{strokeMatcher,writingSheet}.test.ts`, `frontend/src/adapters/kanji-worker/strokeMatcherClient.test.ts`, `frontend/src/components/kanji-library/GenkoyoshiCanvas.test.tsx`, `frontend/src/pages/NotebooksPage.test.tsx`
  - Web E2E: `tests/web/kanji-kanjivg.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Ở chế độ máy bay trên Android thật, vẽ chữ `学` và `飲` → xác nhận màn hình không cuộn theo ngón tay và gợi ý ra đúng chữ; trên Windows xuất thử phiếu PDF Bài 30 và từ Sổ tay kiểm tra bố cục in.

### FR-35: Tra cứu hợp nhất (`Ctrl+K`) + Từ điển mở qua kiểm duyệt + Chia 13 thể
- **Thuộc:** Phase 3 / Epic 11 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E11-03`, `SEC-T11`
- **Interfaces:** Consumes `ContentPack` (Minna), `ExtensionPackStore` (`dict-javi-core` kiểm duyệt), `conjugateJapanese()`, `buildMinnaKnowledgeGraph()`; Produces `GlobalSearchDialog` (`Ctrl+K`), `ConjugationDrawer` 13 thể + `MinnaCrossLinks`.
- **Happy Path:**
  1. Nhấn `Ctrl+K` (hoặc nút kính lúp Mobile) → gõ `"taberu"`, `"食べる"`, `"ăn"`, hoặc `"hoc"` → kết quả trả về `< 50 ms`, kết quả thuộc giáo trình Minna N4/N3 (kèm số Bài) luôn xếp trên từ điển mở rộng.
  2. Mở chi tiết động từ/tính từ → hiển thị `ConjugationDrawer` **13 thể** tự động + `MinnaCrossLinks` nhảy 1 chạm tới `/ngu-phap/cach-chia`, `/ngu-phap/tu-dong-tha-dong`, `/ngu-phap/so-sanh`.
- **Edge & Failure Cases:**
  - Chia đúng các động từ bất quy tắc (`する`, `来る`, `行く`, `帰る` nhóm 1, `ある`) và tính từ `い` (`いい / よい`).
  - Khi chưa tải `dict-javi-core`, `Ctrl+K` vẫn tìm ngay trên gói Minna hiện hành.
  - Chuỗi nhập chứa ký tự regex đặc biệt (`[`, `(`, `*`, `\`) → không văng `SyntaxError`.
- **Offline / Cross-Device Sync Scenarios:**
  - Tải `dict-javi-core` (~30.000 mục) → bật chế độ máy bay → tìm 10 từ bất kỳ hoàn tất `< 50 ms`.
- **Security & Semantic QA Gate (`SEC-E11-03`, `SEC-T11`):**
  - Script QA `infra/scripts/src/dict-pack.ts` bắt buộc kiểm tra gói `dict-javi-core` trước phát hành: không mâu thuẫn nghĩa Minna, không rỗng nghĩa Việt, không lỗi font/encoding, chỉ dùng nguồn `EDRDG/JMdict CC BY-SA 4.0` (0 cào API Mazii).
  - Nạp gói qua `ExtensionPackStore` kiểm SHA-256 + `safeJsonParse()` (chặn `__proto__`/`constructor`/`prototype`, `SEC-T11`), 0 HTML thực thi.
- **Automated Tests:**
  - Unit & Benchmark: `frontend/src/core/japanese/{normalize,conjugate}.test.ts`, `frontend/src/core/dictionary/{validate,search}.test.ts` (`< 50 ms` / `30.000` mục), `infra/scripts/src/dict-pack.test.ts`, `frontend/src/core/content/knowledgeGraph.test.ts`, `frontend/src/components/dictionary/GlobalSearchDialog.test.tsx`
  - Web E2E: `tests/web/dictionary-notebooks.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Nhấn `Ctrl+K`, gõ `todokeru` và `gửi` → kiểm tra mục Minna đứng đầu và mở được liên kết Cặp tự/tha động từ; đối chiếu ngẫu nhiên 20 từ chia 13 thể.

### FR-36: Sổ tay cá nhân không giới hạn & Xuất/Nhập Anki (`.tsv`/`.csv`/JSON)
- **Thuộc:** Phase 3 / Epic 11 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E11-01`, `SEC-E11-02`, `SEC-T04`, `SEC-T07`, `SEC-T11`
- **Interfaces:** Consumes `notebooks`/`notebookItems` (Dexie v4 + Supabase `20261127000500_notebooks_and_items.sql`), `FSRS` (`FR-30`); Produces trang `/so-tay` (`NotebooksPage`), ôn FSRS theo sổ tay + `AnkiTransferDialog` (`.tsv`/`.csv`/JSON).
- **Happy Path:**
  1. Vào `/so-tay`, tạo nhiều Sổ tay, lưu > 500 mục (không khóa 500 từ như Mazii miễn phí) gồm từ vựng, kanji, ngữ pháp, thẻ Cloze → bấm **Ôn FSRS sổ tay này**.
  2. Xuất `.tsv`/`.csv` UTF-8 đầy đủ cột Kanji, Furigana, Hán Việt, Nghĩa, Ví dụ, Tag → mở chuẩn trên Anki/Excel.
  3. Nhập `.csv`/`.tsv`/`.json` → xem trước 5 dòng hợp lệ, nhập vào Sổ tay và ôn được ngay.
- **Edge & Failure Cases:**
  - File sai định dạng, thiếu cột, file nhị phân đổi đuôi `.csv`, file rỗng → báo rõ dòng lỗi, không phá sổ tay hiện có.
  - Xóa Sổ tay → dọn sạch `notebookItems` liên kết (`ON DELETE CASCADE`).
- **Offline / Cross-Device Sync Scenarios:**
  - Tạo Sổ tay và thêm 15 từ offline trên Web → bật mạng → đồng bộ LWW lên Supabase trong `<= 30s`; đăng nhập Android thấy đủ 15 từ.
- **Security Abuse Cases (`SEC-T04`, `SEC-T07`, `SEC-T11`):**
  - **IDOR & Cạn dung lượng (`SEC-T07`):** Khóa ngoại kép `FOREIGN KEY (user_id, notebook_id) REFERENCES notebooks(user_id, id)` chặn User A chèn item vào `notebook_id` của User B; giới hạn DB `<= 200` sổ tay/user, `<= 20.000` items/user, `payload <= 4.096 B`, `note <= 1.000` ký tự; xóa sạch trong `purgeOwner()` (`SEC-T04`).
  - **CSV Formula Injection & Prototype Pollution (`SEC-T11`):** Xuất `.csv`/`.tsv` trung hòa ô bắt đầu bằng `[=+\-@\t\r]` bằng tiền tố `'`; nhập chặn file `> 5 MB` / `> 5.000` dòng / ô `> 1.000` ký tự, strip sạch thẻ HTML (`<img onerror=...>`), dùng `safeJsonParse()` chặn `__proto__`/`constructor`/`prototype` (độ sâu `<= 16`).
- **Automated Tests:**
  - Unit: `frontend/src/adapters/local-store/notebooks.test.ts`, `frontend/src/core/notebook/ankiCodec.test.ts`, `frontend/src/core/extensions/validate.test.ts`, `frontend/src/pages/NotebooksPage.test.tsx` (`SEC-T04`, `SEC-T11`)
  - DB pgTAP: `backend/supabase/tests/notebooks.test.sql` (`SEC-T07`)
  - Web/Sync E2E: `tests/web/dictionary-notebooks.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Xuất Sổ tay có từ chứa `=1+1` ở phần ghi chú ra `.csv`, mở bằng Excel/LibreOffice Calc → xác nhận hiển thị dạng text `'=1+1`, không tự tính công thức; nhập file `.tsv` vào Anki Desktop kiểm tra font Nhật–Việt.

### FR-37: Khai thác câu 1 chạm (Sentence Mining Cloze)
- **Thuộc:** Phase 3 / Epic 11 (`Web`, `Desktop`, `Mobile`) | **Specs:** `mazii-benchmark-va-ke-hoach-phat-trien.md` §5.1, `SEC-E11-01`
- **Interfaces:** Consumes `WordLookupHost` (`FR-32`), câu văn từ `/doc-hieu`, `/ngu-phap` & `/luyen-de`; Produces thẻ `Cloze` trong `notebooks`/`notebookItems` + `srsCards` (`cardType: "cloze"`).
- **Happy Path:**
  1. Tại `/doc-hieu/reading-01` hoặc chữa đề `/luyen-de/n4-2024-07`, chạm vào từ trong câu → bấm **"Tạo thẻ ngữ cảnh (Cloze)"** → trích đúng câu gốc, đục lỗ `【 ___ 】` đúng vị trí từ đã chạm (kể cả động từ đã chia thể), kèm nghĩa Việt, Hán Việt và mã nguồn (`N4 Đề 07/2024 · Câu 14`) vào Sổ tay + FSRS.
- **Edge & Failure Cases:**
  - Từ xuất hiện 2 lần trong cùng câu hoặc ở dạng đã chia (`食べました` vs `食べる`) → đục lỗ đúng span vị trí đã chạm.
  - Bấm lặp 2 lần cùng 1 từ trên 1 câu → phát hiện trùng thay vì tạo thẻ rác.
- **Offline / Cross-Device Sync Scenarios:**
  - Tạo thẻ Cloze offline khi chữa đề → thẻ vào ngay hàng đợi FSRS và đồng bộ qua `notebook_items`/`srs_cards` khi có mạng.
- **Security Abuse Cases:**
  - Chuỗi câu trích hoặc source tag chỉ render qua React text node (0 `dangerouslySetInnerHTML`) và kiểm độ dài payload `<= 4.096 B` (`SEC-E11-01`).
- **Automated Tests:**
  - Unit: `frontend/src/core/cloze/extract.test.ts`, `frontend/src/components/lookup/WordLookupHost.test.tsx`
  - Web E2E: `tests/web/dictionary-notebooks.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Chữa đề N4 ở chế độ máy bay, chạm vào động từ đã chia quá khứ (`食べました`), bấm tạo thẻ Cloze → kiểm tra ô trống `【 ___ 】` đặt đúng vị trí trong `/so-tay`.

### FR-38: Mini-drill Ngữ pháp tương tác & Ôn lại Kanji hay sai + Tìm kiếm từ vựng
- **Thuộc:** Phase 1 / Epic 7 (`Web`, `Desktop`, `Mobile`) | **Specs:** `AGENTS.md`, `VocabularyPage.tsx`, `KanjiQuizPage.tsx`, `ProgressPage.tsx#L180-L199`
- **Interfaces:** Consumes `ContentPack`, `mostMissed` (`ProgressPage`), `db.settings`; Produces `MiniDrillPanel` tại 3 trang `/ngu-phap/{cach-chia,kinh-ngu,tu-dong-tha-dong}`, lọc Bài Minna ở `/kanji`, tìm kiếm + lưu bộ lọc ở `/tu-vung`, nút **"Luyện lại 10 chữ hay sai"** ở `/tien-do`.
- **Happy Path:**
  1. `/ngu-phap/$patternId` giữ nguyên chỉ có Cách chia, Ý nghĩa, Cách dùng, Ví dụ (không gắn quiz, đúng `AGENTS.md`).
  2. 3 trang `/ngu-phap/cach-chia`, `/ngu-phap/kinh-ngu`, `/ngu-phap/tu-dong-tha-dong` có chế độ **Luyện tập nhanh (`MiniDrillPanel`)** tương tác ngay tại trang.
  3. `/tien-do` hiện nút 1 chạm ôn lại `mostMissed` dẫn thẳng sang `/kanji`; `/kanji` có lọc Bài Minna; `/tu-vung` có ô tìm kiếm bỏ dấu + lưu bộ lọc Bài/Mục vào `db.settings`.
- **Edge & Failure Cases:**
  - `mostMissed.length === 0` → ẩn khối hay sai trên `/tien-do`.
  - Tìm từ vựng không có kết quả → hiện trạng thái trống + nút xóa tìm kiếm (`>= 44px`).
  - Lọc Bài Minna có `poolSize < 10` → `clampQuestionCount` điều chỉnh đúng về `poolSize`.
- **Offline / Cross-Device Sync Scenarios:**
  - Bộ lọc lưu cục bộ ở `db.settings`; mini-drill và ôn lại kanji chạy 100% offline, kết quả trắc nghiệm đồng bộ qua `kanji_quiz_attempts`.
- **Security Abuse Cases:**
  - Tìm kiếm chuẩn hóa dùng `.includes()` trên chuỗi thường, không tạo `new RegExp(query)` để tránh ReDoS.
- **Automated Tests:**
  - Unit: `frontend/src/components/kanji-quiz/quizEngine.test.ts`, `frontend/src/core/grammar/miniDrill.test.ts`
  - Web E2E: `tests/web/grammar-extended.spec.ts` (giữ assert số mục `27/22/17/12` + kiểm `/ngu-phap/grammar-G001` không có quiz), `tests/web/study-upgrades.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Làm sai 3 Kanji, vào `/tien-do` bấm nút luyện lại 1 chạm; lọc Bài 35 ở `/tu-vung`, chuyển trang rồi quay lại kiểm tra vẫn giữ Bài 35.

### FR-39: Chế độ tối "Sumi đêm" & Điều hướng Mobile 5 tab mới (`MOBILE_TABS`)
- **Thuộc:** Phase 1 / Epic 7 (`Web`, `Desktop`, `Mobile`) | **Specs:** `Layout.tsx#L38-L62`, `index.css#L101-L155`, `App.tsx#L43`, `scene/tokens.ts`
- **Interfaces:** Consumes `db.settings["theme"]` (`light | dark | system`), `prefers-color-scheme`; Produces `useThemePreference`, `frontend/public/theme-init.js`, class `html.dark`, `<Toaster theme={...} />`, dark palette ở `scene/tokens.ts`, và `MOBILE_TABS` 5 mục.
- **Happy Path:**
  1. Ở `/tai-khoan`, chuyển giữa Sáng (Washi), Tối (Sumi đêm) và Theo hệ thống → `html.dark` cập nhật tức thì, `<Toaster>` đổi theme đồng bộ, cảnh 3D `DeskHeroCanvas` chuyển vật liệu tối dịu.
  2. Trên Mobile (`360×640`), `MOBILE_TABS` hiển thị đúng 5 tab: **`Trang chủ` · `Ôn tập` · `Luyện đề` · `Tra cứu` · `Tiến độ`** giúp vào `/doc-hieu` và `/luyen-de` trong `<= 2` chạm.
- **Edge & Failure Cases:**
  - Không lóe trắng (FOUC) khi reload ở chế độ Tối; 5 tab ở `360px` không cắt chữ khó hiểu, `scrollWidth === 360`, nút cao `>= 44px`.
  - Tất cả 18 route v1 truy cập trực tiếp vẫn trả HTTP `200` và highlight đúng tab cha.
- **Offline / Cross-Device Sync Scenarios:**
  - Lưu theme cục bộ trong `localStorage` + `db.settings` hoạt động tức thì khi offline.
- **Security Abuse Cases:**
  - `frontend/public/theme-init.js` tải qua `<script src="/theme-init.js">` (file tĩnh cùng origin, không inline script phá CSP `script-src 'self'` ở `SEC-E7-02`) và chỉ chấp nhận whitelist `"light" | "dark" | "system"`.
- **Automated Tests:**
  - Unit: `frontend/src/hooks/useThemePreference.test.ts`, `frontend/src/scene/tokens.test.ts`, `frontend/src/components/Layout.test.tsx`
  - Web E2E: `tests/web/routes.spec.ts`, `tests/web/theme-and-mobile-nav.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Bật chế độ **Sumi đêm** trên điện thoại trong phòng tối, kiểm tra độ dễ đọc ở Trang chủ 3D, Đọc hiểu, Đề thi và Toast; kiểm tra mở `/doc-hieu` và `/luyen-de` trong `<= 2` chạm từ thanh tab dưới đáy.

### FR-40: Chuỗi ngày học (Streak), Mục tiêu ngày & Biểu đồ tiến độ (Heatmap 12 tuần)
- **Thuộc:** Phase 2 / Epic 8 (`Web`, `Desktop`, `Mobile`) | **Specs:** `AD-14`, `AGENTS.md`, `ProgressPage.tsx`
- **Interfaces:** Consumes các bảng lượt thực tế (`srs_reviews`, `kanji_quiz_attempts`, `reading_attempts`, `exam_attempts`) theo múi giờ cục bộ qua `core/progress/activity.ts`; Produces `DailyGoalCard` và `StudyHeatmap` 12 tuần (mực chàm ai-zome).
- **Happy Path:**
  1. Người dùng đã có lịch sử học mở `/tien-do` → thấy **Mục tiêu hôm nay (`DailyGoalCard`)**, **Chuỗi ngày học (Streak)** và **Heatmap 12 tuần (`StudyHeatmap`)** dùng sắc độ màu chàm ai-zome.
  2. Hoàn thành 1 lượt ôn FSRS / trắc nghiệm → chỉ số hôm nay và ô ngày trên heatmap cập nhật ngay.
- **Edge & Failure Cases:**
  - **Bất biến bắt buộc (`AGENTS.md`):** Khi tài khoản mới hoặc khách **chưa có tiến độ ở cấp độ hiện tại** → `/tien-do` chỉ hiện `data-ocid="progress.empty_state"` với thông điệp **`"Bạn chưa có tiến độ nào ở cấp độ này"`**; tuyệt đối không vẽ `StudyHeatmap`, không hiện `DailyGoalCard`, `0 ngày`, hay `0%`.
  - Xử lý đúng ranh giới 00:00 theo múi giờ người dùng (UTC+7 / UTC+9).
- **Offline / Cross-Device Sync Scenarios:**
  - Học offline ở ngày T rồi sync vào ngày T+1 → tính dẫn xuất dùng `client_updated_at` / `reviewedAt` nên ngày T vẫn được ghi nhận chính xác trên thiết bị 2.
- **Security Abuse Cases:**
  - Timestamp nằm ngoài biên `0001..9999` hoặc `infinity` bị `timestampKey` và Postgres `CHECK` từ chối; không cho client ghi đè trực tiếp số tổng streak.
- **Automated Tests:**
  - Unit: `frontend/src/core/progress/activity.test.ts`
  - Web E2E: `tests/web/guest-progress.spec.ts` (giữ nguyên assert `progress.empty_state`), `tests/web/progress-streak-heatmap.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Tài khoản mới vào `/tien-do` → xác nhận chỉ có thông báo trống, không có heatmap hay `0%`; học xong 5 thẻ FSRS → quay lại kiểm tra heatmap hôm nay đổi màu chàm.

### FR-41: Trình đọc tự nhập ngoại tuyến (Offline Local Reader)
- **Thuộc:** Phase 4 / Epic 12 (`Web`, `Desktop`, `Mobile`) | **Kiểm soát:** `SEC-E12-01`, `SEC-T09`, `AD-16`, `AD-18` (0% AI)
- **Interfaces:** Consumes `ExtensionPackStore` (`tokenizer-wasm` BSD-3 IPADIC/UniDic), Dedicated Web Worker (`adapters/worker-bridge/tokenizer.worker.ts`) sau `tokenizerClient.ts`; Produces route `/tu-doc` (`LocalReaderPage.tsx`) gắn `<ruby>` + màu JLPT + chạm tra từ + Cloze.
- **Happy Path:**
  1. Mở `/tu-doc`, dán đoạn văn tiếng Nhật hoặc nạp file `.txt`/`.md` UTF-8 → Web Worker tách từ cục bộ gắn `<ruby>`, tô màu cấp độ JLPT, giữ UI mượt mà không giật.
  2. Chạm vào từ bất kỳ để tra nghĩa (`FR-32`) và bấm 1 chạm tạo thẻ Cloze (`FR-37`).
- **Edge & Failure Cases:**
  - Thiết bị thiếu bộ nhớ WASM hoặc chưa tải `tokenizer-wasm` → lùi an toàn về văn bản nguyên bản kèm tìm kiếm trực tiếp (`AD-16`), không crash.
  - Nạp file không phải UTF-8 → báo lỗi định dạng sạch sẽ.
- **Offline / Cross-Device Sync Scenarios:**
  - Tắt hoàn toàn mạng trước khi dán email công việc tiếng Nhật vào `/tu-doc` → xác nhận `0` request mạng thoát ra ngoài (`AD-18`).
- **Security Abuse Cases (`SEC-E12-01`, `SEC-T09`):**
  - Chặn văn bản `> 50.000` ký tự và tệp `> 512 KB`; dán `<script>alert(1)</script>` hoặc `<img onerror=...>` chỉ render React JSX text node (`RubySegment[]`); từ điển tách từ dùng bản **BSD-3** (kiểm `NOTICE` & `/gioi-thieu`); gói WASM kiểm SHA-256 trước khi nạp và CSP chỉ cho phép `'wasm-unsafe-eval'` nếu WebView thật yêu cầu (cấm `'unsafe-eval'`).
- **Automated Tests:**
  - Unit/Adapter: `infra/scripts/src/tokenizer-pack.test.ts`, `frontend/src/adapters/worker-bridge/tokenizerClient.test.ts`, `frontend/src/core/reader/localReader.test.ts`, `frontend/src/pages/LocalReaderPage.test.tsx`
  - Web E2E: `tests/web/local-reader-n3.spec.ts` (XSS input, offline `0` external request).
- **Manual Tester Steps:**
  - [ ] Tắt Wi-Fi Android, mở `/tu-doc`, dán đoạn văn 500 chữ Nhật → xác nhận tách `<ruby>` mượt, chạm từ tạo Cloze hoạt động; thử nạp chuỗi HTML `<script>` kiểm tra không chạy script.

### FR-42: Tiện ích hệ điều hành (Desktop Global Shortcut `Ctrl+Shift+J` & Android Share Intent)
- **Thuộc:** Phase 4 / Epic 12 (`Desktop`, `Android`) | **Kiểm soát:** `SEC-E12-02`, `SEC-E12-03`, `SEC-T09`, `SEC-T12`, `AD-17`
- **Interfaces:** Consumes `deepLinkDispatcher.ts` (`auth-callback` vs `lookup`), `tauri-plugin-global-shortcut` (Desktop), `desktop/src-tauri/capabilities/quick-lookup.json`, `mobile/android-bridge/ProcessTextBridgeActivity.kt`; Produces cửa sổ/màn tra nhanh `/tra-nhanh` (`QuickLookupPage.tsx`).
- **Happy Path:**
  1. **Desktop:** Từ app ngoài, nhấn `Ctrl+Shift+J` → mở cửa sổ `"quick-lookup"` (`#/tra-nhanh`) tra tức thì, đóng bằng `Esc` không nhân bản tiến trình khi nhấn lặp lại.
  2. **Android:** Bôi đen chữ Nhật trong Chrome/PDF -> chọn **Tra bằng Ôn JLPT** → Kotlin bridge phát `luyenjlpt://lookup?q=<encoded>` -> mở `/tra-nhanh` đúng từ đó.
  3. `luyenjlpt://auth-callback?...` vẫn chạy vào luồng đăng nhập và `luyenjlpt://lookup?q=...` không kích hoạt lỗi auth (`App.tsx#L188`).
- **Edge & Failure Cases:**
  - Phím tắt `Ctrl+Shift+J` trùng app khác trên Windows → hiện thông báo nhẹ cho đổi phím tắt, không crash.
  - Chuỗi Intent rỗng, `> 120` ký tự hoặc chứa ký tự điều khiển → cắt sạch trước `Uri.encode()`.
- **Offline / Cross-Device Sync Scenarios:**
  - Tra nhanh khi mất mạng vẫn chạy tức thì trên gói Minna + `dict-javi-core` đã lưu trong `ExtensionPackStore`.
- **Security Abuse Cases (`SEC-T09`, `SEC-T12`):**
  - `deepLinkDispatcher.ts` kiểm chặt `host`: `luyenjlpt://lookup?q=食べる&code=fake&sb_flow_id=12345678` chỉ mở tra từ, không chuyển `/tai-khoan`; host lạ bị bỏ qua.
  - Android Kotlin bridge chỉ nhận `text/plain` (bỏ qua `EXTRA_STREAM`), lọc `[\u0000-\u001F\u007F]`, cắt cứng `<= 120` code point.
  - `desktop/src-tauri/capabilities/quick-lookup.json` gắn riêng `"windows": ["quick-lookup"]` với ít quyền nhất (0 `updater`, `opener`, `deep-link`, `fs`, `http`); `QuickLookupPage` chỉ đọc `dict-javi-core` qua Dexie (không dùng `tauri-plugin-fs`), bắt `NotAllowedError` khi gọi `navigator.clipboard.readText()`, còn `clipboardGuard.ts` đọc clipboard là **opt-in**, bỏ qua URL `https?://` và JWT `eyJ...`, không lưu clipboard vào Dexie/Supabase/log.
- **Automated Tests:**
  - Unit: `frontend/src/adapters/native/deepLinkDispatcher.test.ts`, `frontend/src/core/native/clipboardGuard.test.ts`, `tests/desktop/capability-contract.test.mjs`, `tests/mobile/android-intent-bridge.test.mjs` (`SEC-T09`, `SEC-T12`)
  - Desktop Smoke: `tests/desktop/quick-lookup-smoke.mjs` & mở rộng `tests/desktop/smoke.mjs`
  - Android Smoke: `adb shell am start -a android.intent.action.PROCESS_TEXT -t text/plain ...` trên API 34 Emulator.
- **Manual Tester Steps:**
  - [ ] Trên Windows, mở PDF, bật tùy chọn đọc clipboard rồi bấm `Ctrl+Shift+J` với từ `約束` vs với chuỗi JWT `eyJhbGci...` → từ Nhật được điền sẵn, JWT bị bỏ qua.
  - [ ] Trên Android, bôi đen chữ Nhật trong Chrome → **Tra bằng Ôn JLPT** → xác nhận ra thẻ nghĩa offline.

### FR-43: Cập nhật phiên bản tại chỗ không cần cài đè thủ công
- **Thuộc:** Phase 1 / Epic 7 (`Web`, `Desktop Windows`, `Android`) | **Kiểm soát:** `SEC-E7-06`, `SEC-T08`, `AD-19`
- **Interfaces:** Consumes `latest.json` (Ed25519 Windows), `android-latest.json` (`version`, `versionCode`, `url`, `sha256`, `sizeBytes`), `mobile/src-tauri/src/android_updater.rs` + `FileProvider` + `ACTION_INSTALL_PACKAGE`, Workbox SW (`FR-44`); Produces cập nhật tại chỗ bảo toàn 100% Dexie + session.
- **Happy Path:**
  1. **Windows:** `NativeUpdates.tsx` (và card trong `/tai-khoan`) hiển thị tiến độ tải `%` + nút **Khởi động lại để áp dụng** (`relaunch()`).
  2. **Android:** Tải `.apk` bằng `tauri-plugin-http` vào `context.cacheDir/updates/pending.apk`, **kiểm khớp `sha256`, `sizeBytes`, `packageName`, `versionCode > installedCode` và `signingInfo` trùng chứng chỉ đang cài**, rồi gọi `FileProvider` + `ACTION_INSTALL_PACKAGE` → nâng cấp giữ nguyên `vn.luyenjlpt.app`, toàn bộ Dexie và phiên đăng nhập.
  3. **Web & Nội dung:** SW cập nhật nền + Content/Extension Pack cập nhật OTA tách khỏi nhị phân.
- **Edge & Failure Cases:**
  - Mất mạng giữa lúc tải APK → dọn `cacheDir/updates/*.apk`, hiện nút Thử lại, bản hiện tại vẫn chạy bình thường.
  - Android chưa bật quyền `REQUEST_INSTALL_PACKAGES` → mở đúng màn hình Cài đặt cấp quyền cho app.
- **Offline / Cross-Device Sync Scenarios:**
  - Có sẵn 5 bản ghi offline trong `progressOutbox` trước khi nâng cấp `.apk`/`.exe` → sau nâng cấp mở lại app, outbox vẫn nguyên vẹn và tự đẩy khi có mạng.
- **Security Abuse Cases (`SEC-T08`):**
  - URL không khớp repo gốc, `versionCode <= installedCode`, lệch 1 byte `sha256`, vượt `sizeBytes`/`60 MB`, hoặc khác `ANDROID_SIGNING_CERT_SHA256` → hủy cài và xóa sạch file tạm.
  - Kiểm manifest APK `usesCleartextTraffic="false"`, không debuggable, `FileProvider` `exported="false"` giới hạn `<cache-path name="updates" path="updates/" />`, chỉ `FLAG_GRANT_READ_URI_PERMISSION`.
  - Windows `updater-smoke.mjs` giữ kiểm soát âm tính bản ký lệch version (`0.1.2` vs `0.1.1`) và chỉ thêm quyền `process:allow-restart`; Android `android-update.json` gỡ `opener:allow-open-url` và `release-assets.githubusercontent.com` ngay khi Kotlin/Rust tải APK qua `tauri-plugin-http`.
- **Automated Tests:**
  - Unit: `frontend/src/adapters/native/androidUpdate.test.ts`, `tests/mobile/android-release.test.mjs` (`SEC-T08`)
  - Desktop E2E: `tests/desktop/updater-smoke.mjs`
  - Android CI: `mobile/scripts/validate-scaffold.mjs` + kiểm tra nâng cấp v(N) → v(N+1) trên Emulator API 34.
- **Manual Tester Steps:**
  - [ ] Nâng cấp Android v(N) → v(N+1) ngay trong app trên máy thật có sẵn tiến độ & tài khoản → kiểm tra giữ nguyên dữ liệu; test tương tự trên Windows `.exe`.

### FR-44: Web PWA ngoại tuyến hoàn chỉnh
- **Thuộc:** Phase 1 / Epic 7 (`Web`) | **Kiểm soát:** `SEC-E7-02`, `SEC-E7-04`, `SEC-T03`, `AD-19`
- **Interfaces:** Consumes `vite-plugin-pwa`, `manifest.webmanifest`, `PwaUpdatePrompt.tsx`, `frontend/public/_headers`; Produces Service Worker precache app shell + N4 `/packs/` + cài đặt màn hình chính 0₫.
- **Happy Path:**
  1. Truy cập Web lần đầu → SW đăng ký (`activated`), precache app shell và gói N4.
  2. Bật chế độ Offline, đóng hẳn tab và mở lại → Web mở lạnh thành công, học được toàn bộ N4.
  3. Trên iOS Safari & Android Chrome → *Thêm vào Màn hình chính* hiển thị đúng tên `Ôn JLPT` và chế độ `standalone`.
- **Edge & Failure Cases:**
  - Có bản cập nhật SW mới → `PwaUpdatePrompt` báo nhẹ *"Có phiên bản mới: Tải lại"*, không reload cưỡng bức làm mất bài đang làm ở `/luyen-de`.
  - Mở sâu `/luyen-de/n4-2023-07` khi offline → `navigateFallback` hoạt động chuẩn.
- **Offline / Cross-Device Sync Scenarios:**
  - Mở lạnh Web PWA offline trên iPhone → học 5 từ → bật mạng lại → sync lên Supabase.
- **Security Abuse Cases (`SEC-T03`):**
  - Toàn bộ `*.supabase.co/*` (`/auth/v1/*`, `/rest/v1/*`, `/functions/v1/*`, `/storage/v1/object/sign/*`) bắt buộc `handler: "NetworkOnly"`; `Cache Storage` chứa **0** entry Supabase.
  - Giữ nguyên query params của `/tai-khoan?code=...` qua fallback và gửi `Cache-Control: no-store` cho `/tai-khoan` kèm đủ HTTP security headers từ `frontend/public/_headers` (cập nhật `Permissions-Policy: microphone=(self)` khi Epic 9 Task 6 bật ghi âm so sánh cục bộ).
- **Automated Tests:**
  - Build verify: kiểm `dist/manifest.webmanifest`, `dist/sw.js`, `dist/_headers` sau `pnpm build`
  - Web E2E (`serviceWorkers: "allow"`): `tests/web/pwa-offline.spec.ts` (`SEC-T03`).
- **Manual Tester Steps:**
  - [ ] Trên iPhone Safari: *Thêm vào Màn hình chính* → bật chế độ máy bay → mở icon ngoài màn hình chính kiểm tra vào thẳng bài học N4 offline.

### FR-45: Adaptive Furigana, Audio nền (`MediaSession`) & Nhắc học cục bộ
- **Thuộc:** Phase 2 / Epic 8 (Adaptive Furigana + Local Notification) & Epic 9 (`MediaSession`) | **Kiểm soát:** `SEC-E8-03`, `SEC-E9-03`
- **Interfaces:** Consumes `srsCards` (`FR-30`), `adaptiveRuby.ts`, `<RubyText>` (`FR-32`), `AudioPort` (`FR-28`), `mediaSessionBridge.ts`, `localNotifications.ts` (`tauri-plugin-notification`); Produces ẩn/hiện `<rt>` theo mức thuộc + điều khiển khóa màn hình + nhắc ôn cục bộ.
- **Happy Path:**
  1. **Adaptive Furigana:** Bật tùy chọn Adaptive → từ/kanji đã vững trên FSRS tự động ẩn `<rt>`, từ ghép chỉ ẩn khi **toàn bộ** chữ Kanji thành phần đã vững; từ mới/hay quên giữ nguyên `<rt>`.
  2. **MediaSession:** Phát audio Choukai/Shadowing rồi tắt màn hình Android → âm thanh chạy tiếp, màn hình khóa hiện tên bài + nút Play/Pause/Seek.
  3. **Local Notification:** Đặt giờ nhắc 20:00 → `tauri-plugin-notification` nhắc số thẻ FSRS đến hạn ngay trên thiết bị (0 push server).
- **Edge & Failure Cases:**
  - Từ chối quyền `POST_NOTIFICATIONS` trên Android 13+ → công tắc tắt kèm thông báo tiếng Việt hướng dẫn mở Cài đặt, không crash hay spam xin quyền.
  - Từ bị Adaptive ẩn `<rt>` vẫn bấm chạm để xem Furigana + nghĩa ngay tại chỗ.
- **Offline / Cross-Device Sync Scenarios:**
  - Cả 3 cơ chế chạy 100% offline từ Dexie và `ExtensionPackStore`.
- **Security Abuse Cases (`SEC-E8-03`, `SEC-E9-03`):**
  - Thông báo màn hình khóa và `MediaSession` chỉ hiển thị thông tin chung (*"Bạn có 15 thẻ JLPT đến hạn ôn hôm nay"*, tên bài/đề), **0** email/username/ghi chú cá nhân/Signed URL; capability notification chỉ cấp cho cửa sổ `"main"`; 0 SDK push/Firebase FCM.
- **Automated Tests:**
  - Unit: `frontend/src/core/exam/adaptiveRuby.test.ts`, `frontend/src/adapters/audio/mediaSessionBridge.test.ts`, `frontend/src/core/notifications/reminder.test.ts`, `frontend/src/adapters/native/localNotifications.test.ts`
  - Web E2E: `tests/web/adaptive-furigana.spec.ts`.
- **Manual Tester Steps:**
  - [ ] Kiểm tra từ thành thạo ẩn `<rt>` khi bật Adaptive (và từ ghép có 1 chữ chưa vững vẫn giữ `<rt>`); thử tắt màn hình Android khi đang nghe Choukai xem nút Play/Pause ngoài màn hình khóa; hẹn giờ nhắc 2 phút kiểm tra thông báo cục bộ.

### FR-46: Khắc phục triệt để lỗi không đăng nhập được trên bản Web (P0 Blocker)
- **Thuộc:** Phase 1 / Epic 7 (`Web`, **P0 Blocker**) | **Kiểm soát:** `SEC-E7-01`, `SEC-E7-02`, `SEC-E7-03`, `SEC-T01`, `SEC-T02`, `SEC-T03`
- **Interfaces:** Consumes `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `validate-web-env.mjs`, `.github/workflows/web-deploy.yml`, Edge Function `resolve-login`, Supabase Auth PKCE; Produces `AuthLoginError` phân loại lỗi + đăng nhập Web ổn định cả 3 cách (Email, Username, Google).
- **Quy trình chẩn đoán & kiểm chứng 6 giả thuyết gốc (`H1..H6` từ `2026-11-27-bao-mat-web-va-app-v2.md` §3):**
  1. **`H1` Env build Web:** Chạy `node infra/scripts/src/validate-web-env.mjs` và kiểm tra bundle `frontend/dist/assets/*.js` có chứa URL Supabase HTTPS hợp lệ + key `VITE_SUPABASE_PUBLISHABLE_KEY` (không dùng `VITE_SUPABASE_ANON_KEY`, tuyệt đối chặn `service_role`); `client.ts` bọc `new URL(url.trim())` an toàn.
  2. **`H2` Edge Function `resolve-login`:** Xác nhận hàm đã deploy với `verify_jwt = false` (`--no-verify-jwt`) để chấp nhận khóa `sb_publishable_*` mới mà không trả `401 Invalid JWT`.
  3. **`H3` Redirect URLs & `parseWebAuthCallback`:** Kiểm Supabase Auth Redirect URLs khớp `https://<web-host>/tai-khoan` (và `/tai-khoan/`); `parseWebAuthCallback` chuẩn hóa dấu `/` cuối và chỉ truyền `{ flowId }` khi `flowId` có giá trị.
  4. **`H4` CORS preflight:** `http.ts` thay `Access-Control-Allow-Origin: *` bằng `ALLOWED_ORIGINS` + `Vary: Origin`, `OPTIONS` trả `204` đủ `authorization, apikey, content-type, x-client-info, x-confirmed-owner`.
  5. **`H5` PKCE & Email chưa xác nhận:** Tách thông báo `email_not_confirmed`, lỗi mạng, `429`, `503` khỏi `LOGIN_ERROR` (vẫn giữ chung `LOGIN_ERROR` khi sai mật khẩu hoặc không tìm thấy tài khoản để chống dò user).
  6. **`H6` Dexie `sessionStorage`:** Bọc `try/catch` `JSON.parse` và báo lỗi rõ nếu trình duyệt chặn IndexedDB.
- **Happy Path:**
  1. Trên URL Web deploy (và local stack): đăng nhập thành công cả 3 cách (**Email + mật khẩu**, **Tên đăng nhập + mật khẩu** kể cả chữ hoa `LEARNER_ONE`, và **Google OAuth PKCE**).
  2. F5 reload trang → giữ nguyên phiên đăng nhập; mở Desktop/Android cùng tài khoản → đồng bộ 2 chiều thông suốt.
- **Edge & Failure Cases:**
  - Email chưa xác nhận → báo rõ cần xác nhận thư; mất mạng/CORS/`503` → báo lỗi kết nối dịch vụ; sai mật khẩu/username → trả `LOGIN_ERROR`.
  - Thiếu env trong CI Web deploy → `validate-web-env.mjs` thoát mã lỗi khác `0` trước khi chạy `wrangler deploy`.
- **Offline / Cross-Device Sync Scenarios:**
  - Reload trang lúc mất mạng → `offlineSession()` khôi phục từ `db.settings`; đăng nhập lần đầu từ trạng thái Khách → hiện hộp thoại gộp tiến độ và đẩy dữ liệu lên server.
- **Security Abuse Cases (`SEC-T01`, `SEC-T02`, `SEC-T03`):**
  - Chặn callback `#access_token=`, `?error=`, `?code=a&code=b` và xóa sạch khỏi URL; `resolve-login` chặn payload `8.192` ký tự, giữ floor `>= 500ms` và rate limit `10/username`, `120/global`; `_headers` đặt `Cache-Control: no-store` cho `/tai-khoan` và CSP chặt.
- **Automated Tests:**
  - Unit: `frontend/src/adapters/auth/client.test.ts`, `frontend/src/adapters/auth/session.test.ts`, `infra/scripts/src/validate-web-env.test.ts`
  - Edge Function Deno: `backend/supabase/tests/functions.test.ts` (`SEC-T01`)
  - Web E2E: `tests/web/accounts.local.spec.ts`, `tests/web/account-mail.local.spec.ts`, `tests/web/auth-web-login.spec.ts` (`SEC-T02`).
- **Manual Tester Steps:**
  - [ ] Mở tab ẩn danh trên URL Web deploy (Chrome PC + Safari iPhone + Chrome Android) → test đủ 3 phương thức đăng nhập + F5 reload + kiểm tra DevTools Network không còn lỗi `401`/`CORS`/`null client`.

---

## 3. Cổng phát hành theo từng Giai đoạn (Release Gate Checklist)

### 3.1 Quy trình bắt buộc trước mọi tuyên bố "Hoàn tất"

Mọi kỹ sư và agent thực thi Epic 7–12 bắt buộc đi qua **3 cổng kiểm soát**:

1. **Luật thép `verification-before-completion`:**
   > `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`
   - **Bước 1 (IDENTIFY):** Nêu chính xác lệnh chứng minh cho từng tiêu chí.
   - **Bước 2 (RUN):** Chạy trọn vẹn lệnh mới nhất sau lần sửa cuối (không dùng kết quả cũ).
   - **Bước 3 (READ):** Đọc đủ output, mã thoát (`exit code`), số test pass/fail/skip.
   - **Bước 4 (VERIFY):** Đối chiếu output với ngưỡng ngân sách & ca test; mọi sửa lỗi hồi quy (`FR-46`, `FR-27`, `SEC-T01..T12`) bắt buộc qua chu trình **TDD Red-Green** (revert fix -> test FAIL -> restore fix -> test PASS).
   - **Bước 5 (CLAIM):** Chỉ xác nhận đạt khi dẫn chứng được kết quả thực thi vừa chạy; cấm các từ phỏng đoán (*"chắc là chạy"*, *"có lẽ"*, *"lỗi nhỏ"*).

2. **Đánh giá toàn nhánh `open-code-review-delegate`:**
   - Chạy `ocr delegate preview --from main --format json` lập danh sách 100% file thay đổi (gồm file mới chưa track).
   - Chạy `ocr delegate rule --from main --format json <paths...>`.
   - Đọc trọn `git --no-pager diff --no-ext-diff --no-textconv --no-color <merge_base>..HEAD -- "<path>"` cho từng file (`coverage_rate === 100%`).
   - Lưu báo cáo vào `docs/code-review/YYYY-MM-DD-epic-<N>-review.md` kèm `total_files`, `reviewed_files`, `skipped_files`, `coverage_rate`. Yêu cầu **0 Critical/High**.

3. **Kiểm toán bảo mật diff `differential-review` (Trail of Bits) + Semgrep:**
   - **Bắt buộc** trên mọi nhánh chạm: Auth (`FR-46`), RLS/Postgres/Edge Functions (`FR-27`, `FR-28`, `FR-30`, `FR-33`, `FR-36`), Tauri Capabilities/CSP/Deep-link/Intent (`AD-17`), Native Updater (`FR-43`), hoặc Bộ phân tích ngoài (`SVG`, `CSV/TSV`, `JSON`, `WASM`).
   - Kiểm tra `git blame` phần code bảo mật bị sửa/xóa, tính **blast radius**, rà test coverage cho nhánh code mới, và dựng kịch bản tấn công đối kháng (`differential-review:adversarial-modeler`).
   - Chạy `semgrep --config auto`, `pnpm audit --prod --audit-level=high`, và `cargo audit` (với Desktop/Mobile); mọi lỗi High/Critical phải được sửa kèm test hồi quy trước khi phát hành.

---

### 3.2 Checklist Cổng Phát hành theo Phase (Phase 1 → Phase 4)

#### Phase 1 Gate: Epic 7 (`FR-46`, `FR-27`, `FR-29`, `FR-32`, `FR-38`, `FR-39`, `FR-43`, `FR-44`)
- [ ] **Env, Content & Static:** `node infra/scripts/src/validate-web-env.mjs`, `pnpm packs:build && pnpm packs:verify` (N4 `1.1.0`), `EXPERIMENTAL_LEVELS=1` verify, `pnpm typecheck && pnpm check && pnpm test && pnpm --filter @luyen/mobile-shell test` → exit `0`.
- [ ] **Supabase & Sync:** `supabase test db --workdir backend` (`exam_attempts.test.sql` `SEC-T05` PASS) + `deno test ... functions.test.ts` (`SEC-T01` PASS) + `JLPT_LOCAL_AUTH=1` E2E đồng bộ `exam_attempts` (`in_progress` từng phần + làm lại nhiều lần) và `purgeOwner` (`SEC-T04`) → xanh 100%.
- [ ] **Web & PWA (`SEC-E7-01..04`, `SEC-T02..03`):** `pnpm build && pnpm e2e:web` (`auth-web-login`, `exam-practice`, `furigana-and-keigo`, `study-upgrades`, `theme-and-mobile-nav`, `pwa-offline`) → `dist/_headers` có đủ security headers, Cache Storage có `0` entry `*.supabase.co`, `FR-46` đăng nhập thành công trên URL deploy bằng Email, Username, Google PKCE và giữ phiên qua F5.
- [ ] **Native Windows & Android (`SEC-E7-06`, `SEC-T08`):** `tests/desktop/ci-smoke.ps1` + `tests/desktop/updater-smoke.mjs` xanh; `tests/mobile/android-ci-smoke.sh` xanh; APK release **≤ 30 MB**, nâng cấp tại chỗ v(N) → v(N+1) kiểm `sha256` + `sizeBytes` + `signingInfo` giữ nguyên Dexie và session.
- [ ] **Accessibility & Ràng buộc v1:** `360px` không tràn ngang, nút **≥ 44px**, 5 tab `MOBILE_TABS` mới hoạt động, chế độ tối `Sumi đêm` đạt WCAG AA, `GrammarKeigoPage` đủ `lang="ja"`, `/ngu-phap/$patternId` không có quiz.
- [ ] **Reviews:** `open-code-review-delegate` + `differential-review` (`FR-46`, `exam_attempts`, `FR-43`, PWA SW) + `pnpm audit` = **0 Critical/High**.

#### Phase 2 Gate: Epic 8, 9, 10 (`FR-30`, `FR-40`, `FR-45`, `AD-13`, `AD-15`, `AD-16`, `FR-28`, `FR-31`, `FR-33`, `FR-34`)
- [ ] **FSRS & Adaptive (`SEC-E8-01..03`, `SEC-T04`, `SEC-T07`):** Migration Dexie v3 → v4 bảo toàn 100% `card_status.known`; `srs.test.sql` & `fsrs-review.spec.ts` xanh; `progress-streak-heatmap.spec.ts` giữ `"Bạn chưa có tiến độ nào ở cấp độ này"` khi trống; `adaptive-furigana.spec.ts` ẩn đúng `<rt>` từ thành thạo; Local Notification không lộ email/username/ghi chú.
- [ ] **Private Audio & MediaSession (`SEC-E9-01..03`, `SEC-T06`, `SEC-T09`):** Bucket `audio-packs` khóa `public = false`, `sign-audio-pack` TTL `<= 300s` & rate limit `30 req/giờ/user` (`audio_packs.test.sql` + `functions.test.ts`); phát Opus offline **< 150 ms**; `audio-choukai.spec.ts` & `MediaSession` chạy khi tắt màn hình Android; `ExtensionPackStore` không dùng `Cache Storage` trên Tauri.
- [ ] **KanjiVG & Viết tay offline (`SEC-E10-01..03`, `SEC-T10`):** Đường ống KanjiVG JSON thuần `<path d>` pass `SEC-T10` (0 XSS SVG, 0 `dangerouslySetInnerHTML`); `user_mnemonics.test.sql` + `mnemonics.test.ts` pass `SEC-T07`/`SEC-T04`; viết tay tự do chạy Web Worker `0` network (`kanji-kanjivg.spec.ts`), APK vẫn **≤ 30 MB**.
- [ ] **Attribution & CSP:** `/gioi-thieu` và `NOTICE` ghi đủ `KANJIDIC2`, `KanjiVG (CC BY-SA 3.0)`, `Kanjium (CC BY-SA 4.0)`; `tauri-csp-contract.test.ts` khóa đúng ref 20 ký tự, không `*`.
- [ ] **Reviews:** `open-code-review-delegate` + `differential-review` (`sign-audio-pack`, RLS `srs_*`/`user_mnemonics`, KanjiVG pipeline, Tauri CSP) = **0 Critical/High**.

#### Phase 3 Gate: Epic 11 (`FR-35`, `FR-36`, `FR-37`, Đồ thị Minna, Phiếu viết PDF)
- [ ] **Semantic Dictionary QA & Tốc độ (`SEC-E11-03`):** `dict-pack.test.ts` kiểm duyệt ngữ nghĩa từ điển mở `dict-javi-core` pass 100%; tra cứu `30.000` mục **< 50 ms** (`search.test.ts`); chia 13 thể đúng cả bất quy tắc (`する`, `来る`, `行く`, `帰る`).
- [ ] **Click-to-Lookup & Cloze:** `WordLookupHost.test.tsx` & `dictionary-notebooks.spec.ts` xanh (Desktop Popover / Mobile Bottom Sheet `<= 45dvh`, khóa popup khi thi thật, 1 chạm tạo Cloze, Đồ thị Minna cross-link).
- [ ] **Notebooks & Anki Safety (`SEC-E11-01..02`, `SEC-T04`, `SEC-T07`, `SEC-T11`):** `/so-tay` > 500 từ đồng bộ mượt mà; `notebooks.test.sql` kiểm khóa ngoại kép `(user_id, notebook_id)` chặn IDOR (`SEC-T07`); `ankiCodec.test.ts` kiểm trung hòa `[=+\-@\t\r]` và `safeJsonParse()` chặn `__proto__` (`SEC-T11`); xuất phiếu tập viết PDF từ Sổ tay hoạt động (`NotebooksPage.test.tsx`).
- [ ] **Reviews:** `open-code-review-delegate` + `differential-review` (Anki codec, `safeJsonParse`, RLS `notebooks`/`notebook_items`) = **0 Critical/High**.

#### Phase 4 Gate: Epic 12 (`FR-41`, `FR-42`, `AD-17`, `AD-18`, Dataset N3 thật)
- [ ] **Offline Local Reader & 0% AI (`SEC-E12-01`):** WASM Tokenizer (**BSD-3**, `tokenizer-pack.test.ts`) chạy Web Worker `worker-src 'self'`, giới hạn `<= 50.000` ký tự / `512 KB`, lùi an toàn khi thiếu WASM, xác nhận `0` AI/LLM call trong `local-reader-n3.spec.ts` (`AD-18`).
- [ ] **Tauri OS Bridges (`SEC-E12-02..03`, `SEC-T09`, `SEC-T12`):** `deepLinkDispatcher.test.ts` tách chặt `auth-callback` vs `lookup`; Desktop `Ctrl+Shift+J` mở `/tra-nhanh` với `quick-lookup.json` (`capability-contract.test.mjs`, `quick-lookup-smoke.mjs`) và opt-in `clipboardGuard` bỏ qua URL/JWT; Android Intent bridge (`android-intent-bridge.test.mjs`) nhận `text/plain`, lọc control chars, cắt `<= 120` ký tự.
- [ ] **N3 Real Dataset & Supply Chain (`SEC-E12-04`):** Chỉ chạy sau khi Phase 2 hoàn tất; `verify-n3.test.ts` & `pnpm packs:verify` với dataset N3 thật pass 100%; `N4 ↔ N3` cô lập độc lập; chạy trọn `ci.yml` + `native.yml` + `pnpm audit --prod --audit-level=high` + `cargo audit`.
- [ ] **Reviews:** `open-code-review-delegate` + `differential-review` (Tauri Intent/Deep-link/Quick-Lookup capability, WASM Worker) = **0 Critical/High**.

### 3.3 Bảng kiểm tra thiết bị vật lý tối thiểu trước khi gửi bạn bè

- [ ] **Windows 10/11 (x64):** Cài `.exe` bằng NSIS (không quyền Admin), kiểm đăng nhập Google deep link, `Ctrl+Shift+J`, xuất phiếu tập viết PDF, nâng cấp bản mới ngay trong app không mất dữ liệu.
- [ ] **Android (màn 360px, Android 8+ & 13+):** Cài nâng cấp tại chỗ `.apk` qua `ACTION_INSTALL_PACKAGE` bảo toàn Dexie + session, bật chế độ máy bay học FSRS + viết tay + Choukai tắt màn hình (`MediaSession`), nhận Local Notification, thử `Tra bằng Ôn JLPT` từ Chrome.
- [ ] **iPhone / iPad (iOS Safari PWA):** Cài ra Màn hình chính, bật chế độ máy bay mở lạnh app, kiểm âm thanh khi chạm nút Loa (user gesture) và vùng an toàn tai thỏ/thanh home.
