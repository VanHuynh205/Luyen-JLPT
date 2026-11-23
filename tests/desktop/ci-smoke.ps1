$ErrorActionPreference = 'Stop'
Get-Command tauri-driver, msedgedriver -ErrorAction Stop | Out-Null
$installers = @(Get-ChildItem 'desktop/src-tauri/target/release/bundle/nsis/*-setup.exe')
if ($installers.Count -ne 1) { throw 'Expected one NSIS installer' }
$installDir = Join-Path $env:LOCALAPPDATA 'LuyenJLPT-DesktopSmoke'
$process = Start-Process $installers[0].FullName -ArgumentList "/S /D=$installDir" -PassThru -Wait -WindowStyle Hidden
if ($process.ExitCode -ne 0) { throw 'NSIS installation failed' }
$app = Join-Path $installDir 'luyen-jlpt-desktop.exe'
if (!(Test-Path -LiteralPath $app)) { throw 'Installed desktop executable was not found' }
node tests/desktop/smoke.mjs --app $app
exit $LASTEXITCODE
