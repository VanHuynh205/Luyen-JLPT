# Windows updater smoke

Run from the repository root in PowerShell 7 on a test host with an existing WebView2 runtime, Node.js, the installed workspace dependencies, the cached Rust toolchain and Cargo registry in `.cache/epic3-native`, a populated Tauri NSIS cache, and a built `frontend/dist` containing the desktop update UI and N4 packs. The build copies these inputs; it does not rebuild the frontend or download tooling.

```powershell
& tests/desktop/updater-build.ps1
node tests/desktop/updater-smoke.mjs .cache/epic3-updater/<tag>
```

Use the tag printed by the build. Set `-Port` on the build if the default feed/debug ports (39187 and 39188) are not free. Run the smoke only with permission to perform per-user NSIS installs and launch native windows. Use a test account with no existing `luyenjlpt` protocol registration. The runner checks both registry views before installing and refuses to reuse a prior installation or app data directory.

The smoke installs `0.1.0`, opens the guest home, and clicks the real update action. It first offers the signed `0.1.1` package as `0.1.2` and checks that the download is rejected without replacing the executable. It then offers the same package as `0.1.1`, verifies the installed executable hash and NSIS `DisplayVersion`, and opens a bundled flashcard in the relaunched WebView. The runner uninstalls only its own uniquely named app and checks that `luyenjlpt` remains unregistered. Build artifacts and test data remain in the ignored run directory; the ephemeral private key is removed by the builder.

The smoke uses a dedicated app identity, no registered protocol, HTTP bound to `127.0.0.1`, and the already-installed WebView2 runtime. It does not cover production HTTPS delivery, release keys, Authenticode, WebView2 installation, or account sessions.
