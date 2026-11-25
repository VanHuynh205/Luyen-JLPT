# Rà soát Epic 4 — Ngữ pháp mở rộng

**Chế độ rà:** `delegation` (`open-code-review-delegate`, `workspace` mode). Kế hoạch đối chiếu: [2026-11-25-epic-ngu-phap-mo-rong.md](../superpowers/plans/2026-11-25-epic-ngu-phap-mo-rong.md) và ticket [epic-ngu-phap-mo-rong.md](../initiative-jlpt-da-nen-tang/tickets/epic-ngu-phap-mo-rong/epic-ngu-phap-mo-rong.md).

## Cách rà

| Việc | Công cụ / Skill | Ghi chú |
| --- | --- | --- |
| Chọn file & nạp rule | `open-code-review-delegate` (`ocr.ps1`) | `ocr delegate preview --format json`: 19 file thay đổi/mới (`13` file mã nguồn `reviewable`, `6` file test/kế hoạch bị CLI loại mặc định). `ocr delegate rule --format json`: 1 nhóm rule hệ thống `**/*.{ts,js,tsx,jsx,mjs,cjs,mts,cts}`. |
| Rà diff & file mới | Đọc trực tiếp toàn bộ `git --no-pager diff` và 100% file thêm mới | Rà cả 13 file `reviewable` lẫn 6 file test/plan bị loại bởi bộ lọc mặc định của OCR; đối chiếu `ponytail`, `DESIGN.md` (Washi & Sumi), `lang="ja"`, không dùng Fraunces cho chữ Nhật, không thêm quiz ngữ pháp, vùng chạm ≥ 44px ở 360px, không sửa `infra/content/n4/*.json` hay `VERSION`. |
| Kiểm chứng cuối | `verification-before-completion` | Chạy tươi toàn bộ chuỗi 7 lệnh cục bộ sau khi cập nhật tài liệu; chi tiết ở mục cuối. |

### Độ phủ OCR (`delegation`)

- `total_files` (`reviewable_files`): **13**
- `reviewed_files`: **13**
- `skipped_files`: **0**
- `coverage_rate`: **100%**

| File | Trạng thái | Kết quả rà |
| --- | --- | --- |
| `frontend/src/App.tsx` | modified | `reviewed` — 5 route tĩnh/chi tiết đăng ký trước `/ngu-phap/$patternId` |
| `frontend/src/pages/GrammarListPage.tsx` | modified | `reviewed` — gắn `<GrammarSubNav />`, giữ nguyên lọc/tìm kiếm/ocid |
| `frontend/src/pages/GrammarDetailPage.tsx` | modified | `reviewed` — thêm mục "So sánh liên quan" qua `buildComparisonLinks`, không thêm quiz/`.hanko` |
| `frontend/src/pages/ReadingDetailPage.tsx` | modified | `reviewed` — tách `ReadingDetailContent` với `key={passage.id}`, reset đầy đủ state & mutation |
| `infra/scripts/src/build-packs.ts` | modified | `reviewed` — xuất `formatComparisonLinkReport` gọn, đúng kiểu |
| `infra/scripts/src/packs.ts` | modified | `reviewed` — in cảnh báo phần chưa khớp qua `console.warn`, không chặn build hay đổi JSON/manifest |
| `frontend/src/components/grammar/GrammarSubNav.tsx` | added | `reviewed` — 5 tab + bộ đếm từ pack, `min-h-11`, `flex-wrap`, `aria-current="page"` (1 ghi nhận mức Low) |
| `frontend/src/core/content/comparisonLinks.ts` | added | `reviewed` — tách `／`/`・`, chống khớp slot đơn và `だけ` trong `いただけませんか`, phân biệt gợi ý nghĩa, không hardcode ID |
| `frontend/src/pages/GrammarComparisonsPage.tsx` | added | `reviewed` — 27 bài so sánh, tìm kiếm không dấu, bộ đếm sống, `lang="ja"` (1 ghi nhận mức Low) |
| `frontend/src/pages/GrammarComparisonDetailPage.tsx` | added | `reviewed` — bố cục 2 cột desktop / xếp chồng mobile, fallback `SS021`, ví dụ đối chiếu, liên kết ngược `/ngu-phap/$patternId` |
| `frontend/src/pages/GrammarConjugationsPage.tsx` | added | `reviewed` — 22 quy tắc, `font-body` cho `h2` chứa kana, `lang="ja"` trên tên Nhật & ví dụ, bảng không tràn 360px |
| `frontend/src/pages/GrammarKeigoPage.tsx` | added | `reviewed` — 17 mục, fallback `—` cho ô trống, `font-jp` ghi đè `h2` tránh Fraunces (1 ghi nhận mức Low) |
| `frontend/src/pages/GrammarVerbPairsPage.tsx` | added | `reviewed` — 12 cặp tự/tha, khung chú giải `を`/`が`, lưới 2 cột đáp ứng, `lang="ja"` đầy đủ |

*(Ngoài 13 file trên, 6 file bị OCR bỏ qua mặc định gồm `infra/scripts/src/build-packs.test.ts`, `frontend/src/core/content/comparisonLinks.test.ts`, `frontend/src/pages/ReadingDetailPage.test.tsx`, `tests/web/routes.spec.ts`, `tests/web/grammar-extended.spec.ts` và `docs/superpowers/plans/2026-11-25-epic-ngu-phap-mo-rong.md` cũng đã được đọc và rà đầy đủ.)*

## Đối chiếu kế hoạch & tiêu chí hoàn thành

| Yêu cầu | Kết luận |
| --- | --- |
| 27 Bài so sánh, 22 Bảng chia, 17 Mục kính ngữ, 12 cặp tự/tha hiển thị đủ | Đạt — xác minh bằng Playwright E2E (`grammar-extended.spec.ts`) |
| Liên kết `comparisons.patterns ↔ grammar.id` bằng luật tổng quát (không hardcode ID), in báo cáo phần chưa khớp khi build pack mà không chặn | Đạt — 64/74 phần khớp (0 dương tính giả), 10 phần meta/N5 chưa khớp được in cảnh báo trong `pnpm packs:build` |
| Trang Mẫu ngữ pháp có liên kết tới mọi Bài so sánh chứa nó và ngược lại | Đạt — kiểm thử bằng unit test (`comparisonLinks.test.ts`) và E2E (`grammar-G001 ↔ comparison-SS001`, `comparison-SS014`) |
| Không thêm quiz ngữ pháp mới; không sửa `infra/content/n4/*.json` hay `VERSION` | Đạt — `git diff HEAD -- infra/content/n4` rỗng; `hasQuiz` không đổi |
| Washi & Sumi (`DESIGN.md`), 100% tiếng Việt, `lang="ja"`, không dùng Fraunces cho chữ Nhật, không tràn ngang 360px & vùng chạm ≥ 44px | Đạt — 0 `.hanko` thừa trên 4 trang mới; E2E xác nhận `scrollWidth === 360` và 5 nút subnav cao ≥ 44px |
| Sửa lỗi review #5: `ReadingDetailPage` reset khi đổi `passageId` trực tiếp | Đạt — `ReadingDetailContent` gắn `key={passage.id}`, kiểm chứng bằng 3 unit test (`ReadingDetailPage.test.tsx`) + 1 E2E (`history.pushState` + `popstate`) |

## Phát hiện theo mức độ

- **Critical / High:** Không có (0).
- **Medium:** Không có (0).
- **Low (ghi nhận, không chặn merge):**
  1. `frontend/src/components/grammar/GrammarSubNav.tsx` (dòng 56, 72–92, `maintainability`): prop tùy chọn `active` hiện chưa có nơi nào truyền vào (mọi trang dùng `activeProps` của TanStack Router) và tạo biểu thức 3 ngôi lồng nhau trong `linkProps`. Có thể bỏ prop `active` ở đợt dọn sau cho gọn theo `ponytail`.
  2. `frontend/src/pages/GrammarKeigoPage.tsx` (dòng 235, `style`): `renderValueOrDash(entry.kenjogoII)` chưa truyền cờ `ja = true` dù mọi giá trị `kenjogoII` khác rỗng trong Gói N4 đều thuần tiếng Nhật (khác với `kenjogoI` có 4 dòng ghi chú tiếng Việt). Giao diện không bị Fraunces vì rơi vào `--font-body` (Gothic Nhật), chỉ thiếu thuộc tính `lang="ja"` và `line-height: 1.8` trên ô này.
  3. `frontend/src/pages/GrammarComparisonsPage.tsx` (dòng 52–60, `style`): tiêu đề trang không có dòng dẫn chữ Nhật (`比較`) như 3 trang tham khảo còn lại (mà theo kiểu `GrammarListPage.tsx`). Chỉ là khác biệt thẩm mỹ nhỏ.

## Kiểm chứng

Chạy tươi ngày 25-11-2026 sau khi hoàn tất toàn bộ thay đổi mã nguồn và cập nhật tài liệu:

| Lệnh | Exit | Kết quả thực tế |
| --- | --- | --- |
| `pnpm packs:build` | `0` | `[packs] n4 comparison links: 64/74 parts matched, 10 unmatched` (`SS001:～ですか・ますか`, `SS005:見られる・聞ける`, `SS006:だけ`, `SS012:～とき`, `SS023:尊敬語/謙譲語I/謙譲語II/丁寧語`, `SS025:の/こと`) |
| `pnpm packs:verify` | `0` | Gói N4 `1.0.0` khớp đầy đủ dataset nguồn |
| `pnpm typecheck` | `0` | `frontend` & `infra/scripts` `tsc --noEmit` đều đạt |
| `pnpm check` | `0` | Biome kiểm tra 137 file `frontend` + 11 file `infra/scripts`, 0 lỗi |
| `pnpm test` | `0` | `frontend`: **28/28** file, **238/238** test đạt; `infra/scripts`: **4/4** file, **96/96** test đạt |
| `pnpm build` | `0` | Build gói N4 + Vite bundle thành công |
| `pnpm e2e:web` | `0` | Playwright: **33 passed, 3 skipped, 0 failed** (`47.3s`; 3 test bỏ qua thuộc `accounts.local.spec.ts` & `account-mail.local.spec.ts` cần `JLPT_LOCAL_AUTH=1`) |

**Phần chưa chạy cục bộ:** CI trên GitHub Actions, chế độ `EXPERIMENTAL_LEVELS=1` E2E, bộ test Supabase local (`JLPT_LOCAL_AUTH=1`), và kiểm tra trên bản đã deploy sau merge.

## Rà soát file/thư mục tồn dư

Đã đối chiếu `git status --ignored -s` với bảng rà soát của `e2e-audit`:

- **GIỮ (Epic 4 & tài liệu hiện tại):** 8 file chỉnh sửa (`App.tsx`, `GrammarListPage.tsx`, `GrammarDetailPage.tsx`, `ReadingDetailPage.tsx`, `build-packs.ts`, `packs.ts`, `build-packs.test.ts`, `routes.spec.ts`), 11 file thêm mới của Epic 4 (`GrammarSubNav.tsx`, `comparisonLinks.ts/.test.ts`, 5 trang ngữ pháp mới, `ReadingDetailPage.test.tsx`, `grammar-extended.spec.ts`, `docs/superpowers/plans/2026-11-25-epic-ngu-phap-mo-rong.md`), cùng 3 file tài liệu verifier (`docs/code-review/2026-11-25-epic-4-review.md`, `epic-ngu-phap-mo-rong.md`, `2026-11-21-lo-trinh-code-va-kiem-thu.md`).
- **TẠM / BUILD OUTPUT (đã `.gitignore`, tái tạo được):** `infra/packs/`, `frontend/public/packs/`, `frontend/dist/`, `test-results/`, `node_modules/`, `mobile/src-tauri/icons/`, `_bmad/custom/config.user.toml`, `_bmad/render/bmad-agent-po/`, `.claude/`, `.codex/`. (`tests/web/playwright-report/` và `tests/web/test-results/` đều không tồn tại.)
- **RÁC / DƯ THỪA (đề xuất chủ dự án xem xét xoá sau kiểm tra):** `graphify-out/` (stale từ `fb0a010c`), `.cache/epic3-android/` & `.cache/epic3-native/` (~5.1 GB công cụ build Epic 3), vỏ thư mục rỗng `n3/` trong `infra/packs/`, `frontend/public/packs/`, `frontend/dist/packs/`, và `infra/dataset_n4_minnanihongo.zip` (tracked, không còn tham chiếu sau khi đã giải nén vào `infra/dataset_n4_minnanihongo/`).
