# Vỏ Tauri mobile

Android dùng ID `vn.luyenjlpt.app`, hỗ trợ Android 8.0 (API 26) trở lên. Vỏ dùng `../../frontend/dist`, không có bản sao frontend hay dữ liệu N4 riêng. Origin HTTPS cục bộ cho WebView Android cho phép loader dùng `crypto.subtle` để kiểm hash và mở gói N4 trong `/packs` khi ngoại tuyến.

## Dựng Android

Kênh phát trực tiếp giữ ID `vn.luyenjlpt.app`. Bản thử cũ dùng `.mobile` là ứng dụng khác: không gỡ nếu còn tiến độ chưa đồng bộ. Khi chuyển ID, sinh lại project Android/iOS trong checkout sạch để Gradle và Xcode không giữ namespace cũ.

Từ root, cài dependency của workspace và build frontend (`pnpm --filter @luyen/frontend build`). Sau đó:

```sh
node --test tests/mobile/android-release.test.mjs
node mobile/scripts/validate-scaffold.mjs
cargo metadata --locked --no-deps --manifest-path mobile/src-tauri/Cargo.toml --format-version 1
cd mobile
pnpm exec tauri --version
pnpm exec tauri android init --ci
pnpm exec tauri icon app-icon.svg
pnpm exec tauri android build --ci --apk --debug --target x86_64
```

CLI phải là `2.12.6`; CI dùng Rust `1.100.0`. Thêm target `x86_64-linux-android` cho emulator x86_64 và `aarch64-linux-android` cho máy ARM64. Runner dùng JDK 21, SDK `platforms;android-37.0`, Platform Tools, Build Tools `37.0.0` và NDK `29.0.14206865`. Đặt `JAVA_HOME`, `ANDROID_HOME` (hoặc `ANDROID_SDK_ROOT`) và `NDK_HOME`. Cài thêm system image/API để chạy emulator. Trên Windows, Tauri cần quyền tạo symbolic link khi sinh APK; nếu host không có quyền này, dùng runner Linux.

`android init` tạo `mobile/src-tauri/gen/android/`. Chạy `tauri icon` sau `init` để sinh icon Rust và cập nhật resource của project đã sinh. Git bỏ qua `gen/android`, `gen/apple`, schema và icon sinh ra; giữ `Cargo.lock`. Đầu ra APK nằm dưới `mobile/src-tauri/gen/android/app/build/outputs/apk/`.

Từ root, chạy `node tests/mobile/android-offline-smoke.mjs <debug.apk> --required` trên emulator API 34+ đã mở khóa, chưa cài app. Smoke test cài APK, bật chế độ máy bay và tắt Wi-Fi trước lần mở đầu tiên, rồi dùng UI Automator để mở Từ vựng và kiểm tra từ đầu tiên của gói N4. Script gỡ APK thử và khôi phục cài đặt mạng sau khi chạy. Khi không có APK, `adb` hoặc emulator, chạy không có `--required` sẽ in `SKIP`. Dùng `ANDROID_SERIAL` để chọn emulator khi có nhiều thiết bị.

Test callback từ host, không đặt mã xác thực thật trong log hoặc command history:

```sh
adb shell am start -W -a android.intent.action.VIEW -d luyenjlpt://auth-callback vn.luyenjlpt.app
```

Thử khi app đã đóng và khi đang chạy. URI thiếu mã dùng để kiểm phản hồi trung tính của frontend. Thêm `luyenjlpt://auth-callback[?]sb_flow_id=*` vào redirect allowlist của Supabase để nhận lại mã PKCE và ID phiên đã tạo.

## Ký APK và xuất metadata

Protected release job dùng `tauri android build --ci --apk --target aarch64` cho ARM64 hoặc chọn nhiều target phù hợp trong cùng APK. Không dùng `--split-per-abi` nếu chỉ phát hành một APK. Từ root, chọn đúng một file `*-release-unsigned.apk` trong thư mục output và đặt đường dẫn tuyệt đối vào `UNSIGNED_APK`. Chuẩn bị thư mục output `RELEASE_DIR` trước khi ký. Ví dụ shell CI:

```sh
node mobile/scripts/android-release.mjs check "$UNSIGNED_APK"
node mobile/scripts/sign-android.mjs "$UNSIGNED_APK" "$RELEASE_DIR/Luyen-JLPT-android.apk"
node mobile/scripts/android-release.mjs metadata "$RELEASE_DIR/Luyen-JLPT-android.apk" > "$RELEASE_DIR/android-latest.json"
```

Chỉ ký khi `ANDROID_RELEASE_SIGNING_ENABLED=true`. Release job phải cấp `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` và `ANDROID_SIGNING_CERT_SHA256`. Lấy fingerprint SHA-256 từ chứng chỉ của keystore phát hành đã duyệt, bằng `keytool -list -v` hoặc từ một APK đã phát hành bằng `apksigner verify --print-certs`. Đặt keystore được giải mã ở thư mục tạm của runner, ngoài checkout. Script đọc mật khẩu qua env và không xuất APK hoặc metadata khi fingerprint không khớp.

Mỗi release tăng `version` trong `src-tauri/tauri.conf.json`, dùng `X.Y.Z` với `Y` và `Z` dưới 1000. Để `versionCode` và `autoIncrementVersionCode` unset. CLI Android tính `X × 1_000_000 + Y × 1_000 + Z`; `0.1.0` tương ứng `1000`. Frontend lấy phiên bản cài đặt bằng `getVersion()`. `node mobile/scripts/android-release.mjs version` in contract dự kiến; `check` đối chiếu versionCode, versionName, application ID và min SDK trong APK. `metadata` chỉ in JSON sau khi manifest và chữ ký của APK đều qua kiểm tra.

Đăng hai file vào GitHub Release tag `vX.Y.Z` của repo phân phối công khai riêng. `android-latest.json` chứa `version`, `versionCode`, `url`; `url` trỏ tới `https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/download/vX.Y.Z/Luyen-JLPT-android.apk`. App Android đọc metadata từ `https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/latest/download/android-latest.json`. Native ACL giới hạn URL metadata và redirect HTTPS của GitHub Release Assets. Plugin opener giới hạn APK theo tên và repo, OAuth theo endpoint Supabase authorize, cùng các liên kết Giới thiệu. Giữ nguyên keystore để Android cho cài đè.

## iOS

Trên macOS có Xcode, Rust target iOS và toolchain của Tauri, chạy `pnpm exec tauri ios init --ci` từ `mobile/`, rồi `pnpm exec tauri icon app-icon.svg`. Project được sinh vào `mobile/src-tauri/gen/apple/`; deployment target là iOS 15. Chạy smoke test bằng iOS Simulator trước khi thử thiết bị thật. Windows không có lệnh `tauri ios` và không build hoặc ký iOS.
