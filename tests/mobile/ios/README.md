# iOS Simulator smoke

`vocabulary.yaml` launches the installed `vn.luyenjlpt.app.mobile`, taps
`Bắt đầu học`, and checks the N4 heading, first card `見ます`, and position
`1 / 1182`. Use a fresh Simulator so local progress and level preferences cannot
affect the result. The smoke needs no Supabase configuration or Apple signing secrets.

## Build

From the repo root in Bash on `macos-15` arm64. Use Node 22 (22.12 or newer),
pnpm 10.26.1, stable Rust (at least 1.90), and Xcode 26.3 with the iOS 26.2
Simulator runtime. Keep `DEVELOPER_DIR` set for both the build and smoke steps.

```bash
set -euo pipefail
test "$(uname -m)" = arm64
export DEVELOPER_DIR=/Applications/Xcode_26.3.app/Contents/Developer
xcodebuild -version
xcrun simctl list runtimes available
rustup target add aarch64-apple-ios-sim
pnpm install --frozen-lockfile
pnpm --filter @luyen/frontend build
pnpm packs:verify
test "$(cd mobile && pnpm exec tauri --version)" = 'tauri-cli 2.12.6'
(
  cd mobile
  pnpm exec tauri ios init --ci
  pnpm exec tauri icon app-icon.svg
  pnpm exec tauri ios build --ci --debug --no-sign --target aarch64-sim
)

shopt -s nullglob
apps=("$PWD"/mobile/src-tauri/gen/apple/build/arm64-sim/*.app)
test "${#apps[@]}" -eq 1
IOS_APP="${apps[0]}"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$IOS_APP/Info.plist")" = vn.luyenjlpt.app.mobile
```

The frontend build generates the packs. Leave `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` unset for this smoke build. `IOS_APP` must point
to the exported Simulator `.app`, not an `.ipa` or the `.xcarchive` directory.

## Boot, install, and test

Continue in the same shell, or set the absolute `IOS_APP` and export
`DEVELOPER_DIR` again in the test step. Use an arm64 JDK 17+ for Maestro.

```bash
set -euo pipefail
java -version
work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/luyen-ios.XXXXXX")"
reports="${RUNNER_TEMP:-$work}/ios-smoke"
mkdir -p "$reports"

curl --fail --silent --show-error --location --retry 3 \
  https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/maestro.zip \
  --output "$work/maestro.zip"
printf '%s  %s\n' 54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7 "$work/maestro.zip" \
  | shasum -a 256 --check
unzip -q "$work/maestro.zip" -d "$work"
MAESTRO="$work/maestro/bin/maestro"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true
"$MAESTRO" --version

UDID="$(xcrun simctl create Luyen-JLPT-Smoke \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-26-2)"
trap 'xcrun simctl shutdown "$UDID" || true; xcrun simctl delete "$UDID"' EXIT
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$IOS_APP"

"$MAESTRO" --device "$UDID" test --format junit \
  --output "$reports/vocabulary.xml" --test-output-dir "$reports/vocabulary" \
  tests/mobile/ios/vocabulary.yaml
```

Upload `$RUNNER_TEMP/ios-smoke/` even on failure. Pass the flow file explicitly
so the optional callback never becomes part of the required vocabulary gate.

## Optional callback

In the same shell, after the vocabulary smoke and before the Simulator cleanup:

```bash
"$MAESTRO" --device "$UDID" test --format junit \
  --output "$reports/auth-callback.xml" --test-output-dir "$reports/auth-callback" \
  tests/mobile/ios/auth-callback.yaml
```

The flow opens `luyenjlpt://auth-callback?error=access_denied` in the running app
and expects the neutral toast and `Tài khoản` heading. It requires the built
app to register `luyenjlpt` in `CFBundleURLTypes`. Keep this flow opt-in until
URL delivery and the transient toast are verified on the runner; use
`xcrun simctl openurl "$UDID" 'luyenjlpt://auth-callback?error=access_denied'`
for manual diagnosis.

## Verification

Windows cannot build the `.app` or run CoreSimulator. The first macOS run must
confirm the build/export, boot and install, and WKWebView accessibility selectors.
No Simulator pass is claimed.

Primary references: [Tauri CLI 2.12.6 iOS build](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.6/crates/tauri-cli/src/mobile/ios/build.rs),
[Simulator target mapping](https://github.com/tauri-apps/cargo-mobile2/blob/cargo-mobile2-v0.22.5/src/apple/target.rs),
[macos-15 arm64 runner inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md),
[Apple Simulator CLI](https://developer.apple.com/videos/play/wwdc2020/10647/),
[Maestro 2.12.1 release assets](https://api.github.com/repos/mobile-dev-inc/Maestro/releases/tags/cli-2.12.1),
[Maestro device option](https://github.com/mobile-dev-inc/Maestro/blob/cli-2.12.1/maestro-cli/src/main/java/maestro/cli/App.kt)
and [test options](https://github.com/mobile-dev-inc/Maestro/blob/cli-2.12.1/maestro-cli/src/main/java/maestro/cli/command/TestCommand.kt).
