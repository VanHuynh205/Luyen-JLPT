#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
apps=(mobile/src-tauri/gen/apple/build/arm64-sim/*.app)
test "${#apps[@]}" -eq 1
app="${apps[0]}"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")" = vn.luyenjlpt.app.mobile

work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/luyen-ios.XXXXXX")"
reports="${RUNNER_TEMP:-$work}/ios-smoke"
mkdir -p "$reports"
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/maestro.zip \
  --output "$work/maestro.zip"
printf '%s  %s\n' 54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7 "$work/maestro.zip" \
  | shasum -a 256 --check
unzip -q "$work/maestro.zip" -d "$work"
export MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DISABLE_UPDATE_CHECK=true
maestro="$work/maestro/bin/maestro"

udid="$(xcrun simctl create Luyen-JLPT-Smoke \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-26-2)"
trap 'xcrun simctl shutdown "$udid" || true; xcrun simctl delete "$udid"' EXIT
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$app"
"$maestro" --device "$udid" test --format junit \
  --output "$reports/vocabulary.xml" --test-output-dir "$reports/vocabulary" \
  tests/mobile/ios/vocabulary.yaml
