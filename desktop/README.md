# Windows desktop shell

The Windows app bundles `frontend/dist` and reuses the web favicon. The app ID is `vn.luyenjlpt.app`; the installer registers `luyenjlpt://` per user. The frontend validates the `auth-callback` host and processes PKCE. Build and install from the same Windows user that runs the smoke test.

## Local build

Install stable Rust for MSVC (opener requires Rust 1.90 or higher) and Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK. Install the repo dependencies with `pnpm install --frozen-lockfile`. From the repo root:

```powershell
pnpm --filter @luyen/frontend build
pnpm tauri:desktop build --bundles nsis --ci '--' --locked
```

The installer is under `desktop/src-tauri/target/release/bundle/nsis/` unless Cargo's target directory is overridden. Building it downloads the WebView2 offline installer; installing it does not require a WebView2 download. Start Tauri in `desktop/` to select this crate when the repo also contains a mobile crate.

For development, run `pnpm --filter @luyen/frontend dev` at `http://localhost:5173`, then run `pnpm tauri:desktop dev`. On Windows, use the installed NSIS build to exercise the protocol registration.

Only the local `main` window has native permissions. The opener allows the default browser to open `https://<20-character-project-ref>.supabase.co/auth/v1/authorize?…` and the three exact About links (KANJIDIC, CC BY-SA 4.0 and the GitHub Releases page). Local Supabase, custom domains and other GitHub URLs are outside this scope.

## Release updater build

The default build has the updater disabled and produces no updater artifacts. For a release, set `TAURI_UPDATER_PUBLIC_KEY` to the existing updater public key contents, and provide `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from the release secret store. After building the frontend, run this from the repo root in PowerShell 7:

```powershell
if ([string]::IsNullOrWhiteSpace($env:TAURI_UPDATER_PUBLIC_KEY)) { throw 'Missing updater public key' }
$releaseConfig = Join-Path $env:TEMP "luyen-jlpt-release-$PID.json"
$config = Get-Content desktop/src-tauri/tauri.release.conf.example.json -Raw | ConvertFrom-Json -AsHashtable
$config.plugins.updater.pubkey = $env:TAURI_UPDATER_PUBLIC_KEY.Trim()
try {
  $config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $releaseConfig -Encoding utf8
  pnpm tauri:desktop build --bundles nsis --ci --config $releaseConfig '--' --locked
  if ($LASTEXITCODE -ne 0) { throw 'Desktop release build failed' }
} finally {
  Remove-Item -LiteralPath $releaseConfig -ErrorAction SilentlyContinue
}
```

Release CI owns `latest.json`: use the release version and, for `windows-x86_64-nsis`, the installer download URL and the matching `.sig` contents. The update client reads `latest.json` from the latest release in the separate public distribution repository `VanHuynh205/Luyen-JLPT-Releases`. It rejects installer signatures that do not bind the manifest version. Keep the private key and the materialized config out of Git.

## Desktop smoke contract

Put `tauri-driver` and `msedgedriver` on `PATH`. Use the Microsoft Edge WebDriver version that matches the runner's WebView2 Runtime. Install the NSIS bundle before invoking the smoke, so the Windows protocol is registered. Example from the repo root with the default Cargo target directory:

```powershell
$installer = @(Get-ChildItem desktop/src-tauri/target/release/bundle/nsis/*-setup.exe)
if ($installer.Count -ne 1) { throw 'Expected one NSIS installer' }
$installDir = Join-Path $env:LOCALAPPDATA 'LuyenJLPT-DesktopSmoke'
$process = Start-Process $installer[0].FullName -ArgumentList "/S /D=$installDir" -PassThru -Wait -WindowStyle Hidden
if ($process.ExitCode -ne 0) { throw 'NSIS installation failed' }
node tests/desktop/smoke.mjs --app (Join-Path $installDir 'luyen-jlpt-desktop.exe')
```

Run on a dedicated runner with no other instance of the app. The smoke uses Node's built-ins, a fresh WebView2 profile, and a proxy that blocks external web traffic. It launches the installed executable with a cancelled callback, then starts a clean session, flips an N4 flashcard, marks it known and checks that progress survives a reload. It delivers an invalid code using Windows protocol activation with that instance open. Both callbacks must show the `Tài khoản` heading and `Liên kết tài khoản không hợp lệ hoặc đã hết hạn.` toast at `#/tai-khoan`. No Supabase credentials are required. The test uses localhost ports 4444 and 4445 by default (`TAURI_DRIVER_PORT` and `TAURI_NATIVE_DRIVER_PORT` override them).
