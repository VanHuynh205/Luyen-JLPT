# Epic 4 — Ngữ pháp mở rộng Implementation Plan

> **For agentic workers:** Follow `ponytail` (`C:/Users/admin/.agents/skills/ponytail/SKILL.md`), `test-driven-development`, `impeccable` (`craft-floor.md` + `DESIGN.md` + `EXPERIENCE.md`), and `verification-before-completion`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bốn trang ngữ pháp mở rộng (Bài so sánh, Bảng chia, Kính ngữ, Tự/tha động từ), liên kết hai chiều giữa Bài so sánh và Mẫu ngữ pháp, sửa lỗi reset state ở `ReadingDetailPage`, và kiểm chứng đầy đủ bằng unit test + Playwright E2E + code review.

**Architecture:** Tách logic chuẩn hoá và liên kết `comparisons.patterns ↔ grammar.id` thành hàm thuần trong `frontend/src/core/content/comparisonLinks.ts` để cả frontend lẫn `infra/scripts` dùng chung mà không đổi schema hay nội dung JSON gói N4 `1.0.0`. Các trang mới tái sử dụng token Washi & Sumi, shadcn UI và `DetailSection`, đăng ký trong `frontend/src/App.tsx` trước route động `/ngu-phap/$patternId`.

**Tech Stack:** React 19, TypeScript 7, TanStack Router 1.131, Tailwind CSS + shadcn/ui, Vitest 5.1.1, Playwright 1.65.1.

**Spec:** `docs/initiative-jlpt-da-nen-tang/tickets/epic-ngu-phap-mo-rong/epic-ngu-phap-mo-rong.md`, `docs/initiative-jlpt-da-nen-tang/ux-jlpt-da-nen-tang/EXPERIENCE.md`, `docs/initiative-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang/architecture-jlpt-da-nen-tang.md`.

## Global Constraints

- Không thêm quiz ngữ pháp mới (biên giới Epic 4).
- Không sửa `infra/content/n4/*.json` hoặc nâng `infra/content/n4/VERSION` (giữ `1.0.0`).
- Giao diện 100% tiếng Việt; toàn bộ chữ Nhật gắn `lang="ja"`, không dùng font Fraunces cho chữ Nhật.
- Thiết kế Washi & Sumi (`DESIGN.md`): nền giấy phẳng, đường kẻ mảnh, tối đa 1 dấu `.hanko` son mỗi màn hình; không gradient sặc sỡ hay glow.
- Responsive 360px: không tràn ngang (`scrollWidth === 360`), vùng chạm tối thiểu `44×44px` (`min-h-11`).
- Bảng so sánh 2 cột trên desktop, xếp chồng trên điện thoại; câu đối chiếu đặt cạnh nhau.

## Review Focus

- Tách mẫu theo `／` hoặc `・` không được khớp nhầm ký hiệu slot đơn lẻ (`V`, `N`, `A`) hoặc chuỗi con sai ngữ cảnh (`だけ` khớp vào `いただけませんか`).
- Các mẫu đồng hình thức (`Vてしまう`, `～そうだ`, `のに`) phải phân biệt được dựa trên gợi ý nghĩa/ngữ cảnh để không nối sai bài so sánh.
- Các ô trống trong `keigo.json` (`sonkeigo`, `kenjogoI`, `kenjogoII`) phải hiển thị gọn (`—`) thay vì khoảng trắng hay lỗi bố cục.
- Route tĩnh `/ngu-phap/so-sanh`, `/ngu-phap/cach-chia`, `/ngu-phap/kinh-ngu`, `/ngu-phap/tu-dong-tha-dong` phải khai báo trước `/ngu-phap/$patternId` để không bị nuốt thành `$patternId`.
- Chuyển trực tiếp từ `/doc-hieu/reading-01` sang `/doc-hieu/reading-02` phải xoá sạch `answers`, `submitted`, và trạng thái lưu điểm.

---

### Task 1 (`linker`): Bộ liên kết `comparisons ↔ grammar` & báo cáo khi build pack

**Files:**
- Create: `frontend/src/core/content/comparisonLinks.ts`
- Create: `frontend/src/core/content/comparisonLinks.test.ts`
- Modify: `infra/scripts/src/build-packs.ts`
- Modify: `infra/scripts/src/packs.ts`
- Modify: `infra/scripts/src/build-packs.test.ts`

**Interfaces:**
- Produces in `frontend/src/core/content/comparisonLinks.ts`:
  - `ComparisonPartLink { part: string; grammarIds: string[] }`
  - `ComparisonLinkReport { byComparisonId: Map<string, string[]>; partsByComparisonId: Map<string, ComparisonPartLink[]>; byGrammarId: Map<string, GrammarComparison[]>; unmatched: Array<{ comparisonId: string; group: string; part: string }> }`
  - `buildComparisonLinks(comparisons: readonly GrammarComparison[], grammar: readonly GrammarPattern[]): ComparisonLinkReport`
  - `splitComparisonExamples(exampleJa: string, exampleVi: string): Array<{ ja: string; vi: string }>`
  - `splitComparisonDistinctions(patterns: string, distinction: string): Array<{ pattern: string; detail: string }> | null`

- [ ] **Step 1:** Viết unit test trong `frontend/src/core/content/comparisonLinks.test.ts` cho tách `／` & `・`, chống khớp nhầm slot đơn `V`/`N`/`A` và `だけ` trong `いただけませんか`, phân biệt `Vてしまう`/`～そうだ`/`のに`, và test đối chiếu với bộ dữ liệu N4 thật (`infra/content/n4/`).
- [ ] **Step 2:** Chạy `pnpm --filter @luyen/frontend test src/core/content/comparisonLinks.test.ts` xác nhận fail ban đầu.
- [ ] **Step 3:** Hiện thực `comparisonLinks.ts` thuần (không hardcode ID) và tích hợp in báo cáo phần chưa khớp (không chặn build) vào `infra/scripts/src/build-packs.ts` & `packs.ts`, kèm test trong `build-packs.test.ts`.
- [ ] **Step 4:** Chạy test frontend + `infra-scripts` + `pnpm packs:build && pnpm packs:verify` xác nhận xanh.

### Task 2 (`ref-pages`): Thanh điều hướng phụ & 3 trang tham khảo ngữ pháp

**Files:**
- Create: `frontend/src/components/grammar/GrammarSubNav.tsx`
- Create: `frontend/src/pages/GrammarConjugationsPage.tsx`
- Create: `frontend/src/pages/GrammarKeigoPage.tsx`
- Create: `frontend/src/pages/GrammarVerbPairsPage.tsx`

- [ ] **Step 1:** Đọc `impeccable/reference/craft-floor.md`, `DESIGN.md`, `EXPERIENCE.md`, `GrammarListPage.tsx`.
- [ ] **Step 2:** Tạo `GrammarSubNav.tsx` gồm 5 mục (`/ngu-phap`, `/ngu-phap/so-sanh`, `/ngu-phap/cach-chia`, `/ngu-phap/kinh-ngu`, `/ngu-phap/tu-dong-tha-dong`) kèm số lượng từ `useReadyPack()`, đảm bảo `min-h-11`, không tràn ngang 360px.
- [ ] **Step 3:** Tạo 3 trang `/ngu-phap/cach-chia` (22 mục), `/ngu-phap/kinh-ngu` (17 mục, xử lý ô trống bằng `—`), `/ngu-phap/tu-dong-tha-dong` (12 cặp) có tìm kiếm không dấu, bộ đếm `Hiển thị {n} / {total}`, `lang="ja"`.

### Task 3 (`reading-fix`): Sửa lỗi review #5 ở `ReadingDetailPage`

**Files:**
- Modify: `frontend/src/pages/ReadingDetailPage.tsx`
- Create: `frontend/src/pages/ReadingDetailPage.test.tsx`

- [ ] **Step 1:** Viết regression test `ReadingDetailPage.test.tsx` chứng minh đổi `passageId` reset `answers`, `submitted`, và trạng thái mutation.
- [ ] **Step 2:** Chạy test xác nhận fail trước khi sửa.
- [ ] **Step 3:** Tách `ReadingDetailContent` và gắn `key={passage.id}` trong `ReadingDetailPage.tsx`, chạy lại test xác nhận pass.

### Task 4 (`comparison-ui`): Trang Bài so sánh, liên kết hai chiều & đăng ký route

**Files:**
- Create: `frontend/src/pages/GrammarComparisonsPage.tsx`
- Create: `frontend/src/pages/GrammarComparisonDetailPage.tsx`
- Modify: `frontend/src/pages/GrammarListPage.tsx`
- Modify: `frontend/src/pages/GrammarDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes `buildComparisonLinks`, `splitComparisonExamples`, `splitComparisonDistinctions` from `frontend/src/core/content/comparisonLinks.ts` and `GrammarSubNav` from `frontend/src/components/grammar/GrammarSubNav.tsx`.

- [ ] **Step 1:** Tạo `GrammarComparisonsPage.tsx` (danh sách 27 bài so sánh, tìm kiếm, bộ đếm, thẻ dẫn tới `/ngu-phap/so-sanh/$comparisonId`).
- [ ] **Step 2:** Tạo `GrammarComparisonDetailPage.tsx` (bố cục đối chiếu 2 cột desktop / xếp chồng mobile, câu ví dụ đối chiếu, liên kết tới các `/ngu-phap/$patternId`, điều hướng trước/sau).
- [ ] **Step 3:** Gắn `<GrammarSubNav />` vào `GrammarListPage.tsx`; thêm mục "So sánh liên quan" vào `GrammarDetailPage.tsx`; đăng ký 5 route mới trong `App.tsx` trước `/ngu-phap/$patternId`.
- [ ] **Step 4:** Chạy `pnpm typecheck && pnpm check && pnpm --filter @luyen/frontend test` xác nhận pass.

### Task 5 (`e2e-audit`): E2E Playwright & rà soát file/folder dư thừa

**Files:**
- Modify: `tests/web/routes.spec.ts`
- Create: `tests/web/grammar-extended.spec.ts`

- [ ] **Step 1:** Cập nhật `routes.spec.ts` và thêm `grammar-extended.spec.ts` kiểm tra đủ 27/22/17/12 mục, lọc tìm kiếm, liên kết 2 chiều `grammar-G001 ↔ comparison-SS001`, reset `ReadingDetailPage` khi đổi bài trực tiếp, và layout 360px.
- [ ] **Step 2:** Rà soát toàn bộ workspace + file/folder mới sinh ra trong phiên đối chiếu với lộ trình hiện tại và tương lai (Epic 5, N3), lập bảng đánh dấu rõ file/folder nào giữ lại và file/folder nào là rác hoặc không còn cần thiết.

### Task 6 (`verifier`): Kiểm thử toàn chuỗi, review & cập nhật ticket

- [ ] **Step 1:** Chạy thực tế `pnpm packs:build && pnpm packs:verify && pnpm typecheck && pnpm check && pnpm test && pnpm build && pnpm e2e:web`.
- [ ] **Step 2:** Chạy review cuối nhánh theo `open-code-review-delegate` và ghi báo cáo vào `docs/code-review/2026-11-25-epic-4-review.md`.
- [ ] **Step 3:** Cập nhật trạng thái Epic 4 trong `docs/initiative-jlpt-da-nen-tang/tickets/epic-ngu-phap-mo-rong/epic-ngu-phap-mo-rong.md` và `docs/superpowers/plans/2026-11-21-lo-trinh-code-va-kiem-thu.md`.
