param(
    [ValidateRange(1024, 65534)] [int]$Port = 39187,
    [ValidatePattern('^[a-f0-9]{10}$')] [string]$ReuseCacheTag
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$cache = Join-Path $repo '.cache/epic3-updater'
$native = Join-Path $repo '.cache/epic3-native'
$cli = Join-Path $repo 'node_modules/@tauri-apps/cli/tauri.js'
$tag = if ($ReuseCacheTag) { $ReuseCacheTag } else { [guid]::NewGuid().ToString('N').Substring(0, 10) }
$run = Join-Path $cache $tag
$stage = Join-Path $run 'desktop'
$tauri = Join-Path $stage 'src-tauri'
$target = Join-Path $run 'target'
$privateKey = Join-Path $run 'ephemeral.key'

if ($env:OS -ne 'Windows_NT') { throw 'The updater smoke requires Windows' }
$toolchains = @(Get-ChildItem (Join-Path $native 'rustup/toolchains') -Directory -Filter 'stable-*-windows-msvc')
if ($toolchains.Count -ne 1) { throw 'Expected one cached stable Windows MSVC toolchain' }
$localNsis = Join-Path $env:LOCALAPPDATA 'tauri/NSIS'
if (!(Test-Path (Join-Path $localNsis 'makensis.exe'))) { throw 'A populated Tauri NSIS cache is required' }
$debuggerPort = $Port + 1
$product = "Luyen JLPT Updater Smoke $tag"
$binary = "luyen-updater-smoke-$tag"
$identifier = "vn.updatersmoke.test$tag"
$endpoint = "http://127.0.0.1:$Port/$tag/latest.json"

if (!$ReuseCacheTag) {
    New-Item -ItemType Directory -Path $tauri, "$run/frontend", "$target/.tauri", "$run/cargo", "$run/tmp" | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'frontend/dist') -Destination "$run/frontend" -Recurse
    New-Item -ItemType Directory -Path "$run/frontend/public" | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'frontend/public/favicon.ico') -Destination "$run/frontend/public"
    foreach ($name in @('Cargo.toml', 'Cargo.lock', 'build.rs', 'tauri.conf.json', 'src', 'capabilities')) {
        Copy-Item -LiteralPath (Join-Path $repo "desktop/src-tauri/$name") -Destination $tauri -Recurse
    }
    Copy-Item -LiteralPath $localNsis -Destination "$target/.tauri" -Recurse
    Copy-Item -LiteralPath (Join-Path $native 'cargo/registry') -Destination "$run/cargo" -Recurse
} elseif ((Get-Item -LiteralPath $run).LinkType -or (Test-Path "$run/installed") -or (Test-Path $privateKey)) {
    throw 'Reuse is allowed only for an uninstalled, inactive updater build cache'
}

$env:CARGO_HOME = "$run/cargo"
$env:CARGO_TARGET_DIR = $target
$env:CARGO_NET_OFFLINE = 'true'
$env:TMP = "$run/tmp"
$env:TEMP = $env:TMP
$env:Path = "$(Join-Path $toolchains[0].FullName 'bin');$env:Path"
Remove-Item Env:TAURI_CONFIG,Env:TAURI_SIGNING_PRIVATE_KEY,Env:TAURI_SIGNING_PRIVATE_KEY_PATH,Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue

Write-Output "Updater run: $run"
Push-Location $stage
try {
    & node $cli signer generate --ci --force --write-keys $privateKey *> "$run/keygen.log"
    $env:TAURI_SIGNING_PRIVATE_KEY = [IO.File]::ReadAllText($privateKey).Trim()
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
    $windows = (Get-Content -LiteralPath "$tauri/tauri.conf.json" -Raw | ConvertFrom-Json -AsHashtable).app.windows
    if ($windows.Count -ne 1 -or $windows[0].label -ne 'main') { throw 'Expected exactly one main WebView' }
    $windows[0].additionalBrowserArgs = "--remote-debugging-port=$debuggerPort --remote-debugging-address=127.0.0.1 --proxy-server=127.0.0.1:9 --proxy-bypass-list=<-loopback>;tauri.localhost;ipc.localhost"
    $override = @{
        productName = $product
        mainBinaryName = $binary
        identifier = $identifier
        app = @{ appDirectoriesOverride = "$run/app-data"; windows = $windows }
        bundle = @{
            publisher = "UpdaterSmoke-$tag"
            createUpdaterArtifacts = $true
            useLocalToolsDir = $true
            windows = @{ webviewInstallMode = @{ type = 'skip' }; nsis = @{ compression = 'zlib' } }
        }
        plugins = @{
            'deep-link' = @{ desktop = @{ schemes = @() } }
            updater = @{
                endpoints = @($endpoint)
                pubkey = [IO.File]::ReadAllText("$privateKey.pub").Trim()
                requireSignedVersion = $true
                dangerousInsecureTransportProtocol = $true
                windows = @{ installerArgs = @('/NS') }
            }
        }
    }
    foreach ($version in @('0.1.0', '0.1.1')) {
        $override.version = $version
        $overridePath = Join-Path $run "$version.conf.json"
        $override | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $overridePath -Encoding utf8
        Write-Output "Building isolated Windows NSIS $version"
        & node $cli build --ci --bundles nsis --config $overridePath -- --offline --locked *> "$run/build-$version.log"
        $installer = @(Get-ChildItem "$target/release/bundle/nsis" -File -Filter "*_${version}_*-setup.exe")
        if ($installer.Count -ne 1 -or !(Test-Path -LiteralPath "$($installer[0].FullName).sig")) {
            throw "Expected exactly one signed NSIS installer for $version"
        }
        Copy-Item -LiteralPath $installer[0].FullName -Destination "$run/$version-setup.exe"
        Copy-Item -LiteralPath "$($installer[0].FullName).sig" -Destination "$run/$version-setup.exe.sig"
        (Get-FileHash -LiteralPath "$target/release/$binary.exe").Hash | Set-Content "$run/$version-exe.sha256"
    }
    $signature = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String((Get-Content "$run/0.1.1-setup.exe.sig" -Raw).Trim()))
    if ($signature -notmatch "`tversion:0\.1\.1(?:\s|$)") { throw 'Update signature does not bind version 0.1.1' }
    @{ tag = $tag; port = $Port; debuggerPort = $debuggerPort; product = $product; binary = $binary; endpoint = $endpoint } |
        ConvertTo-Json | Set-Content -LiteralPath "$run/manifest.json" -Encoding utf8
    Write-Output "Signed installers ready: $run"
} finally {
    Pop-Location
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY,Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $privateKey -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$run/keygen.log" -ErrorAction SilentlyContinue
}
