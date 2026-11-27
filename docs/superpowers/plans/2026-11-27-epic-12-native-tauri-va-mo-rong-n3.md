# Epic 12: Trình đọc Tự nhập Offline WASM, Tiện ích Tauri 2 OS & Mở rộng Nội dung N3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện trình đọc tự nhập gắn Furigana/Pitch/màu JLPT hoàn toàn ngoại tuyến qua WASM Tokenizer Web Worker (từ điển BSD-3), tách bộ điều phối deep-link đa host (`auth-callback` vs `lookup`), bổ sung cửa sổ tra nhanh Desktop (`Ctrl+Shift+J`) với capability ít quyền nhất, cầu nối Android `ACTION_PROCESS_TEXT`/`ACTION_SEND`, đường ống nhập gói nội dung N3 thật sau Phase 2 và gia cố chuỗi cung ứng CI/CD, giữ tuyệt đối **0% AI (`AD-18`)**.

**Architecture:** Bộ tách từ hình thái học WASM chạy tải lười trong Dedicated Web Worker sau lớp adapter (`frontend/src/adapters/worker-bridge/`, `AD-16`) nạp gói từ điển BSD-3 `tokenizer-wasm` đã kiểm chứng SHA-256 qua `ExtensionPackStore` (`AD-13`). Mọi tích hợp hệ điều hành Tauri 2 (`AD-17`) chỉ là cầu nối mỏng không chứa logic học tập: Desktop dùng `tauri-plugin-global-shortcut` bật cửa sổ `"quick-lookup"` trỏ `#/tra-nhanh` dưới capability cô lập riêng; Android trích `text/plain` từ Intent, lọc sạch rồi đẩy `luyenjlpt://lookup?q=<encoded>` qua `deepLinkDispatcher.ts` tách rạch ròi với luồng OAuth `auth-callback`. Đường ống N3 thật mở rộng trực tiếp trên `infra/scripts/src/{packs,build-packs,verify-packs,import-dataset}.ts` (`AD-3`) mà không phá vỡ bất biến gói N4 hay trần APK `<= 30 MB`.

**Tech Stack:** React 19, TypeScript 7, TanStack Router 1.131, Tauri 2.12.7 (`tauri-plugin-global-shortcut`, `tauri-plugin-deep-link`), Rust 1.90+, Kotlin/Android API 26+, Web Worker + Lindera-WASM / IPADIC-UniDic BSD-3, Vitest 5.1.1, Playwright 1.65.1, `tsx` (`infra/scripts/`).

**Spec:** `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (`FR-41`, `FR-42`, `AD-3`, `AD-13`, `AD-16`, `AD-17`, `AD-18`, Phase 4 & Quyết định #3, #7) và `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E12-01..04`, `SEC-T09`, `SEC-T12`).

## Global Constraints

- **Khóa tuyệt đối 0% AI (`AD-18` [LOCKED]):** Không tích hợp bất kỳ SDK/endpoint LLM nào trong toàn bộ Epic 12; `0` tên miền quảng cáo/theo dõi; toàn bộ tách từ, gắn furigana, tra nhanh Desktop/Android và học N3 chạy 100% ngoại tuyến.
- **Điều kiện cổng đầu vào cho N3 (Quyết định #3):** Task 6 (Nhập dữ liệu N3 thật) chỉ kích hoạt sản xuất sau khi **Phase 2** (FSRS Epic 8 + Audio Choukai Epic 9 + KanjiVG Epic 10) đã hoàn tất và ổn định trên N4; trong lúc chưa có `infra/content/n3/VERSION`, giữ nguyên chế độ fixture kỹ thuật `n3-sample` sau cờ `EXPERIMENTAL_LEVELS=1`.
- **Ngân sách dung lượng & hiệu năng:** Bản cài `.apk` Android cơ bản giữ `<= 30 MB`; gói từ điển WASM `tokenizer-wasm` và gói N3 mở rộng (`kanjivg-n3`, `audio-n3-vocab`, `audio-n3-exams`) là gói tải tùy chọn qua `ExtensionPackStore`; giao diện chính không bao giờ chờ WASM Worker khởi động (`AD-16`).
- **Giấy phép sạch tương thích `AGPL-3.0-only`:** Bộ từ điển tách từ hình thái học bắt buộc dùng phiên bản phát hành dưới giấy phép **BSD-3** (IPADIC/UniDic BSD-3), kèm nguyên văn bản quyền trong `NOTICE` và `/gioi-thieu`.
- **Bất biến bảo mật Tauri 2 & WASM (`SEC-E12-01..04`):**
  - WASM Worker chạy dưới `worker-src 'self'`, chỉ thêm `'wasm-unsafe-eval'` nếu WebView thực tế yêu cầu (cấm tuyệt đối `'unsafe-eval'`); giới hạn đầu vào Tự đọc `<= 50.000` ký tự và tệp `.txt`/`.md` `<= 512 KB`, render `<ruby>` 100% bằng React JSX (`RubySegment[]`), cấm `innerHTML`.
  - Tách cứng `deepLinkDispatcher.ts` theo `host` (`auth-callback` vs `lookup`); mọi host khác bỏ qua im lặng.
  - Cửa sổ Desktop `"quick-lookup"` có file capability riêng `desktop/src-tauri/capabilities/quick-lookup.json` (cấm tuyệt đối thêm `"quick-lookup"` vào `main-capability`); đọc clipboard là **opt-in**, cắt `<= 120` ký tự, bỏ qua URL (`^https?://`) và JWT (`^eyJ`), không lưu Dexie/Supabase/log.
  - Android Intent bridge chỉ nhận `mimeType == "text/plain"`, bỏ qua `EXTRA_STREAM`, lọc `\0` và ký tự điều khiển `[\u0000-\u001F\u007F]`, cắt `<= 120` code point rồi `Uri.encode()`.
- **Bảo toàn N4:** Mọi thay đổi ở `infra/scripts/` không được làm thay đổi ID hay hash gói N4 (`1.182` vocab, `118` kanji, `388` compound / `403` nguồn, `148` grammar).

## Review Focus

1. **Deep-link giả mạo hoặc trộn tham số auth vào host `lookup` (`luyenjlpt://lookup?q=食べる&code=fake&sb_flow_id=12345678`):** Bộ điều phối không được kích hoạt `completeNativeSignIn`, không chuyển về `/tai-khoan`, không bật toast lỗi tài khoản và không để lọt `code`/`sb_flow_id` vào ô tìm kiếm. Khóa bằng unit test `SEC-T12` tại **Task 1**.
2. **Thiết bị di động thiếu bộ nhớ WASM hoặc chưa tải gói `tokenizer-wasm` khi mở `/tu-doc`:** Trang Tự đọc không được trắng màn hình hay treo luồng chính; phải hạ cấp mượt về hiển thị văn bản gốc kèm tra từ trực tiếp và hiện nút tải gói `tokenizer-wasm`. Khóa bằng unit test tại **Task 2** và **Task 3**.
3. **Bấm `Ctrl+Shift+J` khi người dùng vừa copy mật khẩu, URL chứa token (`https://.../?token=abc`) hoặc JWT (`eyJ...`):** Nếu người dùng chưa bật opt-in thì không đọc clipboard; ngay cả khi đã bật opt-in, guard phải từ chối mọi URL/JWT và tuyệt đối không ghi chuỗi clipboard vào Dexie hay `console.log`. Khóa bằng test `SEC-T12` tại **Task 4**.
4. **App Android độc hại gửi `ACTION_SEND` với `mimeType: image/*`, `EXTRA_STREAM`, hoặc chuỗi `50.000` ký tự chứa `\0` và ký tự xuống dòng/control:** Bridge Kotlin phải từ chối mọi non-`text/plain`, bỏ qua `EXTRA_STREAM`, lọc sạch ký tự điều khiển và cắt cứng `<= 120` code point trước khi mã hóa URI. Khóa bằng test bridge tại **Task 5**.
5. **Nhập dữ liệu N3 thật chứa mã ID trùng với N4 hoặc quên nâng phiên bản `VERSION`:** Pipeline `packs:verify` phải bắt ngay trùng lặp ID chéo bảng, kiểm tra tiền tố ID N3 hợp lệ `<= 128` ký tự, và không làm hỏng xác thực bộ N4 đóng băng. Khóa bằng test pipeline tại **Task 6**.

---

### Task 1: Tách Bộ Điều phối Deep-Link theo `host` (`AD-17`, `SEC-E12-02`)

**Files:**
- Create: `frontend/src/adapters/native/deepLinkDispatcher.ts`
- Modify: `frontend/src/App.tsx:182-225`
- Modify: `mobile/src-tauri/tauri.conf.json:33-39`
- Modify: `mobile/scripts/validate-scaffold.mjs:15-20`
- Test: `frontend/src/adapters/native/deepLinkDispatcher.test.ts`

**Interfaces:**
- Consumes: `parseAuthCallback`, `listenForNativeAuth` (`frontend/src/adapters/auth/nativeAuth.ts:12-77`), `completeNativeSignIn` (`frontend/src/adapters/auth/client.ts`).
- Produces:
  - `export type DispatchedDeepLink = { kind: "auth-callback"; callback: ReturnType<typeof parseAuthCallback> & {} } | { kind: "lookup"; query: string };`
  - `export function parseAppDeepLink(raw: string): DispatchedDeepLink | null`
  - `export function sanitizeLookupQuery(raw: string): string` (xóa `\0` và `[\u0000-\u001F\u007F]`, chuẩn hóa khoảng trắng, cắt cứng `<= 120` code points)
  - `export async function listenForAppDeepLinks(handlers: { onAuth: (callback: NonNullable<ReturnType<typeof parseAuthCallback>>) => void; onLookup: (query: string) => void; }): Promise<() => void>`

- [ ] **Step 1: Write the failing test (`SEC-T12` & Review Focus #1)**

Tạo `frontend/src/adapters/native/deepLinkDispatcher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseAppDeepLink, sanitizeLookupQuery } from "./deepLinkDispatcher";

describe("parseAppDeepLink host isolation (SEC-E12-02 / SEC-T12)", () => {
  it("routes auth-callback strictly to auth handler", () => {
    const parsed = parseAppDeepLink(
      "luyenjlpt://auth-callback?code=abc123&sb_flow_id=flow123456",
    );
    expect(parsed).toEqual({
      kind: "auth-callback",
      callback: { code: "abc123", flowId: "flow123456" },
    });
  });

  it("routes lookup host only to lookup and ignores smuggled auth params", () => {
    const parsed = parseAppDeepLink(
      "luyenjlpt://lookup?q=%E9%A3%9F%E3%81%B9%E3%82%8B&code=fake&sb_flow_id=12345678",
    );
    expect(parsed).toEqual({ kind: "lookup", query: "食べる" });
  });

  it("silently ignores unknown hosts, non-luyenjlpt schemes, and oversized links", () => {
    expect(parseAppDeepLink("luyenjlpt://unknown-host?x=1")).toBeNull();
    expect(parseAppDeepLink("https://evil.test/lookup?q=a")).toBeNull();
    expect(parseAppDeepLink(`luyenjlpt://lookup?q=${"あ".repeat(5000)}`)).toBeNull();
  });

  it("strips NUL/control chars and truncates lookup query to 120 code points", () => {
    const dirty = `\u0000\u0007${"漢".repeat(150)}\n\t`;
    const clean = sanitizeLookupQuery(dirty);
    expect([...clean]).toHaveLength(120);
    expect(clean).not.toMatch(/[\u0000-\u001F\u007F]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/native/deepLinkDispatcher.test.ts`
Expected: FAIL vì `deepLinkDispatcher.ts` chưa tồn tại.

- [ ] **Step 3: Implement `deepLinkDispatcher.ts`, update `App.tsx`, `mobile/src-tauri/tauri.conf.json`, and `validate-scaffold.mjs`**

- Cài đặt `parseAppDeepLink`, `sanitizeLookupQuery`, `listenForAppDeepLinks` trong `frontend/src/adapters/native/deepLinkDispatcher.ts`:
  - Phân tích bằng `new URL(raw)` (sau khi kiểm `raw.length <= 4096`), chỉ chấp nhận `parsed.protocol === "luyenjlpt:"`.
  - Nếu `parsed.hostname === "auth-callback"`: chuyển cho `parseAuthCallback(raw)` và giữ nguyên chống phát lại `SEEN_KEY` trong `sessionStorage`.
  - Nếu `parsed.hostname === "lookup"`: chỉ đọc `parsed.searchParams.get("q")`, lọc qua `sanitizeLookupQuery`, trả về `{ kind: "lookup", query }` (chỉ đọc, không bao giờ gọi `completeNativeSignIn` hay điều hướng `/tai-khoan`).
  - Mọi `hostname` khác trả `null`.
- Thay lời gọi `listenForNativeAuth` tại `frontend/src/App.tsx:188-218` bằng `listenForAppDeepLinks({ onAuth, onLookup })`, trong đó `onLookup(query)` điều hướng tới `/tra-nhanh` với search param `{ q: query }` (hoặc mở `GlobalSearchDialog` với từ khóa đó).
- Cập nhật `mobile/src-tauri/tauri.conf.json:35-37`:
  ```json
  "mobile": [
    { "scheme": ["luyenjlpt"], "host": "auth-callback" },
    { "scheme": ["luyenjlpt"], "host": "lookup" }
  ]
  ```
- Cập nhật `mobile/scripts/validate-scaffold.mjs:17-18` kiểm tra cả hai host `"auth-callback"` và `"lookup"` đều được đăng ký với scheme `"luyenjlpt"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/native/deepLinkDispatcher.test.ts src/adapters/auth/nativeAuth.test.ts && node mobile/scripts/validate-scaffold.mjs --config-only`
Expected: PASS cả Vitest lẫn kiểm tra cấu hình mobile.

- [ ] **Step 5: Security & QA Gate (`SEC-E12-02`)**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: PASS; xác nhận không làm vỡ đường dẫn `luyenjlpt://auth-callback` đã kiểm thử trong `tests/desktop/smoke.mjs`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/adapters/native/deepLinkDispatcher.ts frontend/src/adapters/native/deepLinkDispatcher.test.ts frontend/src/App.tsx mobile/src-tauri/tauri.conf.json mobile/scripts/validate-scaffold.mjs
git commit -m "feat(native): split deep-link dispatcher strictly by host for auth-callback and lookup"
```

---

### Task 2: Web Worker Tách từ Hình thái học WASM & Gói Từ điển BSD-3 (`FR-41`, `AD-16`, `SEC-E12-01`)

**Files:**
- Create: `infra/scripts/src/tokenizer-pack.ts`
- Create: `frontend/src/core/reader/tokenizerPort.ts`
- Create: `frontend/src/adapters/worker-bridge/tokenizer.worker.ts`
- Create: `frontend/src/adapters/worker-bridge/tokenizerClient.ts`
- Modify: `frontend/src/pages/AboutPage.tsx:44-63`
- Modify: `frontend/public/_headers` (chỉ bổ sung `'wasm-unsafe-eval'` vào `script-src` nếu kiểm thử biên dịch Lindera-WASM thực tế yêu cầu)
- Modify: `desktop/src-tauri/tauri.conf.json:24-28` và `mobile/src-tauri/tauri.conf.json:11-14` (cùng điều kiện `'wasm-unsafe-eval'` nếu WebView2/Android WebView yêu cầu)
- Create/Modify: `NOTICE`
- Test: `frontend/src/adapters/worker-bridge/tokenizerClient.test.ts`
- Test: `infra/scripts/src/tokenizer-pack.test.ts`

**Interfaces:**
- Consumes: `extensionPackStore.getEntryBlob("tokenizer-wasm", "dict.bin")` (`frontend/src/adapters/extensions/index.ts`, Epic 9, đã kiểm chứng SHA-256 trên byte thô `SEC-E9-01`) và `writeExtensionsIndex` (`infra/scripts/src/extensions.ts`, Epic 9).
- Produces:
  - `export const LOCAL_READER_LIMITS = { maxChars: 50_000, maxFileBytes: 512 * 1024, workerTimeoutMs: 5_000 } as const;`
  - `export interface MorphemeToken { surface: string; readingHiragana: string; baseForm: string; pos: string; jlpt?: "n5" | "n4" | "n3" | "n2" | "n1"; pitch?: number[]; hasKanji: boolean; }`
  - `export interface TokenizerPort { tokenize(text: string, signal?: AbortSignal): Promise<Result<MorphemeToken[], { code: "pack-missing" | "input-too-large" | "wasm-unavailable" | "timeout"; detail: string }>>; dispose(): void; }`
  - `export function createWasmTokenizerClient(deps: { loadPackBytes: () => Promise<Uint8Array | null>; expectedSha256?: string; }): TokenizerPort` trong `frontend/src/adapters/worker-bridge/tokenizerClient.ts`.

- [ ] **Step 1: Write the failing tests (`SEC-E12-01` & Review Focus #2)**

Tạo `frontend/src/adapters/worker-bridge/tokenizerClient.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { LOCAL_READER_LIMITS } from "@/core/reader/tokenizerPort";
import { createWasmTokenizerClient } from "./tokenizerClient";

describe("createWasmTokenizerClient (AD-16 / SEC-E12-01)", () => {
  it("rejects input exceeding 50,000 characters before waking the worker", async () => {
    const client = createWasmTokenizerClient({ loadPackBytes: async () => new Uint8Array([1]) });
    const res = await client.tokenize("あ".repeat(LOCAL_READER_LIMITS.maxChars + 1));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("input-too-large");
    client.dispose();
  });

  it("returns pack-missing gracefully when optional tokenizer-wasm pack is not installed", async () => {
    const client = createWasmTokenizerClient({ loadPackBytes: async () => null });
    const res = await client.tokenize("図書館へ行きます。");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("pack-missing");
    client.dispose();
  });

  it("falls back cleanly with wasm-unavailable if Worker or WebAssembly throws OOM", async () => {
    const client = createWasmTokenizerClient({
      loadPackBytes: async () => {
        throw new RangeError("WebAssembly.Memory(): could not allocate memory");
      },
    });
    const res = await client.tokenize("図書館へ行きます。");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("wasm-unavailable");
    client.dispose();
  });
});
```

Tạo `infra/scripts/src/tokenizer-pack.test.ts`: kiểm tra `buildTokenizerPackManifest` chỉ chấp nhận từ điển khai báo giấy phép `"BSD-3-Clause"`, tính đúng SHA-256 và từ chối mọi từ điển `GPL-2.0` hoặc thiếu `NOTICE`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/worker-bridge/tokenizerClient.test.ts && pnpm --filter @luyen/infra-scripts test -- src/tokenizer-pack.test.ts`
Expected: FAIL do các file chưa tồn tại.

- [ ] **Step 3: Implement BSD-3 pack script, `tokenizerPort.ts`, lazy Web Worker & `NOTICE`**

- Cài đặt `infra/scripts/src/tokenizer-pack.ts`: đóng gói bộ từ điển hình thái học **BSD-3** (IPADIC/UniDic phát hành dưới giấy phép `BSD-3-Clause` cho Lindera-WASM) thành gói `tokenizer-wasm` rời, ghi `sha256`, `sizeBytes`, `license: "BSD-3-Clause"` vào `extensions-index.json`.
- Cài đặt `frontend/src/adapters/worker-bridge/tokenizer.worker.ts`:
  - Khởi tạo lười (chỉ tạo `new Worker(new URL("./tokenizer.worker.ts", import.meta.url), { type: "module" })` khi người dùng thực sự phân tích văn bản ở `/tu-doc`).
  - Nạp byte gói `tokenizer-wasm` nhận qua `Transferable` từ `ExtensionPackStore`, tự kiểm khớp SHA-256 trên byte thô trước khi khởi tạo WASM, `0` lệnh `fetch()` ra mạng trong Worker.
  - Chuyển cách đọc Katakana của IPADIC sang Hiragana để gắn `<ruby>`.
- Cài đặt `frontend/src/adapters/worker-bridge/tokenizerClient.ts`: bọc `TokenizerPort`, enforce `maxChars <= 50_000`, `workerTimeoutMs = 5_000` (gọi `worker.terminate()` khi quá giờ), bắt mọi lỗi `WebAssembly`/`RangeError` trả `{ ok: false, error: { code: "wasm-unavailable" } }`.
- Cập nhật `NOTICE` (nguyên văn giấy phép `BSD-3-Clause` của IPADIC/UniDic) và `frontend/src/pages/AboutPage.tsx`: ghi chú **IPADIC/UniDic (BSD-3-Clause)** bằng văn bản thuần (không thêm `<ExternalLink>` ngoài mới để không mở rộng `opener:allow-open-url`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/worker-bridge/tokenizerClient.test.ts && pnpm --filter @luyen/infra-scripts test -- src/tokenizer-pack.test.ts`
Expected: PASS.

- [ ] **Step 5: Security & QA Gate (`SEC-E12-01`)**

- Kiểm tra tĩnh: `tokenizer.worker.ts` không chứa `fetch(`, `XMLHttpRequest`, `importScripts("http")`, hay `eval(`.
- Kiểm tra CSP trên `frontend/public/_headers`, `desktop/src-tauri/tauri.conf.json` và `mobile/src-tauri/tauri.conf.json`: xác minh `worker-src 'self'` luôn hiện diện, `'unsafe-eval'` tuyệt đối vắng mặt; nếu kiểm thử khởi tạo Lindera-WASM trên Chromium/WebView2/Android WebView báo chặn `WebAssembly.instantiate`, chỉ thêm `'wasm-unsafe-eval'` vào `script-src` của đúng các tệp CSP trên và chạy lại contract test CSP của Epic 9.
- Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check && pnpm --filter @luyen/infra-scripts test -- src/tauri-csp-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add infra/scripts/src/tokenizer-pack.ts infra/scripts/src/tokenizer-pack.test.ts frontend/src/core/reader/tokenizerPort.ts frontend/src/adapters/worker-bridge/tokenizer.worker.ts frontend/src/adapters/worker-bridge/tokenizerClient.ts frontend/src/adapters/worker-bridge/tokenizerClient.test.ts frontend/src/pages/AboutPage.tsx NOTICE
git commit -m "feat(reader): add lazy WASM tokenizer Web Worker with BSD-3 dictionary pack"
```

---

### Task 3: Trình đọc Tự nhập Ngoại tuyến `/tu-doc` (`FR-41`, `AD-18`)

**Files:**
- Create: `frontend/src/core/reader/localReader.ts`
- Create: `frontend/src/pages/LocalReaderPage.tsx`
- Modify: `frontend/src/App.tsx:74-166`
- Modify: `frontend/src/components/Layout.tsx:28-62`
- Test: `frontend/src/core/reader/localReader.test.ts`
- Test: `frontend/src/pages/LocalReaderPage.test.tsx`

**Interfaces:**
- Consumes:
  - `TokenizerPort`, `MorphemeToken`, `LOCAL_READER_LIMITS` (`Task 2`).
  - `UnifiedSearchIndex` (Epic 11 Task 3), `WordLookupHost` & `extractSentenceCloze` (Epic 11 Task 5), `RubySegment` (`frontend/src/core/exam/ruby.ts`).
  - `useFuriganaPreference`, `useMasteredKanji` (`frontend/src/hooks/`) và `adaptiveRuby.ts` (`frontend/src/core/exam/adaptiveRuby.ts`, Epic 8 `FR-45`) để tự ẩn `<rt>` cho từ đã thành thạo nếu người dùng bật Adaptive Furigana.
- Produces:
  - `export interface AnnotatedToken { token: MorphemeToken; ruby?: { base: string; reading: string }; jlptBand: "n5" | "n4" | "n3-plus" | "none"; pitch?: number[]; }`
  - `export function annotateMorphemes(tokens: readonly MorphemeToken[], index: UnifiedSearchIndex): AnnotatedToken[]`
  - `export function decodeReaderFileBytes(bytes: Uint8Array, filename: string): Result<string, { code: "unsupported-ext" | "file-too-large" | "invalid-utf8" | "text-too-long"; detail: string }>`
  - Route `/tu-doc` (`LocalReaderPage.tsx`).

- [ ] **Step 1: Write the failing tests (`SEC-E12-01` & Review Focus #2)**

Tạo `frontend/src/core/reader/localReader.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { LOCAL_READER_LIMITS } from "./tokenizerPort";
import { decodeReaderFileBytes } from "./localReader";

describe("decodeReaderFileBytes (SEC-E12-01)", () => {
  it("accepts UTF-8 .txt and .md up to 512KB and 50,000 chars", () => {
    const bytes = new TextEncoder().encode("今日はいい天気ですね。");
    const res = decodeReaderFileBytes(bytes, "bai-doc.txt");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe("今日はいい天気ですね。");
  });

  it("rejects .html/.exe files, >512KB files, and invalid UTF-8 bytes", () => {
    expect(decodeReaderFileBytes(new Uint8Array([65]), "evil.html").ok).toBe(false);
    expect(
      decodeReaderFileBytes(new Uint8Array(LOCAL_READER_LIMITS.maxFileBytes + 1), "big.txt").ok,
    ).toBe(false);
    expect(decodeReaderFileBytes(new Uint8Array([0xff, 0xfe]), "bad.md").ok).toBe(false);
  });
});
```

Tạo `frontend/src/pages/LocalReaderPage.test.tsx`:
- Kiểm tra khi `tokenizerClient` trả `pack-missing` hoặc `wasm-unavailable` (Review Focus #2), trang vẫn hiển thị nguyên văn đoạn văn người dùng dán, cho phép chọn từ để mở `WordLookupHost` và hiện thông báo gợi ý tải gói `tokenizer-wasm` trong `/tai-khoan`.
- Kiểm tra dán chuỗi chứa `<script>alert(1)</script>日本語` chỉ xuất ra text node an toàn, không chèn phần tử `<script>` vào DOM.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/reader/localReader.test.ts src/pages/LocalReaderPage.test.tsx`
Expected: FAIL do chưa có file.

- [ ] **Step 3: Implement `localReader.ts`, `LocalReaderPage.tsx`, and route `/tu-doc`**

- Cài đặt `decodeReaderFileBytes` (chỉ chấp nhận đuôi `.txt`/`.md`, `<= 512 KB`, `TextDecoder("utf-8", { fatal: true })`, `<= 50_000` ký tự) và `annotateMorphemes` (gắn `ruby` khi token chứa Kanji và khác cách đọc, gắn nhãn màu JLPT `N5`/`N4`/`N3+` và `pitch` từ `UnifiedSearchIndex`).
- Cài đặt `LocalReaderPage.tsx` (phong cách giấy Washi, `lang="ja"` cho vùng đọc):
  - Ô dán văn bản (`maxLength={50_000}`) + nút nhập `.txt`/`.md` (`min-h-11`).
  - Công tắc `Hiện Furigana` (tôn trọng Adaptive Furigana từ Epic 8), `Tô màu cấp độ JLPT` và `Hiện cao độ Pitch`.
  - Render `<ruby>` thuần React JSX; chạm bất kỳ token nào mở `WordLookupHost` với nút `Lưu sổ tay` và `Tạo thẻ Cloze` (nguồn `"Tự đọc"`).
  - Fallback an toàn khi chưa tải `tokenizer-wasm` hoặc WASM hết bộ nhớ.
- Đăng ký route `/tu-doc` trong `frontend/src/App.tsx` và lối vào gọn trong nhóm `Đọc hiểu` / `Luyện đề` (không làm thay đổi cấu trúc 5 tab `MOBILE_TABS` đã chốt ở FR-39).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/reader/ src/pages/LocalReaderPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Security & QA Gate**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: PASS; 0 `innerHTML`/`dangerouslySetInnerHTML`, 0 lời gọi mạng ngoài.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/reader/localReader.ts frontend/src/core/reader/localReader.test.ts frontend/src/pages/LocalReaderPage.tsx frontend/src/pages/LocalReaderPage.test.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(reader): add offline local furigana reader page /tu-doc with safe WASM fallback"
```

---

### Task 4: Desktop Global Shortcut `Ctrl+Shift+J`, Cửa sổ Quick Lookup & Capability Ít Quyền Nhất (`FR-42`, `AD-17`, `SEC-E12-03`)

**Files:**
- Modify: `desktop/src-tauri/Cargo.toml:13-20`
- Modify: `desktop/src-tauri/tauri.conf.json:11-29`
- Create: `desktop/src-tauri/capabilities/quick-lookup.json`
- Modify: `desktop/src-tauri/src/main.rs:1-28`
- Create: `frontend/src/core/native/clipboardGuard.ts`
- Create: `frontend/src/pages/QuickLookupPage.tsx`
- Modify: `frontend/src/App.tsx:74-166`
- Modify: `frontend/src/pages/AccountPage.tsx` (thêm công tắc opt-in `Đọc clipboard khi bấm Ctrl+Shift+J` và tùy chỉnh phím tắt)
- Test: `frontend/src/core/native/clipboardGuard.test.ts`
- Test: `tests/desktop/capability-contract.test.mjs`

**Interfaces:**
- Consumes: `UnifiedSearchIndex` (Epic 11 Task 3), `conjugateJapanese` (Epic 11 Task 1), `MinnaCrossLinks` (Epic 11 Task 4), `sanitizeLookupQuery` (`Task 1`).
- Produces:
  - Capability cô lập `desktop/src-tauri/capabilities/quick-lookup.json` (`"windows": ["quick-lookup"]`, `"local": true`, CHỈ `core:window:allow-hide`, `core:window:allow-set-focus`, `core:event:allow-listen`, `core:event:allow-unlisten`).
  - Lệnh Tauri Desktop `toggle_quick_lookup` và sự kiện `"quick-lookup:open"` phát từ `desktop/src-tauri/src/main.rs` khi nhấn `Ctrl+Shift+J` (`Cmd+Shift+J` trên macOS).
  - `export function filterClipboardForLookup(raw: string, optInEnabled: boolean): string | null` trong `frontend/src/core/native/clipboardGuard.ts`.
  - Route `/tra-nhanh` (`QuickLookupPage.tsx`): chế độ cửa sổ mini nổi gọn, bấm `Esc` ẩn cửa sổ (`getCurrentWindow().hide()`), không lưu clipboard vào Dexie/Supabase/log.

- [ ] **Step 1: Write the failing tests (`SEC-E12-03`, `SEC-T09`, `SEC-T12` & Review Focus #3)**

Tạo `frontend/src/core/native/clipboardGuard.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filterClipboardForLookup } from "./clipboardGuard";

describe("filterClipboardForLookup (SEC-E12-03 / SEC-T12)", () => {
  it("returns null when opt-in is disabled", () => {
    expect(filterClipboardForLookup("食べる", false)).toBeNull();
  });

  it("skips URLs, JWT tokens, and Bearer secrets even when opt-in is enabled", () => {
    expect(filterClipboardForLookup("https://secret.test/?token=abc", true)).toBeNull();
    expect(filterClipboardForLookup("http://localhost:5173/tai-khoan?code=1", true)).toBeNull();
    expect(
      filterClipboardForLookup("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def", true),
    ).toBeNull();
  });

  it("accepts Japanese/Vietnamese lookup text, strips controls, and truncates to 120 code points", () => {
    expect(filterClipboardForLookup("  図書館\n", true)).toBe("図書館");
    expect([...(filterClipboardForLookup("あ".repeat(200), true) ?? "")]).toHaveLength(120);
  });
});
```

Tạo `tests/desktop/capability-contract.test.mjs` (`SEC-T09`):
- Đọc `desktop/src-tauri/capabilities/default.json`, `desktop/src-tauri/capabilities/quick-lookup.json` và `desktop/src-tauri/tauri.conf.json`.
- Khẳng định `default.json` chỉ có `"windows": ["main"]` (KHÔNG chứa `"quick-lookup"`).
- Khẳng định `quick-lookup.json` có `"windows": ["quick-lookup"]`, `"local": true`, và **KHÔNG chứa** bất kỳ quyền nào có tiền tố `updater:`, `opener:`, `deep-link:`, `fs:`, `http:`, `shell:`.
- Khẳng định CSP không có `'unsafe-eval'`, không có `media-src *` hay `script-src *`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/native/clipboardGuard.test.ts && node --test tests/desktop/capability-contract.test.mjs`
Expected: FAIL vì các file chưa tồn tại.

- [ ] **Step 3: Implement Desktop Tauri shortcut, least-privilege capability, `clipboardGuard.ts`, and `/tra-nhanh`**

- Thêm `tauri-plugin-global-shortcut` vào `desktop/src-tauri/Cargo.toml` bằng `cargo add --manifest-path desktop/src-tauri/Cargo.toml tauri-plugin-global-shortcut@2 --pin` (ghim chính xác dấu `=` khớp `tauri = "=2.12.7"`) và khóa `desktop/src-tauri/Cargo.lock`.
- Tạo `desktop/src-tauri/capabilities/quick-lookup.json`:
  ```json
  {
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "quick-lookup-capability",
    "description": "Least-privilege local capability for the Quick Lookup overlay window",
    "windows": ["quick-lookup"],
    "local": true,
    "permissions": [
      "core:window:allow-hide",
      "core:window:allow-set-focus",
      "core:event:allow-listen",
      "core:event:allow-unlisten"
    ]
  }
  ```
- Cập nhật `desktop/src-tauri/tauri.conf.json`:
  - Thêm cửa sổ thứ hai `{ "label": "quick-lookup", "title": "Tra nhanh JLPT", "url": "index.html#/tra-nhanh", "width": 480, "height": 560, "resizable": true, "visible": false, "alwaysOnTop": true, "skipTaskbar": true }`.
  - Cập nhật `"capabilities": ["main-capability", "quick-lookup-capability"]`.
- Cập nhật `desktop/src-tauri/src/main.rs`: đăng ký `tauri_plugin_global_shortcut` với phím mặc định `CommandOrControl+Shift+J`. Khi kích hoạt: nếu cửa sổ `"quick-lookup"` đang hiện thì `.hide()`, nếu đang ẩn thì `.show()`, `.set_focus()` và `.emit("quick-lookup:open", ())`. Không nhét logic tra từ vào Rust (`AD-17`).
- Cài đặt `clipboardGuard.ts` và `QuickLookupPage.tsx` (route `/tra-nhanh`, bỏ khung Header/Footer nặng, chỉ hiển thị ô tra cứu + kết quả + 13 thể + `MinnaCrossLinks`, bấm `Esc` ẩn cửa sổ):
  - **Đọc từ điển thuần Dexie:** `QuickLookupPage` bắt buộc nạp `dict-javi-core` thông qua `createDexieExtensionStore()` (`frontend/src/adapters/extensions/dexieExtensionStore.ts`), **tuyệt đối không gọi `tauri-plugin-fs`** vì `quick-lookup.json` cố ý không cấp quyền `fs`.
  - **Đọc clipboard an toàn:** Chỉ gọi `navigator.clipboard.readText()` đúng thời điểm nhận sự kiện `"quick-lookup:open"` khi `quickLookupReadClipboard === true`, bọc `try/catch` bỏ qua im lặng `NotAllowedError` (mất focus hoặc từ chối quyền) mà không ném lỗi/bật toast ồn, lọc qua `filterClipboardForLookup`, và không bao giờ lưu clipboard vào Dexie, Supabase hay log.
- Thêm tùy chọn bật/tắt `Đọc clipboard khi mở Tra nhanh (Ctrl+Shift+J)` (mặc định `false`) trong `frontend/src/pages/AccountPage.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/native/clipboardGuard.test.ts && node --test tests/desktop/capability-contract.test.mjs`
Expected: PASS 100%.

- [ ] **Step 5: Security & QA Gate (`SEC-E12-03`, `SEC-T09`, `SEC-T12`)**

Run: `cargo check --manifest-path desktop/src-tauri/Cargo.toml --locked && pnpm --filter @luyen/frontend typecheck`
Expected: Biên dịch Rust thành công không cảnh báo mới; `capability-contract.test.mjs` xác nhận `quick-lookup` hoàn toàn cô lập khỏi `updater`/`opener`/`deep-link`/`fs`/`http`.

- [ ] **Step 6: Commit**

```bash
git add desktop/src-tauri/Cargo.toml desktop/src-tauri/Cargo.lock desktop/src-tauri/tauri.conf.json desktop/src-tauri/capabilities/quick-lookup.json desktop/src-tauri/src/main.rs frontend/src/core/native/clipboardGuard.ts frontend/src/core/native/clipboardGuard.test.ts frontend/src/pages/QuickLookupPage.tsx frontend/src/App.tsx frontend/src/pages/AccountPage.tsx tests/desktop/capability-contract.test.mjs
git commit -m "feat(desktop): add Ctrl+Shift+J quick lookup window with least-privilege capability"
```

---

### Task 5: Cầu nối Android `ACTION_PROCESS_TEXT` & `ACTION_SEND` Intent Bridge (`FR-42`, `AD-17`, `SEC-E12-02`)

**Files:**
- Create: `mobile/android-bridge/ProcessTextBridgeActivity.kt`
- Create: `mobile/scripts/patch-android-intents.mjs`
- Modify: `.github/workflows/native.yml:193-198`
- Test: `tests/mobile/android-intent-bridge.test.mjs`

**Interfaces:**
- Consumes: `luyenjlpt://lookup?q=<encoded>` xử lý bởi `deepLinkDispatcher.ts` (`Task 1`) và `mobile/src-tauri/tauri.conf.json:34-38`.
- Produces:
  - `mobile/android-bridge/ProcessTextBridgeActivity.kt`: Activity trong gói `vn.luyenjlpt.app` đăng ký `ACTION_PROCESS_TEXT` và `ACTION_SEND` (chỉ `mimeType="text/plain"`, `android:label="Tra bằng Ôn JLPT"`), lọc sạch chuỗi theo `SEC-E12-02` và chuyển tiếp `Intent(Intent.ACTION_VIEW, Uri.parse("luyenjlpt://lookup?q=" + Uri.encode(sanitized)))` tới `MainActivity` rồi `finish()`.
  - `export function sanitizeAndroidIntentText(mimeType: string | null, extraText: string | null): string | null` và `export function patchAndroidProject(genAndroidDir: string): void` trong `mobile/scripts/patch-android-intents.mjs` (idempotent, chạy ngay sau `pnpm tauri:mobile android init` trong CI và máy dev).

- [ ] **Step 1: Write the failing test (`SEC-E12-02`, `SEC-T12` & Review Focus #4)**

Tạo `tests/mobile/android-intent-bridge.test.mjs`:
- Kiểm tra `sanitizeAndroidIntentText`:
  1. Từ chối mọi `mimeType !== "text/plain"` (`image/png`, `text/html`, `application/pdf`, `null`).
  2. Lọc bỏ `\0` và mọi ký tự điều khiển `[\u0000-\u001F\u007F]`, cắt cứng `<= 120` code points (kể cả ký tự Kanji surrogate pair).
  3. Từ chối chuỗi rỗng sau khi trim.
- Kiểm tra `patchAndroidProject(tmpDir)` trên một `AndroidManifest.xml` mẫu giống Tauri generate:
  1. Chèn đúng 1 khai báo `<activity android:name=".ProcessTextBridgeActivity" android:exported="true" ...>` chứa cả `ACTION_PROCESS_TEXT` và `ACTION_SEND` chỉ với `<data android:mimeType="text/plain" />`.
  2. Chạy lần 2 là idempotent (không nhân đôi thẻ `<activity>`).
  3. Bảo toàn nguyên vẹn các khai báo bảo mật từ Epic 7 trong `AndroidManifest.xml`: `android:usesCleartextTraffic="false"`, `android:networkSecurityConfig="@xml/network_security_config"`, và `<provider android:name="androidx.core.content.FileProvider" android:exported="false" ...>` (`updates/`).
  4. Chép `ProcessTextBridgeActivity.kt` vào `app/src/main/java/vn/luyenjlpt/app/` và xác nhận mã Kotlin không đọc `EXTRA_STREAM`, có lọc ký tự điều khiển, cắt `120` code points và gọi `Uri.encode()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mobile/android-intent-bridge.test.mjs`
Expected: FAIL vì `patch-android-intents.mjs` chưa tồn tại.

- [ ] **Step 3: Implement Kotlin bridge, idempotent patch script, and wire into `native.yml`**

- Viết `mobile/android-bridge/ProcessTextBridgeActivity.kt`:
  - Kiểm `intent?.type == "text/plain"` (bỏ qua nếu khác hoặc nếu có `Intent.EXTRA_STREAM` mà không có text hợp lệ).
  - Đọc `Intent.EXTRA_PROCESS_TEXT` (khi `ACTION_PROCESS_TEXT`) hoặc `Intent.EXTRA_TEXT` (khi `ACTION_SEND`), chỉ đọc `CharSequence` thuần `.toString()`.
  - Loại bỏ `[\u0000-\u001F\u007F]`, `.trim()`, cắt an toàn theo Unicode code point `<= 120` (`codePointCount` / `offsetByCodePoints`), mã hóa bằng `Uri.encode(clean)`.
  - Gọi `startActivity` với `Intent(Intent.ACTION_VIEW, Uri.parse("luyenjlpt://lookup?q=$encoded")).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)` rồi `finish()`.
- Viết `mobile/scripts/patch-android-intents.mjs` sao chép `ProcessTextBridgeActivity.kt` và vá `mobile/src-tauri/gen/android/app/src/main/AndroidManifest.xml` một cách idempotent, chỉ chèn `<activity android:name=".ProcessTextBridgeActivity">` trước thẻ đóng `</application>` và **giữ nguyên tuyệt đối** các thuộc tính/thẻ bảo mật đã được Epic 7 vá (`android:usesCleartextTraffic="false"`, `android:networkSecurityConfig`, và `FileProvider` `exported="false"` cho `updates/`).
- Gọi `node mobile/scripts/patch-android-intents.mjs` trong `.github/workflows/native.yml` ngay sau bước `pnpm tauri:mobile android init --ci --skip-targets-install`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mobile/android-intent-bridge.test.mjs && node --test tests/mobile/android-release.test.mjs`
Expected: PASS 100%.

- [ ] **Step 5: Security & QA Gate (`SEC-E12-02`)**

- Xác minh `ProcessTextBridgeActivity.kt` luôn ràng buộc `.setPackage(packageName)` khi phát `ACTION_VIEW` (không cho app ngoài chặn bắt Intent nội bộ) và không ghi log `Log.d` chứa văn bản người dùng.
- Run: `node mobile/scripts/validate-scaffold.mjs --config-only`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/android-bridge/ProcessTextBridgeActivity.kt mobile/scripts/patch-android-intents.mjs tests/mobile/android-intent-bridge.test.mjs .github/workflows/native.yml
git commit -m "feat(android): add sanitized ACTION_PROCESS_TEXT and ACTION_SEND intent bridge"
```

---

### Task 6: Đường ống Nhập & Kiểm chuẩn Gói Nội dung JLPT N3 Thật (`R1–R4`, `AD-3`, `AD-13`, `SEC-E12-04`)

**Files:**
- Create: `infra/scripts/src/import-n3.ts`
- Create: `infra/scripts/src/verify-n3.ts`
- Modify: `infra/scripts/src/packs.ts:21-151`
- Modify: `infra/scripts/package.json:6-13`
- Modify: `infra/content/n3-sample/README.md` (ghi rõ phân tách `infra/content/n3/` thật vs `infra/content/n3-sample/` fixture)
- Test: `infra/scripts/src/verify-n3.test.ts`
- Test: `infra/scripts/src/packs.test.ts`

**Interfaces:**
- Consumes:
  - `buildPack`, `writeIndex`, `formatComparisonLinkReport` (`infra/scripts/src/build-packs.ts`).
  - `verifyPack`, `verifyN4AgainstDataset`, `removedIds` (`infra/scripts/src/verify-packs.ts`).
  - `importDatasetTables` (`infra/scripts/src/import-dataset.ts`) và `validatePack` (`frontend/src/core/content/validate.ts`).
- Produces:
  - `export function importN3Dataset(jsonlDir: string, outDir: string): { counts: Record<PackTable, number> }` trong `infra/scripts/src/import-n3.ts` (gắn tiền tố chuẩn `n3-` cho mọi ID, kiểm tra ID `<= 128` ký tự, không trùng ID, không sót trường nguồn).
  - `export function verifyN3AgainstDataset(packDir: string, datasetDir: string): string[]` trong `infra/scripts/src/verify-n3.ts` (đối chiếu 100% số lượng, ID, `kanjiIds` từ ghép, furigana đã kiểm duyệt và cấm xóa ID đã phát hành qua `removedIds`).
  - Quy tắc phát hành trong `infra/scripts/src/packs.ts`:
    - Nếu tồn tại `infra/content/n3/VERSION` (dữ liệu N3 thật đã được chủ dự án nạp sau khi Phase 2 hoàn tất): `buildPacks` và `verifyPacks` tự động đóng gói & kiểm chuẩn cả `n4` và `n3` (không cần `EXPERIMENTAL_LEVELS=1`), đồng thời giữ audio/KanjiVG N3 ở `extensions-index.json` (`kanjivg-n3`, `audio-n3-vocab`, `audio-n3-exams`) để APK cơ bản giữ `<= 30 MB`.
    - Nếu chưa tồn tại `infra/content/n3/VERSION`: giữ nguyên hành vi hiện tại (`n3-sample` chỉ bật khi `EXPERIMENTAL_LEVELS=1`).

- [ ] **Step 1: Write the failing tests (Review Focus #5)**

Tạo `infra/scripts/src/verify-n3.test.ts`:
```ts
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importN3Dataset } from "./import-n3";
import { verifyN3AgainstDataset } from "./verify-n3";

describe("importN3Dataset & verifyN3AgainstDataset", () => {
  it("enforces n3- ID prefix, <=128 char ID limit, and detects duplicate or missing IDs", () => {
    const dir = mkdtempSync(join(tmpdir(), "n3-import-"));
    const jsonlDir = join(dir, "jsonl");
    const outDir = join(dir, "content");
    mkdirSync(jsonlDir, { recursive: true });
    writeFileSync(
      join(jsonlDir, "tu_vung.jsonl"),
      `${JSON.stringify({ id: "TV001", word: "経験", reading: "けいけん", han_viet: "KINH NGHIỆM", meaning_vi: "kinh nghiệm", lesson: 1, section: "từ chính" })}\n`,
    );
    writeFileSync(
      join(jsonlDir, "kanji.jsonl"),
      `${JSON.stringify({ id: "K001", kanji: "経", han_viet: "KINH", onyomi: ["ケイ"], kunyomi: ["へる"], meaning_vi: "trải qua", lessons: ["1"] })}\n`,
    );
    writeFileSync(
      join(jsonlDir, "tu_ghep_kanji.jsonl"),
      `${JSON.stringify({ id: "C001", compound: "経験", reading: "けいけん", han_viet: "KINH NGHIỆM", meaning_vi: "kinh nghiệm", kanji_id: "K001", components: [{ kanji: "経", han_viet: "KINH", meaning: "trải qua" }], lessons: ["1"] })}\n`,
    );
    writeFileSync(
      join(jsonlDir, "ngu_phap.jsonl"),
      `${JSON.stringify({ id: "G001", lesson: 1, pattern: "～うちに", connections: { v: "Vる／Vている" }, meaning_vi: "nhân lúc", usage_vi: "làm việc trước khi thay đổi", examples: [{ japanese: "若いうちに旅行したい。", reading: "{若|わか}いうちに{旅行|りょこう}したい。", meaning: "Muốn du lịch nhân lúc còn trẻ." }] })}\n`,
    );
    for (const empty of ["so_sanh", "cach_chia", "kinh_ngu", "tu_dong_tha_dong", "doc_hieu"]) {
      writeFileSync(join(jsonlDir, `${empty}.jsonl`), "");
    }

    const { counts } = importN3Dataset(jsonlDir, outDir);
    expect(counts.vocabulary).toBe(1);
    expect(counts.kanji).toBe(1);
    expect(counts.compounds).toBe(1);
    expect(counts.grammar).toBe(1);
    expect(verifyN3AgainstDataset(outDir, jsonlDir)).toEqual([]);
  });

  it("rejects IDs exceeding 128 characters or unmapped source fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "n3-bad-"));
    const jsonlDir = join(dir, "jsonl");
    mkdirSync(jsonlDir, { recursive: true });
    writeFileSync(
      join(jsonlDir, "tu_vung.jsonl"),
      `${JSON.stringify({ id: "X".repeat(130), word: "a", reading: "a", meaning_vi: "a", lesson: 1, section: "từ chính" })}\n`,
    );
    expect(() => importN3Dataset(jsonlDir, join(dir, "out"))).toThrow(/128/);
  });
});
```

Mở rộng `infra/scripts/src/packs.test.ts` kiểm tra: khi không có `infra/content/n3/VERSION`, `buildPacks(root, false)` chỉ xuất N4; khi có `infra/content/n3/VERSION` hợp lệ, `buildPacks(root, false)` và `verifyPacks(root)` tự động xuất & kiểm chứng cả `n4` lẫn `n3` mà không phá vỡ kiểm tra dataset N4.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/infra-scripts test -- src/verify-n3.test.ts src/packs.test.ts`
Expected: FAIL do `import-n3.ts` và `verify-n3.ts` chưa tồn tại.

- [ ] **Step 3: Implement `import-n3.ts`, `verify-n3.ts`, and update `packs.ts`**

- Cài đặt `infra/scripts/src/import-n3.ts` chuyển đổi đủ 9 bảng JSONL từ `infra/dataset_n3/jsonl/` sang `infra/content/n3/` với tiền tố `n3-` (`n3-vocab-*`, `n3-kanji-*`, `n3-compound-*`, `n3-grammar-*`, `n3-comparison-*`, `n3-conjugation-*`, `n3-keigo-*`, `n3-verbpair-*`, `n3-reading-*`), tái sử dụng `importDatasetTables` cho 4 bảng ngữ pháp mở rộng và `writeTable`.
- Cài đặt `infra/scripts/src/verify-n3.ts`: đối chiếu đầy đủ số lượng, ID duy nhất, không dùng ID trùng N4, kiểm tra `kanjiIds` hợp lệ và phát hiện mất ID giữa các phiên bản N3.
- Cập nhật `infra/scripts/src/packs.ts`: thêm `n3Release(root)` đọc `infra/content/n3/VERSION` (nếu tồn tại); chỉ dùng `n3-sample` khi `infra/content/n3/VERSION` chưa tồn tại và `EXPERIMENTAL_LEVELS === "1"`. Thêm script `"content:n3": "tsx src/import-n3.ts"` vào `infra/scripts/package.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/infra-scripts test -- src/verify-n3.test.ts src/packs.test.ts && pnpm packs:verify`
Expected: PASS 100%, gói N4 giữ nguyên vẹn không thay đổi byte nào.

- [ ] **Step 5: Security & QA Gate (`SEC-E12-04`)**

Run: `pnpm --filter @luyen/infra-scripts typecheck && pnpm --filter @luyen/infra-scripts check`
Expected: PASS; mọi hàng N3 đi qua `validatePack()` và SHA-256 trước khi xuất bản.

- [ ] **Step 6: Commit**

```bash
git add infra/scripts/src/import-n3.ts infra/scripts/src/verify-n3.ts infra/scripts/src/verify-n3.test.ts infra/scripts/src/packs.ts infra/scripts/src/packs.test.ts infra/scripts/package.json infra/content/n3-sample/README.md
git commit -m "feat(packs): add N3 real dataset ingestion and verification pipeline preserving N4 invariants"
```

---

### Task 7: Gia cố Chuỗi cung ứng CI/CD (`SEC-E12-04`), Kiểm toán 0% AI (`AD-18`) & E2E Phase 4

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/native.yml:60-65,355-366`
- Create: `tests/web/local-reader-n3.spec.ts`
- Create: `tests/desktop/quick-lookup-smoke.mjs`

**Interfaces:**
- Consumes: toàn bộ Epic 11 & Epic 12 (`Task 1..Task 6`), quy tắc `AD-18` (0% AI / 0 ad-tech), quy tắc `SEC-E12-04`.
- Produces:
  - CI pipeline đã ghim runner `windows-2025` (thay `windows-latest`), ghim phiên bản `xcodegen` xác định, bổ sung cổng `pnpm audit --prod --audit-level=high` và `cargo audit`.
  - Bộ E2E `tests/web/local-reader-n3.spec.ts` kiểm chứng:
    1. Mở `/tu-doc` ngoại tuyến, dán đoạn tiếng Nhật, kiểm tra 0 request tới bất kỳ tên miền bên thứ ba/LLM/ad-tech nào (`AD-18`), tạo được thẻ Cloze và không vỡ DOM khi dán `<script>`.
    2. Chuyển đổi cấp độ `N4 ↔ N3` (dưới `EXPERIMENTAL_LEVELS=1` hoặc N3 thật) giữ nguyên dữ liệu tiến độ tách biệt theo cấp độ.
  - Bộ Desktop smoke `tests/desktop/quick-lookup-smoke.mjs`: mở `#/tra-nhanh?q=食べる`, xác nhận hiển thị nghĩa + 13 thể ngoại tuyến, và xác nhận gọi IPC ngoài phạm vi `quick-lookup-capability` bị từ chối.

- [ ] **Step 1: Write the failing E2E & supply-chain audit checks**

Tạo `tests/web/local-reader-n3.spec.ts` với network interceptor ghi nhận mọi request ngoài `localhost`/`127.0.0.1` (khẳng định `externalRequests.length === 0`, khóa `AD-18`).
Tạo `tests/desktop/quick-lookup-smoke.mjs` kiểm tra cửa sổ tra nhanh và tường ACL `quick-lookup-capability`.

- [ ] **Step 2: Run E2E before final workflow wiring to verify baseline**

Run: `pnpm e2e:web -- tests/web/local-reader-n3.spec.ts`
Expected: PASS trên nhánh đã hoàn thành Task 1..6 (hoặc FAIL nếu thiếu route `/tu-doc` / bộ lọc mạng).

- [ ] **Step 3: Harden `.github/workflows/ci.yml` and `.github/workflows/native.yml` (`SEC-E12-04`)**

- Trong `.github/workflows/native.yml:62`: đổi `runs-on: windows-latest` sang `runs-on: windows-2025`.
- Trong `.github/workflows/native.yml:360`: thay `brew install xcodegen` chưa ghim bằng tải release `yonaskolb/XcodeGen` bản cố định `2.42.0` (`xcodegen.zip`) kèm kiểm chứng `shasum -a 256` trước khi giải nén.
- Trong `.github/workflows/ci.yml`: thêm job/step `pnpm audit --prod --audit-level=high` và `cargo audit` cho cả `desktop/src-tauri/Cargo.lock` và `mobile/src-tauri/Cargo.lock`, đồng thời chạy `node --test tests/desktop/capability-contract.test.mjs tests/mobile/android-intent-bridge.test.mjs`.

- [ ] **Step 4: Run full verification suite across Web, Packs, Config Contracts & Audits**

Run:
```bash
pnpm packs:build && pnpm packs:verify
pnpm typecheck && pnpm check && pnpm test && pnpm build
node --test tests/desktop/capability-contract.test.mjs tests/mobile/android-intent-bridge.test.mjs tests/mobile/android-release.test.mjs
pnpm e2e:web -- tests/web/local-reader-n3.spec.ts
pnpm audit --prod --audit-level=high
```
Expected: Tất cả lệnh thoát với mã `0`; `externalRequests.length === 0` trong `local-reader-n3.spec.ts`; kích thước APK cơ bản giữ `<= 30 MB`.

- [ ] **Step 5: Security & QA Gate (Epic 12 & v2 Closure)**

- Xác nhận toàn bộ 4 kiểm soát bảo mật `SEC-E12-01..04` và 2 ca kiểm thử lạm dụng `SEC-T09`, `SEC-T12` đều đã được bao phủ tự động.
- Xác nhận không có bất kỳ dependency hay endpoint AI/LLM nào trong `package.json`, `Cargo.toml` và mã nguồn (`AD-18`).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/native.yml tests/web/local-reader-n3.spec.ts tests/desktop/quick-lookup-smoke.mjs
git commit -m "chore(ci): pin native toolchain, add dependency audits, and Phase 4 E2E smoke suite"
```
