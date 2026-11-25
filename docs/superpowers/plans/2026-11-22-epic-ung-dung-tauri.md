# Epic 3 — App desktop, Android, iOS

**Mục tiêu:** Phát bộ cài Windows NSIS và APK Android cho bạn bè. Học N4 ngoại tuyến ngay lần đầu mở, đăng nhập và đồng bộ khi kết nối lại. Dựng bản iOS Simulator trên macOS, không đưa lên store.

**Đặc tả:** Epic `epic-ung-dung-tauri`, R15–R17 và AD-4/AD-9/AD-10. Hai crate Tauri dùng chung `frontend/dist`, giữ học và lưu tiến độ ở frontend. Web tiếp tục dùng redirect HTTPS; Tauri nhận `luyenjlpt://auth-callback` và đổi mã PKCE. Khóa ký cập nhật và keystore không nằm trong Git.

## Thực hiện

1. **Windows, WebDriver:** Tạo vỏ desktop, giới hạn capability ở cửa sổ `main`, đăng ký protocol và chuyển URL từ lần mở thứ hai về cửa sổ hiện có. Dựng NSIS, kiểm tra N4 đóng kèm và callback lúc mở app/lúc app đang chạy.
2. **Android, iOS:** Tạo vỏ mobile cùng app ID gốc, hỗ trợ Android API 26 và iOS 15. Kiểm tra APK mở được và làm flashcard ở chế độ máy bay. Dựng iOS Simulator trên macOS.
3. **Frontend dùng chung:** Kiểm callback chỉ chấp nhận đúng protocol/host và mã PKCE. Mở OAuth qua trình duyệt hệ thống, giữ phiên và thông báo khôi phục mật khẩu. Thêm Giới thiệu, nguồn KANJIDIC2, hướng dẫn bộ cài và thông báo cập nhật.
4. **CI, phát hành:** Dựng frontend và xác minh Gói N4 trước native build. Xuất NSIS, APK và metadata; chỉ ký khi có khóa. Updater desktop xác minh chữ ký, Android so `versionCode` và mở trang tải chính thức. Cách ly secrets khỏi jobs kiểm thử PR.
5. **Nghiệm thu:** Chạy frontend, CI native và test trên bản đã cài. Trên staging, kiểm Google, email, đặt lại mật khẩu và đồng bộ desktop–điện thoại. Kiểm bản cập nhật từ bản ký cũ sang bản ký mới. Ghi riêng kết quả cục bộ và bước cần runner, khóa hoặc người dùng.

## Rủi ro cần kiểm

- Callback trùng ở lúc khởi động không đổi mã hai lần; link sai không đổi phiên.
- Xác nhận và đặt lại mật khẩu mở trên cùng thiết bị đã tạo PKCE verifier.
- Native không dùng service role, khóa riêng hoặc thông tin ký trong tài nguyên bundle.
- Metadata Android không được chuyển người dùng sang origin khác hoặc tải bản cũ.
- Gói nhúng mở được khi chưa có cache hoặc chưa đăng nhập.

## Build và phát hành

CI chạy `Native apps` cho pull request có thay đổi liên quan. Job Windows tạo NSIS và chạy smoke; Android build APK rồi chạy smoke ở chế độ máy bay (360 dp) trên runner riêng; macOS dựng bản Simulator và chạy smoke từ vựng N4. Chỉ dùng bộ cài từ lượt CI đạt để thử bản khách. Bản Android debug dùng khóa thử, không cài đè lên APK phát hành.

Trước lần phát hành đầu tiên:

1. Trong Supabase Auth, giữ redirect web hiện có và thêm `luyenjlpt://auth-callback` cùng `luyenjlpt://auth-callback[?]sb_flow_id=*`. Mở email xác nhận hoặc đặt lại mật khẩu trên thiết bị đã gửi yêu cầu. Kiểm Google và hai luồng email trên bản cài thật.
2. Giữ repo mã nguồn `VanHuynh205/Luyen-JLPT` ở chế độ private. Sau khi xác nhận có thể phân phối nội dung đóng kèm, tạo repo công khai riêng `VanHuynh205/Luyen-JLPT-Releases` với một README và nhánh mặc định. Repo này chỉ nhận bộ cài, metadata và checksum. Không chuyển mã nguồn sang repo phát hành.
3. Bảo vệ nhánh mặc định và tag `v*` trong repo mã nguồn. Tạo môi trường GitHub `native-signing` và `native-publish`, giới hạn ở tag phát hành và yêu cầu người duyệt. Trong `native-publish`, đặt `PUBLIC_RELEASES_TOKEN`: token có quyền `Contents: write` chỉ ở repo phát hành công khai. Trong `native-signing`, đặt variables `NATIVE_SUPABASE_URL`, `NATIVE_SUPABASE_PUBLISHABLE_KEY`, `TAURI_UPDATER_PUBLIC_KEY`, `ANDROID_SIGNING_CERT_SHA256`. Đặt signing secrets chỉ trong `native-signing`: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Giữ bản sao khóa updater và keystore ngoài repo. Không gửi khóa qua chat.
4. Đồng bộ `version` của hai cấu hình Tauri. Chọn tag `vX.Y.Z` khớp, nằm trong lịch sử nhánh mặc định, khi chạy `Native apps` với `publish: true`. Sau ba job hệ điều hành, GitHub Release nhận NSIS, APK ký, `latest.json`, `android-latest.json` và `SHA256SUMS.txt`. Chữ ký updater không thay cho Authenticode; hướng dẫn cài Windows yêu cầu kiểm nguồn trước khi tiếp tục qua SmartScreen.
5. Kiểm bản cài từ hai phiên bản liên tiếp: Windows tải và cài đúng phiên bản đã ký; Android báo và mở đúng APK, Android cho cài đè bằng cùng keystore. Kiểm học N4 ngoại tuyến, đăng nhập và đồng bộ Tiến độ Windows–Android trước khi gửi bạn bè.

Repo nguồn trên GitHub Free phải giữ private. GitHub Free không hỗ trợ cấu hình môi trường có secrets trên repo private. Không chuyển khóa ký sang secrets cấp repo để chạy bước 4. Sau khi chủ repo duyệt nội dung và nắm giữ khóa, ký cục bộ theo [hướng dẫn Windows](../../../desktop/README.md) và [hướng dẫn Android](../../../mobile/README.md). Dùng cùng khóa cho hai bản liên tiếp. Chỉ tải bộ cài và metadata lên repo phân phối sau khi chủ repo duyệt phát hành.

## Nghiệm thu Auth trên staging

Dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` của dự án staging khi build frontend cho cả hai bộ cài. Chạy `node infra/scripts/src/validate-native-env.mjs` trước khi build để kiểm URL Supabase và loại khóa. Phần kiểm này không xác nhận cấu hình Google, email hay redirect; kiểm từng luồng trên bản cài.

Dùng hai tài khoản thử và bản cài Windows/Android trỏ cùng dự án. Giữ URL callback, mã PKCE, token và mật khẩu ngoài ảnh chụp và log. Mỗi lần thử callback dùng một luồng mới; email phải mở trên thiết bị đã gửi yêu cầu.

- **Google:** chọn `Tiếp tục với Google`, xác nhận đúng tài khoản trong trình duyệt hệ thống. Thử một lần mở lại app lạnh và một lần app còn chạy; cả hai lần `Tài khoản` phải hiện đúng người dùng. Khởi động lại để kiểm phiên còn lưu.
- **Xác nhận email:** đăng ký từ app. Mật khẩu chưa đăng nhập được trước khi xác nhận. Sau khi mở thư từ chính thiết bị đó, app phải đăng nhập đúng người và cho đồng bộ.
- **Quên mật khẩu:** gửi yêu cầu khi đã đăng xuất. Link phải mở form `Mật khẩu mới` mà không cần chọn `Đổi mật khẩu`. Lưu, đăng xuất, kiểm mật khẩu cũ bị từ chối và mật khẩu mới dùng được.
- **Đồng bộ:** đánh dấu một thẻ N4 trên Android lúc ngoại tuyến, kết nối lại và kiểm đúng thẻ trên Windows. Kiểm chiều ngược lại với thẻ khác. Tài khoản thứ hai không được thấy hai thay đổi này.

## Kiểm chứng ngày 22-11-2026

- **Windows:** dựng và cài thử NSIS x64. WebDriver nhận callback lỗi lúc mở lạnh và lúc app đang chạy. Flashcard N4 lật được, đánh dấu và giữ trạng thái sau khi tải lại khi WebView bị chặn mạng ngoài. Bản thử đã gỡ; bộ cài khách giữ trong `.cache/epic3-native/verified-installer/`.
- **Updater Windows:** từ chối gói ký cho `0.1.1` khi feed loopback báo `0.1.2`; file thực thi và đăng ký NSIS giữ nguyên. Khi feed báo `0.1.1`, app tải, cài và mở lại đúng bản mới; thẻ N4 vẫn mở được. Xem cách chạy tại `tests/desktop/updater-smoke.md` và log cục bộ `.cache/epic3-updater/353b6b3ec3/smoke-10.log`. Chưa kiểm qua HTTPS với khóa phát hành thật.
- **Android:** dựng `0.1.0` debug x86_64, `versionCode=1000`, `minSdkVersion=26`; `apksigner` xác minh chữ ký debug. Windows không cho Tauri tạo symlink nên bước đóng gói cục bộ dùng Gradle với thư viện Rust đã biên dịch, không đổi quyền hệ thống. Emulator API 34 ở 360 dp cài mới, bật máy bay, tắt Wi-Fi và mở thẻ N4 `見ます`. APK thử nằm trong `.cache/epic3-android/`; chưa có APK phát hành ký bằng keystore thật.
- **Nâng cấp Android:** hai APK thử cùng chứng chỉ, dùng chung mã và tài nguyên; chỉ đổi `versionName` và `versionCode` trong manifest. `adb install -r` nâng `0.1.0 (1000)` lên `0.1.1 (1001)` trên emulator API 34. Ở chế độ máy bay, app mở lại thẻ `見ます`, giữ trạng thái đã thuộc và `updatedAt` trong IndexedDB. Log: `.cache/epic3-android/upgrade-validation/post-upgrade-evidence.txt`. Chưa kiểm nâng cấp giữa hai release thật hay qua trang tải.
- **Web và contract:** 195 test frontend, 93 test build gói và 8 test Android release; `pnpm check`, `pnpm typecheck`, `pnpm build`, `pnpm packs:verify` và `actionlint` đạt. Chromium: 17 bài đạt, 3 bài cần Supabase local được bỏ qua trong lượt này. `mobile/scripts/validate-scaffold.mjs` xác minh SHA-256 của cả chín bảng N4.
- **Kiểm bổ sung:** ký APK release universal `arm64-v8a` và `x86_64` bằng khóa thử. Đối chiếu chứng chỉ và metadata `0.1.0`/`1000`, từ chối fingerprint khác, kiểm ZIP alignment 16 KiB. Bản release ký thử cài mới trên emulator API 34 và mở `見ます` ở chế độ máy bay. Test PKCE dùng Supabase SDK thật với HTTP fixture: Google, xác nhận và khôi phục dùng verifier riêng; callback lạ và replay bị chặn trước HTTP. Đây chưa phải Auth staging.
- **GitHub, PR #1:** lượt `45044714012` dựng và cài được app iOS Simulator. Maestro mở đúng thẻ `見ます`, nhưng cây trợ năng tách bộ đếm `1 / 1182` thành ba phần. Windows dừng vì thừa dấu `--` trước `--locked`; Android không thấy `sdkmanager` trên `PATH`. Đã gộp sửa bộ đếm, tham số build và đường dẫn SDK. Lệnh Windows đã dựng NSIS cục bộ; vẫn cần xác nhận cả ba job trên GitHub.
- **GitHub, PR #1, commit `5aecb40`:** Web/Supabase (`45050344080`) và iOS Simulator (`45050344101`) đạt. Cùng lượt native, Windows dựng NSIS nhưng không tìm được debugger WebView2; Android dựng APK và tìm được AVD nhưng thiếu đĩa để boot. Hai job chưa tải bộ cài lên.
- **Cục bộ ngày 23-11-2026:** bộ cài NSIS qua smoke callback lạnh/nóng với cổng do WebView2 cấp; tiến độ N4 vẫn còn sau khi tải lại. APK debug mở thẻ `見ます` trong chế độ máy bay trên AVD API 34 mới với phân vùng dữ liệu 6 GiB. Cần xác nhận lại trên runner.
- **GitHub, PR #1, commit `36ebef9`:** Web/Supabase (`45055313097`) và iOS Simulator (`45055313138`) đạt. Log Android báo còn `4122.48 MB` sau dọn cache, thiếu so với `7372.80 MB` cần để tạo đĩa dữ liệu. Runner Windows không ghi `DevToolsActivePort`. Job publish không chạy.
- **Bản sửa chưa chạy trên GitHub:** Android chuyển APK từ job build sang một runner chỉ chạy emulator và smoke. Thử luồng chuyển APK cục bộ đã boot AVD nhưng gặp hộp thoại `Pixel Launcher isn't responding`. Windows dùng UI Automation cho cold callback, không bật CDP trong bộ cài; NSIS thử qua cold/warm callback, flashcard ngoại tuyến và lưu tiến độ cục bộ.
- **Cục bộ, sau commit `5891dd8`:** chạy lại `tests/mobile/android-ci-smoke.sh` trên AVD API 34 mới. Không gặp hộp thoại Pixel Launcher; smoke dừng vì sau `wm size 1080x1920`, nút `Bắt đầu học` chỉ còn dải `[48,1917][456,1920]` dưới thanh cử chỉ, nên lệnh chạm không tới app. Smoke giờ cuộn trước khi chạm nút bị cắt ở mép dưới, và chấp nhận `uiautomator dump` thoát mã 137 sau khi đã ghi file. Phân vùng dữ liệu AVD trên CI giảm còn 2G (cần khoảng 2.4 GB trống thay vì 7.37 GB). Cold callback Windows chờ tối đa 60 giây, giữ kết quả đã thấy giữa các lượt quét vì toast tự đóng sau 4 giây, và báo app đã thoát hay chưa khi lỗi. Sau sửa: script CI Android đạt ba lần boot mới liên tiếp, lần cuối với userdata tạo lại từ cấu hình 2G (`hardware-qemu.ini` ghi `disk.dataPartition.size = 2g`); Windows smoke trên bộ cài NSIS cục bộ đạt trong 5 giây rồi gỡ cài đặt. Chưa có kết quả trên GitHub.
- **GitHub, PR #1, commit `ca65540` (`45063997472`):** iOS đạt. Android boot được (runner còn 7.6 GB) nhưng hộp thoại `Pixel Launcher isn't responding` che app. Cục bộ, `am_anr` cho thấy launcher ANR vì `input keyevent 82` (MENU) chờ quá 5 giây khi launcher còn bận; smoke giờ dùng `wm dismiss-keyguard` và bấm `Wait` nếu gặp hộp thoại ANR. Windows qua cold callback bằng UI Automation nhưng `POST /session` hết hạn sau 60 giây: msedgedriver vẫn không gắn được vào WebView2 trên runner. Smoke chờ 120 giây để lộ lỗi của msedgedriver và in tiến trình WebView2, file `DevToolsActivePort`, policy Edge khi thất bại.
- **GitHub, commit `392f960` (`45066393984`):** msedgedriver báo `session not created: DevToolsActivePort file doesn't exist`; runner chạy elevated (High). WebView2 Runtime 150 trở lên bỏ qua `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` khi host elevated (MicrosoftEdge/WebView2Feedback#5640), nên cả cờ debug lẫn cờ proxy ngoại tuyến không có tác dụng; máy cục bộ chạy Medium nên vẫn đạt. Workflow giờ ghi các cờ này vào policy `HKLM\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments` cho `luyen-jlpt-desktop.exe`, chỉ trên runner. Android lần này dừng vì `adb install` APK 190 MB quá 30 giây; lệnh cài giờ chờ 180 giây. Test web `kanji-quiz-count` có race: tải lại trước khi IndexedDB ghi xong số câu; test giờ chờ IndexedDB rồi mới tải lại (đạt 5/5 lần cục bộ).
- **Còn mở:** chưa có release công khai hoặc nghiệm thu Auth, Đồng bộ hai chiều và cập nhật qua hai bản phát hành ký thật trên staging.

## Bước kế tiếp

### Checkpoint phát hành ngày 23-11-2026

- Repo nguồn `VanHuynh205/Luyen-JLPT` vẫn private. Repo phân phối `VanHuynh205/Luyen-JLPT-Releases` đã public, có nhánh `main` và README, chưa có release. Không có mã nguồn hay dataset trong repo này. Chưa có xác nhận quyền phân phối công khai phần giáo trình Minna; chỉ upload sau khi chủ dự án xác nhận quyền cho nội dung đóng kèm.
- Hai môi trường trên **repo nguồn**, `native-signing` và `native-publish`, đều chỉ cho tag `v*`. GitHub trả HTTP 422 khi yêu cầu reviewer bảo vệ môi trường, HTTP 403 khi kiểm tra branch protection và rulesets. Không đặt khóa, token publish hoặc mật khẩu vào GitHub. Dùng luồng ký local; tag filter không thay cho duyệt phát hành.
- ID cố định cho bản phân phối trực tiếp là `vn.luyenjlpt.app`. Project Android sinh mới có cả `namespace` và `applicationId` này. APK thử hậu tố `.mobile` không nâng cấp tại chỗ sang ID mới. Cặp bản dùng nghiệm thu phải cùng ID mới và cùng chứng chỉ. Không dùng lại Gradle/Xcode project sinh theo ID cũ.
- Khóa updater đã ký một mẫu thử; kiểm độc lập cả chữ ký payload lẫn trusted comment chứa version. Keystore Android PKCS12 có alias `luyen-jlpt-release`, SHA-256 chứng chỉ `8B912DF32875CF913BB759376238D5DE13B1E275F70D42934A66CD429926A6FC`. Các kiểm tra này chưa chứng minh cập nhật app.
- Staging web theo plan Epic 2 trỏ tới Supabase ref `vuyanbtfmhnqvirkikgf`. Endpoint settings công khai báo Google/email bật, xác nhận email bắt buộc, đăng ký mở. [Biên bản Auth và đồng bộ](../../2026-11-23-nghiem-thu-auth-staging-native.md) phân biệt test web, test giả lập và kết quả trên bản cài.
- Run `45130724256` xanh trên commit `9f6a06e`; không bao gồm UI 3D hoặc ID vừa sửa trong working tree. Chỉ dùng kết quả CI trên chính revision dự định phát hành.

### Bàn giao khóa cho người phát hành

`native-signing` có bốn biến không bí mật: URL và publishable key của staging, pubkey updater và fingerprint Android đã đối chiếu với chứng chỉ xuất từ keystore. Cả hai môi trường không có signing secret hoặc token publish. Các tệp nghiệm thu ký cục bộ chưa được tải lên GitHub; trước khi phát stable, xác nhận custody và bản sao phục hồi độc lập.

Trên máy tạo khóa, `%LOCALAPPDATA%\LuyenJLPT-ReleaseSigning` chỉ cấp quyền cho tài khoản Windows đã tạo khóa. `updater.key` và `android-release.p12` có mật khẩu riêng. `updater.key.pub` và `android-release.cer` là dữ liệu công khai. Các tệp `*.password.dpapi` chỉ mở được trong ngữ cảnh tài khoản/máy này. Chép mỗi thư mục sang máy khác chưa phải sao lưu phục hồi được.

Trước khi ký bản đầu, người giữ khóa nhập hai mật khẩu vào kho mật khẩu riêng, sao lưu hai khóa đã mã hóa ở nơi độc lập và thử phục hồi trên một hồ sơ khác. Đừng in mật khẩu ra console hoặc gửi qua chat. Trên máy gốc, dùng PowerShell 7 trong phiên riêng; chỉ nạp bí mật sau khi build xong. Ví dụ nạp mật khẩu cho **bước ký** rồi đóng phiên ngay sau khi kiểm chứng:

```powershell
$vault = Join-Path $env:LOCALAPPDATA 'LuyenJLPT-ReleaseSigning'
function Read-SigningPassword($file) {
  $secure = Get-Content -Raw -LiteralPath (Join-Path $vault $file)
  [Net.NetworkCredential]::new('', (ConvertTo-SecureString $secure.Trim())).Password
}
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = Join-Path $vault 'updater.key'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Read-SigningPassword 'updater.password.dpapi'
$env:ANDROID_KEYSTORE_PATH = Join-Path $vault 'android-release.p12'
$env:ANDROID_KEYSTORE_PASSWORD = Read-SigningPassword 'android.password.dpapi'
$env:ANDROID_KEY_PASSWORD = $env:ANDROID_KEYSTORE_PASSWORD
$env:ANDROID_KEY_ALIAS = 'luyen-jlpt-release'
$env:ANDROID_SIGNING_CERT_SHA256 = '8B912DF32875CF913BB759376238D5DE13B1E275F70D42934A66CD429926A6FC'
```

Với NSIS đã nhúng đúng pubkey và endpoint release, `pnpm exec tauri signer sign --app-version <version-trong-NSIS> <installer>` ký file bằng khóa theo đường dẫn. Với APK unsigned, dùng `sign-android.mjs` và `android-release.mjs metadata` theo hướng dẫn Android. Chỉ ký bộ cài đã kiểm nguồn, môi trường và version; không ký installer dùng endpoint thử bằng khóa chính thức.

### Bản nghiệm thu nội bộ (không phát công khai)

Hai bộ cài QA `0.1.2` đã được cài đè trên Windows và Android thật và xác nhận đầy đủ các luồng Auth + đồng bộ trên staging: đăng nhập Google, đăng ký/xác nhận email, đặt lại mật khẩu và đồng bộ hai chiều Windows–Android giữa hai tài khoản QA. Các bộ cài nội bộ nằm trong `.cache/epic3-identity-check/qa-0.1.1/` và `.cache/epic3-identity-check/qa-0.1.2/` (chưa phát ra feed công khai).

- Windows x64: dựng hai bộ NSIS `0.1.0`/`0.1.1` và bản QA `0.1.2` (SHA-256 `5be4acb7ce45ed4c3e9bd0ff6506ea3adc205fcd2b874c7ddea11541274c3026`) nhúng frontend staging theo đường dẫn **tương đối** `frontendDist`, endpoint HTTPS như release, cùng pubkey. `0.1.0` qua smoke callback lỗi lạnh/nóng, mở thẻ N4 và lưu cục bộ khi ngoại tuyến; cài đè lên `0.1.1` giữ `見ます` là `Đã thuộc` trên cùng hồ sơ WebView2; cài đè lên `0.1.2` xác nhận Auth và đồng bộ trên máy thật. Chưa thử tải/cài qua thông báo updater ở feed HTTPS công khai; chữ ký updater không phải Authenticode.
- Android x86_64 và ARM64: cặp staging `0.1.0` (`1000`) / `0.1.1` (`1001`) cùng `vn.luyenjlpt.app` và một signer trùng fingerprint phát hành đã cài đè ngoại tuyến trên AVD API 34 giữ tiến độ `1/1182`, UID và `dataDir`. Bản QA ARM64 `0.1.2` (`1002`, SHA-256 `46300ed7c73be7741a88f3e4db33aa0115ccfef3f4ab6785d345f4bea7a2d3d1`, căn chỉnh 16 KiB) đã cài đè trên thiết bị Android thật và xác nhận Auth + đồng bộ hai chiều với Windows.
- UI dùng chung: trang học không tải scene 3D, giảm chuyển động của hệ điều hành thắng tùy chọn `full`, thiếu WebGL2 hoặc mất context thì giữ SVG và nút học. Bộ kiểm baseline (`pnpm check`, `pnpm typecheck`, `pnpm packs:verify`, `pnpm test`, `android-release.test.mjs`, `validate-scaffold.mjs`, `pnpm build`) đạt.
- Chuẩn bị phát hành bản đầu `0.2.0` (`versionCode` Android `2000`, lớn hơn bản QA `0.1.2` / `1002`): tăng đồng bộ `version` trong hai cấu hình Tauri lên `0.2.0`, chạy CI native (Windows, Android, iOS Simulator) trên đúng revision phát hành, kiểm cập nhật từ bản ký cũ `0.1.2` sang `0.2.0` qua feed HTTPS công khai rồi phát hành trên `VanHuynh205/Luyen-JLPT-Releases`. Không tạo tag cho bản QA.

Khi Windows và Android phát hành thử đạt, cho bạn bè dùng `.exe`/`.apk`. Epic 4 có thể chuẩn bị song song: refine `epic-ngu-phap-mo-rong`, bắt đầu ánh xạ `comparisons.patterns` sang ID mẫu ngữ pháp, ghi mẫu không khớp trong báo cáo build.
