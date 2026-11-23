# Rà soát lại Epic 3 theo kế hoạch

**Mốc:** `master...ba33c48` (merge-base `79081cf`), nhánh `codex/epic-3-native`. Kế hoạch đối chiếu: [2026-11-22-epic-ung-dung-tauri.md](../superpowers/plans/2026-11-22-epic-ung-dung-tauri.md).

## Cách rà

| Việc | Skill | Ghi chú |
| --- | --- | --- |
| Đối chiếu code với kế hoạch | `spec-to-code-compliance` | Bản cài không có script workflow và agent checker. Bốn subagent rà bốn nhóm yêu cầu (desktop, mobile, auth, CI); mỗi divergence được đọc lại code để bác bỏ hoặc xác nhận. |
| Rà diff | `open-code-review-delegate` | `ocr delegate preview --from master`: 59 file rà được, 54 file bị CLI loại (tài liệu, lockfile, asset, test legacy đã xóa). |
| Rà bảo mật | `differential-review` | Mức MEDIUM, tập trung auth, capability Tauri, updater, workflow phát hành. |
| Sửa lỗi | `superpowers:systematic-debugging`, TDD | Test hỏng trước khi sửa. |
| Kiểm chứng | `superpowers:verification-before-completion` | Kết quả ở mục cuối. |

Độ phủ OCR: 53/59 file đã rà, 6 file bỏ qua (89,8%). Sáu file bỏ qua là harness test chỉ chạy trên máy thử hoặc runner, chưa đọc từng dòng: `tests/desktop/updater-build.ps1`, `tests/desktop/updater-smoke.mjs`, `tests/mobile/android-offline-smoke.mjs`, `tests/mobile/ios/ci-smoke.sh`, `tests/mobile/ios/auth-callback.yaml`, `tests/mobile/ios/vocabulary.yaml`. `android-offline-smoke.mjs`, `ios/ci-smoke.sh` và `ios/vocabulary.yaml` chạy đạt trên CI `ba33c48`; hai file updater chỉ có log chạy cục bộ ghi trong kế hoạch.

## Đối chiếu kế hoạch

| Yêu cầu | Kết luận |
| --- | --- |
| Capability chỉ ở cửa sổ `main`, opener giới hạn 4 URL HTTPS | Đạt |
| Đăng ký `luyenjlpt`, chuyển URL từ lần mở thứ hai về cửa sổ đang chạy | Đạt; có lỗi phát lại link khi tải lại webview, đã sửa (mục dưới) |
| NSIS kèm Gói N4 | Đạt trên CI. Không có `beforeBuildCommand`, nên build cục bộ dùng `frontend/dist` hiện có |
| Updater desktop xác minh chữ ký | Mạnh hơn kế hoạch: plugin ràng cả phiên bản đã ký |
| Không có service role, khóa riêng hay khóa ký trong bundle | Đạt |
| Vỏ mobile cùng app ID gốc, Android API 26, iOS 15 | Một phần: mobile dùng `vn.luyenjlpt.app.mobile`, kiến trúc chỉ cho thêm hậu tố khi store yêu cầu. Không ảnh hưởng chạy; cần chủ dự án chốt trước bản phát hành đầu tiên vì đổi ID sau đó làm mất đường nâng cấp |
| Android so `versionCode`, mở đúng link tải chính thức | Đạt; chặn origin khác, bản cũ và bản trùng |
| Chỉ ký khi có khóa, kiểm fingerprint chứng chỉ | Mạnh hơn kế hoạch |
| Callback chỉ nhận đúng scheme/host và mã PKCE có flow ID | Đạt |
| OAuth qua trình duyệt hệ thống, giữ phiên, báo khôi phục mật khẩu | Đạt |
| Web giữ redirect HTTPS | Đạt |
| Frontend build và `packs:verify` trước native build | Đạt cả ba job |
| Cách ly secrets khỏi job PR, action ghim SHA | Đạt |
| Tag khớp version, nằm trên nhánh mặc định, mới hơn bản stable | Đạt; kiểm version chạy ở job `publish`, sau khoảng 55 phút build |
| Release chờ Windows, Android, iOS | Đạt |

Phần kế hoạch vẫn để mở và không kiểm được từ code: Auth trên staging, đồng bộ hai chiều Windows–Android, cập nhật giữa hai bản phát hành ký thật, cấu hình môi trường GitHub và repo phân phối.

## Lỗi đã sửa

1. **Link đăng nhập lúc khởi động bị đổi mã lại sau khi tải lại webview** (thấp). `getCurrent()` của `plugin-deep-link` giữ link khởi động suốt vòng đời process, còn danh sách link đã xử lý chỉ sống trong một lần gọi `listenForNativeAuth`. Sau `window.location.reload()` (ví dụ sau khi xóa tài khoản), app đổi lại mã đã dùng, thất bại và hiện "Liên kết tài khoản không hợp lệ hoặc đã hết hạn." Phiên không bị ảnh hưởng. Sửa: lưu danh sách vào `sessionStorage` của webview ([nativeAuth.ts](../../frontend/src/adapters/auth/nativeAuth.ts)). Test mới: `does not replay the launch link after the webview reloads`.
2. **Test `kanji-quiz-count` chập chờn trên CI** (`45066390309`, `45068576243`). Cả hai lượt đều lưu `single: 118` thay vì `20`. Bước lỗi là bước duy nhất gõ ngay sau khi đổi dạng bài mà không chờ ô số câu hiện số của dạng mới; các bước khác đều chờ. Không tái hiện được cục bộ (40 lượt thường, 30 lượt với CPU chậm 6 lần). Sửa: chờ ô hiện `118` trước khi gõ ([kanji-quiz-count.spec.ts](../../tests/web/kanji-quiz-count.spec.ts)).
3. Ba file đặt `import` ở cuối file sau khi thay `signal.throwIfAborted`; đã chuyển lên đầu.

## Ghi nhận, chưa sửa

- `NativeUpdates.tsx` gọi `check()` lần nữa khi bấm cài. Bản cài vẫn được xác minh chữ ký, nhưng có thể mới hơn bản toast báo.
- `mobile/scripts/package-release.sh` dùng `test` trần dưới `set -e`; thiếu keystore hoặc sai số APK thì thoát mà không in lý do.
- Ở chế độ phát hành, script vòng đời của `pnpm install` chạy cùng job sau đó nạp khóa ký. Đây là rủi ro chuỗi cung ứng còn lại, đã giảm bằng lockfile cố định và keystore tạm ngoài thư mục tải lên.
- `validate-native-env.mjs` chưa có unit test.

## Kiểm chứng

Cục bộ ngày 23-11-2026, sau các bản sửa:

- `pnpm typecheck`, `pnpm check`, `pnpm build`, `pnpm packs:build`, `pnpm packs:verify`, `node mobile/scripts/validate-scaffold.mjs`: đều đạt.
- `pnpm test`: frontend 196/196, infra 93/93, Android release đạt.
- Test phát lại link: thất bại trước khi sửa (handler bị gọi 2 lần), đạt sau khi sửa.
- `pnpm e2e:web`: 17 đạt, 3 bỏ qua vì cần Supabase local.
- `kanji-quiz-count`: 30/30 lượt đạt với 2 worker. Không có lượt đỏ trước khi sửa, nên phải chờ CI xác nhận.
- GitHub trên `ba33c48` (trước các bản sửa): Windows, Android build, Android smoke và iOS đều đạt; lượt CI web của sự kiện push lỗi ở `kanji-quiz-count`.

Chưa chạy: dựng lại NSIS, APK và bản iOS với các bản sửa. Thay đổi chỉ nằm trong frontend dùng chung, nên CI native trên commit mới sẽ là lượt kiểm chính thức.
