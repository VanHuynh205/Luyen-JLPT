#!/usr/bin/env bash
set -euo pipefail

test "${ANDROID_RELEASE_SIGNING_ENABLED:-}" = true
test -n "${ANDROID_KEYSTORE_BASE64:-}"
mapfile -t apks < <(find mobile/src-tauri/gen/android/app/build/outputs/apk -name '*-release-unsigned.apk')
test "${#apks[@]}" -eq 1
umask 077
export ANDROID_KEYSTORE_PATH="$(mktemp "$RUNNER_TEMP/luyen-keystore.XXXXXX")"
trap 'rm -f -- "$ANDROID_KEYSTORE_PATH"' EXIT
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$ANDROID_KEYSTORE_PATH"
unset ANDROID_KEYSTORE_BASE64
output="$RUNNER_TEMP/android-native"
mkdir -p "$output"
node mobile/scripts/sign-android.mjs "${apks[0]}" "$output/Luyen-JLPT-android.apk"
node mobile/scripts/android-release.mjs metadata "$output/Luyen-JLPT-android.apk" > "$output/android-latest.json"
