# Nghiệm thu Auth staging, đồng bộ Windows–Android và cập nhật feed công khai

Ngày 23–25-11-2026 (Asia/Bangkok). Phạm vi theo [mục Nghiệm thu Auth trên staging của Epic 3](superpowers/plans/2026-11-22-epic-ung-dung-tauri.md#nghiệm-thu-auth-trên-staging). **Đã hoàn tất toàn bộ hạng mục nghiệm thu Epic 3** (QA `0.1.2` trên thiết bị thật, CI PR #2 gồm Windows/Android/iOS, phát hành công khai `v0.2.0`, và kiểm cập nhật qua feed HTTPS công khai trên Windows và Android).

## Kết quả nghiệm thu cuối (`0.1.2` → `v0.2.0`)

- **Cài đè `0.1.2` và Auth trên thiết bị thật:** Đã cài đè bản QA `0.1.2` trên Windows và Android thật, xác nhận Google OAuth, đăng ký/xác nhận email và đặt lại mật khẩu hoạt động.
- **Đồng bộ hai chiều:** Đã xác nhận đồng bộ hai chiều Windows–Android với hai tài khoản QA.
- **CI trên revision phát hành (`d610e78`, PR #2):** `CI` (`45561612272`) và `Native apps` (`45561612418` — Windows NSIS + smoke, Android build + offline smoke API 34, iOS Simulator build + Maestro N4 smoke) đều PASS.
- **Phát hành công khai `v0.2.0` (lưu trữ lịch sử tại repo phụ):** Tag `v0.2.0` (`7cbea40`) trên `VanHuynh205/Luyen-JLPT`; release ban đầu từng đặt tại `VanHuynh205/Luyen-JLPT-Releases/releases/tag/v0.2.0` đủ 6 asset (`Luyen-JLPT-windows-x64-setup.exe`, `.sig`, `latest.json`, `Luyen-JLPT-android.apk` multi-ABI `arm64-v8a`+`x86_64`, `android-latest.json`, `SHA256SUMS.txt`), kiểm chứng tải trực tiếp qua HTTPS khớp 100% SHA-256. Từ bản `v0.2.1`, repo `VanHuynh205/Luyen-JLPT` chuyển sang public và gộp trực tiếp phát hành/feed cập nhật vào `VanHuynh205/Luyen-JLPT/releases`.
- **Cập nhật qua feed công khai — Windows (`0.1.2` → `0.2.0`):** Bản `0.1.2` tự phát hiện `Có bản Windows 0.2.0` và nút `Cài cập nhật` từ `latest.json` sau 2 giây; kích hoạt cập nhật tải `Luyen-JLPT-windows-x64-setup.exe`, xác minh chữ ký Ed25519 + `requireSignedVersion` và cài đè đúng thư mục cài cũ (không tạo bản trùng). Sau nâng cấp: binary và Registry Uninstall HKCU đều là `0.2.0`, protocol `luyenjlpt` trỏ đúng binary mới, giữ nguyên `%LOCALAPPDATA%\vn.luyenjlpt.app` và trạng thái đồng bộ/tiến độ, không còn hiện toast `0.2.0`.
- **Cập nhật qua feed công khai — Android (`0.1.1` → `0.2.0` trên AVD API 34):** Bản `0.1.1` (`1001`) gọi live `android-latest.json` và hiển thị toast `Có bản Android 0.2.0` cùng nút `Tải APK`. Tạo tiến độ khách `1/1182` (`見ます`) trên `0.1.1`, cài đè APK tải từ URL release công khai (`adb install -r`): lên `0.2.0` (`2000`), giữ nguyên `userId`, `dataDir`, `firstInstallTime` và tiến độ `1/1182`, không còn hiện toast cập nhật.
- **Lưu ý hậu phát hành (tùy chọn & vận hành):** Có thể kiểm thêm thao tác bấm `Tải APK` và cài đè trên điện thoại ARM64 thật nếu muốn; chủ dự án cần duy trì bản sao phục hồi độc lập của hai khóa ký (`updater.key`, `android-release.p12`) và mật khẩu ngoài máy tạo khóa.

## Kết quả kiểm tra trước đó (23-11-2026)

### Kiểm tra lại sau khi nhận báo lỗi từ Windows và Android

- Trước khi sửa, Dashboard Supabase chỉ có callback web `/tai-khoan`. Với mã thử không hợp lệ, cả hai redirect native đều rơi về trang chủ web, kể cả trên máy không có phiên đăng nhập. Sau khi thêm `luyenjlpt://auth-callback` và `luyenjlpt://auth-callback[?]sb_flow_id=*`, giữ nguyên Site URL và redirect web, cả 8 phép thử chọn đích cho signup/recovery đều đạt: web, native cơ bản, native có ID (giữ nguyên giá trị), và origin ngoài danh sách (về Site URL).
- Với hai yêu cầu Google PKCE mới, endpoint authorize trả 302 tới Google. Mô phỏng hủy đồng ý bằng state do chính yêu cầu đó cấp: callback của Supabase trả 302 về app cho yêu cầu native, về `/tai-khoan` cho web.
- Worker `luyen-jlpt` đã nhận giao diện 3D. Đã bỏ `_redirects` lặp về `index.html` vì Workers Static Assets đã có SPA fallback trong `wrangler.toml`. Kiểm trực tiếp: 23 tệp khớp bản build; 17/17 E2E khách trên staging đạt, gồm hai ca từng lỗi. Trang chủ tải chunk 3D, hiện canvas, không có lỗi JavaScript trong lượt kiểm. Bảy ca chuyển động/fallback cục bộ đạt.
- Windows `0.1.1` trên máy thử có đăng ký giao thức trỏ đúng EXE và có endpoint updater. App kiểm lúc mở/khi có mạng lại. Feed Windows và Android đang trả 404 vì repo phân phối chưa có release.
- Bản web kèm sửa callback đã deploy: Worker version `6ef2ba50-c2d4-4abf-afd5-a13c1e9bc136`. 23 tệp HTTPS khớp bản build. Chromium truy cập callback giả trên staging: thấy thông báo lỗi, URL đã bỏ mã và không có form đổi mật khẩu. Hai ca Playwright trên Supabase/Mailpit cục bộ đạt, gồm xác nhận đăng ký, phục hồi mật khẩu và giữ nguyên phiên cũ khi gặp mã sai. Phép thử này không gửi thư staging.
- Android 14, WebView 113: Chrome mở app cả lúc đóng lẫn lúc đang chạy, nhưng parser cũ bỏ qua link vì WebView diễn giải host của custom scheme thành pathname. Parser mới kiểm đúng tiền tố `luyenjlpt://auth-callback` và kiểm mã/ID PKCE như trước.
- Bộ cài thử `0.1.2` đã ký nằm trong `.cache/epic3-identity-check/qa-0.1.2/`, chưa phát ra feed công khai. APK ARM64 `1002` giữ app ID và cert của `1001`, 23/23 tệp frontend khớp bản staging đã build riêng cho native; SHA-256 `46300ed7c73be7741a88f3e4db33aa0115ccfef3f4ab6785d345f4bea7a2d3d1`. Windows NSIS `0.1.2` giữ updater key và endpoint, SHA-256 `5be4acb7ce45ed4c3e9bd0ff6506ea3adc205fcd2b874c7ddea11541274c3026`; đã kiểm chữ ký updater và phiên bản trong trusted comment (không phải Authenticode).

Các dòng khảo sát Windows/Android bên dưới mô tả trạng thái **trước khi dựng bản QA `0.1.2`**. [Checkpoint phát hành và bằng chứng](superpowers/plans/2026-11-22-epic-ung-dung-tauri.md#bản-nghiệm-thu-nội-bộ-không-phát-công-khai).

| Môi trường | Kiểm tra và kết quả | Giới hạn |
| --- | --- | --- |
| Web staging | GET `/tai-khoan`, `/tai-khoan?type=recovery`, `/packs/index.json`: HTTP 200. Chỉ mục có N4 `1.0.0`. Chromium phiên khách hiển thị `Tiếp tục với Google` và `Quên mật khẩu` trên cả hai route tài khoản. | Không gửi biểu mẫu. URL `?type=recovery` không có mã nên việc không thấy `Mật khẩu mới` không xác minh luồng recovery. Chưa kiểm provider, thư hoặc redirect native. |
| Web staging, suite khách | `JLPT_STAGING_URL` trỏ staging trong plan Epic 2, `JLPT_LOCAL_AUTH=0`, `EXPERIMENTAL_LEVELS=0`, `pnpm e2e:web --output <thư-mục-tạm-riêng> --trace off`: 15 đạt, 2 lỗi. `/gioi-thieu` thiếu locator `about.page`; nút `Đã thuộc` ở viewport 360 px cao 36 px, dưới ngưỡng 44 px của bài test. | Route `/tai-khoan` và ba bài tiến độ khách đạt. Suite không đăng nhập và không thử đồng bộ giữa hai máy. Hai lỗi chưa được điều tra nguyên nhân. |
| Vitest cục bộ | `pnpm --filter @luyen/frontend test src/adapters/auth src/adapters/supabase-sync src/adapters/local-store/progress.test.ts src/core/sync`: 6 tệp, 33 bài đạt. | Test Auth native dùng fixture/mock cho Tauri và upstream; IndexedDB giả lập. Bao phủ callback PKCE, retry offline, ranh giới chủ dữ liệu; không đo đồng bộ qua staging hay RLS trên DB thật. |
 | Windows | Không thấy app trong các vị trí cài phổ biến, danh mục Uninstall đã kiểm, hoặc danh sách tiến trình. Không thấy đăng ký `luyenjlpt` ở `HKCU`/`HKLM`. Bộ cài x64 trong `.cache/builds/9f6a06e/` khớp checksum trong manifest cục bộ. Cấu hình workspace hiện dùng app ID `vn.luyenjlpt.app`. | Chưa xác nhận app Windows đã cài hoặc bundle trỏ staging. Không chạy smoke Windows; harness chạy callback giả và chặn mạng ngoài. |
 | Android | `adb` trong `.cache/epic3-android/sdk/platform-tools/` báo 0 thiết bị; không thấy tiến trình emulator. APK debug cache cùng bộ Windows khớp checksum cục bộ và chỉ chứa ABI `x86_64`. Cấu hình workspace hiện dùng app ID trực tiếp `vn.luyenjlpt.app`, không dùng hậu tố `.mobile`. | Chưa xác minh app trên giả lập hoặc thiết bị thật trong lượt này. Không chạy smoke Android: cần giả lập thử riêng và script có bước gỡ APK sau khi chạy. Không dùng APK này trên thiết bị không hỗ trợ `x86_64`. |
| Android staging build | Dùng scaffold trong `.cache/epic3-identity-check/mobile`, toolchain/cache `.cache/epic3-android`, `CARGO_BUILD_JOBS=3`. Rust build x86_64 đạt; workaround Windows copy `.so` vào `jniLibs` rồi đóng gói bằng Gradle. Cặp unsigned `0.1.0`/`0.1.1` có `versionCode=1000`/`1001`, `applicationId=vn.luyenjlpt.app`, `minSdk=26`, ABI `x86_64`; `zipalign -c -P 16 4` đạt. Hai bản lần lượt nhúng JS từ `../../frontend/staging-dist` và `../../frontend/staging-dist-next`, trỏ ref `vuyanbtfmhnqvirkikgf`. | Chỉ cho giả lập x86_64 nội bộ; không thay bản ARM64. Cặp do người phụ trách khóa ký đã qua thử nâng cấp ngoại tuyến bên dưới. |

Ở bước khảo sát ban đầu, không chạy E2E tài khoản local: suite tự tạo/xóa tài khoản thử; Docker daemon local cũng không kết nối được. Không chạy pgTAP hoặc Deno (CLI không có trên `PATH`). Không dùng tài khoản cá nhân hoặc thay đổi dữ liệu Supabase. Checksum của artifact cũ chỉ chứng minh file khớp manifest; hai bản QA mới đã được đối chiếu cấu hình staging riêng.

Supabase MCP ngày 23-11-2026 liệt kê dự án `Luyen JLPT`, ref `vuyanbtfmhnqvirkikgf`, khu vực `ap-southeast-1`, trạng thái `ACTIVE_HEALTHY`. MCP không gắn nhãn môi trường. Ở lượt tiếp theo, GET `/assets/index-CoLpZPbf.js` từ origin staging trong plan Epic 2 trả HTTP 200; JS deploy dùng đúng URL của ref này. Bundle cục bộ `.cache/epic3-identity-check/frontend/staging-dist` chứa cùng URL và cùng khóa publishable với JS deploy; `frontend/dist` trong cùng cache không có hai giá trị đó. Không ghi giá trị khóa. Đối chiếu này xác định backend mà web staging đang dùng; chưa xác nhận backend này tách riêng với production hoặc kiểm được luồng đăng nhập.

Endpoint Auth settings read-only của ref này trả `google=true`, `email=true`, `mailer_autoconfirm=false`. Đây là bằng chứng cấu hình đang bật các phương thức cần cho ca QA; chưa phải bằng chứng đăng nhập, nhận thư, callback native hoặc đồng bộ tài khoản.

### Artifact unsigned

- APK: `.cache/epic3-identity-check/android-staging/Luyen-JLPT-android-staging-0.1.0-x86_64-unsigned.apk`
- SHA-256: `5CE2A2455969BC615E1C7D8BBF7A86985910F07FED0434930634D004E5D1F8B1`
- `apksigner verify --verbose --print-certs`: không verify, thiếu `META-INF/MANIFEST.MF`; APK không có entry chữ ký JAR. `aapt2 dump badging` xác nhận ID/version/ABI ở trên.
- AVD disposable API 34 x86_64 đã boot riêng, bật chế độ máy bay, tắt Wi-Fi và xác nhận Android không có mạng mặc định rồi tắt AVD. Chưa cài APK nên chưa ghi nhận smoke hoặc upgrade.
- APK unsigned `0.1.1`: `.cache/epic3-identity-check/android-staging/Luyen-JLPT-android-staging-0.1.1-x86_64-unsigned.apk`. SHA-256: `BAE5EFDFE0501AFB9FCCF863B06F9C7700A7DB44C3E92BE2A65EE7C6BB19F9F3`. `aapt2` xác nhận `0.1.1`/`1001`; `apksigner` báo thiếu `META-INF/MANIFEST.MF`, ZIP không có entry chữ ký JAR. Kiểm trực tiếp xác nhận JS cấu hình Auth từ `staging-dist-next` nằm trong `.so` đóng gói.

### Nâng cấp ngoại tuyến trên AVD x86_64

- `checkApk` và `verifyReleaseSigner` xác minh hai APK do người phụ trách khóa ký: cùng `vn.luyenjlpt.app`, `0.1.0`/`1000` và `0.1.1`/`1001`, cùng một cert SHA-256 `8b912df32875cf913bb759376238d5de13b1e275f70d42934a66cd429926a6fc`. SHA-256 của `Luyen-JLPT-android-0.1.1.apk` khớp `1CDF14FD7A7B3B2208D5668EA10F722547A7DA7CF729D40FEC88E3369AA96FBC`.
- Trên AVD mới `luyen-jlpt-signed-pair-disposable` (API 34, x86_64), bật chế độ máy bay và xác nhận không có mạng mặc định. Bản `0.1.0` ghi tiến độ khách `0/1182 → 1/1182` sau khi đánh dấu `見ます`. `adb install -r` lên `0.1.1` giữ `dataDir`, UID và `firstInstallTime`. Mở lại trang Từ vựng vẫn thấy `1/1182` mà không đánh dấu thêm.
- Đã dừng ADB riêng và xóa đúng AVD disposable; xác nhận cả `.avd` và `.ini` đã biến mất. Bằng chứng: `.cache/epic3-identity-check/android-staging/signed-pair-final-evidence.txt`. Chỉ xác minh tiến độ khách trên giả lập x86_64; không kiểm ARM64, Auth staging hay đồng bộ Windows–Android. Không ký lại hay phát hành APK.

## Đầu vào cho lượt nghiệm thu có người phối hợp

- Người phụ trách staging xác nhận hai bundle đã cài trỏ cùng dự án staging, ghi phiên bản/commit và checksum; xác nhận Google, gửi thư xác nhận/recovery và allowlist native (gồm biến thể `sb_flow_id`) đã sẵn sàng. Không gửi khóa hoặc link xác thực qua chat.
- Chỉ định người vận hành Windows và Android, thiết bị thử riêng và một khung giờ chung. Ghi Android là giả lập hay thiết bị thật, API/ABI và phiên bản app. Cần bộ cài đã duyệt phù hợp thiết bị; không mặc định dùng APK debug x86_64 cho điện thoại.
- Chỉ định hai tài khoản QA A/B đã được duyệt, một hộp thư thử và tài khoản Google thử phù hợp. Người giữ tài khoản nhập thông tin trực tiếp trên thiết bị. Ca xác nhận email cần người phụ trách chuẩn bị danh tính QA chưa xác nhận hoặc duyệt một lượt đăng ký QA theo plan; không chạy ca xóa.

## Trạng thái cuối

- **Đã hoàn tất:** Google OAuth, xác nhận email, đặt lại mật khẩu, cài đè `0.1.2` và đồng bộ hai chiều Windows–Android với hai tài khoản QA trên thiết bị thật; CI PR #2 (`45561612272`, `45561612418`); release công khai `v0.2.0`; kiểm cập nhật qua feed HTTPS công khai Windows (`0.1.2` → `0.2.0`) và Android (`0.1.1` → `0.2.0` trên AVD).
- **Ghi chú vận hành:** Tùy chọn kiểm thêm thao tác cài đè trên điện thoại ARM64 thật; đảm bảo sao lưu khóa ký (`updater.key`, `android-release.p12`) và mật khẩu độc lập ngoài máy tạo khóa.
- Quy ước ghi nhận: không ghi email, mật khẩu, token, mã PKCE hoặc URL callback có tham số xác thực.
