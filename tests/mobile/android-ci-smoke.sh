#!/usr/bin/env bash
set -euo pipefail

output="$RUNNER_TEMP/android-native"
if [[ "${PUBLISH:-false}" == true ]]; then
  apk="$output/Luyen-JLPT-android.apk"
else
  apk="$output/Luyen-JLPT-android-debug.apk"
fi
if [[ ! -s "$apk" ]]; then
  echo "Missing Android smoke APK: $apk" >&2
  exit 1
fi
export ANDROID_SERIAL=emulator-5554
emulator_log="$RUNNER_TEMP/emulator.log"
"$ANDROID_HOME/emulator/emulator" -avd luyen-jlpt -port 5554 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > "$emulator_log" 2>&1 &
emulator_pid=$!
trap 'if kill -0 "$emulator_pid" 2>/dev/null; then adb emu kill || kill "$emulator_pid"; fi' EXIT
if ! timeout 300 bash -c '
  while kill -0 "$1" 2>/dev/null; do
    if [[ $(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r") == 1 ]]; then exit 0; fi
    sleep 3
  done
  exit 1
' _ "$emulator_pid"; then
  echo 'Android emulator did not boot.' >&2
  tail -n 80 "$emulator_log" >&2
  exit 1
fi
adb shell wm size 1080x1920
adb shell wm density 480
adb shell input keyevent 82
node tests/mobile/android-offline-smoke.mjs "$apk" --required
