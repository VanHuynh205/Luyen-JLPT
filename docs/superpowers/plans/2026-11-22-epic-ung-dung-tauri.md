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
- **Còn mở:** chưa có release công khai hoặc nghiệm thu Auth, Đồng bộ hai chiều và cập nhật qua hai bản phát hành ký thật trên staging.

## Bước kế tiếp

Khi Windows và Android phát hành thử đạt, cho bạn bè dùng `.exe`/`.apk`. Epic 4 có thể chuẩn bị song song: refine `epic-ngu-phap-mo-rong`, bắt đầu ánh xạ `comparisons.patterns` sang ID mẫu ngữ pháp, ghi mẫu không khớp trong báo cáo build.
