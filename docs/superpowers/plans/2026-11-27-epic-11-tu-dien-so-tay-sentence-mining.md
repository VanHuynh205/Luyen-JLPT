# Epic 11: Từ điển Hợp nhất, Sổ tay Không giới hạn & Khai thác câu 1 chạm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống tra cứu hợp nhất Nhật–Việt / Việt–Nhật (`Ctrl+K`) kèm bộ chia 13 thể động từ thuần TypeScript, gói từ điển mở đã qua kiểm duyệt ngữ nghĩa, popup chạm-để-tra kèm khai thác câu 1 chạm (Sentence Mining Cloze), sổ tay cá nhân đồng bộ Supabase không giới hạn phí kèm xuất/nhập Anki an toàn, đồ thị liên kết chéo Minna và phiếu tập viết Kanji in được.

**Architecture:** Toàn bộ lõi ngôn ngữ (`core/japanese/`), tra cứu hợp nhất (`core/dictionary/`), trích câu Cloze (`core/cloze/`), bộ mã hóa Anki (`core/notebook/ankiCodec.ts`) và đồ thị chéo (`core/content/knowledgeGraph.ts`) nằm thuần trong `frontend/src/core/` không phụ thuộc React hay SDK (`AD-2`). Dữ liệu Sổ tay lưu cục bộ trong Dexie `luyen-jlpt` v4 (`notebooks`, `notebookItems`) và đồng bộ lên Supabase Postgres qua `createProgressSync` với RLS + khóa ngoại kép chống IDOR (`AD-14`, `SEC-E11-01`). Gói từ điển mở `dict-javi-core` được kiểm duyệt tại `infra/scripts/` rồi tải tùy chọn qua `ExtensionPackStore` đã kiểm chứng SHA-256 (`AD-13`, `SEC-E11-03`), giữ APK cơ bản `<= 30 MB` và 0% AI (`AD-18`).

**Tech Stack:** React 19, TypeScript 7, TanStack Router 1.131, Dexie 4.4.7 (`luyen-jlpt` v4), Supabase Postgres (RLS + pgTAP), Tailwind CSS + shadcn/ui (Radix Dialog/Popover/Sheet), Vitest 5.1.1, Playwright 1.65.1, `tsx` (`infra/scripts/`).

**Spec:** `docs/initiative-jlpt-da-nen-tang/mazii-benchmark-va-ke-hoach-phat-trien.md` (`FR-31`, `FR-32`, `FR-34` P2, `FR-35`, `FR-36`, `FR-37`, `FR-38`, `AD-13`, `AD-14`, `AD-18`) và `docs/superpowers/plans/2026-11-27-bao-mat-web-va-app-v2.md` (`SEC-E11-01..03`, `SEC-T04`, `SEC-T07`, `SEC-T11`).

## Global Constraints

- **Phụ thuộc đầu vào từ Epic 8, Epic 9 & Epic 10:** Sử dụng `extensionPackStore: ExtensionPackStore` (`frontend/src/adapters/extensions/index.ts`, gồm `getEntryJson`/`getEntryBlob`), `safeJsonParse` (`frontend/src/core/extensions/validate.ts`), cổng `AudioPort`, `pitch.ts` (`frontend/src/core/audio/`), `PitchBadge` (`frontend/src/components/audio/PitchBadge.tsx`), bảng Dexie v4 `srsCards` (`card_type IN ('vocab', 'kanji', 'compound', 'cloze')`) và `extensionPacks` (`AD-13`, `AD-14`, `AD-15`), cùng `KanjiWritingSheetDialog` từ Epic 10.
- **Ngân sách dung lượng & Hiệu năng:** Bản cài `.apk` Android cơ bản phải giữ `<= 30 MB`; gói `dict-javi-core` là gói mở rộng tùy chọn tải rời qua `extensions-index.json`; tốc độ tra cứu cục bộ `< 50 ms` trên `30.000` mục từ điển.
- **Thuần ngoại tuyến 0% AI (`AD-18`):** Không gọi API Mazii, không gọi LLM hay bất kỳ endpoint ngoài nào khi tra từ, chia động từ, tạo Cloze hoặc xuất/nhập Anki (`0` domain bên thứ ba ngoại tuyến).
- **Bảo toàn dữ liệu & định tuyến N4:** Giữ nguyên toàn bộ `1.182` ID từ vựng, `118` ID kanji, `388` ID từ ghép (từ `403` dòng nguồn) và `148` ID ngữ pháp trong `infra/content/n4/`; giữ nguyên các route tiếng Việt cũ; trang `/ngu-phap/$patternId` tiếp tục chỉ hiển thị `Cách chia`, `Ý nghĩa`, `Cách dùng / Lưu ý`, `Ví dụ` (và `So sánh liên quan`), không thêm quiz vào trang chi tiết ngữ pháp.
- **Bản quyền dữ liệu mở:** Phân phối JMdict/EDICT và Kanjium dưới dạng gói dữ liệu tĩnh tách rời (`dict-javi-core`), ghi đầy đủ nguồn EDRDG (`CC BY-SA 4.0`) và Kanjium (`CC BY-SA 4.0`) trong `/gioi-thieu` và `NOTICE`.
- **Giới hạn bảo mật & chống lạm dụng (`SEC-E11-01..03`):** Tối đa `200` sổ tay/user, `20.000` mục/user, `title` `1..120` ký tự, `description <= 500` ký tự, `note <= 1.000` ký tự, `payload <= 4.096` bytes; khóa ngoại kép `(user_id, notebook_id) -> notebooks(user_id, id)`; xuất CSV/TSV trung hòa `[=+\-@\t\r]`; nhập file `<= 5 MB`, `<= 5.000` dòng, `<= 1.000` ký tự/ô, strip HTML và dùng `safeJsonParse()` (chặn `__proto__`/`constructor`/`prototype`, độ sâu `<= 16`).
- **Thẩm mỹ & Trợ năng Washi & Sumi:** Giao diện tiếng Việt, chữ Nhật gắn `lang="ja"`, vùng chạm tối thiểu `44×44px` ở 360px, tối đa `1` con dấu `.hanko`/màn hình, tương thích cả Sáng và Tối "Sumi đêm".

## Review Focus

1. **Động từ ngoại lệ trong bộ chia 13 thể (`行く`, `来る`, `する`, động từ đuôi `いる/える` nhóm 1 như `帰る`/`走る`/`知る`):** Người dùng tra `行く` mà ra `行いて` thay vì `行って`, hoặc chia `帰る` thành nhóm 2 `帰て` thay vì `帰って`, sẽ học sai căn bản. Khóa bằng unit test chi tiết tại **Task 1**.
2. **Chạm tra từ trong lúc đang làm bài thi có tính giờ (`/luyen-de/$examId` khi `activeStatus === "in_progress"`):** Người dùng bấm nhầm vào từ tiếng Nhật trong câu hỏi khi chưa nộp bài không được mở popup tra nghĩa (tránh lộ đáp án lúc thi thật); popup chỉ kích hoạt ở trạng thái `locked` (`submitted`/`timed_out`) sau khi nộp. Khóa bằng test component tại **Task 5**.
3. **Đồng bộ chéo tài khoản & xóa tài khoản trên máy dùng chung (`purgeOwner` + IDOR `notebook_items`):** Khi đăng xuất/xóa tài khoản `ownerA`, mọi `notebooks` và `notebookItems` cục bộ của `ownerA` phải biến mất hoàn toàn trong cùng transaction mà không đụng dữ liệu `ownerB`, đồng thời Postgres chặn `ownerA` chèn item vào `notebook_id` của `ownerB`. Khóa bằng pgTAP + Vitest tại **Task 6**.
4. **File Anki nhập từ bên ngoài chứa HTML độc hại, công thức Excel, UTF-8 hỏng hoặc `{"__proto__": ...}`:** Nhập tệp Anki có `<img src=x onerror=alert(1)>`, ô `=HYPERLINK(...)`, byte UTF-8 không hợp lệ hoặc tệp `> 5 MB` không được làm sập tab, không thực thi mã và phải báo lỗi tiếng Việt rõ ràng. Khóa bằng test bảo mật `SEC-T11` tại **Task 7**.
5. **Từ điển mở rộng chưa tải hoặc bị sửa byte (`dict-javi-core` vắng mặt / sai SHA-256):** Người dùng chưa tải gói mở rộng hoặc tải gói bị hỏng vẫn phải tra được toàn bộ `1.182` từ vựng, `118` kanji, `388` từ ghép, `148` ngữ pháp Minna N4 trong `< 50 ms` mà không treo UI hay ném lỗi chưa bắt. Khóa bằng test fallback tại **Task 2** và **Task 3**.

---

### Task 1: Bộ chia 13 thể động từ/tính từ thuần TypeScript & Chuẩn hóa tìm kiếm hợp nhất

**Files:**
- Create: `frontend/src/core/japanese/normalize.ts`
- Create: `frontend/src/core/japanese/conjugate.ts`
- Modify: `frontend/src/components/kanji-library/search.ts:1-20`
- Test: `frontend/src/core/japanese/conjugate.test.ts`
- Test: `frontend/src/core/japanese/normalize.test.ts`

**Interfaces:**
- Consumes: `normalize` behavior từ `frontend/src/components/kanji-library/search.ts:4-18` (giữ nguyên chuẩn bỏ dấu tiếng Việt, giữ dakuten/handakuten `\u3099`/`\u309a`, đổi Katakana `ァ-ヶ` sang Hiragana).
- Produces:
  - `normalizeQuery(value: string): string` và `romajiToHiragana(value: string): string` từ `frontend/src/core/japanese/normalize.ts`.
  - `export type WordClass = "v1" | "v2" | "v3-suru" | "v3-kuru" | "adj-i" | "adj-na";`
  - `export type ConjugationFormKey = "dictionary" | "masu" | "nai" | "ta" | "te" | "nakatta" | "potential" | "passive" | "causative" | "causativePassive" | "volitional" | "imperative" | "conditionalBa" | "conditionalTara";`
  - `export interface ConjugationRow { key: ConjugationFormKey; labelVi: string; labelJa: string; form: string; reading?: string; conjugationRuleId?: string; }`
  - `export function conjugateJapanese(word: string, reading: string, wordClass: WordClass): ConjugationRow[]`
  - `export function inferWordClass(word: string, reading: string, wordType?: string): WordClass | null`

- [ ] **Step 1: Write the failing tests**

Tạo `frontend/src/core/japanese/normalize.test.ts` kiểm tra:
```ts
import { describe, expect, it } from "vitest";
import { normalizeQuery, romajiToHiragana } from "./normalize";

describe("normalizeQuery & romajiToHiragana", () => {
  it("strips Vietnamese diacritics and folds katakana to hiragana while preserving dakuten", () => {
    expect(normalizeQuery("Đọc Hiểu ガッコウ")).toBe("doc hieu がっこう");
    expect(normalizeQuery("食べます")).toBe("食べます");
  });

  it("converts Hepburn romaji including sokuon and n-apostrophe to hiragana", () => {
    expect(romajiToHiragana("taberu")).toBe("たべる");
    expect(romajiToHiragana("gakkou")).toBe("がっこう");
    expect(romajiToHiragana("shimbun")).toBe("しんぶん");
  });
});
```

Tạo `frontend/src/core/japanese/conjugate.test.ts` khóa Review Focus #1 (13 thể cho V1, V2, V3 và ngoại lệ `行く`, `来る`, `する`, `帰る`, `ある`, `いい`):
```ts
import { describe, expect, it } from "vitest";
import { conjugateJapanese, inferWordClass } from "./conjugate";

describe("conjugateJapanese (13 forms + exceptions)", () => {
  it("generates all 13 conjugated forms beyond dictionary form for ichidan verb 食べる", () => {
    const rows = conjugateJapanese("食べる", "たべる", "v2");
    expect(rows).toHaveLength(14);
    expect(Object.fromEntries(rows.map((r) => [r.key, r.form]))).toMatchObject({
      dictionary: "食べる",
      masu: "食べます",
      nai: "食べない",
      ta: "食べた",
      te: "食べて",
      nakatta: "食べなかった",
      potential: "食べられる",
      passive: "食べられる",
      causative: "食べさせる",
      causativePassive: "食べさせられる",
      volitional: "食べよう",
      imperative: "食べろ",
      conditionalBa: "食べれば",
      conditionalTara: "食べたら",
    });
  });

  it("handles godan exceptions 行く, 帰る (not ichidan), and ある", () => {
    const iku = Object.fromEntries(
      conjugateJapanese("行く", "いく", "v1").map((r) => [r.key, r.form]),
    );
    expect(iku.te).toBe("行って");
    expect(iku.ta).toBe("行った");
    expect(iku.conditionalTara).toBe("行ったら");

    const kaeru = Object.fromEntries(
      conjugateJapanese("帰る", "かえる", "v1").map((r) => [r.key, r.form]),
    );
    expect(kaeru.te).toBe("帰って");
    expect(kaeru.nai).toBe("帰らない");

    const aru = Object.fromEntries(
      conjugateJapanese("ある", "ある", "v1").map((r) => [r.key, r.form]),
    );
    expect(aru.nai).toBe("ない");
    expect(aru.nakatta).toBe("なかった");
  });

  it("handles irregular v3-suru, v3-kuru and adj-i いい", () => {
    const kuru = Object.fromEntries(
      conjugateJapanese("来る", "くる", "v3-kuru").map((r) => [r.key, r.reading]),
    );
    expect(kuru.nai).toBe("こない");
    expect(kuru.masu).toBe("きます");
    expect(kuru.potential).toBe("こられる");

    const ii = Object.fromEntries(
      conjugateJapanese("いい", "いい", "adj-i").map((r) => [r.key, r.form]),
    );
    expect(ii.nai).toBe("よくない");
    expect(ii.ta).toBe("よかった");
    expect(ii.conditionalBa).toBe("よければ");
  });

  it("infers word class from Minna wordType metadata and godan-ru exception list", () => {
    expect(inferWordClass("帰る", "かえる", "I")).toBe("v1");
    expect(inferWordClass("勉強する", "べんきょうする", "III")).toBe("v3-suru");
    expect(inferWordClass("食べる", "たべる", "II")).toBe("v2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/japanese/`
Expected: FAIL với lỗi không tìm thấy module `./normalize` và `./conjugate`.

- [ ] **Step 3: Implement `normalize.ts`, `conjugate.ts` and re-export from `kanji-library/search.ts`**

- Cài đặt `normalizeQuery` và `romajiToHiragana` trong `frontend/src/core/japanese/normalize.ts` (di chuyển logic từ `frontend/src/components/kanji-library/search.ts:4-18` và để `search.ts` tái xuất `normalizeQuery as normalize` nhằm tránh trùng lặp).
- Cài đặt `conjugateJapanese` và `inferWordClass` trong `frontend/src/core/japanese/conjugate.ts`:
  - Hỗ trợ đủ 13 thể chia (cộng thể từ điển = 14 hàng): `masu`, `nai`, `ta`, `te`, `nakatta`, `potential`, `passive`, `causative`, `causativePassive`, `volitional`, `imperative`, `conditionalBa`, `conditionalTara`.
  - Xử lý rõ danh sách ngoại lệ nhóm I đuôi `-iru/-eru` (`帰る`, `走る`, `知る`, `切る`, `入る`, `要る`, `滑る`, `喋る`, `減る`, `焦る`, `限る`, `握る`), `行く/いく`, `ある`, `問う/請う`, `いらっしゃる/おっしゃる/くださる/なさる/ござる` (đuôi `-います`), `する`/`来る`, tính từ `いい`/`よい`.
  - Gắn `conjugationRuleId` khớp bảng `conjugations.json` (22 quy tắc trong gói N4) để UI liên kết thẳng về `/ngu-phap/cach-chia`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/japanese/ src/components/kanji-library/search.test.ts`
Expected: PASS tất cả test case.

- [ ] **Step 5: Security & QA Gate**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: 0 lỗi TypeScript và Biome; không phát sinh lời gọi mạng hay phụ thuộc React trong `frontend/src/core/japanese/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/japanese/normalize.ts frontend/src/core/japanese/normalize.test.ts frontend/src/core/japanese/conjugate.ts frontend/src/core/japanese/conjugate.test.ts frontend/src/components/kanji-library/search.ts
git commit -m "feat(core): add pure TS 13-form Japanese conjugator and unified query normalizer"
```

---

### Task 2: Đường ống Build & Cổng Kiểm duyệt Ngữ nghĩa Gói Từ điển Mở JA–VI (`dict-javi-core`)

**Files:**
- Modify: `frontend/src/core/extensions/validate.ts` (đảm bảo `safeJsonParse` lọc `__proto__`/`constructor`/`prototype` và giới hạn `maxDepth = 16`)
- Create: `frontend/src/core/dictionary/types.ts`
- Create: `frontend/src/core/dictionary/validate.ts`
- Create: `infra/scripts/src/dict-pack.ts`
- Modify: `infra/scripts/package.json:6-13`
- Test: `frontend/src/core/dictionary/validate.test.ts`
- Test: `infra/scripts/src/dict-pack.test.ts`

**Interfaces:**
- Consumes: `ExtensionPackStore` (`frontend/src/core/extensions/types.ts`), `safeJsonParse` (`frontend/src/core/extensions/validate.ts`), và `writeExtensionsIndex` (`infra/scripts/src/extensions.ts`) từ Epic 9 (`AD-13`); bảng `vocabulary.json` từ `infra/content/n4/` để đối soát ngữ nghĩa Minna.
- Produces:
  - `export function safeJsonParse<T = unknown>(raw: string, maxDepth?: number): T` (tái sử dụng thống nhất từ `frontend/src/core/extensions/validate.ts`, mặc định `maxDepth = 16`, loại bỏ khóa `__proto__`, `constructor`, `prototype`).
  - `export interface DictEntry { id: string; word: string; reading: string; readingNorm: string; hanViet?: string; pitch?: number[]; jlpt?: "n5" | "n4" | "n3" | "n2" | "n1"; wordClass?: WordClass; sensesVi: string[]; examples?: Array<{ ja: string; vi: string }>; source: "jmdict-vi" | "wiktionary-vi"; license: "CC-BY-SA-4.0"; }`
  - `export interface DictPack { id: "dict-javi-core"; version: string; entryCount: number; sha256: string; auditedAt: string; qaSummary: { totalChecked: number; rejectedCount: number; minnaCrossCheckPassRate: number }; entries: DictEntry[]; }`
  - `export function validateDictPack(raw: unknown): Result<DictPack, { code: "schema" | "count-mismatch" | "unsafe-content"; detail: string }>`
  - `export interface SemanticAuditReport { accepted: DictEntry[]; rejected: Array<{ id: string; word: string; reason: string }>; minnaOverlapCount: number; minnaMismatchWarnings: Array<{ word: string; dictVi: string; minnaVi: string }>; }`
  - `export function auditAndBuildDictPack(rawEntries: unknown[], minnaVocab: VocabWord[], kanjiumPitch: Map<string, number[]>): SemanticAuditReport` trong `infra/scripts/src/dict-pack.ts`.

- [ ] **Step 1: Write the failing tests**

Tạo `frontend/src/core/dictionary/validate.test.ts` (khóa `SEC-E11-02`/`SEC-E11-03` và Review Focus #5):
```ts
import { describe, expect, it } from "vitest";
import { safeJsonParse } from "@/core/extensions/validate";
import { validateDictPack } from "./validate";

describe("safeJsonParse & validateDictPack", () => {
  it("strips __proto__, constructor, prototype keys without polluting Object.prototype", () => {
    const parsed = safeJsonParse<Record<string, unknown>>(
      '{"ok":1,"__proto__":{"polluted":true},"nested":{"constructor":{"x":1},"prototype":{"y":2}}}',
    );
    expect(parsed.ok).toBe(1);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, "__proto__")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        parsed.nested as Record<string, unknown>,
        "constructor",
      ),
    ).toBe(false);
  });

  it("throws when JSON nesting exceeds maxDepth (16)", () => {
    const deep = `${"[".repeat(18)}1${"]".repeat(18)}`;
    expect(() => safeJsonParse(deep, 16)).toThrow(/depth/i);
  });

  it("rejects dict pack containing HTML/script tags in Vietnamese senses", () => {
    const res = validateDictPack({
      id: "dict-javi-core",
      version: "1.0.0",
      entryCount: 1,
      sha256: "a".repeat(64),
      auditedAt: "2026-11-27T00:00:00Z",
      qaSummary: { totalChecked: 1, rejectedCount: 0, minnaCrossCheckPassRate: 1 },
      entries: [
        {
          id: "jmd-1",
          word: "食べる",
          reading: "たべる",
          readingNorm: "たべる",
          sensesVi: ["<script>alert(1)</script>ăn"],
          source: "jmdict-vi",
          license: "CC-BY-SA-4.0",
        },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unsafe-content");
  });
});
```

Tạo `infra/scripts/src/dict-pack.test.ts` kiểm tra cổng QA ngữ nghĩa (`FR-35` Quyết định #2):
```ts
import { describe, expect, it } from "vitest";
import { auditAndBuildDictPack } from "./dict-pack";

describe("auditAndBuildDictPack semantic QA gate", () => {
  it("rejects machine-garbled, empty, untranslated English-only, or HTML entries", () => {
    const report = auditAndBuildDictPack(
      [
        { id: "j1", word: "食べる", reading: "たべる", sensesVi: ["ăn"], source: "jmdict-vi", license: "CC-BY-SA-4.0" },
        { id: "j2", word: "走る", reading: "はしる", sensesVi: ["to run quickly"], source: "jmdict-vi", license: "CC-BY-SA-4.0" },
        { id: "j3", word: "飲む", reading: "のむ", sensesVi: ["uống ??? [TODO]"], source: "jmdict-vi", license: "CC-BY-SA-4.0" },
        { id: "j4", word: "見る", reading: "みる", sensesVi: ["<b>xem</b>"], source: "jmdict-vi", license: "CC-BY-SA-4.0" },
      ],
      [{ id: "vocab-1", word: "食べる", reading: "たべる", meaning: "ăn", lesson: 26, section: "từ chính" }],
      new Map([["食べる|たべる", [2]]]),
    );
    expect(report.accepted).toHaveLength(1);
    expect(report.accepted[0].pitch).toEqual([2]);
    expect(report.rejected.map((r) => r.id)).toEqual(["j2", "j3", "j4"]);
    expect(report.minnaOverlapCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/dictionary/validate.test.ts && pnpm --filter @luyen/infra-scripts test -- src/dict-pack.test.ts`
Expected: FAIL vì các module chưa tồn tại.

- [ ] **Step 3: Harden `safeJsonParse` in `core/extensions/validate.ts`, implement `core/dictionary/validate.ts` and `infra/scripts/src/dict-pack.ts`**

- Củng cố `safeJsonParse` trong `frontend/src/core/extensions/validate.ts` dùng reviver lọc khóa nguy hiểm (`__proto__`, `constructor`, `prototype`) kết hợp kiểm tra độ sâu đệ quy (trả về lỗi tường minh nếu sâu `> 16` hoặc JSON hỏng).
- Cài đặt `validateDictPack` trong `frontend/src/core/dictionary/validate.ts`: kiểm tra `id === "dict-javi-core"`, `entryCount === entries.length`, mỗi mục có `sensesVi` khác rỗng không chứa thẻ HTML (`/<[^>]+>/`), không chứa ký tự `\0`, `license === "CC-BY-SA-4.0"`.
- Cài đặt `infra/scripts/src/dict-pack.ts` + script `"dict:build"` và `"dict:audit"` trong `infra/scripts/package.json`:
  - Nhận nguồn mở hợp pháp (JMdict-vi / Wiktionary tiếng Việt mở CC BY-SA 4.0 + bảng cao độ Kanjium CC BY-SA 4.0); tuyệt đối không gọi mạng tới Mazii.
  - Quy tắc cổng QA ngữ nghĩa (`auditAndBuildDictPack`):
    1. Từ chối mọi mục thiếu `reading`, thiếu `sensesVi`, chứa thẻ HTML/script, chứa dấu hiệu dịch lỗi/placeholder (`TODO`, `???`, chuỗi thuần tiếng Anh thiếu dấu/từ vựng tiếng Việt hợp lệ theo từ điển kiểm soát hoặc tỉ lệ ký tự ASCII không dấu dài bất thường).
    2. Gắn cao độ Pitch Accent từ Kanjium theo khóa `word|reading`.
    3. Đối chiếu chéo 100% từ trùng với `infra/content/n4/vocabulary.json` (`1.182` từ): xuất báo cáo sai lệch nghĩa `minnaMismatchWarnings` để biên tập viên duyệt tay trước khi đóng gói và xuất `sha256` vào `extensions-index.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/dictionary/validate.test.ts && pnpm --filter @luyen/infra-scripts test -- src/dict-pack.test.ts`
Expected: PASS 100%.

- [ ] **Step 5: Security & QA Gate (`SEC-E11-03`)**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/infra-scripts typecheck && pnpm --filter @luyen/infra-scripts check`
Expected: PASS, 0 lỗi; `safeJsonParse` chặn được Prototype Pollution và `validateDictPack` từ chối mọi nội dung HTML.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/extensions/validate.ts frontend/src/core/dictionary/types.ts frontend/src/core/dictionary/validate.ts frontend/src/core/dictionary/validate.test.ts infra/scripts/src/dict-pack.ts infra/scripts/src/dict-pack.test.ts infra/scripts/package.json
git commit -m "feat(dictionary): harden safeJsonParse and add semantic-audited JA-VI dictionary pack pipeline"
```

---

### Task 3: Công cụ Tra cứu Hợp nhất `< 50 ms` & Thanh Tìm kiếm Toàn cục `Ctrl+K`

**Files:**
- Create: `frontend/src/core/dictionary/search.ts`
- Create: `frontend/src/hooks/useGlobalSearch.ts`
- Create: `frontend/src/components/dictionary/ConjugationDrawer.tsx`
- Create: `frontend/src/components/dictionary/GlobalSearchDialog.tsx`
- Modify: `frontend/src/components/Layout.tsx:118-198`
- Modify: `frontend/src/pages/AboutPage.tsx:44-63`
- Modify: `desktop/src-tauri/capabilities/default.json:13-29`
- Modify: `mobile/src-tauri/capabilities/default.json:13-23`
- Modify: `tests/mobile/android-release.test.mjs:75-85`
- Test: `frontend/src/core/dictionary/search.test.ts`
- Test: `frontend/src/components/dictionary/GlobalSearchDialog.test.tsx`

**Interfaces:**
- Consumes:
  - `normalizeQuery`, `romajiToHiragana` (`Task 1`); `conjugateJapanese`, `inferWordClass` (`Task 1`); `DictEntry` (`Task 2`).
  - `ContentPack` từ `useContent()` (`frontend/src/hooks/useContent.ts`).
  - `extensionPackStore.getEntryJson<DictPack>("dict-javi-core", "dict.json")` (`frontend/src/adapters/extensions/index.ts`, Epic 9), `PitchBadge` (`frontend/src/components/audio/PitchBadge.tsx`, Epic 9), `pitch.ts` (`frontend/src/core/audio/pitch.ts`, Epic 9) và `AudioPort` (`frontend/src/core/audio/types.ts`, Epic 9).
- Produces:
  - `export type UnifiedSearchHit = { id: string; source: "minna-vocab" | "minna-kanji" | "minna-compound" | "minna-grammar" | "dict-ext"; primary: string; reading?: string; hanViet?: string; meaning: string; lesson?: number; pitch?: number[]; wordClass?: WordClass; rankScore: number; route?: { to: string; params?: Record<string, string> }; }`
  - `export interface UnifiedSearchIndex { search(query: string, limit?: number): UnifiedSearchHit[]; lookupExact(surface: string): UnifiedSearchHit[]; }`
  - `export function buildUnifiedSearchIndex(pack: ContentPack, extEntries?: readonly DictEntry[]): UnifiedSearchIndex`
  - `export function GlobalSearchDialog(): JSX.Element` (lắng nghe `Ctrl+K` / `Cmd+K` và sự kiện mở từ nút kính lúp trên Header/Mobile tab `Tra cứu`).

- [ ] **Step 1: Write the failing tests**

Tạo `frontend/src/core/dictionary/search.test.ts` (khóa ưu tiên Minna + ngân sách `< 50 ms` trên `30.000` mục + Review Focus #5):
```ts
import { describe, expect, it } from "vitest";
import { miniPack } from "@/core/content/__fixtures__/mini-pack";
import type { DictEntry } from "./types";
import { buildUnifiedSearchIndex } from "./search";

describe("buildUnifiedSearchIndex", () => {
  it("ranks Minna curriculum hits ahead of optional dict-javi-core entries and works offline without ext pack", () => {
    const minnaFirst = buildUnifiedSearchIndex(miniPack, undefined);
    expect(minnaFirst.search(miniPack.vocabulary[0].word)[0]?.source).toBe("minna-vocab");

    const ext: DictEntry[] = [
      {
        id: "jmd-dup",
        word: miniPack.vocabulary[0].word,
        reading: miniPack.vocabulary[0].reading,
        readingNorm: miniPack.vocabulary[0].reading,
        sensesVi: [miniPack.vocabulary[0].meaning],
        pitch: [0],
        source: "jmdict-vi",
        license: "CC-BY-SA-4.0",
      },
    ];
    const combined = buildUnifiedSearchIndex(miniPack, ext);
    const hits = combined.search(miniPack.vocabulary[0].word);
    expect(hits[0].source).toBe("minna-vocab");
    expect(hits[0].lesson).toBe(miniPack.vocabulary[0].lesson);
  });

  it("completes prefix & Vietnamese reverse lookup under 50ms on 30,000 entries", () => {
    const bigDict: DictEntry[] = Array.from({ length: 30_000 }, (_, i) => ({
      id: `jmd-${i}`,
      word: i === 29_999 ? "図書館" : `単語${i}`,
      reading: i === 29_999 ? "としょかん" : `たんご${i}`,
      readingNorm: i === 29_999 ? "としょかん" : `たんご${i}`,
      sensesVi: [i === 29_999 ? "thư viện" : `nghĩa mẫu ${i}`],
      source: "jmdict-vi",
      license: "CC-BY-SA-4.0",
    }));
    const index = buildUnifiedSearchIndex(miniPack, bigDict);
    const t0 = performance.now();
    const hits = index.search("thu vien", 20);
    const elapsed = performance.now() - t0;
    expect(hits.some((h) => h.primary === "図書館")).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });
});
```

Tạo `frontend/src/components/dictionary/GlobalSearchDialog.test.tsx`: kiểm tra bấm `Ctrl+K` mở hộp thoại, gõ từ tiếng Nhật hoặc Việt bỏ dấu hiện kết quả có nút nghe, nút mở bảng chia 13 thể (khi là động từ/tính từ) và link về `/ngu-phap/cach-chia`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/dictionary/search.test.ts src/components/dictionary/GlobalSearchDialog.test.tsx`
Expected: FAIL do các file chưa tồn tại.

- [ ] **Step 3: Implement Unified Search Index, `GlobalSearchDialog`, Header button & License Attribution**

- Cài đặt `buildUnifiedSearchIndex` trong `frontend/src/core/dictionary/search.ts`:
  - Lập chỉ mụcMap chính xác (`exactMap`) + danh sách chuỗi đã `normalizeQuery()` sẵn 1 lần lúc khởi tạo để mọi truy vấn JA→VI, VI→JA (bỏ dấu), Kana và Romaji đạt `< 50 ms` trên `30.000` mục.
  - Xếp hạng: khớp chính xác Minna (`+1000`) > tiền tố Minna (`+600`) > khớp chính xác `dict-ext` (`+400`) > chứa chuỗi Minna (`+300`) > tiền tố/chứa `dict-ext` (`+100`). Luôn gộp Pitch Accent từ `dict-ext` sang kết quả Minna trùng `word|reading`.
- Tái sử dụng `PitchBadge` từ `frontend/src/components/audio/PitchBadge.tsx` (Epic 9, không tạo bản trùng lặp); cài đặt `ConjugationDrawer.tsx` (hiển thị 13 thể từ `conjugateJapanese`, gắn liên kết `/ngu-phap/cach-chia`) và `GlobalSearchDialog.tsx` (`Ctrl+K`/`Cmd+K`, vùng chạm `min-h-11`, có nút `Lưu sổ tay`, nút nghe qua `AudioPort`).
- Gắn nút kính lúp `Tra nhanh (Ctrl+K)` vào `frontend/src/components/Layout.tsx:141-145` (không đổi route cũ).
- Cập nhật `frontend/src/pages/AboutPage.tsx:44-63`: bổ sung ghi nguồn **JMdict/EDICT (EDRDG, CC BY-SA 4.0)** kèm liên kết `<ExternalLink href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">` (Kanjium đã có từ Epic 9), đồng thời bổ sung URL chính xác đó vào `opener:allow-open-url` ở `desktop/src-tauri/capabilities/default.json`, `mobile/src-tauri/capabilities/default.json` và cập nhật assertion tương ứng trong `tests/mobile/android-release.test.mjs:78-82`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/dictionary/ src/components/dictionary/ && node --test tests/mobile/android-release.test.mjs`
Expected: PASS tất cả test, thời gian tìm `30.000` mục `< 50 ms`, opener allowlist khớp `android-release.test.mjs`.

- [ ] **Step 5: Security & QA Gate**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: PASS; kiểm tra tĩnh không có `dangerouslySetInnerHTML`, không có fetch ra ngoài khi tìm kiếm.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/dictionary/search.ts frontend/src/core/dictionary/search.test.ts frontend/src/hooks/useGlobalSearch.ts frontend/src/components/dictionary/ frontend/src/components/Layout.tsx frontend/src/pages/AboutPage.tsx desktop/src-tauri/capabilities/default.json mobile/src-tauri/capabilities/default.json tests/mobile/android-release.test.mjs
git commit -m "feat(dictionary): add unified Ctrl+K search, 13-form conjugation view, and JMdict attribution"
```

---

### Task 4: Đồ thị Liên kết Chéo Minna (Minna Knowledge Graph Cross-Links)

**Files:**
- Create: `frontend/src/core/content/knowledgeGraph.ts`
- Create: `frontend/src/components/lookup/MinnaCrossLinks.tsx`
- Modify: `infra/scripts/src/build-packs.ts:98-116`
- Test: `frontend/src/core/content/knowledgeGraph.test.ts`

**Interfaces:**
- Consumes: `ContentPack` (`vocabulary`, `kanji`, `compounds`, `grammar`, `comparisons`, `conjugations`, `keigo`, `verbPairs`, `reading`), `buildComparisonLinks` (`frontend/src/core/content/comparisonLinks.ts:355-401`).
- Produces:
  - `export type CrossLinkTarget = { kind: "lesson" | "kanji" | "grammar" | "comparison" | "conjugation" | "keigo" | "verb-pair"; label: string; badge: string; to: string; params?: Record<string, string>; search?: Record<string, string>; }`
  - `export interface MinnaKnowledgeGraph { forWord(word: string, reading?: string): CrossLinkTarget[]; forKanji(kanjiChar: string): CrossLinkTarget[]; forGrammarId(grammarId: string): CrossLinkTarget[]; forSentence(sentenceJa: string): CrossLinkTarget[]; }`
  - `export function buildMinnaKnowledgeGraph(pack: ContentPack): MinnaKnowledgeGraph`

- [ ] **Step 1: Write the failing test**

Tạo `frontend/src/core/content/knowledgeGraph.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { miniPack } from "./__fixtures__/mini-pack";
import { buildMinnaKnowledgeGraph } from "./knowledgeGraph";

describe("buildMinnaKnowledgeGraph", () => {
  it("links transitive/intransitive verb pairs, keigo, Minna lesson, and kanji from a single surface word", () => {
    const graph = buildMinnaKnowledgeGraph(miniPack);
    const vp = miniPack.verbPairs[0];
    const links = graph.forWord(vp.transitiveJa, vp.transitiveKana);
    expect(links.some((l) => l.kind === "verb-pair" && l.to === "/ngu-phap/tu-dong-tha-dong")).toBe(true);
  });

  it("links grammar patterns back to their related comparisons without duplicating comparisonLinks logic", () => {
    const graph = buildMinnaKnowledgeGraph(miniPack);
    const firstGrammar = miniPack.grammar[0];
    const links = graph.forGrammarId(firstGrammar.id);
    expect(links.every((l) => l.to.startsWith("/ngu-phap"))).toBe(true);
  });

  it("extracts deterministic lesson, kanji, and verb-pair cross-links from a Japanese reading sentence", () => {
    const graph = buildMinnaKnowledgeGraph(miniPack);
    const sampleVocab = miniPack.vocabulary[0];
    const sentenceLinks = graph.forSentence(`今日は${sampleVocab.word}を使います。`);
    expect(sentenceLinks.some((l) => l.kind === "lesson")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/core/content/knowledgeGraph.test.ts`
Expected: FAIL do `./knowledgeGraph` chưa tồn tại.

- [ ] **Step 3: Implement `knowledgeGraph.ts`, `MinnaCrossLinks.tsx`, and build-pack summary report**

- Cài đặt `buildMinnaKnowledgeGraph(pack)` trong `frontend/src/core/content/knowledgeGraph.ts`:
  - Lập chỉ mục 2 chiều hoàn toàn xác định (0% AI) từ `pack`: từ vựng ↔ bài Minna (`/tu-vung`), chữ Kanji ↔ họ từ ghép & bài học (`/kanji/tra-cuu`), động từ ↔ `verbPairs` (`/ngu-phap/tu-dong-tha-dong`) & `keigo` (`/ngu-phap/kinh-ngu`) & `conjugations` (`/ngu-phap/cach-chia`), mẫu ngữ pháp ↔ `buildComparisonLinks()` (`/ngu-phap/so-sanh/$comparisonId`).
- Cài đặt `MinnaCrossLinks.tsx`: hiển thị tối đa 6 chip liên kết 1 chạm (`min-h-11`, `lang="ja"` cho nhãn tiếng Nhật) để nhúng trong `GlobalSearchDialog`, `WordLookupHost` và `ReadingDetailPage`.
- Mở rộng `infra/scripts/src/build-packs.ts` in thống kê kiểm chứng số cạnh đồ thị Minna khi chạy `pnpm packs:build` (không làm thay đổi schema hay làm hỏng `manifest.json` của N4).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @luyen/frontend test -- src/core/content/knowledgeGraph.test.ts && pnpm --filter @luyen/infra-scripts test -- src/build-packs.test.ts`
Expected: PASS.

- [ ] **Step 5: Security & QA Gate**

Run: `pnpm packs:verify && pnpm --filter @luyen/frontend typecheck`
Expected: `packs:verify` xanh 100%, giữ nguyên 1.182/118/388/148/403 N4.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/content/knowledgeGraph.ts frontend/src/core/content/knowledgeGraph.test.ts frontend/src/components/lookup/MinnaCrossLinks.tsx infra/scripts/src/build-packs.ts
git commit -m "feat(content): build deterministic Minna knowledge graph cross-links"
```

---

### Task 5: Popup Chạm-để-tra (Click-to-Lookup) & Khai thác câu 1 chạm (Sentence Mining Cloze)

**Files:**
- Create: `frontend/src/core/cloze/extract.ts`
- Create: `frontend/src/components/lookup/InteractiveJaText.tsx`
- Create: `frontend/src/components/lookup/WordLookupHost.tsx`
- Modify: `frontend/src/pages/ReadingDetailPage.tsx:126-138`
- Modify: `frontend/src/pages/GrammarDetailPage.tsx:215-247`
- Modify: `frontend/src/pages/ExamRunnerPage.tsx:790-860`
- Modify: `frontend/src/components/exam/ExamQuestionCard.tsx:46-55,187-238`
- Test: `frontend/src/core/cloze/extract.test.ts`
- Test: `frontend/src/components/lookup/WordLookupHost.test.tsx`

**Interfaces:**
- Consumes:
  - `UnifiedSearchIndex` (`Task 3`), `MinnaKnowledgeGraph` (`Task 4`), `conjugateJapanese` (`Task 1`).
  - `parseRubyText` (`frontend/src/core/exam/ruby.ts:83-88`).
  - `AudioPort` (`frontend/src/core/audio/types.ts`, Epic 9), `srsStore` (`frontend/src/adapters/local-store/srs.ts`, Epic 8 `srsCards` với `card_type: "cloze"`), `useFuriganaPreference` (Epic 7) và `useMasteredKanji` (`frontend/src/hooks/useMasteredKanji.ts`, Epic 8).
  - `notebookStore.upsertItem` (`Task 6`, nhận qua prop/hook adapter để không tạo phụ thuộc vòng).
- Produces:
  - `export interface ClozeCardPayload { sentenceJa: string; clozeJa: string; targetWord: string; targetReading?: string; hanViet?: string; meaningVi: string; sentenceTranslationVi?: string; sourceLabel: string; audioKey?: string; }`
  - `export function extractSentenceCloze(params: { fullText: string; targetWord: string; offsetHint?: number; meaningVi: string; targetReading?: string; hanViet?: string; sentenceTranslationVi?: string; sourceLabel: string; audioKey?: string; }): ClozeCardPayload`
  - `export function InteractiveJaText(props: { text: string; enabled: boolean; furiganaMode?: "all" | "adaptive" | "off"; mastered?: ReadonlySet<string>; sourceLabel: string; sentenceTranslationVi?: string; audioKey?: string; onSelectWord: (ctx: { surface: string; sentenceJa: string; sourceLabel: string; sentenceTranslationVi?: string; audioKey?: string }) => void; className?: string; }): JSX.Element`
  - `export function WordLookupHost(props: { selection: LookupSelection | null; onClose: () => void; onSaveToNotebook: (item: NotebookItemDraft) => Promise<void>; onCreateCloze: (payload: ClozeCardPayload) => Promise<void>; }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

Tạo `frontend/src/core/cloze/extract.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractSentenceCloze } from "./extract";

describe("extractSentenceCloze", () => {
  it("extracts exact Japanese sentence delimited by 。！？ and replaces target word with 【 ___ 】", () => {
    const payload = extractSentenceCloze({
      fullText: "昨日、駅で友達に会いました。一緒に図書館へ行きました。楽しかったです。",
      targetWord: "図書館",
      targetReading: "としょかん",
      hanViet: "ĐỒ THƯ QUÁN",
      meaningVi: "thư viện",
      sentenceTranslationVi: "Chúng tôi cùng nhau đi đến thư viện.",
      sourceLabel: "N4 Đề 02 · Câu 14",
    });
    expect(payload.sentenceJa).toBe("一緒に図書館へ行きました。");
    expect(payload.clozeJa).toBe("一緒に【 ___ 】へ行きました。");
    expect(payload.sourceLabel).toBe("N4 Đề 02 · Câu 14");
  });

  it("strips ruby markup {漢字|かんじ} cleanly before cloze masking", () => {
    const payload = extractSentenceCloze({
      fullText: "毎日{日本語|にほんご}を{勉強|べんきょう}します。",
      targetWord: "勉強",
      meaningVi: "học tập",
      sourceLabel: "Đọc hiểu 01",
    });
    expect(payload.sentenceJa).toBe("毎日日本語を勉強します。");
    expect(payload.clozeJa).toBe("毎日日本語を【 ___ 】します。");
  });
});
```

Tạo `frontend/src/components/lookup/WordLookupHost.test.tsx` khóa Review Focus #2:
- Kiểm tra `ExamQuestionCard` với `locked={false}` (đang thi có đồng hồ) KHÔNG render nút/token chạm tra từ và click vào câu hỏi không mở `WordLookupHost`.
- Kiểm tra `ExamQuestionCard` với `locked={true}` (đã nộp bài) cho phép chạm vào từ để mở `WordLookupHost`, hiển thị Hán Việt, nghĩa, nút `Nghe`, nút `Lưu sổ tay` và nút `Tạo thẻ Cloze` (1 chạm).
- Kiểm tra trên viewport hẹp (`< 768px`), `WordLookupHost` render dạng Bottom Sheet với class `max-h-[45dvh]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/core/cloze/extract.test.ts src/components/lookup/WordLookupHost.test.tsx`
Expected: FAIL vì chưa có file.

- [ ] **Step 3: Implement Cloze extractor, `InteractiveJaText`, `WordLookupHost`, and page integrations**

- Cài đặt `extractSentenceCloze` trong `frontend/src/core/cloze/extract.ts`: loại bỏ cú pháp `{base|reading}` và `[[...]]` trước khi tách câu theo dấu `[。！？\n]`, tìm câu chứa `targetWord` gần `offsetHint` nhất, thay bằng `【 ___ 】`, cắt tối đa `400` ký tự để luôn nằm gọn trong ngân sách payload `<= 4.096` bytes (`SEC-E11-01`).
- Cài đặt `InteractiveJaText.tsx`: tách câu thành các token ứng viên khớp từ điển Minna/mở rộng (longest-match không gọi mạng, không dùng `innerHTML`) giữ nguyên `<RubyText>` khi có furigana; khi `enabled={false}` chỉ render `<RubyText>` thuần.
- Cài đặt `WordLookupHost.tsx`:
  - Desktop (`>= 768px`): Popover nổi gần từ được chọn; Mobile (`< 768px`): Bottom Sheet chiếm tối đa `45%` chiều cao (`max-h-[45dvh]`).
  - Luôn hiện: Chữ Nhật (`lang="ja"`) + Furigana + `PitchBadge`, Âm Hán Việt, Nghĩa tiếng Việt, nút `Nghe`, `MinnaCrossLinks`, accordion `Bảng chia 13 thể` (nếu là động từ/tính từ), nút `Lưu sổ tay` và nút `Tạo thẻ Cloze` (đẩy thẳng vào FSRS `srsCards` loại `cloze` + sổ tay mặc định `"Câu khai thác"`).
- Tích hợp vào:
  - `frontend/src/pages/ReadingDetailPage.tsx:126-138`: giữ nguyên `useFuriganaPreference` (Epic 7) và `useMasteredKanji` (Epic 8); truyền `text={furiganaMode === "off" ? passage.text : (passage.textRuby ?? passage.text)}`, `furiganaMode`, `mastered`, `enabled={true}`, `sourceLabel={passage.title}` vào `InteractiveJaText`.
  - `frontend/src/pages/GrammarDetailPage.tsx:215-247`: giữ nguyên `useFuriganaPreference` + `useMasteredKanji`; gắn `InteractiveJaText` với `text={furiganaMode === "off" ? example.japanese : (example.reading || example.japanese)}`, `furiganaMode` và `mastered` trong mục `Ví dụ` (tuyệt đối không thêm quiz hay thay đổi 4 phần cốt lõi của trang chi tiết ngữ pháp).
  - `frontend/src/pages/ExamRunnerPage.tsx:790-860` và `frontend/src/components/exam/ExamQuestionCard.tsx:46-55,187-238`: gắn `WordLookupHost` ở cấp phiên xem lại đề thi (`ExamRunnerPage`) và truyền `enabled={locked}` cho `promptText`/`scriptText` trong `ExamQuestionCard` để chỉ cho phép tra từ + Cloze sau khi nộp bài (`submitted`/`timed_out`), khóa tuyệt đối lúc đang đếm giờ (`in_progress`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/core/cloze/ src/components/lookup/ src/pages/ReadingDetailPage.test.tsx`
Expected: PASS tất cả test, kể cả test Review Focus #2 (khóa tra từ khi `locked={false}`).

- [ ] **Step 5: Security & QA Gate**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: PASS; kiểm tra không còn dùng `innerHTML`/`dangerouslySetInnerHTML`, tất cả nút trên sheet đạt `min-h-11` (`44px`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/cloze/ frontend/src/components/lookup/ frontend/src/pages/ReadingDetailPage.tsx frontend/src/pages/GrammarDetailPage.tsx frontend/src/pages/ExamRunnerPage.tsx frontend/src/components/exam/ExamQuestionCard.tsx
git commit -m "feat(lookup): add click-to-lookup popover/sheet and 1-tap sentence mining cloze"
```

---

### Task 6: Sổ tay Cá nhân Không giới hạn (Supabase RLS + Composite FK chống IDOR + Dexie v4 Sync + Ôn FSRS)

**Files:**
- Create: `backend/supabase/migrations/20261127000500_notebooks_and_items.sql`
- Create: `backend/supabase/tests/notebooks.test.sql`
- Create: `frontend/src/core/notebook/types.ts`
- Create: `frontend/src/core/notebook/validate.ts`
- Create: `frontend/src/adapters/local-store/notebooks.ts`
- Modify: `frontend/src/adapters/local-store/db.ts:21-43`
- Modify: `frontend/src/adapters/local-store/progress.ts:167-185`
- Modify: `frontend/src/core/progress/index.ts:26-45`
- Modify: `frontend/src/adapters/supabase-sync/index.ts:14-181`
- Create: `frontend/src/hooks/useNotebooks.ts`
- Create: `frontend/src/pages/NotebooksPage.tsx`
- Modify: `frontend/src/App.tsx:74-166`
- Test: `frontend/src/adapters/local-store/notebooks.test.ts`

**Interfaces:**
- Consumes:
  - `jlpt_private.has_confirmed_email()`, `jlpt_private.lock_progress_writer()` từ `backend/supabase/migrations/20261122000100_profiles_and_progress.sql`.
  - `db` Dexie v4 (`frontend/src/adapters/local-store/db.ts`), `createProgressSync` (`frontend/src/core/sync/index.ts`), FSRS runner (`frontend/src/core/srs/`, Epic 8).
- Produces:
  - Bảng Supabase `public.notebooks` và `public.notebook_items` với khóa ngoại kép `(user_id, notebook_id) REFERENCES public.notebooks(user_id, id) ON DELETE CASCADE` và RLS đầy đủ (`SEC-E11-01`).
  - Bảng Dexie v4 `db.notebooks` và `db.notebookItems` kèm xóa sạch trong `progressStore.purgeOwner(owner)` (`SEC-T04`).
  - `export type NotebookItemType = "vocab" | "kanji" | "compound" | "grammar" | "cloze" | "custom";`
  - `export interface NotebookRecord { id: string; owner: string; title: string; description: string; deletedAt?: string | null; updatedAt: string; }`
  - `export interface NotebookItemRecord { id: string; owner: string; notebookId: string; itemType: NotebookItemType; itemRefId?: string; front: string; reading?: string; hanViet?: string; meaning: string; note: string; payload: Record<string, unknown>; deletedAt?: string | null; updatedAt: string; }`
  - `export const notebookStore: { listNotebooks(owner: string): Promise<NotebookRecord[]>; saveNotebook(owner: string, input: Pick<NotebookRecord, "id" | "title" | "description">): Promise<NotebookRecord>; softDeleteNotebook(owner: string, id: string): Promise<void>; listItems(owner: string, notebookId: string): Promise<NotebookItemRecord[]>; upsertItem(owner: string, item: Omit<NotebookItemRecord, "owner" | "updatedAt">): Promise<NotebookItemRecord>; softDeleteItem(owner: string, itemId: string): Promise<void>; }`
  - Route `/so-tay` (`NotebooksPage.tsx`) cho CRUD sổ tay, lọc/tìm mục và nút **"Ôn FSRS sổ tay này"**.

- [ ] **Step 1: Write the failing tests (pgTAP RLS/IDOR/Cap + Dexie `purgeOwner`)**

Tạo `backend/supabase/tests/notebooks.test.sql` (khóa `SEC-E11-01`, `SEC-T07` và Review Focus #3):
- Test 1: Tài khoản chưa xác nhận email bị từ chối `INSERT` vào `public.notebooks` (`42501`).
- Test 2: User A tạo `notebook_a`; User B không đọc/sửa được `notebook_a` và khi User B thử `INSERT INTO public.notebook_items (id, user_id, notebook_id, ...)` với `user_id = user_b` nhưng `notebook_id = notebook_a` → Postgres chặn cứng bằng vi phạm khóa ngoại kép `(user_id, notebook_id)` (`23503`).
- Test 3: `title` dài `121` ký tự, `description` dài `501` ký tự, `note` dài `1001` ký tự, `item_type = 'invalid'`, hoặc `payload` nặng `> 4096` bytes bị chặn bằng CHECK (`23514`).
- Test 4: Trigger chống lạm dụng chặn tạo sổ tay thứ `201` cho cùng 1 user (`23514` / `P0001`).
- Test 5: LWW bỏ qua bản cập nhật có `client_updated_at <= old.client_updated_at` và client không thể sửa trực tiếp `server_updated_at` (`42501`).

Tạo `frontend/src/adapters/local-store/notebooks.test.ts` (khóa `SEC-T04` và Review Focus #3):
```ts
import { describe, expect, it } from "vitest";
import { db } from "./db";
import { notebookStore } from "./notebooks";
import { progressStore } from "./progress";

describe("notebookStore & purgeOwner isolation", () => {
  it("purges all notebooks and notebookItems of ownerA while preserving ownerB", async () => {
    const nbA = await notebookStore.saveNotebook("owner-a", {
      id: crypto.randomUUID(),
      title: "Bài 38",
      description: "Từ hay quên",
    });
    const nbB = await notebookStore.saveNotebook("owner-b", {
      id: crypto.randomUUID(),
      title: "Giữ nguyên",
      description: "",
    });
    await notebookStore.upsertItem("owner-a", {
      id: crypto.randomUUID(),
      notebookId: nbA.id,
      itemType: "vocab",
      front: "届ける",
      reading: "とどける",
      meaning: "giao đến",
      note: "",
      payload: {},
    });

    await progressStore.purgeOwner("owner-a");

    expect(await db.notebooks.where("owner").equals("owner-a").count()).toBe(0);
    expect(await db.notebookItems.where("owner").equals("owner-a").count()).toBe(0);
    expect(await db.notebooks.where("owner").equals("owner-b").count()).toBe(1);
    expect((await notebookStore.listNotebooks("owner-b"))[0]?.id).toBe(nbB.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/notebooks.test.ts`
Expected: FAIL vì `./notebooks` và bảng Dexie `notebooks`/`notebookItems` chưa tồn tại.

- [ ] **Step 3: Implement Supabase migration, Dexie v4 store, Sync wiring, and `/so-tay` UI**

- Viết `backend/supabase/migrations/20261127000500_notebooks_and_items.sql`:
  - `public.notebooks`: `id uuid primary key` (CHECK UUID v4), `user_id uuid not null references auth.users(id) on delete cascade`, `title text not null check (char_length(title) between 1 and 120 and position(chr(0) in title) = 0)`, `description text not null default '' check (char_length(description) <= 500 and position(chr(0) in description) = 0)`, `deleted_at timestamptz`, `client_updated_at timestamptz not null`, `server_updated_at timestamptz not null`, `unique (user_id, id)`.
  - `public.notebook_items`: `id uuid primary key` (CHECK UUID v4), `user_id uuid not null`, `notebook_id uuid not null`, `foreign key (user_id, notebook_id) references public.notebooks(user_id, id) on delete cascade`, `item_type text not null check (item_type in ('vocab', 'kanji', 'compound', 'grammar', 'cloze', 'custom'))`, `item_ref_id text check (item_ref_id is null or char_length(item_ref_id) between 1 and 128)`, `front text not null check (char_length(front) between 1 and 200)`, `reading text not null default '' check (char_length(reading) <= 200)`, `han_viet text not null default '' check (char_length(han_viet) <= 120)`, `meaning text not null check (char_length(meaning) between 1 and 500)`, `note text not null default '' check (char_length(note) <= 1000 and position(chr(0) in note) = 0)`, `payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4096)`, `deleted_at timestamptz`, `client_updated_at timestamptz not null`, `server_updated_at timestamptz not null`.
  - Tạo hàm trigger `jlpt_private.apply_notebook_write()` riêng (KHÔNG dùng lại `apply_progress_write()` vốn đọc `new.item_id`/`new.level`): cấp `server_updated_at` đơn điệu, áp LWW theo `client_updated_at`, khóa bất biến `(user_id, id)` (và `(user_id, notebook_id)` trên items), đồng thời kiểm tra giới hạn chống lạm dụng `<= 200` sổ tay đang hoạt động và `<= 20.000` mục đang hoạt động cho mỗi `user_id`.
  - Bật RLS (`user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email())`), `REVOKE ALL` và chỉ `GRANT SELECT/INSERT/UPDATE` trên các cột dữ liệu (cấm ghi `server_updated_at`).
- Mở rộng Dexie v4 trong `frontend/src/adapters/local-store/db.ts` bảo đảm có `notebooks: "id, owner, [owner+updatedAt]"` và `notebookItems: "id, owner, [owner+notebookId], [owner+notebookId+itemType], [owner+itemType]"`.
- Cập nhật `progressStore` (`frontend/src/adapters/local-store/progress.ts`):
  - Mở rộng `purgeOwner(owner)` (`L167-185`) xóa cả `db.notebooks` và `db.notebookItems` của `owner` trong cùng transaction Dexie v4.
  - Định tuyến thao tác `write` / `applyPulledPage` / `mergeGuest` cho `kind === "notebooks"` sang `db.notebooks` và `kind === "notebook_items"` sang `db.notebookItems` (không nhét vào bảng `db.progress` vốn đòi khóa `[owner+level+kind+id]`).
- Nối `notebooks` và `notebook_items` vào `frontend/src/core/progress/index.ts` và `frontend/src/adapters/supabase-sync/index.ts` với cấu hình `hasLevel: false` (vì `public.notebooks` và `public.notebook_items` không có cột `level`):
  - `core/progress/index.ts`: bổ sung nhánh `ProgressRow` không yêu cầu `level` cho `"notebooks"` và `"notebook_items"`, bỏ qua kiểm tra `LEVELS.includes(row.level)` khi `hasLevel === false`, kiểm tra UUID v4 và giới hạn độ dài/payload (`SEC-E11-01`).
  - `supabase-sync/index.ts`: tham số hóa metadata theo `ProgressKind` (`{ hasLevel, onConflict, ignoreDuplicates, cursorIdColumn }`); với `"notebooks"` và `"notebook_items"`, đặt `hasLevel: false` (chỉ `select("user_id,client_updated_at,server_updated_at,...")`), `onConflict: "id"`, `ignoreDuplicates: false` (LWW upsert), `cursorIdColumn: "id"`, và giữ giới hạn lô `<= 100` bản ghi/request.
- Tạo trang `/so-tay` (`frontend/src/pages/NotebooksPage.tsx`, đăng ký trong `frontend/src/App.tsx`): tạo/sửa/xóa mềm sổ tay, xem danh sách mục (từ, kanji, ngữ pháp, Cloze), và nút **"Ôn FSRS sổ tay này"** nạp trực tiếp tập thẻ vào trình ôn FSRS (Epic 8).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @luyen/frontend test -- src/adapters/local-store/notebooks.test.ts src/adapters/supabase-sync/index.test.ts`
Expected: PASS 100%.

- [ ] **Step 5: Security & QA Gate (`SEC-E11-01`, `SEC-T04`, `SEC-T07`)**

Run: `supabase test db --workdir backend` (chạy `backend/supabase/tests/notebooks.test.sql`) và `pnpm --filter @luyen/frontend typecheck`
Expected: Toàn bộ pgTAP assertions (IDOR FK kép, RLS unconfirmed email, giới hạn 200 sổ / 20.000 mục, CHECK payload `<= 4096B`, LWW) PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/supabase/migrations/20261127000500_notebooks_and_items.sql backend/supabase/tests/notebooks.test.sql frontend/src/core/notebook/types.ts frontend/src/core/notebook/validate.ts frontend/src/adapters/local-store/notebooks.ts frontend/src/adapters/local-store/notebooks.test.ts frontend/src/adapters/local-store/db.ts frontend/src/adapters/local-store/progress.ts frontend/src/core/progress/index.ts frontend/src/adapters/supabase-sync/index.ts frontend/src/hooks/useNotebooks.ts frontend/src/pages/NotebooksPage.tsx frontend/src/App.tsx
git commit -m "feat(notebook): add unlimited synced notebooks with composite-FK IDOR defense and FSRS study"
```

---

### Task 7: Xuất/Nhập Anki `.tsv` / `.csv` / `.json` với Phòng vệ Formula Injection & Prototype Pollution

**Files:**
- Create: `frontend/src/core/notebook/ankiCodec.ts`
- Create: `frontend/src/components/notebook/AnkiTransferDialog.tsx`
- Modify: `frontend/src/pages/NotebooksPage.tsx`
- Test: `frontend/src/core/notebook/ankiCodec.test.ts`

**Interfaces:**
- Consumes: `safeJsonParse` (`Task 2`), `NotebookItemRecord` & `notebookStore` (`Task 6`).
- Produces:
  - `export const ANKI_IMPORT_LIMITS = { maxBytes: 5 * 1024 * 1024, maxRows: 5_000, maxCellChars: 1_000 } as const;`
  - `export function neutralizeFormulaCell(value: string): string`
  - `export function stripHtmlToPlainText(value: string): string`
  - `export function exportNotebookAnki(items: readonly NotebookItemRecord[], format: "tsv" | "csv" | "json", deckTag: string): { filename: string; mimeType: string; content: string }`
  - `export function parseAnkiImportBytes(bytes: Uint8Array, format: "tsv" | "csv" | "json"): Result<Array<Pick<NotebookItemRecord, "itemType" | "front" | "reading" | "hanViet" | "meaning" | "note" | "payload">>, { code: "too-large" | "invalid-utf8" | "too-many-rows" | "cell-too-long" | "malformed"; detail: string }>`

- [ ] **Step 1: Write the failing tests (`SEC-E11-02`, `SEC-T11` & Review Focus #4)**

Tạo `frontend/src/core/notebook/ankiCodec.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  ANKI_IMPORT_LIMITS,
  exportNotebookAnki,
  neutralizeFormulaCell,
  parseAnkiImportBytes,
  stripHtmlToPlainText,
} from "./ankiCodec";

describe("ankiCodec security & Anki compatibility (SEC-T11)", () => {
  it("neutralizes leading formula triggers (=, +, -, @, tab, CR) even after leading spaces", () => {
    expect(neutralizeFormulaCell("=1+1")).toBe("'=1+1");
    expect(neutralizeFormulaCell("  +cmd|' /C calc'!A0")).toBe("'  +cmd|' /C calc'!A0");
    expect(neutralizeFormulaCell("-2+3")).toBe("'-2+3");
    expect(neutralizeFormulaCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormulaCell("thư viện")).toBe("thư viện");
  });

  it("adds UTF-8 BOM on CSV export and escapes tabs/newlines on TSV export", () => {
    const item = {
      id: "1",
      owner: "u1",
      notebookId: "n1",
      itemType: "vocab" as const,
      front: "食べる",
      reading: "たべる",
      hanViet: "THỰC",
      meaning: "=ăn\tngon\ncơm",
      note: "+ghi chú",
      payload: {},
      updatedAt: "2026-11-27T00:00:00Z",
    };
    const csv = exportNotebookAnki([item], "csv", "minna-n4");
    expect(csv.content.startsWith("\uFEFF")).toBe(true);
    expect(csv.content).toContain("'=ăn");
    expect(csv.content).toContain("'+ghi chú");

    const tsv = exportNotebookAnki([item], "tsv", "minna-n4");
    const lines = tsv.content.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1].split("\t")).toHaveLength(7);
  });

  it("strips HTML tags, blocks prototype pollution JSON, rejects >5MB, >5000 rows, and invalid UTF-8", () => {
    expect(stripHtmlToPlainText('<b>ăn</b><img src=x onerror="alert(1)">')).toBe("ăn");

    const polluted = new TextEncoder().encode(
      '{"__proto__":{"polluted":true},"items":[{"front":"猫","reading":"ねこ","meaning":"<i>mèo</i>"}]}',
    );
    const jsonRes = parseAnkiImportBytes(polluted, "json");
    expect(jsonRes.ok).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    if (jsonRes.ok) expect(jsonRes.value[0].meaning).toBe("mèo");

    const oversized = new Uint8Array(ANKI_IMPORT_LIMITS.maxBytes + 1);
    const sizeRes = parseAnkiImportBytes(oversized, "tsv");
    expect(sizeRes.ok).toBe(false);
    if (!sizeRes.ok) expect(sizeRes.error.code).toBe("too-large");

    const badUtf8 = new Uint8Array([0xff, 0xfe, 0xfd]);
    const utf8Res = parseAnkiImportBytes(badUtf8, "csv");
    expect(utf8Res.ok).toBe(false);
    if (!utf8Res.ok) expect(utf8Res.error.code).toBe("invalid-utf8");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/core/notebook/ankiCodec.test.ts`
Expected: FAIL vì `ankiCodec.ts` chưa tồn tại.

- [ ] **Step 3: Implement `ankiCodec.ts` and `AnkiTransferDialog.tsx`**

- Cài đặt `frontend/src/core/notebook/ankiCodec.ts`:
  - Các cột xuất chuẩn Anki (7 cột): `Kanji`, `Furigana`, `HanViet`, `Nghia`, `ViDu`, `GhiChu`, `Tag`.
  - `neutralizeFormulaCell`: nếu `/^[\s]*[=+\-@\t\r]/` khớp thì thêm tiền tố `'`.
  - `.csv`: mã hóa RFC 4180 có dấu ngoặc kép + BOM `\uFEFF` đầu tệp để Excel không lỗi font tiếng Nhật/Việt.
  - `.tsv`: thay mọi `\t`, `\r`, `\n` trong ô bằng khoảng trắng trước khi ghép bằng `\t` để không vỡ cấu trúc cột Anki.
  - `parseAnkiImportBytes`: kiểm `bytes.byteLength <= 5 * 1024 * 1024` trước tiên; giải mã bằng `new TextDecoder("utf-8", { fatal: true })`; kiểm số dòng `<= 5_000`, mỗi ô `<= 1_000` ký tự; gọi `safeJsonParse(..., 16)` cho JSON; gọi `stripHtmlToPlainText()` trên mọi trường chuỗi.
- Cài đặt `AnkiTransferDialog.tsx` gắn vào `NotebooksPage.tsx`: cho xuất 1 chạm (`.tsv` khuyên dùng cho Anki, `.csv` cho Excel, `.json` sao lưu đầy đủ) và nhập file có xem trước 5 dòng đầu + hiển thị rõ lỗi tiếng Việt nếu tệp bị từ chối.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @luyen/frontend test -- src/core/notebook/ankiCodec.test.ts`
Expected: PASS 100%.

- [ ] **Step 5: Security & QA Gate (`SEC-E11-02`, `SEC-T11`)**

Run: `pnpm --filter @luyen/frontend typecheck && pnpm --filter @luyen/frontend check`
Expected: PASS; xác minh không có `innerHTML` hay `eval`, mọi ca `SEC-T11` xanh.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/notebook/ankiCodec.ts frontend/src/core/notebook/ankiCodec.test.ts frontend/src/components/notebook/AnkiTransferDialog.tsx frontend/src/pages/NotebooksPage.tsx
git commit -m "feat(notebook): add Anki TSV/CSV/JSON export and import with formula-injection defense"
```

---

### Task 8: Nối Phiếu Tập viết Kanji từ Sổ tay (`FR-34` P2) & Kiểm thử E2E Epic 11

**Files:**
- Modify: `frontend/src/pages/NotebooksPage.tsx` (thêm nút `"In phiếu tập viết Kanji từ sổ tay"` gọi `KanjiWritingSheetDialog` từ Epic 10)
- Create: `tests/web/dictionary-notebooks.spec.ts`
- Test: `frontend/src/pages/NotebooksPage.test.tsx`

**Interfaces:**
- Consumes: `KanjiWritingSheetDialog` (`frontend/src/components/kanji-library/KanjiWritingSheetDialog.tsx`, Epic 10, render SVG thuần JSX và cấm `dangerouslySetInnerHTML`), `NotebookItemRecord` (`Task 6`), `KanjiEntry` (`frontend/src/core/content/types.ts`).
- Produces:
  - Tích hợp in phiếu tập viết Genkoyoshi cho tập chữ Kanji đã lưu trong bất kỳ Sổ tay cá nhân nào (tái sử dụng `KanjiWritingSheetDialog` từ Epic 10, không nhân bản mã in) và bộ kiểm thử E2E Playwright bao phủ toàn bộ Epic 11.

- [ ] **Step 1: Write the failing unit & E2E tests**

Tạo `frontend/src/pages/NotebooksPage.test.tsx`: kiểm tra sổ tay có các mục `itemType: "kanji"` hiển thị nút `"In phiếu tập viết Kanji"` (`min-h-11`), mở `KanjiWritingSheetDialog` với đúng danh sách Kanji trong sổ tay, gắn `lang="ja"`, và không chứa `<script>` hay `dangerouslySetInnerHTML`.

Tạo `tests/web/dictionary-notebooks.spec.ts` kiểm tra trọn vòng khép kín Phase 3 (offline):
1. Mở `/doc-hieu/reading-01` ở trạng thái ngoại tuyến (`context.setOffline(true)`), chạm vào 1 động từ trong bài đọc → mở `WordLookupHost` hiện nghĩa, âm Hán Việt, bảng chia 13 thể → bấm `Tạo thẻ Cloze`.
2. Bấm `Ctrl+K` → gõ tiếng Việt bỏ dấu `"thu vien"` hoặc từ N4 → hiện kết quả Minna xếp đầu, điều hướng được sang liên kết chéo Minna.
3. Mở `/so-tay` → thấy thẻ Cloze vừa khai thác trong sổ tay → xuất tệp `.tsv` kiểm tra không lỗi font tiếng Nhật/Việt và công thức nguy hiểm bị trung hòa.
4. Mở `/luyen-de/$examId` đang làm dở (`in_progress`) → xác nhận chạm từ KHÔNG mở popup tra từ; sau khi nộp phần → chạm từ mở được popup.

- [ ] **Step 2: Run unit test to verify it fails**

Run: `pnpm --filter @luyen/frontend test -- src/pages/NotebooksPage.test.tsx`
Expected: FAIL vì nút in phiếu tập viết trên `NotebooksPage.tsx` chưa được nối.

- [ ] **Step 3: Wire `KanjiWritingSheetDialog` into `NotebooksPage.tsx` and complete E2E spec**

- Nối `KanjiWritingSheetDialog` (từ Epic 10) vào `frontend/src/pages/NotebooksPage.tsx` để xuất phiếu tập viết PDF cho các chữ Kanji trong sổ tay đang chọn (nút `min-h-11`, kích hoạt `window.print()`).
- Hoàn thiện `tests/web/dictionary-notebooks.spec.ts`.

- [ ] **Step 4: Run unit & E2E verification suite**

Run:
```bash
pnpm --filter @luyen/frontend test -- src/pages/NotebooksPage.test.tsx
pnpm packs:verify && pnpm typecheck && pnpm check && pnpm test && pnpm build
pnpm e2e:web -- tests/web/dictionary-notebooks.spec.ts
```
Expected: Tất cả unit test, `packs:verify`, `typecheck`, `check`, `build` và E2E Playwright `dictionary-notebooks.spec.ts` đều PASS.

- [ ] **Step 5: Security & QA Gate (Epic 11 Closure)**

- Xác nhận 0 yêu cầu mạng ra domain ngoài khi chạy `dictionary-notebooks.spec.ts` ở chế độ offline (`AD-18`).
- Xác nhận toàn bộ 3 kiểm soát bảo mật `SEC-E11-01`, `SEC-E11-02`, `SEC-E11-03` và các ca `SEC-T04`, `SEC-T07`, `SEC-T11` đều đã xanh.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/NotebooksPage.tsx frontend/src/pages/NotebooksPage.test.tsx tests/web/dictionary-notebooks.spec.ts
git commit -m "feat(notebook): wire Kanji writing sheet print from notebooks and add Epic 11 E2E suite"
```
