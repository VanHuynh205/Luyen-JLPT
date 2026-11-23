$ErrorActionPreference = 'Stop'
$output = Join-Path $env:RUNNER_TEMP 'windows-native'
$bundle = @(Get-ChildItem 'desktop/src-tauri/target/release/bundle/nsis/*-setup.exe')
if ($bundle.Count -ne 1) { throw 'Expected one NSIS installer' }
New-Item -Path $output -ItemType Directory -Force | Out-Null
$asset = 'Luyen-JLPT-windows-x64-setup.exe'
Copy-Item -LiteralPath $bundle[0].FullName -Destination (Join-Path $output $asset)
if ($env:PUBLISH -ne 'true') { exit 0 }
$signaturePath = "$($bundle[0].FullName).sig"
$signature = (Get-Content -LiteralPath $signaturePath -Raw).Trim()
if (!$signature) { throw 'Missing NSIS updater signature' }
Copy-Item -LiteralPath $signaturePath -Destination (Join-Path $output "$asset.sig")
@{
  version = $env:APP_VERSION
  platforms = @{
    'windows-x86_64-nsis' = @{
      signature = $signature
      url = "https://github.com/VanHuynh205/Luyen-JLPT-Releases/releases/download/v$env:APP_VERSION/$asset"
    }
  }
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'latest.json') -Encoding utf8
