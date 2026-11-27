#[cfg(target_os = "android")]
use tauri::ipc::{Channel, InvokeResponseBody};
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;
use tauri::plugin::{Builder, TauriPlugin};
#[cfg(target_os = "android")]
use tauri::{Emitter, Manager};
use tauri::{AppHandle, Runtime};

const MAX_ANDROID_APK_BYTES: u64 = 62_914_560;
const RELEASE_PREFIX: &str = "https://github.com/VanHuynh205/Luyen-JLPT/releases/download/v";
const RELEASE_SUFFIX: &str = "/Luyen-JLPT-android.apk";

#[cfg(target_os = "android")]
struct AndroidUpdaterHandle<R: Runtime>(PluginHandle<R>);

fn is_valid_version_part(part: &str, max_len: usize) -> bool {
    if part.is_empty() || part.len() > max_len || !part.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    !(part.len() > 1 && part.starts_with('0'))
}

fn parse_release_version_code(version: &str) -> Result<u64, String> {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3
        || !is_valid_version_part(parts[0], 4)
        || !is_valid_version_part(parts[1], 3)
        || !is_valid_version_part(parts[2], 3)
    {
        return Err("Phiên bản trong URL tải APK không hợp lệ.".into());
    }
    let major: u64 = parts[0]
        .parse()
        .map_err(|_| "Phiên bản trong URL tải APK không hợp lệ.".to_string())?;
    let minor: u64 = parts[1]
        .parse()
        .map_err(|_| "Phiên bản trong URL tải APK không hợp lệ.".to_string())?;
    let patch: u64 = parts[2]
        .parse()
        .map_err(|_| "Phiên bản trong URL tải APK không hợp lệ.".to_string())?;
    let version_code = major * 1_000_000 + minor * 1_000 + patch;
    if version_code == 0 || version_code > 2_100_000_000 {
        return Err("Phiên bản trong URL tải APK không hợp lệ.".into());
    }
    Ok(version_code)
}

fn validate_apk_request(
    url: &str,
    expected_sha256: &str,
    expected_size_bytes: u64,
    expected_version_code: u64,
) -> Result<String, String> {
    if !url.starts_with(RELEASE_PREFIX)
        || !url.ends_with(RELEASE_SUFFIX)
        || url.contains('?')
        || url.contains('#')
        || url.contains("..")
        || url.chars().any(char::is_whitespace)
    {
        return Err("URL tải APK không khớp nguồn phát hành chính thức.".into());
    }
    let version = &url[RELEASE_PREFIX.len()..url.len() - RELEASE_SUFFIX.len()];
    let version_code = parse_release_version_code(version)?;
    let normalized_sha = expected_sha256.trim().to_ascii_lowercase();
    if normalized_sha.len() != 64 || !normalized_sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Mã kiểm tra SHA-256 không hợp lệ.".into());
    }
    if expected_size_bytes == 0 || expected_size_bytes > MAX_ANDROID_APK_BYTES {
        return Err("Dung lượng APK vượt ngưỡng an toàn cho phép.".into());
    }
    if expected_version_code == 0
        || expected_version_code > 2_100_000_000
        || version_code != expected_version_code
    {
        return Err("Mã phiên bản Android không hợp lệ.".into());
    }
    Ok(normalized_sha)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-updater")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("vn.luyenjlpt.app", "ApkInstallerPlugin")?;
                app.manage(AndroidUpdaterHandle(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn install_android_apk<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    expected_sha256: String,
    expected_size_bytes: u64,
    expected_version_code: u64,
) -> Result<(), String> {
    let normalized_sha = validate_apk_request(
        &url,
        &expected_sha256,
        expected_size_bytes,
        expected_version_code,
    )?;

    #[cfg(target_os = "android")]
    {
        let handle = app.state::<AndroidUpdaterHandle<R>>().0.clone();
        let app_for_events = app.clone();
        let on_progress = Channel::new(move |event: InvokeResponseBody| {
            if let InvokeResponseBody::Json(raw) = event {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
                    let _ = app_for_events.emit("android-update-progress", value);
                }
            }
            Ok(())
        });

        let payload = serde_json::json!({
            "url": url,
            "expectedSha256": normalized_sha,
            "expectedSizeBytes": expected_size_bytes,
            "expectedVersionCode": expected_version_code,
            "onProgress": on_progress,
        });

        handle
            .run_mobile_plugin_async::<serde_json::Value>("installApk", payload)
            .await
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (&app, normalized_sha);
        Err("Cài đặt APK trong ứng dụng chỉ hỗ trợ trên Android.".into())
    }
}
