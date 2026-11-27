import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ANDROID_DIR = fileURLToPath(
  new URL("../src-tauri/gen/android", import.meta.url),
);

const FILE_PATHS_XML = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="updates" path="updates/" />
</paths>
`;

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const FILE_PROVIDER_BLOCK = `        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>`;

const APK_INSTALLER_PLUGIN_KT = `package vn.luyenjlpt.app

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import javax.net.ssl.HttpsURLConnection

@InvokeArg
class InstallApkArgs {
    var url: String = ""
    var expectedSha256: String = ""
    var expectedSizeBytes: Long = 0L
    var expectedVersionCode: Long = 0L
    var onProgress: Channel? = null
}

@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        private const val EXPECTED_PACKAGE = "vn.luyenjlpt.app"
        private const val MAX_APK_BYTES = 62_914_560L
        private const val MAX_REDIRECTS = 5
        private const val CONNECT_TIMEOUT_MS = 15_000
        private const val READ_TIMEOUT_MS = 30_000
        private val CANONICAL_URL = Regex(
            "^https://github\\\\.com/VanHuynh205/Luyen-JLPT/releases/download/v(0|[1-9]\\\\d{0,3})\\\\.(0|[1-9]\\\\d{0,2})\\\\.(0|[1-9]\\\\d{0,2})/Luyen-JLPT-android\\\\.apk$"
        )
        private val SHA256_HEX = Regex("^[a-fA-F0-9]{64}$")
    }

    init {
        cleanStaleApks()
    }

    override fun load(webView: WebView) {
        super.load(webView)
        cleanStaleApks()
    }

    private fun updatesDir(): File {
        val dir = File(activity.cacheDir, "updates")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    private fun cleanStaleApks() {
        val dir = File(activity.cacheDir, "updates")
        if (!dir.isDirectory) return
        dir.listFiles()?.forEach { file ->
            if (file.isFile && file.name.endsWith(".apk", ignoreCase = true)) {
                file.delete()
            }
        }
    }

    @Command
    fun installApk(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(InstallApkArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Tham số cập nhật không hợp lệ.")
            return
        }

        if (!CANONICAL_URL.matches(args.url)) {
            invoke.reject("URL tải APK không khớp nguồn phát hành chính thức.")
            return
        }
        if (!SHA256_HEX.matches(args.expectedSha256)) {
            invoke.reject("Mã kiểm tra SHA-256 không hợp lệ.")
            return
        }
        if (args.expectedSizeBytes < 1L || args.expectedSizeBytes > MAX_APK_BYTES) {
            invoke.reject("Dung lượng APK vượt ngưỡng an toàn cho phép.")
            return
        }

        Thread({
            val pendingFile = File(updatesDir(), "pending.apk")
            try {
                cleanStaleApks()
                val installedInfo = getInstalledPackageInfo()
                val installedVersionCode = getPackageVersionCode(installedInfo)
                if (args.expectedVersionCode <= installedVersionCode) {
                    throw SecurityException("Phiên bản cập nhật không mới hơn bản đang cài.")
                }

                val sizeCap = minOf(args.expectedSizeBytes, MAX_APK_BYTES)
                downloadHttpsApk(args.url, pendingFile, sizeCap, args.onProgress)

                if (pendingFile.length() != args.expectedSizeBytes) {
                    throw SecurityException("Dung lượng APK tải về không khớp siêu dữ liệu.")
                }

                emitProgress(args.onProgress, 100, "verifying")
                verifySha256(pendingFile, args.expectedSha256)
                verifyArchiveIntegrity(
                    pendingFile,
                    installedInfo,
                    installedVersionCode,
                    args.expectedVersionCode
                )

                if (!activity.packageManager.canRequestPackageInstalls()) {
                    pendingFile.delete()
                    activity.runOnUiThread {
                        val settingsIntent = Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:\${activity.packageName}")
                        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        activity.startActivity(settingsIntent)
                    }
                    invoke.reject("PERMISSION_REQUIRED: Hãy bật quyền cài đặt ứng dụng không rõ nguồn cho Luyện JLPT rồi thử lại.")
                    return@Thread
                }

                val contentUri = FileProvider.getUriForFile(
                    activity,
                    "\${activity.packageName}.fileprovider",
                    pendingFile
                )
                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(contentUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.runOnUiThread {
                    activity.startActivity(installIntent)
                }
                val result = JSObject()
                result.put("started", true)
                invoke.resolve(result)
            } catch (e: Exception) {
                pendingFile.delete()
                invoke.reject(e.message ?: "Không thể tải hoặc xác minh tệp APK.")
            }
        }, "luyen-apk-updater").start()
    }

    private fun emitProgress(channel: Channel?, percent: Int, stage: String) {
        if (channel == null) return
        val payload = JSObject().apply {
            put("percent", percent.coerceIn(0, 100))
            put("stage", stage)
        }
        channel.send(payload)
    }

    private fun isAllowedDownloadHost(host: String): Boolean {
        val normalized = host.lowercase()
        return normalized == "github.com" || normalized.endsWith(".githubusercontent.com")
    }

    private fun downloadHttpsApk(
        initialUrl: String,
        target: File,
        sizeCap: Long,
        onProgress: Channel?
    ) {
        var currentUrl = URL(initialUrl)
        var connection: HttpsURLConnection? = null
        try {
            var redirects = 0
            while (true) {
                if (!currentUrl.protocol.equals("https", ignoreCase = true)) {
                    throw SecurityException("Từ chối chuyển hướng không dùng HTTPS.")
                }
                if (!isAllowedDownloadHost(currentUrl.host)) {
                    throw SecurityException("Tên miền tải APK không nằm trong danh sách cho phép.")
                }
                val conn = (currentUrl.openConnection() as? HttpsURLConnection)
                    ?: throw SecurityException("Kết nối tải APK bắt buộc dùng HTTPS.")
                conn.instanceFollowRedirects = false
                conn.connectTimeout = CONNECT_TIMEOUT_MS
                conn.readTimeout = READ_TIMEOUT_MS
                conn.requestMethod = "GET"
                conn.setRequestProperty("Accept", "application/octet-stream")
                conn.connect()

                val status = conn.responseCode
                if (status in listOf(
                        HttpURLConnection.HTTP_MOVED_PERM,
                        HttpURLConnection.HTTP_MOVED_TEMP,
                        HttpURLConnection.HTTP_SEE_OTHER,
                        307,
                        308
                    )
                ) {
                    val location = conn.getHeaderField("Location")
                        ?: throw SecurityException("Chuyển hướng tải APK thiếu Location.")
                    conn.disconnect()
                    redirects += 1
                    if (redirects > MAX_REDIRECTS) {
                        throw SecurityException("Quá nhiều lượt chuyển hướng khi tải APK.")
                    }
                    currentUrl = URL(currentUrl, location)
                    continue
                }
                connection = conn
                break
            }

            val conn = connection ?: throw IllegalStateException("Không mở được kết nối tải APK.")
            if (conn.responseCode != HttpURLConnection.HTTP_OK) {
                throw IllegalStateException("Máy chủ trả mã lỗi HTTP \${conn.responseCode}.")
            }
            val contentLength = conn.contentLengthLong
            if (contentLength > sizeCap) {
                throw SecurityException("Dung lượng phản hồi vượt giới hạn an toàn.")
            }
            val totalForPercent = if (contentLength > 0L) contentLength else sizeCap

            emitProgress(onProgress, 0, "downloading")
            var downloaded = 0L
            var lastPercent = 0
            conn.inputStream.use { input ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        downloaded += read.toLong()
                        if (downloaded > sizeCap) {
                            throw SecurityException("Tệp APK vượt quá dung lượng tối đa cho phép.")
                        }
                        output.write(buffer, 0, read)
                        val percent = ((downloaded * 100L) / totalForPercent).toInt().coerceIn(0, 99)
                        if (percent > lastPercent) {
                            lastPercent = percent
                            emitProgress(onProgress, percent, "downloading")
                        }
                    }
                    output.fd.sync()
                }
            }
        } finally {
            connection?.disconnect()
        }
    }

    private fun verifySha256(file: File, expectedHex: String) {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(16 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                digest.update(buffer, 0, read)
            }
        }
        val actual = digest.digest()
        val expected = hexToBytes(expectedHex)
        if (!MessageDigest.isEqual(actual, expected)) {
            throw SecurityException("Mã kiểm tra SHA-256 của tệp APK không khớp.")
        }
    }

    private fun hexToBytes(hex: String): ByteArray {
        val out = ByteArray(hex.length / 2)
        for (i in out.indices) {
            val high = Character.digit(hex[i * 2], 16)
            val low = Character.digit(hex[i * 2 + 1], 16)
            if (high < 0 || low < 0) {
                throw SecurityException("Chuỗi hex SHA-256 không hợp lệ.")
            }
            out[i] = ((high shl 4) or low).toByte()
        }
        return out
    }

    @Suppress("DEPRECATION")
    private fun getInstalledPackageInfo(): PackageInfo {
        val pm = activity.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return pm.getPackageInfo(activity.packageName, flags)
    }

    @Suppress("DEPRECATION")
    private fun getArchivePackageInfo(apkFile: File): PackageInfo {
        val pm = activity.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return pm.getPackageArchiveInfo(apkFile.absolutePath, flags)
            ?: throw SecurityException("Không đọc được thông tin gói APK.")
    }

    @Suppress("DEPRECATION")
    private fun getPackageVersionCode(info: PackageInfo): Long {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            info.versionCode.toLong()
        }
    }

    @Suppress("DEPRECATION")
    private fun extractSignerDigests(info: PackageInfo): List<ByteArray> {
        val rawSignatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo
                ?: throw SecurityException("Không tìm thấy chứng chỉ ký APK.")
            if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
        } else {
            info.signatures
        }
        if (rawSignatures == null || rawSignatures.isEmpty()) {
            throw SecurityException("APK không có chứng chỉ ký hợp lệ.")
        }
        val sha256 = MessageDigest.getInstance("SHA-256")
        return rawSignatures.map { sig -> sha256.digest(sig.toByteArray()) }
    }

    private fun verifyArchiveIntegrity(
        apkFile: File,
        installedInfo: PackageInfo,
        installedVersionCode: Long,
        expectedVersionCode: Long
    ) {
        val archiveInfo = getArchivePackageInfo(apkFile)
        if (archiveInfo.packageName != EXPECTED_PACKAGE) {
            throw SecurityException("Tên gói APK không khớp vn.luyenjlpt.app.")
        }
        val archiveVersionCode = getPackageVersionCode(archiveInfo)
        if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= installedVersionCode) {
            throw SecurityException("Mã phiên bản APK không hợp lệ hoặc bị hạ cấp.")
        }
        val installedDigests = extractSignerDigests(installedInfo)
        val archiveDigests = extractSignerDigests(archiveInfo)
        if (installedDigests.size != 1 || archiveDigests.size != 1) {
            throw SecurityException("Chứng chỉ ký APK không khớp cấu hình 1 khóa phát hành.")
        }
        if (!MessageDigest.isEqual(installedDigests[0], archiveDigests[0])) {
            throw SecurityException("Chứng chỉ ký APK mới không khớp ứng dụng đang cài.")
        }
    }
}
`;

function patchManifestContent(xml) {
  let next = xml;

  if (!next.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
    const appIdx = next.indexOf("<application");
    if (appIdx === -1) {
      throw new Error("AndroidManifest.xml is missing <application>");
    }
    next =
      `${next.slice(0, appIdx)}    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n${next.slice(appIdx)}`;
  }

  next = next.replace(/<application\b[^>]*>/, (openTag) => {
    let patchedTag = openTag;
    if (/android:usesCleartextTraffic\s*=/.test(patchedTag)) {
      patchedTag = patchedTag.replace(
        /android:usesCleartextTraffic\s*=\s*"[^"]*"/,
        'android:usesCleartextTraffic="false"',
      );
    } else {
      patchedTag = patchedTag.replace(
        />$/,
        '\n        android:usesCleartextTraffic="false">',
      );
    }

    if (/android:networkSecurityConfig\s*=/.test(patchedTag)) {
      patchedTag = patchedTag.replace(
        /android:networkSecurityConfig\s*=\s*"[^"]*"/,
        'android:networkSecurityConfig="@xml/network_security_config"',
      );
    } else {
      patchedTag = patchedTag.replace(
        />$/,
        '\n        android:networkSecurityConfig="@xml/network_security_config">',
      );
    }
    return patchedTag;
  });

  if (!next.includes("androidx.core.content.FileProvider")) {
    const closeIdx = next.lastIndexOf("</application>");
    if (closeIdx === -1) {
      throw new Error("AndroidManifest.xml is missing </application>");
    }
    next = `${next.slice(0, closeIdx)}${FILE_PROVIDER_BLOCK}\n    ${next.slice(closeIdx)}`;
  }

  return next;
}

function writeFileEnsuringDir(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

export function patchAndroidProject(androidDir = DEFAULT_ANDROID_DIR) {
  const root = resolve(androidDir);
  const mainDir = join(root, "app", "src", "main");
  const manifestPath = join(mainDir, "AndroidManifest.xml");
  const originalManifest = readFileSync(manifestPath, "utf8");
  const patchedManifest = patchManifestContent(originalManifest);
  writeFileSync(manifestPath, patchedManifest, "utf8");

  writeFileEnsuringDir(join(mainDir, "res", "xml", "file_paths.xml"), FILE_PATHS_XML);
  writeFileEnsuringDir(
    join(mainDir, "res", "xml", "network_security_config.xml"),
    NETWORK_SECURITY_CONFIG_XML,
  );
  writeFileEnsuringDir(
    join(mainDir, "java", "vn", "luyenjlpt", "app", "ApkInstallerPlugin.kt"),
    APK_INSTALLER_PLUGIN_KT,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    patchAndroidProject(process.argv[2] || DEFAULT_ANDROID_DIR);
    console.log("Android manifest, network security config, FileProvider and ApkInstallerPlugin patched.");
  } catch (error) {
    console.error(`patch-android-manifest: ${error.message}`);
    process.exitCode = 2;
  }
}
