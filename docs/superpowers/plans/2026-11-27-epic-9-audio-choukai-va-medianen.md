# Epic 9: Hạ tầng Gói Mở rộng, Audio Choukai & Media Nền Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hạ tầng gói mở rộng tùy chọn (`ExtensionPackStore` theo `AD-13`), đường ống nén và phân phối Audio Choukai Opus 24–32 kbps qua bucket Supabase riêng tư (`audio-packs`) với Signed URL ngắn hạn (`FR-28`), cổng phát âm `AudioPort` kèm Pitch Accent Kanjium (`FR-31`), chế độ luyện nghe Shadowing A–B `0.75×–1.25×` trong `ExamRunnerPage`, và phát audio nền qua `MediaSession` (`FR-45`) với CSP media chặt trên Web, Desktop và Mobile.

**Architecture:** Toàn bộ tài nguyên nặng tách khỏi gói cài cơ bản sang danh mục `extensions-index.json`, tải theo yêu cầu và kiểm chứng SHA-256 trên byte thô trước khi lưu vào bảng `extensionPacks` của Dexie `luyen-jlpt` v4 (hoặc adapter `tauri-plugin-fs` phạm vi `$APPDATA/extensions/**` trên native, không phụ thuộc `Cache Storage`). Âm thanh chạy qua cổng `AudioPort` thuần trong `frontend/src/core/audio/` với chuỗi ưu tiên 3 tầng (Blob Opus offline → Signed URL ngắn hạn từ Edge Function `sign-audio-pack` → `window.speechSynthesis` `ja-JP`), nối cầu `MediaSession` ở lớp adapter để nghe khi tắt màn hình mà không lọt PII/token.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Dexie 4 (`luyen-jlpt` v4), Supabase Postgres RLS + Private Storage + Deno Edge Functions, Tauri 2 (`tauri-plugin-fs`, `tauri-plugin-opener`), FFmpeg (`libopus`), Vitest 5, pgTAP, Deno test, Playwright.

**Spec:**
- `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (`AD-13`, `AD-15`, `FR-28`, `FR-31`, `FR-45`)
- `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E9-01`, `SEC-E9-02`, `SEC-E9-03`, `SEC-T06`, `SEC-T09`)

## Global Constraints

- Bản cài Android `.apk` cơ bản giữ `<= 30 MB`; tuyệt đối không đóng gói file `.opus`/`.mp3` Choukai vào `frontend/public/packs/`.
- Bảo toàn 100% đường dẫn tiếng Việt (`/tai-khoan`, `/tu-vung`, `/ngu-phap/$patternId`, `/luyen-de/$examId`, `/gioi-thieu`) và bộ ID gói N4 (`1.182` từ vựng, `118` kanji, `388` từ ghép từ `403` dòng nguồn, `148` ngữ pháp) qua `pnpm packs:verify`.
- Mọi giao diện tiếng Việt, mọi chữ Nhật gắn `lang="ja"`, vùng chạm tối thiểu `44×44px` (`min-h-11 min-w-11`), tôn trọng `useMotionPreference()`, 0 quảng cáo, 0 tracker, 0% AI (`AD-18`).
- `ExtensionPackStore` không phụ thuộc `Cache Storage` trên Tauri; kiểm chứng SHA-256 trên byte thô trước giải nén/parse, giới hạn giải nén `<= 100 MB` (`SEC-E9-01`).
- Bucket `audio-packs` bắt buộc `public = false`, chỉ `SELECT` qua RLS cho tài khoản có `jlpt_private.has_confirmed_email()`, 0 quyền `INSERT/UPDATE/DELETE` cho `anon`/`authenticated`; Edge Function `sign-audio-pack` áp rate-limit `<= 30 req/giờ/user`, Signed URL TTL `<= 300s`, header `Cache-Control: private, no-store`, không log `?token=` (`SEC-E9-02`).
- CSP Tauri Desktop/Mobile chỉ mở `media-src 'self' blob: https://<ref>.supabase.co`, `worker-src 'self'`, ghim đúng 20 ký tự project ref ở bản release, gỡ `wss://*.supabase.co`, cấm wildcard `*` và `'unsafe-eval'` (`SEC-E9-03`).
- Kanjium Pitch Accent tuân thủ giấy phép `CC BY-SA 4.0`, ghi nguồn đầy đủ trong `/gioi-thieu` (`AboutPage.tsx`) và allowlist `opener:allow-open-url` của Desktop/Mobile.
- Độ trễ phát audio cục bộ `< 150 ms`; mọi `Blob` URL tạo bởi `URL.createObjectURL` phải gọi `URL.revokeObjectURL` khi đổi bài hoặc unmount.

## Review Focus

1. **Audio Blob bị cắt giữa chừng hoặc sửa 1 byte trên đường truyền:** `extensionTransport` phải từ chối gói ngay khi SHA-256 byte thô sai hoặc luồng vượt `sizeBytes`, tuyệt đối không ghi một phần dữ liệu vào Dexie hay `$APPDATA/extensions/` (pin trong Task 2).
2. **Tài khoản chưa xác nhận email hoặc vượt 30 lượt xin Signed URL/giờ:** `sign-audio-pack` phải trả `401/403` cho user chưa confirm email, trả `429` từ yêu cầu thứ 31, và từ chối `objectPath` chứa `../` với `400` mà không gọi Storage upstream (pin trong Task 3).
3. **Autoplay bị chặn trên iOS Safari / Android WebView và thiết bị thiếu giọng `ja-JP`:** `webAudioAdapter` phải khởi tạo phát trong sự kiện chạm, bắt `NotAllowedError`, lùi an toàn sang Web Speech hoặc trả trạng thái gợi ý cài giọng đọc thay vì ném unhandled rejection (pin trong Task 5).
4. **Đổi bài hoặc rời màn hình khi đang lặp Shadowing A–B / thu âm RAM:** `ChoukaiPlayer` và `webAudioAdapter` phải dừng vòng lặp A–B, dừng `MediaRecorder`, thu hồi mọi `ObjectURL`, và xóa `navigator.mediaSession.metadata` để tránh rò RAM hoặc phát tiếng đè ở trang khác (pin trong Task 6 & Task 7).
5. **Đề thi có `hasSourceAudio: false` hoặc người học chưa tải gói `audio-n4-exams` khi đang offline:** `ExamRunnerPage` (`n4-2024-12`, `n4-2025-07`, `n4-2023-07`) phải giữ nguyên luồng làm bằng Script nghe hoặc bỏ qua phần Nghe mà không bị kẹt màn hình (pin trong Task 6).

---

## File Structure

- **Core Extensions & Validation (`AD-13`):**
  - `frontend/src/core/extensions/types.ts`: Kiểu `ExtensionPackId`, `ExtensionPackEntry`, `ExtensionsIndex`, `InstalledExtensionMeta`, cổng `ExtensionPackStore`.
  - `frontend/src/core/extensions/validate.ts`: Hàm `safeJsonParse`, `validateExtensionsIndex`, `isAllowedExtensionUrl`, `isSafeEntryPath`.
- **Extension Adapters (`Dexie v4` & `tauri-plugin-fs`):**
  - `frontend/src/adapters/local-store/db.ts`: Khai báo bảng `extensionPacks` (`"[packId+entryKey], packId, entryKey"`) trong Dexie v4.
  - `frontend/src/adapters/extensions/extensionTransport.ts`: Bộ tải streaming có `AbortSignal`, timeout, giới hạn byte, kiểm SHA-256 byte thô và chặn decompression bomb (`<= 100 MB`).
  - `frontend/src/adapters/extensions/dexieExtensionStore.ts`: Cài đặt `ExtensionPackStore` trên Dexie v4 + `navigator.storage.persist()` / `estimate()`.
  - `frontend/src/adapters/extensions/nativeFsExtensionStore.ts`: Adapter `tauri-plugin-fs` cho tệp audio lớn trong `$APPDATA/extensions/**`.
  - `frontend/src/adapters/extensions/index.ts`: Factory chọn adapter theo nền tảng và export `extensionPackStore`.
- **Supabase Private Bucket & Edge Function (`FR-28`, `SEC-E9-02`):**
  - `backend/supabase/migrations/20261127000300_audio_packs_bucket.sql`: Bucket riêng tư `audio-packs`, RLS `SELECT`-only, bảng và RPC `consume_audio_sign_quota` (`30/giờ/user`).
  - `backend/supabase/functions/_shared/sign-audio-pack.ts`: Logic xác thực JWT, kiểm email confirmed, allowlist pack/path, rate-limit, cấp Signed URL TTL `300s`.
  - `backend/supabase/functions/sign-audio-pack/index.ts`: Entrypoint `serve(signAudioPack)`.
  - `backend/supabase/config.toml`: Đăng ký `[functions.sign-audio-pack]` với `verify_jwt = false`.
- **Infra Audio & Pitch Pipelines (`FR-28`, `FR-31`):**
  - `infra/scripts/src/extensions.ts`: Sinh/kiểm chứng `extensions-index.json`.
  - `infra/scripts/src/build-audio-packs.ts`: Nén FFmpeg Opus 24–32 kbps + sinh `audio-n4-exams.manifest.json` + tính SHA-256.
  - `infra/scripts/src/build-pitch-pack.ts`: Chuyển đổi Kanjium TSV (`CC BY-SA 4.0`) sang gói `pitch-n4.json`.
  - `infra/scripts/src/packs.ts`, `infra/scripts/src/exams.ts`, `infra/scripts/package.json`: Tích hợp bước kiểm chứng gói mở rộng và trường audio tùy chọn trong `ExamDocument`.
- **Core Audio, Pitch Accent & MediaSession (`FR-31`, `FR-45`, `AD-15`):**
  - `frontend/src/core/audio/types.ts`: Cổng `AudioPort`, `AudioSourceSpec`, `ShadowingLoop`, `MediaTrackInfo`.
  - `frontend/src/core/audio/pitch.ts`: Tách mora tiếng Nhật và tính đường cao độ Pitch Accent.
  - `frontend/src/adapters/audio/webAudioAdapter.ts`: Ưu tiên Blob Opus offline → Signed URL → Web Speech `ja-JP`.
  - `frontend/src/adapters/audio/mediaSessionBridge.ts`: Kết nối `navigator.mediaSession` cho màn hình khóa không chứa PII/token.
  - `frontend/src/hooks/useAudio.ts`: Hook React quản lý vòng đời `AudioPort` và `SpeakButton`/`ChoukaiPlayer`.
- **UI & Tauri Config:**
  - `frontend/src/components/audio/SpeakButton.tsx`, `frontend/src/components/audio/PitchBadge.tsx`
  - `frontend/src/components/exam/ChoukaiPlayer.tsx`
  - `frontend/src/components/account/ExtensionPackManagerCard.tsx`
  - `frontend/src/pages/ExamRunnerPage.tsx`, `frontend/src/components/exam/ExamQuestionCard.tsx`, `frontend/src/components/vocabulary/Flashcard.tsx`, `frontend/src/pages/GrammarDetailPage.tsx`, `frontend/src/pages/AccountPage.tsx`, `frontend/src/pages/AboutPage.tsx`
  - `desktop/src-tauri/{tauri.conf.json,Cargo.toml,src/main.rs,capabilities/default.json}`, `mobile/src-tauri/{tauri.conf.json,Cargo.toml,src/lib.rs,capabilities/default.json}`, `frontend/public/_headers`, `infra/scripts/src/{tauri-csp-contract.ts,validate-native-env.mjs}`, `tests/mobile/android-release.test.mjs`.

---

### Task 1: Core Extension Pack Schema, Validator & `extensions-index.json` Pipeline

**Files:**
- Create: `frontend/src/core/extensions/types.ts`
- Create: `frontend/src/core/extensions/validate.ts`
- Create: `infra/scripts/src/extensions.ts`
- Modify: `infra/scripts/src/packs.ts:71-151`
- Test: `frontend/src/core/extensions/validate.test.ts`
- Test: `infra/scripts/src/extensions.test.ts`

**Interfaces:**
- Consumes: `Level`, `LEVELS` from `frontend/src/core/content/types.ts`; `isVersion` from `frontend/src/core/content/validate.ts`; `Result` from `frontend/src/core/result.ts`.
- Produces:
  - `EXTENSION_PACK_IDS = ["kanjivg-n4", "kanjivg-joyo", "audio-n4-vocab", "audio-n4-exams", "dict-javi-core", "tokenizer-wasm"] as const`
  - `export type ExtensionPackId = (typeof EXTENSION_PACK_IDS)[number]`
  - `export type ExtensionAccess = "public" | "private-signed"`
  - `export interface ExtensionPackEntry { id: ExtensionPackId; version: string; level: Level | "all"; access: ExtensionAccess; url: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; format: "json" | "json-gzip" | "tar-opus"; license: string; descriptionVi: string }`
  - `export interface ExtensionsIndex { version: string; updatedAt: string; packs: ExtensionPackEntry[] }`
  - `export interface InstalledExtensionMeta { packId: ExtensionPackId; version: string; sha256: string; sizeBytes: number; installedAt: string; storageBackend: "dexie" | "tauri-fs" }`
  - `export interface ExtensionPackStore { listInstalled(): Promise<InstalledExtensionMeta[]>; getMeta(packId: ExtensionPackId): Promise<InstalledExtensionMeta | null>; getEntryBlob(packId: ExtensionPackId, entryKey: string): Promise<Blob | null>; getEntryJson<T>(packId: ExtensionPackId, entryKey: string): Promise<T | null>; installPack(entry: ExtensionPackEntry, options?: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void; resolveSignedUrl?: (packId: ExtensionPackId) => Promise<string> }): Promise<InstalledExtensionMeta>; removePack(packId: ExtensionPackId): Promise<void>; estimateQuota(): Promise<{ usageBytes: number; quotaBytes: number; persisted: boolean }> }`
  - `safeJsonParse(text: string, maxDepth?: number): unknown`
  - `validateExtensionsIndex(raw: unknown, options?: { allowLocalhost?: boolean }): Result<ExtensionsIndex, { code: "schema" | "unsafe-url" | "size-limit"; detail: string }>`
  - `isSafeEntryPath(path: string): boolean`

**Security & QA Gate:** `SEC-E9-01` (URL chỉ cho phép `https:` ngoài localhost dev/test; `sizeBytes <= 104_857_600`; `uncompressedSizeBytes <= 104_857_600`; `safeJsonParse` chặn `__proto__`/`constructor`/`prototype` và độ sâu `<= 16`; `isSafeEntryPath` chặn `..` và `\0`).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/core/extensions/validate.test.ts` and `infra/scripts/src/extensions.test.ts`:

```ts
// frontend/src/core/extensions/validate.test.ts
import { describe, expect, it } from "vitest";
import {
  isSafeEntryPath,
  safeJsonParse,
  validateExtensionsIndex,
} from "./validate";

const VALID_SHA = "a".repeat(64);
const basePack = {
  id: "audio-n4-exams",
  version: "1.0.0",
  level: "n4",
  access: "private-signed",
  url: "https://cdn.luyenjlpt.vn/extensions/audio-n4-exams-1.0.0.tar",
  sha256: VALID_SHA,
  sizeBytes: 18_500_000,
  uncompressedSizeBytes: 18_500_000,
  format: "tar-opus",
  license: "Private Study Group",
  descriptionVi: "Âm thanh nghe hiểu JLPT N4 nén Opus",
};

describe("validateExtensionsIndex", () => {
  it("accepts a valid extensions-index.json with public and private-signed entries", () => {
    const res = validateExtensionsIndex({
      version: "1.0.0",
      updatedAt: "2026-11-27T00:00:00Z",
      packs: [basePack],
    });
    expect(res.ok).toBe(true);
  });

  it("rejects non-HTTPS URLs in production mode and rejects private-signed public HTTP", () => {
    const res = validateExtensionsIndex({
      version: "1.0.0",
      updatedAt: "2026-11-27T00:00:00Z",
      packs: [{ ...basePack, url: "http://evil.example/pack.tar" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unsafe-url");
  });

  it("rejects packs exceeding 100 MB compressed or uncompressed limit", () => {
    const res = validateExtensionsIndex({
      version: "1.0.0",
      updatedAt: "2026-11-27T00:00:00Z",
      packs: [{ ...basePack, uncompressedSizeBytes: 104_857_601 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("size-limit");
  });

  it("strips prototype-pollution keys and enforces max depth in safeJsonParse", () => {
    const parsed = safeJsonParse(
      '{"ok":1,"__proto__":{"polluted":true},"constructor":{"bad":1}}',
    ) as Record<string, unknown>;
    expect(parsed.ok).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(parsed, "__proto__")).toBe(false);
    expect(() => safeJsonParse("[".repeat(20) + "]".repeat(20), 16)).toThrow(
      /depth/i,
    );
  });

  it("rejects path traversal and null bytes in entry paths", () => {
    expect(isSafeEntryPath("n4-2024-07/q01.opus")).toBe(true);
    expect(isSafeEntryPath("../other/file.opus")).toBe(false);
    expect(isSafeEntryPath("a\0b.opus")).toBe(false);
    expect(isSafeEntryPath("/abs/path.opus")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/extensions/validate.test.ts`
Expected: FAIL with module `./validate` not found.

- [ ] **Step 3: Implement extension types, strict validator, and infra verification helper**

1. Create `frontend/src/core/extensions/types.ts` with the exact types and `ExtensionPackStore` port listed in `Produces`.
2. Create `frontend/src/core/extensions/validate.ts`:
   - `MAX_EXTENSION_BYTES = 104_857_600` (100 MB).
   - `safeJsonParse(text, maxDepth = 16)`: reviver drops `__proto__`, `constructor`, `prototype`, then iteratively verifies object/array depth `<= maxDepth`.
   - `isSafeEntryPath(path)`: requires `/^[a-z0-9][a-z0-9/_.-]{0,199}$/i`, forbids `..`, `//`, leading `/`, `\0`, and backslashes.
   - `isAllowedExtensionUrl(url, allowLocalhost)`: accepts `https:` (without embedded credentials), or `http://127.0.0.1` / `http://localhost` only when `allowLocalhost === true`; allows relative `/packs/extensions/...` only for bundled public metadata.
   - `validateExtensionsIndex(raw, options)`: rejects duplicate `id`, invalid semver, invalid 64-hex `sha256`, unknown `id` outside `EXTENSION_PACK_IDS`, or size `> MAX_EXTENSION_BYTES`.
3. Create `infra/scripts/src/extensions.ts` exporting `writeExtensionsIndex(outDir: string, index: ExtensionsIndex): void` and `verifyExtensionsIndex(root: string): string[]`, and invoke `verifyExtensionsIndex(root)` inside `infra/scripts/src/packs.ts:143-150` whenever `frontend/public/packs/extensions-index.json` exists.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/core/extensions/validate.test.ts && pnpm --filter @luyen/infra-scripts test -- src/extensions.test.ts && pnpm typecheck`
Expected: PASS (all unit tests green, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/extensions/ infra/scripts/src/extensions.ts infra/scripts/src/extensions.test.ts infra/scripts/src/packs.ts
git commit -m "feat(extensions): add AD-13 extension pack schema, validator and index verifier"
```

---

### Task 2: `ExtensionPackStore` Adapter on Dexie v4 + Native `tauri-plugin-fs` Scope

**Files:**
- Modify: `frontend/src/adapters/local-store/db.ts:1-43`
- Create: `frontend/src/adapters/extensions/extensionTransport.ts`
- Create: `frontend/src/adapters/extensions/dexieExtensionStore.ts`
- Create: `frontend/src/adapters/extensions/nativeFsExtensionStore.ts`
- Create: `frontend/src/adapters/extensions/index.ts`
- Modify: `desktop/src-tauri/Cargo.toml:13-20`
- Modify: `desktop/src-tauri/src/main.rs:9-26`
- Modify: `desktop/src-tauri/capabilities/default.json:7-32`
- Modify: `mobile/src-tauri/Cargo.toml:17-24`
- Modify: `mobile/src-tauri/src/lib.rs:3-12`
- Modify: `mobile/src-tauri/capabilities/default.json:8-24`
- Modify: `frontend/package.json:51-57`
- Test: `frontend/src/adapters/extensions/extensionTransport.test.ts`
- Test: `frontend/src/adapters/extensions/dexieExtensionStore.test.ts`

**Interfaces:**
- Consumes: `ExtensionPackEntry`, `ExtensionPackId`, `ExtensionPackStore`, `InstalledExtensionMeta` from `frontend/src/core/extensions/types.ts`; `isAllowedExtensionUrl`, `isSafeEntryPath`, `safeJsonParse` from `frontend/src/core/extensions/validate.ts`; `db` from `frontend/src/adapters/local-store/db.ts`.
- Produces:
  - `export const EXTENSION_META_KEY = "__meta__"`
  - `downloadAndVerifyPack(url: string, expectedSha256: string, maxBytes: number, options?: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void; allowLocalhost?: boolean }): Promise<Uint8Array<ArrayBuffer>>`
  - `gunzipWithLimit(compressed: Uint8Array<ArrayBuffer>, maxUncompressedBytes: number): Promise<Uint8Array<ArrayBuffer>>`
  - `unpackTarEntries(bytes: Uint8Array<ArrayBuffer>, maxTotalBytes: number): Map<string, Uint8Array<ArrayBuffer>>`
  - `createDexieExtensionStore(): ExtensionPackStore`
  - `createNativeFsExtensionStore(): ExtensionPackStore`
  - `export const extensionPackStore: ExtensionPackStore`

**Security & QA Gate:** `SEC-E9-01`: tính SHA-256 trên byte thô TRƯỚC khi giải nén/parse; ngắt stream ngay khi vượt `sizeBytes` hoặc `100 MB`; giới hạn tỷ lệ/dung lượng giải nén `<= 100 MB`; xóa sạch dữ liệu tạm khi lỗi; capability `tauri-plugin-fs` khóa chặt trong `$APPDATA/extensions/**` trên cả Desktop lẫn Mobile; không đụng `Cache Storage`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/adapters/extensions/extensionTransport.test.ts` and `frontend/src/adapters/extensions/dexieExtensionStore.test.ts`:

```ts
// frontend/src/adapters/extensions/extensionTransport.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  downloadAndVerifyPack,
  gunzipWithLimit,
} from "./extensionTransport";

describe("extensionTransport (SEC-E9-01)", () => {
  it("rejects mismatched SHA-256 on raw bytes before returning payload", async () => {
    const payload = new TextEncoder().encode('{"hello":"world"}');
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(payload, { status: 200 })),
    );
    await expect(
      downloadAndVerifyPack(
        "https://cdn.luyenjlpt.vn/extensions/test.json",
        "0".repeat(64),
        1024,
      ),
    ).rejects.toThrow(/sha-?256/i);
  });

  it("aborts streaming immediately when response exceeds maxBytes", async () => {
    const chunk = new Uint8Array(600);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
    );
    await expect(
      downloadAndVerifyPack(
        "https://cdn.luyenjlpt.vn/extensions/big.bin",
        "a".repeat(64),
        1000,
      ),
    ).rejects.toThrow(/too large/i);
  });

  it("blocks decompression bomb exceeding maxUncompressedBytes", async () => {
    // Highly compressible 200 KB of zeroes, limit set to 64 KB
    const raw = new Uint8Array(200_000);
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    void writer.write(raw);
    void writer.close();
    const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    await expect(gunzipWithLimit(compressed, 65_536)).rejects.toThrow(
      /decompression limit/i,
    );
  });
});
```

In `dexieExtensionStore.test.ts`, assert:
1. `installPack()` stores `__meta__` + entry blobs in `db.extensionPacks` atomically, `getEntryBlob()` reads a single `.opus` Blob without loading other entries, and `removePack()` leaves 0 rows for that `packId`.
2. Failed SHA-256 verification leaves 0 partial rows in `db.extensionPacks`.
3. `estimateQuota()` calls `navigator.storage.persist()` when available and returns `{ usageBytes, quotaBytes, persisted }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/extensions/`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement Dexie v4 `extensionPacks` schema, transport, Dexie store, and Tauri FS scope**

1. Update `frontend/src/adapters/local-store/db.ts:21-43`:
   - Add `ExtensionPackRow` union (`{ packId: ExtensionPackId; entryKey: "__meta__"; meta: InstalledExtensionMeta }` | `{ packId: ExtensionPackId; entryKey: string; blob: Blob }`) and table `extensionPacks: Table<ExtensionPackRow, [string, string]>`.
   - Ensure `db.version(4).stores(...)` includes `extensionPacks: "[packId+entryKey], packId, entryKey"` alongside the consolidated Dexie v4 tables (`activeExamDrafts`, `srsCards`, `srsReviews`, `notebooks`, `notebookItems`, `userMnemonics`) without breaking migration from v3.
2. Create `frontend/src/adapters/extensions/extensionTransport.ts`:
   - `downloadAndVerifyPack`: validates URL via `isAllowedExtensionUrl`, streams via `response.body.getReader()` with 60s `AbortSignal` deadline, throws `PackTooLargeError` as soon as `loaded > maxBytes`, computes `crypto.subtle.digest("SHA-256", bytes)` and verifies exact lowercase hex match before returning.
   - `gunzipWithLimit`: uses `DecompressionStream("gzip")`, reads chunks incrementally and aborts immediately if output bytes `> maxUncompressedBytes` (default `104_857_600`).
   - `unpackTarEntries`: parses minimal POSIX USTAR tar archive of `.opus` + `manifest.json` files, validates every member filename via `isSafeEntryPath`, enforces total unpacked bytes `<= maxTotalBytes`.
3. Create `frontend/src/adapters/extensions/dexieExtensionStore.ts`:
   - Uses `db.transaction("rw", db.extensionPacks, ...)` to atomically replace all rows for `entry.id` only AFTER full verification & unpack succeeds.
   - Calls `navigator.storage?.persist?.()` best-effort before installing large packs and checks `navigator.storage?.estimate?.()`.
4. Create `frontend/src/adapters/extensions/nativeFsExtensionStore.ts` + `index.ts`:
   - On Tauri Desktop/Mobile (`isTauri()`), stores `tar-opus` blobs under `BaseDirectory.AppData` path `extensions/${packId}/${entryKey}` via `@tauri-apps/plugin-fs` while keeping metadata in `db.extensionPacks` (and falls back cleanly to `dexieExtensionStore` for small JSON packs).
   - Add `@tauri-apps/plugin-fs` to `frontend/package.json`, `tauri-plugin-fs` to `desktop/src-tauri/Cargo.toml` + `src/main.rs` and `mobile/src-tauri/Cargo.toml` + `src/lib.rs`, and add scoped fs permissions strictly restricted to `[{ "path": "$APPDATA/extensions/**" }]` in `desktop/src-tauri/capabilities/default.json` and `mobile/src-tauri/capabilities/default.json`.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/extensions/ src/adapters/local-store/db.test.ts && pnpm typecheck`
Expected: PASS (all extension transport, Dexie store, and Dexie v3→v4 migration tests green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/adapters/local-store/db.ts frontend/src/adapters/extensions/ frontend/package.json desktop/src-tauri/ mobile/src-tauri/
git commit -m "feat(extensions): implement ExtensionPackStore on Dexie v4 and scoped tauri-plugin-fs"
```

---

### Task 3: Private Supabase Bucket `audio-packs`, RLS & `sign-audio-pack` Edge Function

**Files:**
- Create: `backend/supabase/migrations/20261127000300_audio_packs_bucket.sql`
- Create: `backend/supabase/functions/_shared/sign-audio-pack.ts`
- Create: `backend/supabase/functions/sign-audio-pack/index.ts`
- Modify: `backend/supabase/config.toml:45-53`
- Modify: `backend/supabase/tests/functions.test.ts`
- Create: `backend/supabase/tests/audio_packs.test.sql`

**Interfaces:**
- Consumes: `jlpt_private.has_confirmed_email()` from `backend/supabase/migrations/20261122000100_profiles_and_progress.sql`; `checkMethod`, `Config`, `json`, `upstream`, `serve` from `backend/supabase/functions/_shared/http.ts`.
- Produces:
  - Private Supabase Storage bucket `audio-packs` (`public = false`, `file_size_limit = 52428800`)
  - Postgres RPC `public.consume_audio_sign_quota(p_user_id uuid) returns table (allowed boolean, remaining integer)` (service_role only, 30 req/hour/user)
  - Edge Function `POST /functions/v1/sign-audio-pack` accepting `{ packId: "audio-n4-exams" | "audio-n4-vocab", objectPath: string }` with `Authorization: Bearer <access_token>` → returns `200 { signedUrl: string, expiresIn: 300 }` with `Cache-Control: private, no-store` (or `400/401/403/429/503`).

**Security & QA Gate:** `SEC-E9-02` & `SEC-T06(a..e)`: bucket `public = false`; RLS `storage.objects` chỉ cho `SELECT` khi `has_confirmed_email()` và `name ~ '^[a-z0-9/_.-]+$' and position('..' in name) = 0`; 0 quyền `INSERT/UPDATE/DELETE` cho `anon`/`authenticated`; `sign-audio-pack` xác thực JWT thật qua `/auth/v1/user`, kiểm `email_confirmed_at`, chặn `../`, áp rate limit `30/giờ/user` (`429` ở lượt 31), TTL `<= 300s`, không bao giờ log `?token=`.

- [ ] **Step 1: Write the failing tests (Deno + pgTAP covering `SEC-T06`)**

Add tests to `backend/supabase/tests/functions.test.ts` importing `signAudioPack` from `../functions/_shared/sign-audio-pack.ts`:

```ts
Deno.test("sign-audio-pack rejects unconfirmed email with 403 and never signs", async () => {
  const res = await signAudioPack(
    new Request("http://example.test", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify({
        packId: "audio-n4-exams",
        objectPath: "n4/audio-n4-exams-1.0.0.tar",
      }),
    }),
    config,
    async () =>
      Response.json({
        id: userId,
        role: "authenticated",
        is_anonymous: false,
        email: "pending@example.test",
        email_confirmed_at: null,
      }),
  );
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "email_not_confirmed" });
});

Deno.test("sign-audio-pack blocks path traversal (../) with 400 before upstream", async () => {
  const res = await signAudioPack(
    new Request("http://example.test", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify({
        packId: "audio-n4-exams",
        objectPath: "../other-bucket/secret.ogg",
      }),
    }),
    config,
    unexpectedFetch,
  );
  assert.equal(res.status, 400);
});

Deno.test("sign-audio-pack returns 429 on 31st request and 200 with TTL=300 & no-store when allowed", async () => {
  const makeReq = () =>
    new Request("http://example.test", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify({
        packId: "audio-n4-exams",
        objectPath: "n4/audio-n4-exams-1.0.0.tar",
      }),
    });

  const denied = await signAudioPack(makeReq(), config, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/v1/user") {
      return Response.json({
        id: userId,
        role: "authenticated",
        is_anonymous: false,
        email: "ok@example.test",
        email_confirmed_at: "2026-11-27T00:00:00Z",
      });
    }
    return Response.json([{ allowed: false, remaining: 0 }]);
  });
  assert.equal(denied.status, 429);

  let signBody: { expiresIn?: number } | undefined;
  const ok = await signAudioPack(makeReq(), config, async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/v1/user") {
      return Response.json({
        id: userId,
        role: "authenticated",
        is_anonymous: false,
        email: "ok@example.test",
        email_confirmed_at: "2026-11-27T00:00:00Z",
      });
    }
    if (path === "/rest/v1/rpc/consume_audio_sign_quota") {
      return Response.json([{ allowed: true, remaining: 29 }]);
    }
    signBody = await new Request(input, init).json();
    return Response.json({ signedURL: "/object/sign/audio-packs/n4/audio-n4-exams-1.0.0.tar?token=sig" });
  });
  assert.equal(ok.status, 200);
  assert.equal(signBody?.expiresIn, 300);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
});
```

Create `backend/supabase/tests/audio_packs.test.sql` (pgTAP) asserting:
- `storage.buckets` has `id = 'audio-packs'` with `public = false` and `file_size_limit = 52428800`.
- Unconfirmed user (`10000000-0000-4000-8000-000000000003`) cannot `SELECT` from `storage.objects` in `audio-packs`.
- Confirmed user (`10000000-0000-4000-8000-000000000001`) can `SELECT` valid path `n4/audio-n4-exams-1.0.0.tar`, gets `42501` on `INSERT`, `UPDATE`, and `DELETE`.
- `consume_audio_sign_quota` returns `allowed = true` for calls `1..30` and `allowed = false` on call `31`; `authenticated` role gets `42501` calling `consume_audio_sign_quota` directly.

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --no-config --no-lock --node-modules-dir=none backend/supabase/tests/functions.test.ts`
Expected: FAIL with `sign-audio-pack.ts` not found.

- [ ] **Step 3: Implement migration, Edge Function, and `config.toml` entry**

1. Create `backend/supabase/migrations/20261127000300_audio_packs_bucket.sql`:
   - `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('audio-packs', 'audio-packs', false, 52428800, array['audio/ogg', 'audio/opus', 'audio/webm', 'application/x-tar', 'application/json']) on conflict (id) do update set public = false, file_size_limit = 52428800;`
   - Create `storage.objects` policy `audio_packs_confirmed_select` for `SELECT` to `authenticated` using `bucket_id = 'audio-packs' and (select jlpt_private.has_confirmed_email()) and name ~ '^[a-z0-9/_.-]+$' and position('..' in name) = 0`.
   - Create `jlpt_private.audio_sign_rate_limits (user_id uuid primary key, attempts integer not null, window_start timestamptz not null)` and `public.consume_audio_sign_quota(p_user_id uuid)` using `date_bin('1 hour', transaction_timestamp(), '2000-01-01 00:00:00+00')` with cap `30`, `security definer set search_path = ''`, granted ONLY to `service_role`.
2. Create `backend/supabase/functions/_shared/sign-audio-pack.ts`:
   - Uses Epic 7's updated `http.ts` CORS allowlist helpers, passing `request` to `checkMethod(request)` and `json(..., request)` so responses emit the allowlisted `Access-Control-Allow-Origin` + `Vary: Origin` (never `*`).
   - Validates `POST`, Bearer token regex, JSON body `{ packId, objectPath }`, `packId ∈ {"audio-n4-exams", "audio-n4-vocab"}`, `objectPath` matching `/^(n4|n3)\/[a-z0-9][a-z0-9/_.-]{0,120}$/` without `..`.
   - Verifies token via `GET ${config.url}/auth/v1/user`; returns `401` if invalid/anonymous, `403 { error: "email_not_confirmed" }` if `!user.email_confirmed_at`.
   - Calls `POST ${config.url}/rest/v1/rpc/consume_audio_sign_quota` with `serviceKey`; returns `429 { error: "rate_limited" }` if `!allowed`.
   - Calls `POST ${config.url}/storage/v1/object/sign/audio-packs/${objectPath}` with `{ expiresIn: 300 }`; returns `200 { signedUrl, expiresIn: 300 }` with `cache-control: private, no-store` and never logs `signedUrl`.
3. Create `backend/supabase/functions/sign-audio-pack/index.ts` calling `serve(signAudioPack)` and add `[functions.sign-audio-pack]\nverify_jwt = false` in `backend/supabase/config.toml`.

- [ ] **Step 4: Run Deno & pgTAP verification**

Run: `deno test --no-config --no-lock --node-modules-dir=none backend/supabase/tests/functions.test.ts && supabase test db --workdir backend`
Expected: PASS (Deno tests + pgTAP `audio_packs.test.sql` all green).

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20261127000300_audio_packs_bucket.sql backend/supabase/functions/_shared/sign-audio-pack.ts backend/supabase/functions/sign-audio-pack/index.ts backend/supabase/config.toml backend/supabase/tests/
git commit -m "feat(audio): add private audio-packs bucket, RLS and rate-limited sign-audio-pack function"
```

---

### Task 4: Opus 24–32 kbps Audio Compression Pipeline & Kanjium Pitch Accent Pack Builder

**Files:**
- Modify: `frontend/src/core/exam/types.ts:13-49`
- Modify: `frontend/src/core/exam/validate.ts:136-235`
- Create: `infra/scripts/src/build-audio-packs.ts`
- Create: `infra/scripts/src/build-pitch-pack.ts`
- Modify: `infra/scripts/src/exams.ts:140-193`
- Modify: `infra/scripts/package.json:6-13`
- Test: `infra/scripts/src/build-audio-packs.test.ts`
- Test: `infra/scripts/src/build-pitch-pack.test.ts`

**Interfaces:**
- Consumes: `ExamDocument`, `ExamQuestion` from `frontend/src/core/exam/types.ts`; `ExtensionsIndex`, `ExtensionPackEntry` from `frontend/src/core/extensions/types.ts`; `writeExtensionsIndex` from `infra/scripts/src/extensions.ts`.
- Produces:
  - Optional `ExamAudioCue { startSec: number; endSec: number; speaker?: string }` and optional fields `audioTrackId?: string`, `audioCues?: ExamAudioCue[]` on `ExamQuestion`; optional `audioPackId?: ExtensionPackId` on `ExamSection`.
  - `AudioPackManifest { packId: "audio-n4-exams" | "audio-n4-vocab"; version: string; codec: "opus"; bitrateKbps: number; tracks: Record<string, { path: string; durationSec: number; sha256: string }> }`
  - `buildFfmpegOpusArgs(inputPath: string, outputPath: string, bitrateKbps?: number): string[]` (clamps `bitrateKbps` to `24..32`, mono `-ac 1`, `libopus`, `-vbr on`, `-application voip`)
  - `parseKanjiumTsv(tsv: string, allowedWords: Set<string>): Record<string, number[]>` (keyed by `${word}|${reading}`, outputs numeric pitch accent positions)
  - `pnpm --filter @luyen/infra-scripts audio:build` & `pnpm --filter @luyen/infra-scripts pitch:build`

**Security & QA Gate:** Output gói `.tar` audio đặt ở `infra/extensions-dist/` (KHÔNG chép vào `frontend/public/packs/` để giữ APK `<= 30 MB`); kiểm tổng dung lượng 6 đề nguồn (`145,4 MB` thô) sau nén `24–32 kbps` giảm `>= 65%` (`<= 48 MB`); `pnpm packs:verify` tiếp tục đạt 100% với toàn bộ 9 đề thi và bảng N4 cũ.

- [ ] **Step 1: Write the failing tests**

Create `infra/scripts/src/build-audio-packs.test.ts` and `infra/scripts/src/build-pitch-pack.test.ts`:

```ts
// infra/scripts/src/build-audio-packs.test.ts
import { describe, expect, it } from "vitest";
import { buildFfmpegOpusArgs } from "./build-audio-packs";

describe("buildFfmpegOpusArgs", () => {
  it("encodes mono Opus clamped strictly to 24-32 kbps", () => {
    const args = buildFfmpegOpusArgs("in.mp3", "out.opus", 28);
    expect(args).toContain("libopus");
    expect(args).toContain("28k");
    expect(args).toContain("1");
    expect(() => buildFfmpegOpusArgs("in.mp3", "out.opus", 16)).toThrow(/24.*32/);
    expect(() => buildFfmpegOpusArgs("in.mp3", "out.opus", 64)).toThrow(/24.*32/);
  });
});

// infra/scripts/src/build-pitch-pack.test.ts
import { describe, expect, it } from "vitest";
import { parseKanjiumTsv } from "./build-pitch-pack";

describe("parseKanjiumTsv", () => {
  it("parses Kanjium tab rows into downstep arrays filtered to pack vocabulary", () => {
    const tsv = "食べる\tたべる\t2\n橋\tはし\t2,0\n無関係\tむかんけい\t1\n";
    const result = parseKanjiumTsv(tsv, new Set(["食べる|たべる", "橋|はし"]));
    expect(result).toEqual({ "食べる|たべる": [2], "橋|はし": [2, 0] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/infra-scripts test -- src/build-audio-packs.test.ts src/build-pitch-pack.test.ts`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement Opus audio pack builder, Kanjium pitch builder, and backward-compatible exam schema extension**

1. Extend `frontend/src/core/exam/types.ts:13-49` and `frontend/src/core/exam/validate.ts:136-235` with optional `audioTrackId`, `audioCues` (`startSec >= 0`, `endSec > startSec`), and `audioPackId`; keep all existing exam JSON valid with zero breaking changes.
2. Create `infra/scripts/src/build-audio-packs.ts`:
   - `buildFfmpegOpusArgs` enforces `24 <= bitrateKbps <= 32` (default `28`), outputs `["-y", "-i", inputPath, "-vn", "-ac", "1", "-c:a", "libopus", "-b:a", `${bitrateKbps}k`, "-vbr", "on", "-application", "voip", outputPath]`.
   - Builds POSIX tar archive `infra/extensions-dist/n4/audio-n4-exams-<version>.tar` containing `manifest.json` + `.opus` tracks for exams where `hasSourceAudio: true` in `infra/dataset_n4_exams/manifest.json` (`n4-2024-07`, `n4-2021-12`, `n4-2021-07`, `n4-2018-12`, `n4-2017-07`, `n4-2013-07`), computes raw SHA-256 and `sizeBytes`, and updates `extensions-index.json` with `access: "private-signed"`.
3. Create `infra/scripts/src/build-pitch-pack.ts`:
   - Parses Kanjium TSV (`CC BY-SA 4.0`) for all 1,182 N4 vocabulary entries, writes `infra/extensions-dist/n4/pitch-n4.json` + `NOTICE-KANJIUM.txt`, and registers optional entry metadata.
4. Add `"audio:build": "tsx src/build-audio-packs.ts"` and `"pitch:build": "tsx src/build-pitch-pack.ts"` to `infra/scripts/package.json`.

- [ ] **Step 4: Run tests and verify pack integrity**

Run: `pnpm --filter @luyen/infra-scripts test && pnpm packs:verify && pnpm typecheck`
Expected: PASS (all infra script tests green, `packs:verify` green with 0 removed IDs, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/exam/types.ts frontend/src/core/exam/validate.ts infra/scripts/
git commit -m "feat(audio): add Opus 24-32kbps pack pipeline and Kanjium pitch accent builder"
```

---

### Task 5: `AudioPort`, Dual-Tier Opus/WebSpeech Adapter, Pitch Accent Badge & Attribution

**Files:**
- Create: `frontend/src/core/audio/types.ts`
- Create: `frontend/src/core/audio/pitch.ts`
- Create: `frontend/src/adapters/audio/webAudioAdapter.ts`
- Create: `frontend/src/hooks/useAudio.ts`
- Create: `frontend/src/components/audio/SpeakButton.tsx`
- Create: `frontend/src/components/audio/PitchBadge.tsx`
- Modify: `frontend/src/components/vocabulary/Flashcard.tsx:191-218`
- Modify: `frontend/src/pages/GrammarDetailPage.tsx:215-246`
- Modify: `frontend/src/pages/AboutPage.tsx:44-63`
- Modify: `desktop/src-tauri/capabilities/default.json:13-29`
- Modify: `mobile/src-tauri/capabilities/default.json:13-23`
- Modify: `tests/mobile/android-release.test.mjs:74-83`
- Test: `frontend/src/core/audio/pitch.test.ts`
- Test: `frontend/src/adapters/audio/webAudioAdapter.test.ts`

**Interfaces:**
- Consumes: `ExtensionPackStore`, `ExtensionPackId` from `frontend/src/core/extensions/types.ts`; `supabase` from `frontend/src/adapters/auth/client.ts`.
- Produces:
  - `export interface AudioSourceSpec { packId?: ExtensionPackId; entryKey?: string; remoteObjectPath?: string; fallbackTextJa?: string; mediaInfo?: { title: string; subtitle: string; sectionLabel?: string } }`
  - `export interface ShadowingLoop { startSec: number; endSec: number; enabled: boolean }`
  - `export interface AudioPlaybackState { status: "idle" | "loading" | "playing" | "paused" | "ended" | "error"; currentTime: number; duration: number; playbackRate: number; tier: "offline-opus" | "signed-stream" | "web-speech" | null; errorCode?: "autoplay-blocked" | "missing-ja-voice" | "auth-required" | "network" }`
  - `export interface AudioPort { play(source: AudioSourceSpec, options?: { rate?: number; loop?: ShadowingLoop; singlePlayLock?: boolean }): Promise<void>; pause(): void; resume(): Promise<void>; seek(seconds: number): void; setRate(rate: number): void; setLoop(loop: ShadowingLoop | null): void; stop(): void; subscribe(listener: (state: AudioPlaybackState) => void): () => void; dispose(): void }`
  - `splitMorae(kana: string): string[]`
  - `computePitchContour(reading: string, downstep: number): Array<{ mora: string; high: boolean; dropAfter: boolean }>`

**Security & QA Gate:** `AD-15` (không component UI nào gọi trực tiếp `Audio` hoặc `window.speechSynthesis`; mọi `Blob` URL thu hồi bằng `URL.revokeObjectURL`; Signed URL không cache hay log); `AboutPage.tsx` ghi nguồn Kanjium `CC BY-SA 4.0` và bổ sung URL Kanjium vào `opener:allow-open-url` trên cả Desktop & Mobile.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/core/audio/pitch.test.ts` and `frontend/src/adapters/audio/webAudioAdapter.test.ts`:

```ts
// frontend/src/core/audio/pitch.test.ts
import { describe, expect, it } from "vitest";
import { computePitchContour, splitMorae } from "./pitch";

describe("Japanese pitch accent contour", () => {
  it("groups small yoon kana with preceding mora while keeping sokuon separate", () => {
    expect(splitMorae("きょう")).toEqual(["きょ", "う"]);
    expect(splitMorae("がっこう")).toEqual(["が", "っ", "こ", "う"]);
  });

  it("computes heiban (0), atamadaka (1), and nakadaka (2) contours", () => {
    expect(computePitchContour("たべる", 2)).toEqual([
      { mora: "た", high: false, dropAfter: false },
      { mora: "べ", high: true, dropAfter: true },
      { mora: "る", high: false, dropAfter: false },
    ]);
    expect(computePitchContour("さくら", 0).map((m) => m.high)).toEqual([
      false,
      true,
      true,
    ]);
    expect(computePitchContour("いのち", 1).map((m) => m.high)).toEqual([
      true,
      false,
      false,
    ]);
  });
});
```

In `webAudioAdapter.test.ts`, assert:
1. Priority tier 1: when `ExtensionPackStore.getEntryBlob` returns a Blob, creates `ObjectURL`, plays `<audio>` without calling `sign-audio-pack` or `speechSynthesis`, and calls `URL.revokeObjectURL` on `stop()` / `dispose()`.
2. Priority tier 3 fallback: when no offline Blob and offline/no remote path, calls `speechSynthesis.speak` with `lang = "ja-JP"`; when no `ja-JP` voice exists, surfaces `errorCode: "missing-ja-voice"` without throwing.
3. `NotAllowedError` from `audio.play()` sets `status: "error", errorCode: "autoplay-blocked"` cleanly.
4. `setRate(rate)` clamps strictly to `0.75..1.25`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/audio/pitch.test.ts src/adapters/audio/webAudioAdapter.test.ts`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement `AudioPort`, `pitch.ts`, `webAudioAdapter.ts`, UI components, and Kanjium attribution**

1. Create `frontend/src/core/audio/types.ts` and `frontend/src/core/audio/pitch.ts`.
2. Create `frontend/src/adapters/audio/webAudioAdapter.ts` implementing the 3-tier `AudioPort` resolution (offline Opus Blob → `supabase.functions.invoke("sign-audio-pack")` online → `window.speechSynthesis` `ja-JP`), clamping `playbackRate` to `[0.75, 1.25]`, enforcing A–B loop reset via `timeupdate`, and revoking every `ObjectURL` in `revokeActiveUrl()`.
3. Create `frontend/src/hooks/useAudio.ts`, `frontend/src/components/audio/SpeakButton.tsx` (`min-h-11 min-w-11`, `event.stopPropagation()` so clicking Speak inside `Flashcard` does not flip the card), and `frontend/src/components/audio/PitchBadge.tsx` (compact inline SVG/border overline marking High/Low pitch with `aria-label` in Vietnamese).
4. Wire `<SpeakButton>` and `<PitchBadge>` into `frontend/src/components/vocabulary/Flashcard.tsx:191-218` (back face next to `word.reading`) and `<SpeakButton>` into each example row in `frontend/src/pages/GrammarDetailPage.tsx:215-246` (keeping `/ngu-phap/$patternId` limited to Cách chia, Ý nghĩa, Cách dùng, Ví dụ per `AGENTS.md`).
5. Add Kanjium `CC BY-SA 4.0` attribution card in `frontend/src/pages/AboutPage.tsx:44-63`, add `"https://github.com/mifunetoshiro/kanjium"` to `opener:allow-open-url` in `desktop/src-tauri/capabilities/default.json` and `mobile/src-tauri/capabilities/default.json`, and update the exact expected URL list in `tests/mobile/android-release.test.mjs:78-82` so `assert.deepEqual` stays green.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/core/audio/ src/adapters/audio/ && node --test tests/mobile/android-release.test.mjs && pnpm typecheck && pnpm check`
Expected: PASS (all audio, pitch, and mobile capability allowlist tests green, Biome clean, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/audio/ frontend/src/adapters/audio/ frontend/src/hooks/useAudio.ts frontend/src/components/audio/ frontend/src/components/vocabulary/Flashcard.tsx frontend/src/pages/GrammarDetailPage.tsx frontend/src/pages/AboutPage.tsx desktop/src-tauri/capabilities/default.json mobile/src-tauri/capabilities/default.json tests/mobile/android-release.test.mjs
git commit -m "feat(audio): add AudioPort Opus/WebSpeech adapter, Kanjium pitch badge and attribution"
```

---

### Task 6: Choukai Exam Audio Player & Shadowing A–B (`0.75×–1.25×`) in `ExamRunnerPage`

**Files:**
- Create: `frontend/src/components/exam/ChoukaiPlayer.tsx`
- Modify: `frontend/src/pages/ExamRunnerPage.tsx:87-235,741-922`
- Modify: `frontend/src/components/exam/ExamQuestionCard.tsx:16-30,217-238`
- Modify: `frontend/public/_headers`
- Test: `frontend/src/components/exam/ChoukaiPlayer.test.tsx`

**Interfaces:**
- Consumes: `AudioPort`, `ShadowingLoop` from `frontend/src/core/audio/types.ts`; `useAudio` from `frontend/src/hooks/useAudio.ts`; `extensionPackStore` from `frontend/src/adapters/extensions/index.ts`; `ExamAudioCue` from `frontend/src/core/exam/types.ts`.
- Produces:
  - `export interface ChoukaiPlayerProps { mode: "exam" | "review"; examCode: string; trackKey: string; remoteObjectPath?: string; cues?: ExamAudioCue[]; onEnded?: () => void }`
  - `export const SHADOWING_RATES = [0.75, 0.9, 1.0, 1.15, 1.25] as const`

**Security & QA Gate:** Chế độ `exam` khóa tua/phát 1 lần chuẩn JLPT; chế độ `review` (chỉ bật khi `activeLocked === true`) mở Shadowing A–B (`0.75×–1.25×`), bật/tắt script tiếng Nhật & dịch Việt, ghi âm so sánh giọng chỉ lưu `Blob` tạm trong RAM và thu hồi `URL.revokeObjectURL` khi unmount (0 upload lên mạng); đề thiếu audio hoặc chưa tải gói giữ nguyên nút làm bằng Script nghe hoặc Bỏ qua.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/exam/ChoukaiPlayer.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoukaiPlayer } from "./ChoukaiPlayer";

describe("ChoukaiPlayer", () => {
  it("locks replay and hides A-B / speed controls in exam mode", () => {
    render(
      <ChoukaiPlayer
        mode="exam"
        examCode="2024-07"
        trackKey="n4-2024-07/full.opus"
      />,
    );
    expect(screen.queryByTestId("shadowing.speed.group")).toBeNull();
    expect(screen.queryByTestId("shadowing.loop_ab.button")).toBeNull();
  });

  it("exposes 0.75x-1.25x speed buttons and A-B loop toggle in review shadowing mode", () => {
    render(
      <ChoukaiPlayer
        mode="review"
        examCode="2024-07"
        trackKey="n4-2024-07/full.opus"
        cues={[{ startSec: 4, endSec: 9.5, speaker: "男" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "0.75×" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1.25×" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Đặt điểm A/i }));
    expect(screen.getByRole("button", { name: /Đặt điểm B/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/components/exam/ChoukaiPlayer.test.tsx`
Expected: FAIL with `./ChoukaiPlayer` not found.

- [ ] **Step 3: Implement `ChoukaiPlayer` and wire into `ExamRunnerPage` & `ExamQuestionCard`**

1. Create `frontend/src/components/exam/ChoukaiPlayer.tsx`:
   - In `mode="exam"`: shows Play button (`Phát băng nghe (1 lần chuẩn JLPT)`), disables replay after `ended`, hides seek bar and speed buttons.
   - In `mode="review"`: renders seek bar, speed buttons `0.75× / 0.9× / 1.0× / 1.15× / 1.25×`, A–B loop controls (`Đặt điểm A`, `Đặt điểm B`, `Tắt lặp A–B`), clickable cue buttons from `cues`, and optional local RAM-only `MediaRecorder` button (`Thu giọng so sánh`) that revokes its `ObjectURL` and stops media tracks on unmount.
2. Update `frontend/src/pages/ExamRunnerPage.tsx:87-235,741-922`:
   - Check `extensionPackStore.getMeta("audio-n4-exams")` inside `SectionIntro`: when `exam.hasSourceAudio` is true and pack is installed, enable primary button `Bắt đầu Phần Nghe (có Audio)` alongside `Làm bằng Script nghe` and `Bỏ qua`; when pack is not installed, show link CTA to `/tai-khoan` (Quản lý gói Audio) while preserving existing Script/Skip buttons.
   - Render `<ChoukaiPlayer mode={activeLocked ? "review" : "exam"} ... />` at the top of active listening sections when audio mode is active.
3. Update `frontend/src/components/exam/ExamQuestionCard.tsx:217-238`: add optional `onJumpCue?: (startSec: number, endSec: number) => void` so clicking a timestamped cue line during review loops that exact dialogue sentence.
4. Update `frontend/public/_headers` (created in Epic 7 Task 1): change `Permissions-Policy` from `microphone=()` to `microphone=(self)` (keeping `camera=(), geolocation=(), payment=()`) so local RAM-only `MediaRecorder` (`Thu giọng so sánh`) works on Web while remaining blocked for third-party frames.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/components/exam/ && pnpm typecheck`
Expected: PASS (all exam component tests green, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/exam/ChoukaiPlayer.tsx frontend/src/components/exam/ChoukaiPlayer.test.tsx frontend/src/components/exam/ExamQuestionCard.tsx frontend/src/pages/ExamRunnerPage.tsx frontend/public/_headers
git commit -m "feat(exam): add Choukai audio player and Shadowing A-B 0.75x-1.25x mode"
```

---

### Task 7: Mobile Background Audio (`MediaSession`) & Tauri CSP `media-src` Hardening

**Files:**
- Create: `frontend/src/adapters/audio/mediaSessionBridge.ts`
- Modify: `frontend/src/adapters/audio/webAudioAdapter.ts`
- Modify: `desktop/src-tauri/tauri.conf.json:24-28`
- Modify: `mobile/src-tauri/tauri.conf.json:11-14`
- Create: `infra/scripts/src/tauri-csp-contract.ts`
- Modify: `infra/scripts/src/validate-native-env.mjs:18-25`
- Test: `frontend/src/adapters/audio/mediaSessionBridge.test.ts`
- Test: `infra/scripts/src/tauri-csp-contract.test.ts`

**Interfaces:**
- Consumes: `AudioPlaybackState`, `AudioSourceSpec` from `frontend/src/core/audio/types.ts`.
- Produces:
  - `sanitizeMediaMetadata(input: { title: string; subtitle: string; sectionLabel?: string }): { title: string; artist: string; album: string }` (strips any `https://`, `?token=`, email patterns, truncates `<= 80` chars)
  - `attachMediaSession(handlers: { onPlay: () => void; onPause: () => void; onSeekBackward?: () => void; onSeekForward?: () => void; onStop: () => void }): { updateMetadata(info: { title: string; subtitle: string; sectionLabel?: string }): void; updatePlayback(state: AudioPlaybackState): void; clear(): void }`
  - `validateTauriCspConfig(csp: string, options: { releaseSupabaseOrigin?: string }): string[]`

**Security & QA Gate:** `FR-45`, `SEC-E9-03`, `SEC-T09`: `MediaSession` chỉ hiển thị tên bài/đề chung, 0 Signed URL / `?token=` / email trên màn hình khóa; CSP Desktop & Mobile thêm `media-src 'self' blob: https://<ref>.supabase.co; worker-src 'self';`, gỡ `wss://*.supabase.co`, cấm wildcard `*` và `'unsafe-eval'`, bản release ghim đúng 20 ký tự Supabase project ref.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/adapters/audio/mediaSessionBridge.test.ts` and `infra/scripts/src/tauri-csp-contract.test.ts`:

```ts
// frontend/src/adapters/audio/mediaSessionBridge.test.ts
import { describe, expect, it } from "vitest";
import { sanitizeMediaMetadata } from "./mediaSessionBridge";

describe("sanitizeMediaMetadata (SEC-E9-03)", () => {
  it("strips Signed URLs, tokens, and email addresses from lock-screen metadata", () => {
    const clean = sanitizeMediaMetadata({
      title: "Đề 2024-07 https://abc.supabase.co/storage?token=secret123",
      subtitle: "user@example.com · Mondai 1",
    });
    expect(clean.title).not.toContain("supabase.co");
    expect(clean.title).not.toContain("token=");
    expect(clean.artist).not.toContain("@");
  });
});

// infra/scripts/src/tauri-csp-contract.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateTauriCspConfig } from "./tauri-csp-contract";

describe("Tauri CSP contract (SEC-E9-03 / SEC-T09)", () => {
  it("verifies desktop and mobile CSP include media-src blob:, worker-src 'self', and drop wss wildcard", () => {
    for (const file of [
      "../../../desktop/src-tauri/tauri.conf.json",
      "../../../mobile/src-tauri/tauri.conf.json",
    ]) {
      const conf = JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
      const csp: string = conf.app.security.csp;
      expect(csp).toContain("media-src 'self' blob:");
      expect(csp).toContain("worker-src 'self'");
      expect(csp).not.toContain("wss://*.supabase.co");
      expect(csp).not.toContain("media-src *");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(validateTauriCspConfig(csp, {})).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/audio/mediaSessionBridge.test.ts && pnpm --filter @luyen/infra-scripts test -- src/tauri-csp-contract.test.ts`
Expected: FAIL (`mediaSessionBridge` and `tauri-csp-contract` missing; `tauri.conf.json` missing `media-src` and still containing `wss://*.supabase.co`).

- [ ] **Step 3: Implement `mediaSessionBridge`, update Tauri CSPs, and enforce release ref pinning**

1. Create `frontend/src/adapters/audio/mediaSessionBridge.ts` and hook it into `frontend/src/adapters/audio/webAudioAdapter.ts` (updating metadata on `play()`, `playbackState` & `setPositionState` on `timeupdate`, and calling `clear()` on `stop()` / `dispose()`). Note: when `singlePlayLock === true` (exam mode), do not register `seekbackward`/`seekforward` handlers so lock-screen controls cannot rewind an active JLPT exam.
2. Update `desktop/src-tauri/tauri.conf.json:26-27`:
   - Add `media-src 'self' blob: https://*.supabase.co; worker-src 'self';` (dev/repo template; release build pins exact 20-char ref via release overlay validated by `tauri-csp-contract.ts`).
3. Update `mobile/src-tauri/tauri.conf.json:13`:
   - Remove `wss://*.supabase.co`, add `media-src 'self' blob: https://*.supabase.co; worker-src 'self';`.
4. Create `infra/scripts/src/tauri-csp-contract.ts` exporting `validateTauriCspConfig(csp: string, options: { releaseSupabaseOrigin?: string }): string[]` (so `infra/scripts/tsconfig.json` compiles strictly in TypeScript without needing `allowJs: true`), checking no wildcard `media-src *`/`script-src *`, no `'unsafe-eval'`, no `wss://*.supabase.co`, and when `releaseSupabaseOrigin` is supplied, rejecting `*.supabase.co` in favor of exact `https://<20-char>.supabase.co`. Also guard CLI execution in `infra/scripts/src/validate-native-env.mjs:18-25` with `isMain` (`process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url`) so importing helpers never throws when env is unset.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/audio/ && pnpm --filter @luyen/infra-scripts test -- src/tauri-csp-contract.test.ts && pnpm typecheck`
Expected: PASS (all MediaSession & CSP contract assertions green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/adapters/audio/ desktop/src-tauri/tauri.conf.json mobile/src-tauri/tauri.conf.json infra/scripts/src/tauri-csp-contract.ts infra/scripts/src/tauri-csp-contract.test.ts infra/scripts/src/validate-native-env.mjs
git commit -m "feat(audio): add lock-screen MediaSession bridge and harden Tauri media-src CSP"
```

---

### Task 8: `/tai-khoan` Extension Storage Manager & End-to-End Verification

**Files:**
- Create: `frontend/src/components/account/ExtensionPackManagerCard.tsx`
- Modify: `frontend/src/pages/AccountPage.tsx:1-20,380-389`
- Create: `tests/web/audio-choukai.spec.ts`
- Test: `frontend/src/components/account/ExtensionPackManagerCard.test.tsx`

**Interfaces:**
- Consumes: `extensionPackStore` from `frontend/src/adapters/extensions/index.ts`; `useAuth` from `frontend/src/adapters/auth/session.tsx`; `supabase` from `frontend/src/adapters/auth/client.ts`.
- Produces:
  - `<ExtensionPackManagerCard />` mounted in `/tai-khoan` with `data-ocid="account.extensions.card"`, per-pack `download`/`cancel`/`remove` buttons (`min-h-11`), storage quota readout (`Đã dùng X MB / Y MB`), and confirmed-email gate hint for `access === "private-signed"` packs.

**Security & QA Gate:** `AD-13`, `FR-28`, `FR-31`, `FR-45`, `SEC-T03`, `SEC-T06`: người dùng chưa đăng nhập hoặc chưa xác nhận email thấy rõ trạng thái khóa của gói `audio-n4-exams` (không gửi request Signed URL vô nghĩa); hủy tải bằng `AbortController` không để rác trong Dexie; xóa gói giải phóng dung lượng ngay; Web E2E xác nhận Cache Storage của Service Worker chứa 0 entry Signed URL.

- [ ] **Step 1: Write the failing component & E2E tests**

Create `frontend/src/components/account/ExtensionPackManagerCard.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExtensionPackManagerCard } from "./ExtensionPackManagerCard";

describe("ExtensionPackManagerCard", () => {
  it("shows login/email-confirmation gate for private audio-n4-exams when signed out", async () => {
    render(<ExtensionPackManagerCard />);
    await waitFor(() => {
      expect(screen.getByText(/Đăng nhập và xác nhận email/i)).toBeTruthy();
    });
  });

  it("downloads, displays installed state, and removes pack cleanly when confirmed", async () => {
    const installPack = vi.fn().mockResolvedValue({
      packId: "audio-n4-exams",
      version: "1.0.0",
      sha256: "a".repeat(64),
      sizeBytes: 18_500_000,
      installedAt: "2026-11-27T00:00:00Z",
      storageBackend: "dexie",
    });
    const removePack = vi.fn().mockResolvedValue(undefined);
    render(
      <ExtensionPackManagerCard
        store={{ ...mockStore, installPack, removePack }}
        confirmedEmail
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Tải gói/i }));
    await waitFor(() => expect(installPack).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Đã tải/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Xóa gói/i }));
    await waitFor(() => expect(removePack).toHaveBeenCalledWith("audio-n4-exams"));
  });
});
```

Create `tests/web/audio-choukai.spec.ts` (Playwright):
- Mocks `/packs/extensions-index.json`, `POST /functions/v1/sign-audio-pack` (returning a local fixture Signed URL), and verifies:
  1. `/tai-khoan` downloads `audio-n4-exams` with matching SHA-256 and persists across reload; corrupted 1-byte response displays integrity error and installs nothing.
  2. `/luyen-de/n4-2024-07` shows Choukai audio start button when installed; after submitting section, Shadowing A–B and speed `0.75×–1.25×` controls work.
  3. `/tu-vung` Flashcard back shows `SpeakButton` and `PitchBadge` (without flipping card on click).
  4. `caches.keys()` / Cache Storage holds 0 entries matching `supabase.co` or `?token=`.

- [ ] **Step 2: Run component test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/components/account/ExtensionPackManagerCard.test.tsx`
Expected: FAIL with `./ExtensionPackManagerCard` not found.

- [ ] **Step 3: Implement `ExtensionPackManagerCard` and mount in `AccountPage.tsx`**

1. Create `frontend/src/components/account/ExtensionPackManagerCard.tsx`:
   - Fetches `/packs/extensions-index.json` (validated via `validateExtensionsIndex`), merges with `extensionPackStore.listInstalled()` and `extensionPackStore.estimateQuota()`.
   - For `access === "private-signed"`, requires `session?.user.email_confirmed_at`; invokes `supabase.functions.invoke("sign-audio-pack", { body: { packId, objectPath } })` to obtain the short-lived Signed URL right before passing it to `extensionPackStore.installPack`.
   - Provides per-pack `Tải gói`, `Hủy tải` (`AbortController`), and `Xóa gói` actions with `min-h-11` buttons and accessible `aria-live="polite"` status.
2. Mount `<ExtensionPackManagerCard />` directly below `<MotionSettingsCard />` in `frontend/src/pages/AccountPage.tsx:386-389`.

- [ ] **Step 4: Run full verification suite for Epic 9**

Run:
```bash
pnpm typecheck && pnpm check && pnpm test && pnpm packs:verify && pnpm build && pnpm e2e:web -- tests/web/audio-choukai.spec.ts
```
And backend checks:
```bash
deno test --no-config --no-lock --node-modules-dir=none backend/supabase/tests/functions.test.ts && supabase test db --workdir backend
```
Expected: PASS across typecheck, Biome check, all Vitest unit/adapter tests, `packs:verify`, Vite build, Playwright E2E, Deno Edge Function tests, and pgTAP RLS tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/account/ExtensionPackManagerCard.tsx frontend/src/components/account/ExtensionPackManagerCard.test.tsx frontend/src/pages/AccountPage.tsx tests/web/audio-choukai.spec.ts
git commit -m "feat(account): add extension pack storage manager and Epic 9 audio E2E"
```

---

## Phase 2 Epic 9 Release Gate Checklist

- [ ] `SEC-E9-01`: `extensionTransport.test.ts` xác nhận chặn SHA-256 sai, chặn quá `sizeBytes`, chặn decompression bomb `> 100 MB`, capability `tauri-plugin-fs` chỉ mở `$APPDATA/extensions/**`.
- [ ] `SEC-E9-02` / `SEC-T06`: `audio_packs.test.sql` + `functions.test.ts` xác nhận bucket `audio-packs` `public = false`, 0 quyền ghi cho client, `sign-audio-pack` trả `403` cho user chưa confirm email, `400` cho `../`, `429` ở request thứ 31/giờ, TTL `300s`, `Cache-Control: private, no-store`.
- [ ] `SEC-E9-03` / `SEC-T09`: `tauri-csp-contract.test.ts` + `mediaSessionBridge.test.ts` xác nhận CSP Desktop/Mobile chặt, không wildcard, không `wss://*.supabase.co`, `MediaSession` 0 PII/token.
- [ ] APK/Bundle budget: Không có file `.opus`/`.mp3` trong `frontend/public/packs/`, bản cài cơ bản giữ `<= 30 MB`, phát audio offline `< 150 ms`.
- [ ] Attribution: `AboutPage.tsx` hiển thị nguồn Kanjium (`CC BY-SA 4.0`) và liên kết mở được trên Desktop/Mobile qua `opener:allow-open-url`.
