#!/usr/bin/env bash
set -euo pipefail

output="$RUNNER_TEMP/android-native"
if [[ "${PUBLISH:-false}" == true ]]; then
  apk="$output/Luyen-JLPT-android.apk"
else
  mapfile -t apks < <(find mobile/src-tauri/gen/android/app/build/outputs/apk -name '*-debug.apk')
  test "${#apks[@]}" -eq 1
  apk="${apks[0]}"
fi
test -f "$apk"
export ANDROID_SERIAL=emulator-5554
"$ANDROID_HOME/emulator/emulator" -avd luyen-jlpt -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > "$RUNNER_TEMP/emulator.log" 2>&1 &
trap 'adb emu kill || true' EXIT
timeout 300 bash -c 'adb wait-for-device; until [[ $(adb shell getprop sys.boot_completed | tr -d "\r") == 1 ]]; do sleep 3; done'
adb shell wm size 1080x1920
adb shell wm density 480
adb shell input keyevent 82
node tests/mobile/android-offline-smoke.mjs "$apk" --required
if [[ "${PUBLISH:-false}" != true ]]; then
  mkdir -p "$output"
  cp "$apk" "$output/Luyen-JLPT-android-debug.apk"
fi
