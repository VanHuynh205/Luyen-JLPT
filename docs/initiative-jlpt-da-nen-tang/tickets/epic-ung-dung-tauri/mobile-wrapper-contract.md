# Contract vỏ Tauri mobile

Task B dùng Tauri CLI `2.12.6`, Rust `tauri 2.12.7` và `tauri-build 2.7.6`. Android API 26+ là nền tảng phát hành trước; iOS 15+ có cấu hình init trên macOS. Xem [lệnh dựng, ký và kiểm tra](../../../../mobile/README.md). CI sinh Gradle project bằng `tauri android init --ci` tại `mobile/src-tauri/gen/android/` thay vì commit project đã sinh.

- AD-4: vỏ đóng gói `frontend/dist`; gate `node mobile/scripts/validate-scaffold.mjs` kiểm index và SHA-256 của chín bảng N4. Mở app lần đầu ở chế độ máy bay trên emulator là bước kiểm tra riêng.
- AD-10: callback `luyenjlpt://auth-callback` dùng plugin deep-link. Frontend quản lý route, xử lý callback, thông báo cập nhật và nội dung Giới thiệu. Vỏ chỉ cấp quyền native cần thiết cho các thao tác này.
- Release: tên APK là `Luyen-JLPT-android.apk`. File `android-latest.json` có `{version, versionCode, url}`; script chỉ xuất sau khi đối chiếu manifest và xác minh chữ ký. Version code lấy từ công thức mặc định của Tauri, không dùng số build tự tăng. PR có thể build debug và chạy static gate mà không cần secret.
