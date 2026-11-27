# Epic 10: KanjiVG Nét động, Bộ thủ, Mẹo nhớ & Viết tay Tự do Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp dữ liệu nét vẽ và bộ thủ KanjiVG (`CC BY-SA 3.0`) dưới dạng gói mở rộng tách rời sạch XSS (`FR-33`), bổ sung hoạt ảnh thứ tự nét, cây bộ thủ và mẹo nhớ cá nhân đồng bộ Supabase (`user_mnemonics`), xây dựng bộ nhận dạng viết tay Kanji tự do 100% offline trong Dedicated Web Worker sau lớp adapter (`FR-34`, `AD-16`), khung tập viết giấy Genkoyoshi và phiếu tập viết PDF in được theo bài Minna.

**Architecture:** Đường ống build ở `infra/scripts/` biên dịch XML KanjiVG thành gói JSON thuần chỉ chứa chuỗi `d` đã kiểm duyệt regex và cây bộ thủ + chỉ mục vector nét nén gọn, phân phối qua `ExtensionPackStore` (`AD-13`) để tách biệt sạch giấy phép `CC BY-SA 3.0` khỏi mã nguồn `AGPL-3.0-only` và giữ APK `<= 30 MB`. Frontend kết xuất toàn bộ nét bằng React JSX `<svg><path d={...} /></svg>` (0 `dangerouslySetInnerHTML`), chạy thuật toán đối khớp viết tay trong lazy Web Worker (`worker-src 'self'`, 0 mạng ngoài, timeout `<= 2.000 ms`), và đồng bộ `user_mnemonics` qua Dexie v4 + Supabase Postgres RLS.

**Tech Stack:** TypeScript 7, React 19, Vite 8 (Dedicated Web Worker), Dexie 4 (`luyen-jlpt` v4), HTML5 Canvas 2D (Pointer Events), Supabase Postgres RLS + pgTAP, Vitest 5, Playwright.

**Spec:**
- `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (`AD-13`, `AD-14`, `AD-16`, `FR-33`, `FR-34`)
- `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E10-01`, `SEC-E10-02`, `SEC-E10-03`, `SEC-T04`, `SEC-T07`, `SEC-T10`)

## Global Constraints

- **Giấy phép KanjiVG (`CC BY-SA 3.0`):** Tuyệt đối không trộn mã SVG/XML KanjiVG vào cây mã nguồn `AGPL-3.0-only`; chỉ phân phối dưới dạng gói dữ liệu tĩnh tách rời (`kanjivg-n4`, `kanjivg-joyo`) qua `ExtensionPackStore` kèm ghi nguồn Ulrich Apel / KanjiVG và liên kết `CC BY-SA 3.0` trong `/gioi-thieu` (`AboutPage.tsx`) và `NOTICE-KANJIVG.txt`.
- **Chống XSS KanjiVG (`SEC-E10-01`):** Cấm tuyệt đối `dangerouslySetInnerHTML`, `innerHTML`, `<object>`, `<embed>`, `<iframe srcdoc>`. Chỉ chấp nhận đường dẫn `d` khớp `^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$`, `<= 2.048` ký tự/nét, `<= 40` nét/chữ; chặn `<script>`, `<foreignObject>`, `on*`, `<use>`, `<image>`, `<!ENTITY>`.
- **Mẹo nhớ cá nhân (`SEC-E10-02`):** Bảng `public.user_mnemonics` bật RLS (`user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`), riêng tư từng người dùng, `kanji_id` `1..128` ký tự, `mnemonic` `1..1000` ký tự không `\0`, LWW theo `client_updated_at` với `server_updated_at` từ trigger, và xóa sạch trong `progressStore.purgeOwner(owner)`.
- **Viết tay offline (`AD-16`, `SEC-E10-03`):** Bộ nhận dạng chạy 100% offline trong Dedicated Web Worker tĩnh (`worker-src 'self'`), 0 gọi `inputtools.google.com` hay bất kỳ API ngoài nào, tải lười khi người dùng mở khung vẽ, giới hạn `<= 40` nét × `<= 500` điểm/nét, timeout `<= 2.000 ms`.
- **UX & Ràng buộc dự án (`AGENTS.md`, `DESIGN.md`):** Giữ khung viết tay 2D kiểu giấy Genkoyoshi (không đưa vào 3D), giao diện tiếng Việt, `lang="ja"` trên toàn bộ kanji/kana, nút `>= 44×44px`, tôn trọng `useMotionPreference()`, và **không đặt link `/kanji/tra-cuu` khi trắc nghiệm Kanji đang chạy (`stage === "quiz"`)**.
- Bản cài `.apk` Android cơ bản giữ `<= 30 MB`; `pnpm packs:verify` bảo toàn đủ `118` kanji và `388` từ ghép N4.

## Review Focus

1. **Tệp KanjiVG đầu vào chứa XSS hoặc XXE (`<script>`, `onclick`, `<foreignObject>`, `<!ENTITY>`):** Bộ biên dịch build-time lẫn validator frontend phải từ chối/loại bỏ triệt để, không cho lọt bất kỳ thuộc tính sự kiện hay thẻ lạ nào vào JSON hoặc DOM (pin trong Task 1 & Task 2).
2. **Người dùng vẽ quá nhiều nét/điểm (spam bút cảm ứng `> 40` nét hoặc `> 500` điểm/nét) hoặc Worker bị treo:** `strokeMatcher` phải chặn ngay trước khi tính toán và `strokeMatcherClient` phải hủy Worker sau `2.000 ms` rồi khởi tạo sạch cho lần vẽ tiếp theo (pin trong Task 4).
3. **Mẹo nhớ cá nhân sửa đồng thời offline trên 2 thiết bị hoặc xóa tài khoản trên máy dùng chung:** LWW theo `client_updated_at` phải giữ bản ghi mới hơn (kể cả trạng thái đã xóa `deleted = true`), và `purgeOwner(owner)` phải xóa sạch 100% `userMnemonics` của `owner` mà không ảnh hưởng người dùng khác (pin trong Task 3).
4. **Chưa tải gói `kanjivg-n4` khi đang mất mạng:** Trang `/kanji/tra-cuu` và `KanjiDetailSheet` vẫn hiển thị đầy đủ Hán Việt, âm On/Kun, nghĩa, từ ghép và cho ghi Mẹo nhớ bình thường; khu vực nét động hiện thông báo gọn + nút mở `/tai-khoan` để tải gói khi có mạng (pin trong Task 2 & Task 5).
5. **In phiếu tập viết PDF trên Mobile WebView không hỗ trợ `window.print()`:** `KanjiWritingSheetDialog` phải phát hiện khả năng in an toàn, vẫn cho xem trước bảng Genkoyoshi đầy đủ và hướng dẫn xuất/in trên Web hoặc Desktop thay vì lỗi im lặng (pin trong Task 6).

---

## File Structure

- **Core KanjiVG Sanitizer & Types (`FR-33`, `SEC-E10-01`):**
  - `frontend/src/core/kanji/kanjivgTypes.ts`: Kiểu `KanjiStroke`, `RadicalNode`, `KanjiVgEntry`, `KanjiVgPack`, `StrokeIndexEntry`, `KanjiMatchCandidate`.
  - `frontend/src/core/kanji/svgSanitizer.ts`: Validator chuỗi `d` nghiêm ngặt và kiểm tra toàn vẹn `KanjiVgPack`.
- **Infra KanjiVG Isolated Aggregation Pipeline (`FR-33`, `FR-34`):**
  - `infra/scripts/src/kanjivg-pack.ts`: Parse XML KanjiVG (chống XXE/XSS) → biên dịch gói JSON `kanjivg-n4` / `kanjivg-joyo`, sinh chỉ mục vector nét resampled cho `strokeMatcher`, ghi `NOTICE-KANJIVG.txt`, cập nhật `extensions-index.json`.
  - `infra/scripts/package.json`: Thêm script `kanjivg:build`.
- **KanjiVG Extension Loader & Declarative UI (`FR-33`):**
  - `frontend/src/adapters/extensions/kanjivgSource.ts`: Đọc và kiểm định `kanjivg-n4` / `kanjivg-joyo` từ `ExtensionPackStore`.
  - `frontend/src/hooks/useKanjiVg.ts`: Hook tải lười dữ liệu nét vẽ & bộ thủ theo ký tự kanji.
  - `frontend/src/components/kanji-library/KanjiStrokePlayer.tsx`: Hoạt ảnh thứ tự nét thuần React `<svg><path d={...} /></svg>`.
  - `frontend/src/components/kanji-library/KanjiRadicalTree.tsx`: Cây phân tách bộ thủ & nhóm từ ghép theo Kun/On.
- **Personal Mnemonics Sync (`FR-33`, `SEC-E10-02`):**
  - `backend/supabase/migrations/20261127000400_user_mnemonics.sql`: Bảng `public.user_mnemonics`, RLS, CHECK, trigger LWW + cursor đơn điệu.
  - `frontend/src/adapters/local-store/db.ts`, `frontend/src/core/progress/index.ts`, `frontend/src/adapters/local-store/progress.ts`, `frontend/src/adapters/supabase-sync/index.ts`: Dexie v4 `userMnemonics`, đồng bộ outbox/pull, và `purgeOwner()`.
  - `frontend/src/hooks/useKanjiMnemonics.ts`: Hook đọc/lưu/xóa mẹo nhớ cá nhân.
- **Offline Handwriting Matcher & Lazy Web Worker (`FR-34`, `AD-16`, `SEC-E10-03`):**
  - `frontend/src/core/kanji/strokeMatcher.ts`: Bộ chuẩn hóa nét, resample 16 điểm và đối khớp vector thuần TS.
  - `frontend/src/adapters/kanji-worker/strokeMatcher.worker.ts`: Dedicated Web Worker chạy hoàn toàn offline.
  - `frontend/src/adapters/kanji-worker/strokeMatcherClient.ts`: Adapter lazy-load Worker kèm timeout `2.000 ms`.
- **Genkoyoshi Canvas, Kanji Pages, Printable Sheet & Attribution (`FR-33`, `FR-34`):**
  - `frontend/src/components/kanji-library/GenkoyoshiCanvas.tsx`: Khung vẽ giấy Genkoyoshi (chế độ `trace` & `freehand`).
  - `frontend/src/components/kanji-library/KanjiDetailSheet.tsx`: Màn chi tiết Kanji gom nét động, bộ thủ, tập đồ và mẹo nhớ.
  - `frontend/src/core/kanji/writingSheet.ts`, `frontend/src/components/kanji-library/KanjiWritingSheetDialog.tsx`, `frontend/src/index.css`: Phiếu tập viết PDF `@media print`.
  - `frontend/src/components/kanji-library/KanjiCard.tsx`, `frontend/src/pages/KanjiLibraryPage.tsx`, `frontend/src/pages/KanjiQuizPage.tsx`, `frontend/src/pages/AboutPage.tsx`, `desktop/src-tauri/capabilities/default.json`, `mobile/src-tauri/capabilities/default.json`, `tests/mobile/android-release.test.mjs`.

---

### Task 1: KanjiVG Isolated Aggregation Pipeline, SVG Path Sanitizer & Radical Tree Compiler

**Files:**
- Create: `frontend/src/core/kanji/kanjivgTypes.ts`
- Create: `frontend/src/core/kanji/svgSanitizer.ts`
- Create: `infra/scripts/src/kanjivg-pack.ts`
- Modify: `infra/scripts/package.json:6-13`
- Test: `frontend/src/core/kanji/svgSanitizer.test.ts`
- Test: `infra/scripts/src/kanjivg-pack.test.ts`

**Interfaces:**
- Consumes: `Result` from `frontend/src/core/result.ts`; `safeJsonParse` from `frontend/src/core/extensions/validate.ts`; `writeExtensionsIndex` from `infra/scripts/src/extensions.ts`.
- Produces:
  - `export const SVG_PATH_D_REGEX = /^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$/`
  - `export const MAX_STROKE_D_LENGTH = 2048`
  - `export const MAX_KANJI_STROKES = 40`
  - `export interface KanjiStroke { order: number; d: string; type?: string }`
  - `export interface RadicalNode { element: string; position?: string; radical?: "general" | "tradit" | "nelson"; children: RadicalNode[] }`
  - `export interface KanjiVgEntry { kanji: string; codepoint: string; strokeCount: number; strokes: KanjiStroke[]; radicals: RadicalNode[] }`
  - `export interface StrokeIndexEntry { kanji: string; strokeCount: number; vectors: number[][][] }` (mỗi nét là mảng `16` điểm `[x, y]` trong hệ `0..100`)
  - `validateStrokePathD(d: unknown): Result<string, { code: "invalid-path"; detail: string }>`
  - `validateKanjiVgEntry(raw: unknown): Result<KanjiVgEntry, { code: "schema" | "invalid-path" | "stroke-limit"; detail: string }>`
  - `compileKanjiVgXml(xml: string, expectedKanji: string): KanjiVgEntry`
  - `sampleSvgPathToPoints(d: string, count?: number): Array<[number, number]>`

**Security & QA Gate:** `SEC-E10-01` & `SEC-T10`: từ chối mọi tệp XML có `<!ENTITY`, `<script`, `<foreignObject`, `<use`, `<image`, thuộc tính `on*`; chỉ xuất chuỗi `d` khớp `SVG_PATH_D_REGEX` (`<= 2.048` ký tự, `<= 40` nét); dữ liệu KanjiVG nằm ở `infra/extensions-dist/` (tách biệt khỏi nguồn `AGPL-3.0-only`).

- [ ] **Step 1: Write the failing tests (covering `SEC-T10`)**

Create `frontend/src/core/kanji/svgSanitizer.test.ts` and `infra/scripts/src/kanjivg-pack.test.ts`:

```ts
// frontend/src/core/kanji/svgSanitizer.test.ts
import { describe, expect, it } from "vitest";
import { validateKanjiVgEntry, validateStrokePathD } from "./svgSanitizer";

describe("svgSanitizer (SEC-E10-01 / SEC-T10)", () => {
  it("accepts valid KanjiVG SVG path commands", () => {
    const res = validateStrokePathD("M52.75,10.5c0.11,0.98-0.18,2.63-0.72,3.93");
    expect(res.ok).toBe(true);
  });

  it("rejects injected script, event attributes, url(), or >2048 chars in path d", () => {
    expect(validateStrokePathD('M0,0" onclick="alert(1)').ok).toBe(false);
    expect(validateStrokePathD("javascript:alert(1)").ok).toBe(false);
    expect(validateStrokePathD("M0,0 ".repeat(500)).ok).toBe(false);
  });

  it("rejects kanji entries with more than 40 strokes", () => {
    const strokes = Array.from({ length: 41 }, (_, i) => ({
      order: i + 1,
      d: "M10,10 L90,90",
    }));
    const res = validateKanjiVgEntry({
      kanji: "食",
      codepoint: "098df",
      strokeCount: 41,
      strokes,
      radicals: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("stroke-limit");
  });
});

// infra/scripts/src/kanjivg-pack.test.ts
import { describe, expect, it } from "vitest";
import { compileKanjiVgXml } from "./kanjivg-pack";

describe("compileKanjiVgXml (SEC-T10)", () => {
  it("extracts pure strokes and radical tree while rejecting XSS/XXE payloads", () => {
    const cleanXml = `
      <svg viewBox="0 0 109 109">
        <g kvg:element="食" kvg:radical="general">
          <g kvg:element="人" kvg:position="top">
            <path id="kvg:098df-s1" d="M52.75,10.5c0.11,0.98-0.18,2.63-0.72,3.93"/>
          </g>
          <g kvg:element="良" kvg:position="bottom">
            <path id="kvg:098df-s2" d="M53.5,16.5c6.5,5.2,17.2,13.5,24.8,17.8"/>
          </g>
        </g>
      </svg>`;
    const entry = compileKanjiVgXml(cleanXml, "食");
    expect(entry.strokeCount).toBe(2);
    expect(entry.radicals[0]?.element).toBe("食");
    expect(entry.radicals[0]?.children.map((c) => c.element)).toEqual(["人", "良"]);

    const maliciousXml = `<svg><script>alert(1)</script><path onclick="alert(1)" d="M0,0"/></svg>`;
    expect(() => compileKanjiVgXml(maliciousXml, "食")).toThrow(/forbidden|unsafe/i);

    const foreignObjXml = `<svg><foreignObject><div>xss</div></foreignObject><path d="M0,0"/></svg>`;
    expect(() => compileKanjiVgXml(foreignObjXml, "食")).toThrow(/forbidden|unsafe/i);

    const xxeXml = `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><path d="M0,0"/></svg>`;
    expect(() => compileKanjiVgXml(xxeXml, "食")).toThrow(/entity|forbidden/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/svgSanitizer.test.ts && pnpm --filter @luyen/infra-scripts test -- src/kanjivg-pack.test.ts`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement KanjiVG sanitizer, XML-to-JSON compiler, and stroke-index builder**

1. Create `frontend/src/core/kanji/kanjivgTypes.ts` and `frontend/src/core/kanji/svgSanitizer.ts` implementing `validateStrokePathD` and `validateKanjiVgEntry` with exact caps (`2048` chars/stroke, `40` strokes/kanji, `SVG_PATH_D_REGEX`).
2. Create `infra/scripts/src/kanjivg-pack.ts`:
   - `compileKanjiVgXml(xml, expectedKanji)`: rejects immediately if raw XML matches `/<!ENTITY|<script\b|<foreignObject\b|<use\b|<image\b|\bon[a-z]+\s*=/i`. Parses `<g kvg:element="...">` nesting stack and `<path d="...">` strictly without evaluating XML entities; validates every path via `validateKanjiVgEntry`.
   - `sampleSvgPathToPoints(d, count = 16)`: evaluates SVG `M/m/L/l/H/h/V/v/C/c/S/s/Q/q/T/t` segments into dense polyline samples, resamples to `16` equidistant points normalized to `0..100` integer coordinates to build the compact `strokeIndex` (~400 KB for N4+Joyo).
   - Writes isolated packs `kanjivg-n4.json.gz` (118 N4 kanji from `infra/content/n4/kanji.json`), `kanjivg-joyo.json.gz`, and `NOTICE-KANJIVG.txt` (Ulrich Apel / `CC BY-SA 3.0`) into `infra/extensions-dist/`, then updates `extensions-index.json`.
3. Add `"kanjivg:build": "tsx src/kanjivg-pack.ts"` to `infra/scripts/package.json`.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/svgSanitizer.test.ts && pnpm --filter @luyen/infra-scripts test -- src/kanjivg-pack.test.ts && pnpm typecheck`
Expected: PASS (100% sanitizer & compiler tests green, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/kanji/ infra/scripts/src/kanjivg-pack.ts infra/scripts/src/kanjivg-pack.test.ts infra/scripts/package.json
git commit -m "feat(kanji): add isolated KanjiVG JSON compiler, SVG path sanitizer and stroke index builder"
```

---

### Task 2: Declarative React Stroke-Order Animator & Radical Tree Components

**Files:**
- Create: `frontend/src/adapters/extensions/kanjivgSource.ts`
- Create: `frontend/src/hooks/useKanjiVg.ts`
- Create: `frontend/src/components/kanji-library/KanjiStrokePlayer.tsx`
- Create: `frontend/src/components/kanji-library/KanjiRadicalTree.tsx`
- Test: `frontend/src/components/kanji-library/KanjiStrokePlayer.test.tsx`

**Interfaces:**
- Consumes: `extensionPackStore` from `frontend/src/adapters/extensions/index.ts`; `KanjiVgEntry`, `RadicalNode` from `frontend/src/core/kanji/kanjivgTypes.ts`; `validateKanjiVgEntry` from `frontend/src/core/kanji/svgSanitizer.ts`; `CompoundEntry` from `frontend/src/core/content/types.ts`; `useMotionPreference` from `frontend/src/hooks/useMotionPreference.ts`.
- Produces:
  - `loadKanjiVgEntry(kanji: string): Promise<KanjiVgEntry | null>`
  - `loadStrokeIndex(): Promise<StrokeIndexEntry[] | null>`
  - `useKanjiVg(kanji: string): { entry: KanjiVgEntry | null; installed: boolean; loading: boolean }`
  - `<KanjiStrokePlayer entry={entry} />` (100% declarative React JSX `<svg viewBox="0 0 109 109">`)
  - `<KanjiRadicalTree radicals={entry.radicals} compounds={compounds} onyomi={entry.onyomi} kunyomi={entry.kunyomi} />`

**Security & QA Gate:** `SEC-E10-01` & `SEC-T10`: 0 `dangerouslySetInnerHTML`/`innerHTML`; `loadKanjiVgEntry` chạy lại `validateKanjiVgEntry` trước khi trả về UI (defense-in-depth); `useMotionPreference()` ở chế độ `reduced` hiển thị tức thì từng nét mà không tạo hiệu ứng lướt; khi chưa tải gói `kanjivg-n4`, hiển thị fallback gọn kèm nút mở `/tai-khoan`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/kanji-library/KanjiStrokePlayer.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { KanjiVgEntry } from "@/core/kanji/kanjivgTypes";
import { KanjiStrokePlayer } from "./KanjiStrokePlayer";

const sampleEntry: KanjiVgEntry = {
  kanji: "食",
  codepoint: "098df",
  strokeCount: 2,
  strokes: [
    { order: 1, d: "M52.75,10.5 L30,40" },
    { order: 2, d: "M53.5,16.5 L78,34" },
  ],
  radicals: [{ element: "食", radical: "general", children: [] }],
};

describe("KanjiStrokePlayer (FR-33 / SEC-E10-01)", () => {
  it("renders declarative SVG paths with zero script or inline event attributes", () => {
    const { container } = render(<KanjiStrokePlayer entry={sampleEntry} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 109 109");
    expect(container.querySelectorAll("path[data-stroke-order]").length).toBe(2);
    expect(container.querySelector("script, foreignObject")).toBeNull();
    expect(container.innerHTML).not.toMatch(/\son[a-z]+=/i);
  });

  it("steps forward and resets stroke counter via accessible >=44px controls", () => {
    render(<KanjiStrokePlayer entry={sampleEntry} />);
    const stepBtn = screen.getByRole("button", { name: /Nét tiếp/i });
    fireEvent.click(stepBtn);
    expect(screen.getByText(/Nét 1 \/ 2/i)).toBeTruthy();
    fireEvent.click(stepBtn);
    expect(screen.getByText(/Nét 2 \/ 2/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/components/kanji-library/KanjiStrokePlayer.test.tsx`
Expected: FAIL with `./KanjiStrokePlayer` not found.

- [ ] **Step 3: Implement `kanjivgSource`, `useKanjiVg`, `KanjiStrokePlayer`, and `KanjiRadicalTree`**

1. Create `frontend/src/adapters/extensions/kanjivgSource.ts`: reads from `extensionPackStore` (`kanjivg-n4` first, then `kanjivg-joyo`), caches parsed map in memory per session, validates every returned entry through `validateKanjiVgEntry()`, and exposes `loadStrokeIndex()` for Task 4.
2. Create `frontend/src/hooks/useKanjiVg.ts` using React Query (`networkMode: "always"`).
3. Create `frontend/src/components/kanji-library/KanjiStrokePlayer.tsx`:
   - Renders Washi square guide lines + faint ghost strokes + animated sumi `<path data-stroke-order={s.order} d={s.d} />` using CSS `stroke-dashoffset` (instant jump when `mode === "reduced"`).
   - Optional stroke-order start-point numbers (`<text>`) toggleable by user; controls `Vẽ lại`, `Nét tiếp`, `Hiện số nét`, tất cả `min-h-11`.
4. Create `frontend/src/components/kanji-library/KanjiRadicalTree.tsx`:
   - Renders nested radical breakdown chips (`lang="ja"`) and groups `compounds` into `Âm On` / `Âm Kun` / `Khác` by matching `compound.reading` against normalized `onyomi` / `kunyomi`.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/components/kanji-library/KanjiStrokePlayer.test.tsx && pnpm typecheck`
Expected: PASS (stroke player tests green, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/adapters/extensions/kanjivgSource.ts frontend/src/hooks/useKanjiVg.ts frontend/src/components/kanji-library/KanjiStrokePlayer.tsx frontend/src/components/kanji-library/KanjiStrokePlayer.test.tsx frontend/src/components/kanji-library/KanjiRadicalTree.tsx
git commit -m "feat(kanji): add declarative KanjiVG stroke-order player and radical tree"
```

---

### Task 3: Synced Personal Kanji Mnemonics (`user_mnemonics` Migration, Dexie v4 & `purgeOwner`)

**Files:**
- Create: `backend/supabase/migrations/20261127000400_user_mnemonics.sql`
- Modify: `frontend/src/adapters/local-store/db.ts:1-43`
- Modify: `frontend/src/core/progress/index.ts:26-109`
- Modify: `frontend/src/adapters/local-store/progress.ts:167-185`
- Modify: `frontend/src/adapters/supabase-sync/index.ts:14-181`
- Create: `frontend/src/hooks/useKanjiMnemonics.ts`
- Create: `backend/supabase/tests/user_mnemonics.test.sql`
- Test: `frontend/src/adapters/local-store/mnemonics.test.ts`

**Interfaces:**
- Consumes: `jlpt_private.has_confirmed_email()`, `jlpt_private.lock_progress_writer()`, `jlpt_private.progress_cursors` from `backend/supabase/migrations/20261122000100_profiles_and_progress.sql`; `ProgressScope`, `timestampKey` from `frontend/src/core/progress/index.ts`.
- Produces:
  - Postgres table `public.user_mnemonics (user_id uuid, level text, kanji_id text, mnemonic text, deleted boolean default false, client_updated_at timestamptz, server_updated_at timestamptz, primary key (user_id, level, kanji_id))`
  - Dexie v4 table `userMnemonics: Table<UserMnemonicRow, [string, Level, string]>` (`"[owner+level+kanjiId], owner, [owner+level]"`)
  - `export interface UserMnemonicRow { owner: string; level: Level; kanjiId: string; mnemonic: string; deleted: boolean; updatedAt: string }`
  - `progressStore.setKanjiMnemonic(scope: ProgressScope, kanjiId: string, mnemonic: string): Promise<UserMnemonicRow>`
  - `progressStore.deleteKanjiMnemonic(scope: ProgressScope, kanjiId: string): Promise<void>`
  - `progressStore.listKanjiMnemonics(scope: ProgressScope): Promise<UserMnemonicRow[]>`
  - `useKanjiMnemonics()` & `useSaveKanjiMnemonic()` hooks

**Security & QA Gate:** `SEC-E10-02`, `SEC-T04`, `SEC-T07(b)`: RLS riêng tư từng user (`user_id = auth.uid()` + `has_confirmed_email()`); `kanji_id` `1..128` ký tự không `\0`; `mnemonic` `1..1000` ký tự không `\0` (từ chối `1001` ký tự và `\0` bằng `23514`); client không ghi được `server_updated_at` (`42501`); `purgeOwner(owner)` xóa sạch 100% `db.userMnemonics` của `owner` trong cùng transaction Dexie v4 mà giữ nguyên `owner` khác.

- [ ] **Step 1: Write the failing tests (pgTAP + Vitest)**

Create `backend/supabase/tests/user_mnemonics.test.sql` asserting:
- Confirmed user 1 can insert & LWW-update `user_mnemonics`; older `client_updated_at` does not overwrite or advance `server_updated_at`.
- `mnemonic` length `1001` throws `23514`; `mnemonic` containing `chr(0)` throws `23514`; `kanji_id` length `129` throws `23514`; writing `server_updated_at` throws `42501`; `DELETE` throws `42501`.
- Unconfirmed user 3 cannot insert or select; user 2 sees 0 rows of user 1.

Create `frontend/src/adapters/local-store/mnemonics.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { progressStore } from "./progress";

describe("userMnemonics local store & purgeOwner (SEC-E10-02 / SEC-T04)", () => {
  beforeEach(async () => {
    await db.userMnemonics.clear();
    await db.progressOutbox.clear();
    await db.settings.clear();
  });

  it("rejects mnemonics over 1000 chars or containing null byte", async () => {
    await expect(
      progressStore.setKanjiMnemonic(
        { owner: "ownerA", level: "n4" },
        "kanji-01",
        "a".repeat(1001),
      ),
    ).rejects.toThrow(/1000|invalid/i);
    await expect(
      progressStore.setKanjiMnemonic(
        { owner: "ownerA", level: "n4" },
        "kanji-01",
        "bad\0text",
      ),
    ).rejects.toThrow(/invalid/i);
  });

  it("purges ownerA mnemonics completely while preserving ownerB", async () => {
    await progressStore.setKanjiMnemonic(
      { owner: "ownerA", level: "n4" },
      "kanji-01",
      "Người dưới mái nhà ăn cơm",
    );
    await progressStore.setKanjiMnemonic(
      { owner: "ownerB", level: "n4" },
      "kanji-01",
      "Mẹo của B",
    );
    await progressStore.purgeOwner("ownerA");
    expect(
      await db.userMnemonics.where("owner").equals("ownerA").count(),
    ).toBe(0);
    expect(
      await db.userMnemonics.where("owner").equals("ownerB").count(),
    ).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/mnemonics.test.ts`
Expected: FAIL (`setKanjiMnemonic` and `db.userMnemonics` undefined).

- [ ] **Step 3: Implement Supabase migration, Dexie v4 table, sync wiring, and hooks**

1. Create `backend/supabase/migrations/20261127000400_user_mnemonics.sql`:
   - Table `public.user_mnemonics` with CHECKs: `level in ('n5','n4','n3','n2','n1')`, `char_length(kanji_id) between 1 and 128`, `position(chr(0) in kanji_id) = 0`, `char_length(mnemonic) between 1 and 1000`, `position(chr(0) in mnemonic) = 0`, finite `client_updated_at`.
   - Separate trigger `jlpt_private.apply_user_mnemonic_write()` enforcing immutable `(user_id, level, kanji_id)`, LWW `new.client_updated_at > old.client_updated_at`, and monotonic `server_updated_at` from `jlpt_private.progress_cursors`.
   - RLS `own_confirmed_select`, `own_confirmed_insert`, `own_confirmed_update` using `jlpt_private.has_confirmed_email()`, column-level `GRANT` excluding `server_updated_at`, no `DELETE` grant.
2. Extend `frontend/src/adapters/local-store/db.ts` (`userMnemonics: "[owner+level+kanjiId], owner, [owner+level]"` in Dexie v4), `frontend/src/core/progress/index.ts` (add `"user_mnemonics"` to `ProgressRow` / `PROGRESS_KINDS` and `isState()` + validation of `1..1000` chars without `\0`), `frontend/src/adapters/local-store/progress.ts` (implement `setKanjiMnemonic`, `deleteKanjiMnemonic`, `listKanjiMnemonics`, mirror writes into `db.userMnemonics` + outbox, and delete `db.userMnemonics.where("owner").equals(owner)` inside `purgeOwner`), and `frontend/src/adapters/supabase-sync/index.ts` (wire `user_mnemonics` `toWire`/`fromWire` with `onConflict: "user_id,level,kanji_id"`, `ignoreDuplicates: false`, and `cursorIdColumn: "kanji_id"` in `pull()` since `public.user_mnemonics` has no `id`/`item_id` column).
3. Create `frontend/src/hooks/useKanjiMnemonics.ts` (`useKanjiMnemonics`, `useSaveKanjiMnemonic`, `useDeleteKanjiMnemonic`).

- [ ] **Step 4: Run Vitest & pgTAP tests**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/mnemonics.test.ts src/adapters/supabase-sync/index.test.ts && supabase test db --workdir backend && pnpm typecheck`
Expected: PASS (Vitest + pgTAP `user_mnemonics.test.sql` all green).

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/migrations/20261127000400_user_mnemonics.sql backend/supabase/tests/user_mnemonics.test.sql frontend/src/adapters/local-store/ frontend/src/core/progress/ frontend/src/adapters/supabase-sync/ frontend/src/hooks/useKanjiMnemonics.ts
git commit -m "feat(kanji): add synced personal user_mnemonics with RLS, Dexie v4 and purgeOwner"
```

---

### Task 4: Offline Freehand Kanji Stroke Matcher Engine & Lazy Web Worker Adapter

**Files:**
- Create: `frontend/src/core/kanji/strokeMatcher.ts`
- Create: `frontend/src/adapters/kanji-worker/strokeMatcher.worker.ts`
- Create: `frontend/src/adapters/kanji-worker/strokeMatcherClient.ts`
- Test: `frontend/src/core/kanji/strokeMatcher.test.ts`
- Test: `frontend/src/adapters/kanji-worker/strokeMatcherClient.test.ts`

**Interfaces:**
- Consumes: `StrokeIndexEntry`, `KanjiMatchCandidate`, `MAX_KANJI_STROKES` from `frontend/src/core/kanji/kanjivgTypes.ts`; `loadStrokeIndex` from `frontend/src/adapters/extensions/kanjivgSource.ts`.
- Produces:
  - `export const MAX_POINTS_PER_STROKE = 500`
  - `export const WORKER_MATCH_TIMEOUT_MS = 2_000`
  - `export type DrawnStroke = Array<[number, number]>`
  - `normalizeDrawnStrokes(strokes: DrawnStroke[], samplesPerStroke?: number): number[][][]` (enforces `1 <= strokes.length <= 40` and `points.length <= 500`, rescales combined bounding box to `0..100` preserving aspect ratio, resamples each stroke to `16` equidistant points)
  - `matchKanjiStrokes(drawn: DrawnStroke[], index: readonly StrokeIndexEntry[], topK?: number): KanjiMatchCandidate[]`
  - `createStrokeMatcherClient(options?: { workerFactory?: () => Worker; timeoutMs?: number }): { recognize(strokes: DrawnStroke[], topK?: number): Promise<KanjiMatchCandidate[]>; terminate(): void }`

**Security & QA Gate:** `AD-16`, `SEC-E10-03`: Worker đóng gói cùng origin (`new Worker(new URL("./strokeMatcher.worker.ts", import.meta.url), { type: "module" })` thuộc `worker-src 'self'`), 0 kết nối mạng, chỉ khởi tạo lười ở lần gọi `recognize()` đầu tiên, chặn cứng `> 40` nét hoặc `> 500` điểm/nét, tự hủy Worker nếu quá `2.000 ms`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/core/kanji/strokeMatcher.test.ts` and `frontend/src/adapters/kanji-worker/strokeMatcherClient.test.ts`:

```ts
// frontend/src/core/kanji/strokeMatcher.test.ts
import { describe, expect, it } from "vitest";
import type { StrokeIndexEntry } from "./kanjivgTypes";
import { matchKanjiStrokes, normalizeDrawnStrokes } from "./strokeMatcher";

const mockIndex: StrokeIndexEntry[] = [
  {
    kanji: "日",
    strokeCount: 4,
    vectors: [
      [[20, 15], [20, 85]],
      [[20, 15], [80, 15], [80, 85]],
      [[22, 50], [78, 50]],
      [[22, 85], [78, 85]],
    ].map((s) => normalizeDrawnStrokes([s as [number, number][]])[0]),
  },
  {
    kanji: "本",
    strokeCount: 5,
    vectors: [
      [[15, 30], [85, 30]],
      [[50, 10], [50, 90]],
      [[50, 30], [18, 75]],
      [[50, 30], [82, 75]],
      [[30, 72], [70, 72]],
    ].map((s) => normalizeDrawnStrokes([s as [number, number][]])[0]),
  },
];

describe("strokeMatcher (FR-34 / SEC-E10-03)", () => {
  it("ranks target kanji in top-3 even with hand-drawn jitter and translation", () => {
    const drawnSun: Array<[number, number]>[] = [
      [[122, 118], [120, 250]],
      [[121, 120], [238, 122], [236, 248]],
      [[125, 185], [232, 184]],
      [[124, 246], [235, 247]],
    ];
    const results = matchKanjiStrokes(drawnSun, mockIndex, 5);
    expect(results[0]?.kanji).toBe("日");
  });

  it("rejects >40 strokes or >500 points per stroke", () => {
    const tooManyStrokes = Array.from({ length: 41 }, () => [[0, 0], [10, 10]] as [number, number][]);
    expect(() => normalizeDrawnStrokes(tooManyStrokes)).toThrow(/40/);
    const tooManyPts = [Array.from({ length: 501 }, (_, i) => [i, i] as [number, number])];
    expect(() => normalizeDrawnStrokes(tooManyPts)).toThrow(/500/);
  });
});
```

In `strokeMatcherClient.test.ts`, assert:
1. Creating the client calls `workerFactory` `0` times (lazy instantiation).
2. First `recognize()` spawns Worker once, sends index + strokes, resolves top candidates.
3. A stalled Worker exceeding `timeoutMs` (e.g. `50 ms` in test, default `2_000 ms`) rejects with timeout error, calls `worker.terminate()`, and allows next call to spawn a fresh Worker.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/strokeMatcher.test.ts src/adapters/kanji-worker/strokeMatcherClient.test.ts`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement `strokeMatcher.ts`, Dedicated Web Worker, and lazy client adapter**

1. Create `frontend/src/core/kanji/strokeMatcher.ts`:
   - `normalizeDrawnStrokes`: guards `1..40` strokes and `<= 500` points/stroke; computes global `[minX, maxX, minY, maxY]`, scales uniformly into `[0, 100]` centered, and resamples each stroke to `16` equidistant points.
   - `matchKanjiStrokes`: pre-filters index entries with `|entry.strokeCount - drawn.length| <= 2`; scores each candidate by weighted sum of: (a) per-stroke directional Euclidean distance + start/end anchor distance (`0.65`), (b) order-relaxed nearest-stroke distance (`0.25`, tolerating minor stroke-order mistakes), and (c) stroke-count difference penalty (`0.10`); sorts descending into `0..1` confidence scores and returns `topK` (`<= 10`).
2. Create `frontend/src/adapters/kanji-worker/strokeMatcher.worker.ts`: handles `{ type: "init", index }` and `{ type: "match", requestId, strokes, topK }`, responds `{ type: "result", requestId, candidates }` or `{ type: "error", requestId, message }`, zero network imports.
3. Create `frontend/src/adapters/kanji-worker/strokeMatcherClient.ts`: lazy-loads `loadStrokeIndex()` + Worker on first `recognize()`, enforces `WORKER_MATCH_TIMEOUT_MS = 2_000`, cancels stale in-flight requests, and exposes `terminate()` for unmount cleanup.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/strokeMatcher.test.ts src/adapters/kanji-worker/strokeMatcherClient.test.ts && pnpm typecheck`
Expected: PASS (accuracy, input cap, lazy spawn, and 2s timeout tests green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/kanji/strokeMatcher.ts frontend/src/core/kanji/strokeMatcher.test.ts frontend/src/adapters/kanji-worker/
git commit -m "feat(kanji): add offline freehand stroke matcher and lazy Web Worker adapter"
```

---

### Task 5: Genkoyoshi Canvas (Trace + Freehand Lookup) & Kanji Page Integration

**Files:**
- Create: `frontend/src/components/kanji-library/GenkoyoshiCanvas.tsx`
- Create: `frontend/src/components/kanji-library/KanjiDetailSheet.tsx`
- Modify: `frontend/src/components/kanji-library/KanjiCard.tsx:29-124`
- Modify: `frontend/src/pages/KanjiLibraryPage.tsx:123-299`
- Modify: `frontend/src/pages/KanjiQuizPage.tsx:131-141`
- Test: `frontend/src/components/kanji-library/GenkoyoshiCanvas.test.tsx`

**Interfaces:**
- Consumes: `KanjiEntry`, `CompoundEntry` from `frontend/src/core/content/types.ts`; `KanjiVgEntry`, `KanjiMatchCandidate` from `frontend/src/core/kanji/kanjivgTypes.ts`; `createStrokeMatcherClient` from `frontend/src/adapters/kanji-worker/strokeMatcherClient.ts`; `KanjiStrokePlayer`, `KanjiRadicalTree`; `useKanjiVg`, `useKanjiMnemonics`, `useSaveKanjiMnemonic`.
- Produces:
  - `export interface GenkoyoshiCanvasProps { mode: "trace" | "freehand"; guideEntry?: KanjiVgEntry | null; onSelectCandidate?: (kanji: string) => void; onTraceChecked?: (result: { passed: boolean; matchedStrokes: number; totalStrokes: number }) => void }`
  - `export interface KanjiDetailSheetProps { entry: KanjiEntry | null; compounds: CompoundEntry[]; onClose: () => void }`

**Security & QA Gate:** Tuân thủ `DESIGN.md` (giấy Genkoyoshi 2D, đường chữ thập mờ 10%, nét mực sumi, 0 cảnh 3D trong bài viết tay); giữ nguyên quy tắc `AGENTS.md` (màn `stage === "quiz"` trên `KanjiQuizPage.tsx` KHÔNG chứa liên kết tới `/kanji/tra-cuu`, chỉ gắn nút xem chi tiết nét vẽ/mẹo nhớ ở `stage === "result"` hoặc `KanjiLibraryPage`); mọi nút `>= 44×44px`; ô mẹo nhớ giới hạn `maxLength={1000}` và hiển thị bộ đếm `n / 1000`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/kanji-library/GenkoyoshiCanvas.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenkoyoshiCanvas } from "./GenkoyoshiCanvas";

describe("GenkoyoshiCanvas", () => {
  it("renders Genkoyoshi canvas with touch-action none and undo/clear controls >=44px", () => {
    render(<GenkoyoshiCanvas mode="freehand" onSelectCandidate={vi.fn()} />);
    const canvas = screen.getByTestId("kanji.genkoyoshi.canvas");
    expect(canvas.style.touchAction).toBe("none");
    expect(screen.getByRole("button", { name: /Hoàn tác/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Xóa/i })).toBeTruthy();
  });

  it("caps strokes at 40 and notifies user instead of overflowing worker input", () => {
    render(<GenkoyoshiCanvas mode="freehand" onSelectCandidate={vi.fn()} />);
    const canvas = screen.getByTestId("kanji.genkoyoshi.canvas");
    for (let i = 0; i < 41; i++) {
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10 + i, clientY: 10 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40 + i, clientY: 40 });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 40 + i, clientY: 40 });
    }
    expect(screen.getByText(/40 \/ 40 nét/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/components/kanji-library/GenkoyoshiCanvas.test.tsx`
Expected: FAIL with `./GenkoyoshiCanvas` not found.

- [ ] **Step 3: Implement `GenkoyoshiCanvas`, `KanjiDetailSheet`, and wire pages**

1. Create `frontend/src/components/kanji-library/GenkoyoshiCanvas.tsx`:
   - Uses DPR-scaled `<canvas style={{ touchAction: "none" }}>` with pointer capture (`setPointerCapture`), captures at most `40` strokes × `500` points/stroke (auto-subsampling dense stylus events).
   - Mode `trace`: renders faint ghost SVG overlay of `guideEntry.strokes` behind canvas; clicking `Kiểm tra` compares user strokes against `guideEntry` via `normalizeDrawnStrokes` and displays pass/retry feedback.
   - Mode `freehand`: debounces `180 ms` after `pointerup`, invokes `strokeMatcherClient.recognize(strokes, 10)`, renders clickable `lang="ja"` candidate buttons (`min-h-11 min-w-11`), and calls `terminate()` on unmount.
2. Create `frontend/src/components/kanji-library/KanjiDetailSheet.tsx` (using `@radix-ui/react-dialog`):
   - Tabs: `Thứ tự nét & Bộ thủ` (`KanjiStrokePlayer` + `KanjiRadicalTree`), `Tập viết` (`GenkoyoshiCanvas mode="trace"`), and `Mẹo nhớ cá nhân` (textarea `maxLength={1000}`, save/clear synced via `useSaveKanjiMnemonic`).
3. Update `frontend/src/components/kanji-library/KanjiCard.tsx:29-124`: add optional `onOpenDetail?: (entry: KanjiEntry) => void` button (`Nét viết & Bộ thủ`).
4. Update `frontend/src/pages/KanjiLibraryPage.tsx:150-299`:
   - Add `Vẽ tay` toggle button next to `#kanji-search` opening an inline collapsible `GenkoyoshiCanvas mode="freehand"`; tapping a candidate sets `query` to that kanji and switches to the `kanji` tab.
   - Mount `<KanjiDetailSheet>` driven by selected `detailEntry` state.
5. Update `frontend/src/pages/KanjiQuizPage.tsx:131-141`: only inside `stage === "result"`, allow clicking a missed kanji item to open `<KanjiDetailSheet>` (strictly keeping `stage === "quiz"` free of `/kanji/tra-cuu` links).

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/components/kanji-library/ && pnpm typecheck && pnpm check`
Expected: PASS (all kanji-library unit & component tests green, Biome clean).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kanji-library/ frontend/src/pages/KanjiLibraryPage.tsx frontend/src/pages/KanjiQuizPage.tsx
git commit -m "feat(kanji): add Genkoyoshi handwriting canvas, KanjiDetailSheet and freehand search"
```

---

### Task 6: Printable Kanji Writing Practice Sheets (PDF / Print Layout)

**Files:**
- Create: `frontend/src/core/kanji/writingSheet.ts`
- Create: `frontend/src/components/kanji-library/KanjiWritingSheetDialog.tsx`
- Modify: `frontend/src/index.css` (append `@media print` A4 rules)
- Modify: `frontend/src/pages/KanjiLibraryPage.tsx:128-149`
- Test: `frontend/src/core/kanji/writingSheet.test.ts`

**Interfaces:**
- Consumes: `KanjiEntry` from `frontend/src/core/content/types.ts`; `KanjiVgEntry` from `frontend/src/core/kanji/kanjivgTypes.ts`.
- Produces:
  - `export interface WritingSheetRow { kanji: string; hanViet: string; onyomi: string[]; kunyomi: string[]; meaning: string; strokes: KanjiStroke[]; ghostCells: 2; blankCells: 6 }`
  - `buildWritingSheetRows(entries: KanjiEntry[], vgMap: ReadonlyMap<string, KanjiVgEntry>, maxRows?: number): WritingSheetRow[]` (caps at `50` kanji/sheet to prevent print memory spikes)
  - `<KanjiWritingSheetDialog entries={kanjiResults} lessonLabel={...} />`

**Security & QA Gate:** Thuần React JSX `<svg><path d={...} /></svg>` (0 HTML string concatenation, 0 `innerHTML`); giới hạn `<= 50` chữ/phiếu; hỗ trợ nút `In / Lưu PDF` (`window.print()`) với fallback thông báo nhẹ khi WebView mobile không có API in.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/core/kanji/writingSheet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWritingSheetRows } from "./writingSheet";

describe("buildWritingSheetRows (FR-34)", () => {
  it("builds rows with 2 ghost cells, 6 blank Genkoyoshi cells, and caps output at 50 rows", () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      id: `kanji-${i + 1}`,
      kanji: "食",
      hanViet: "THỰC",
      onyomi: ["ショク"],
      kunyomi: ["た.べる"],
      meaning: "ăn",
      lessons: ["26"],
    }));
    const rows = buildWritingSheetRows(entries, new Map());
    expect(rows).toHaveLength(50);
    expect(rows[0]?.ghostCells).toBe(2);
    expect(rows[0]?.blankCells).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/writingSheet.test.ts`
Expected: FAIL with `./writingSheet` not found.

- [ ] **Step 3: Implement `writingSheet.ts`, `KanjiWritingSheetDialog`, print CSS, and page trigger**

1. Create `frontend/src/core/kanji/writingSheet.ts`.
2. Create `frontend/src/components/kanji-library/KanjiWritingSheetDialog.tsx` rendering an A4 preview of `WritingSheetRow[]` with declarative `<svg viewBox="0 0 109 109">` KanjiVG traces inside 2 ghost Genkoyoshi boxes + 6 blank Genkoyoshi boxes per row, and button `In / Lưu PDF` invoking `window.print()` (checking `typeof window.print === "function"`).
3. Append `@media print` utility classes (`.print-hidden`, `.kanji-writing-sheet-print`) to `frontend/src/index.css` so only the practice sheet prints cleanly in monochrome A4 without navigation chrome.
4. Add `In phiếu tập viết` button (`min-h-11`, `data-ocid="kanji_library.print_sheet_button"`) in `frontend/src/pages/KanjiLibraryPage.tsx:142-148`.

- [ ] **Step 4: Run tests and verify**

Run: `pnpm --filter @luyen/frontend test -- src/core/kanji/writingSheet.test.ts && pnpm typecheck && pnpm check`
Expected: PASS (writing sheet tests green, CSS valid, 0 TypeScript errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/core/kanji/writingSheet.ts frontend/src/core/kanji/writingSheet.test.ts frontend/src/components/kanji-library/KanjiWritingSheetDialog.tsx frontend/src/index.css frontend/src/pages/KanjiLibraryPage.tsx
git commit -m "feat(kanji): add printable A4 Genkoyoshi PDF writing sheets"
```

---

### Task 7: KanjiVG `CC BY-SA 3.0` Attribution, Tauri Opener Allowlist & End-to-End Verification

**Files:**
- Modify: `frontend/src/pages/AboutPage.tsx:44-63`
- Modify: `desktop/src-tauri/capabilities/default.json:13-29`
- Modify: `mobile/src-tauri/capabilities/default.json:13-23`
- Modify: `tests/mobile/android-release.test.mjs:74-83`
- Create: `tests/web/kanji-kanjivg.spec.ts`

**Interfaces:**
- Consumes: `KanjiLibraryPage`, `AboutPage`, `ExtensionPackStore`, `strokeMatcherClient`, `progressStore`.
- Produces:
  - Attribution block in `AboutPage.tsx` citing Ulrich Apel / KanjiVG (`https://kanjivg.tagaini.net/`) and `CC BY-SA 3.0` (`https://creativecommons.org/licenses/by-sa/3.0/`), explicitly stating KanjiVG is distributed as an isolated optional data pack.
  - Updated `opener:allow-open-url` allowlist in Desktop & Mobile Tauri capabilities.
  - Playwright E2E suite `tests/web/kanji-kanjivg.spec.ts`.

**Security & QA Gate:** `FR-33`, `FR-34`, `SEC-E10-01..03`, `SEC-T04`, `SEC-T07`, `SEC-T10`: xác nhận 0 `<script>`/`on*` trong DOM KanjiVG, 0 request mạng ngoài khi vẽ tay offline, mẹo nhớ lưu/khôi phục sau reload, `AboutPage` có đủ link `CC BY-SA 3.0`, và toàn bộ suite `packs:verify`, `typecheck`, `test`, `build`, `e2e:web`, `supabase test db` xanh.

- [ ] **Step 1: Write the failing Playwright E2E test**

Create `tests/web/kanji-kanjivg.spec.ts`:
1. Loads `/kanji/tra-cuu` directly (per `AGENTS.md`), mocks installed `kanjivg-n4` fixture pack, opens `KanjiDetailSheet` for a N4 kanji, verifies `<svg viewBox="0 0 109 109">` with `<path data-stroke-order>` and asserts `0` `<script>` / `<foreignObject>` inside SVG.
2. Enters a personal mnemonic (`"Mẹo thử nghiệm N4"`), saves, reloads page, re-opens detail sheet, and verifies mnemonic persisted in Dexie.
3. Opens freehand `GenkoyoshiCanvas`, goes offline (`context.setOffline(true)`), records network requests, draws strokes on canvas, asserts `0` outbound network requests and candidate buttons appear from local Web Worker.
4. Opens `In phiếu tập viết` dialog and verifies A4 preview rows render with 2 ghost + 6 blank boxes.
5. Opens `/gioi-thieu` and verifies KanjiVG (`Ulrich Apel`) and `CC BY-SA 3.0` links are visible.

- [ ] **Step 2: Run E2E test to verify it fails before attribution update**

Run: `pnpm e2e:web -- tests/web/kanji-kanjivg.spec.ts`
Expected: FAIL on `/gioi-thieu` KanjiVG `CC BY-SA 3.0` assertion.

- [ ] **Step 3: Update `AboutPage.tsx` and Tauri Desktop/Mobile `opener:allow-open-url`**

1. In `frontend/src/pages/AboutPage.tsx:44-63`, add a paragraph inside the `Nguồn dữ liệu` card crediting **KanjiVG** (Ulrich Apel) for stroke order and radical decomposition, explaining it is distributed as an optional standalone data pack under `CC BY-SA 3.0`, with `<ExternalLink>` to `https://kanjivg.tagaini.net/` and `https://creativecommons.org/licenses/by-sa/3.0/`.
2. Add both exact URLs (`https://kanjivg.tagaini.net/` and `https://creativecommons.org/licenses/by-sa/3.0/`) to `opener:allow-open-url` in `desktop/src-tauri/capabilities/default.json` and `mobile/src-tauri/capabilities/default.json`, and append both URLs to the exact `assert.deepEqual` list in `tests/mobile/android-release.test.mjs:78-82`.

- [ ] **Step 4: Run full verification suite for Epic 10**

Run:
```bash
pnpm typecheck && pnpm check && pnpm test && node --test tests/mobile/android-release.test.mjs && pnpm packs:verify && pnpm build && pnpm e2e:web -- tests/web/kanji-kanjivg.spec.ts
```
And database RLS check:
```bash
supabase test db --workdir backend
```
Expected: PASS (100% unit, sanitizer, stroke matcher, mobile opener allowlist, pgTAP RLS, `packs:verify`, build, and Playwright E2E green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AboutPage.tsx desktop/src-tauri/capabilities/default.json mobile/src-tauri/capabilities/default.json tests/mobile/android-release.test.mjs tests/web/kanji-kanjivg.spec.ts
git commit -m "feat(kanji): add KanjiVG CC BY-SA 3.0 attribution, opener allowlist and E2E suite"
```

---

## Phase 2 Epic 10 Release Gate Checklist

- [ ] `SEC-E10-01` / `SEC-T10`: `svgSanitizer.test.ts` + `kanjivg-pack.test.ts` + `KanjiStrokePlayer.test.tsx` xác nhận 0 `dangerouslySetInnerHTML`, chặn 100% `<script>`, `<foreignObject>`, `on*`, `<!ENTITY>`, `d > 2048`, `> 40` nét.
- [ ] `SEC-E10-02` / `SEC-T04` / `SEC-T07`: `user_mnemonics.test.sql` + `mnemonics.test.ts` xác nhận RLS riêng tư + `has_confirmed_email()`, chặn `1001` ký tự & `\0`, và `purgeOwner()` xóa sạch `db.userMnemonics`.
- [ ] `SEC-E10-03`: `strokeMatcher.test.ts` + `strokeMatcherClient.test.ts` xác nhận Worker tải lười (`worker-src 'self'`), 0 request mạng ngoài, chặn `> 40` nét × `500` điểm, tự hủy khi quá `2.000 ms`.
- [ ] License & APK budget: KanjiVG tách khỏi mã `AGPL-3.0-only` dưới dạng gói dữ liệu tĩnh, ghi đủ Ulrich Apel / `CC BY-SA 3.0` tại `/gioi-thieu` + `NOTICE-KANJIVG.txt`, APK cài gốc giữ `<= 30 MB`.
- [ ] E2E & AGENTS invariants: `tests/web/kanji-kanjivg.spec.ts` xanh; `KanjiQuizPage` khi đang thi không link tới `/kanji/tra-cuu`; `pnpm packs:verify` xanh.
