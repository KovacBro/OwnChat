param(
  [string]$Version = "0.2.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must be MAJOR.MINOR.PATCH, got: $Version"
}
$parts = $Version.Split('.')
if ($parts[2] -ne '0') {
  throw "Only MAJOR.MINOR.0 releases get installers. Patch releases are source-only."
}

$iscc = "C:\Users\$env:USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
  )
  $iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $iscc) { throw "ISCC.exe not found. Install Inno Setup 6 first." }

$staging = Join-Path $root ".build\staging"
$dist = Join-Path $root "dist"
$node = Join-Path $env:ProgramFiles "nodejs\node.exe"
if (-not (Test-Path $node)) { throw "node.exe not found at $node" }
$nodeLicense = Join-Path $env:ProgramFiles "nodejs\LICENSE"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force $staging, $dist | Out-Null

$files = @(
  "package.json", "server.js", "README.md", "CHANGELOG.md", "LICENSE",
  "start.bat", "start.ps1", "start.vbs", "stop.bat", "stop.ps1"
)
foreach ($file in $files) {
  $source = Join-Path $root $file
  if (-not (Test-Path $source)) { throw "Missing release file: $file" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $staging $file) -Force
}

Copy-Item -LiteralPath (Join-Path $root "lib") -Destination (Join-Path $staging "lib") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root "public") -Destination (Join-Path $staging "public") -Recurse -Force
Copy-Item -LiteralPath $node -Destination (Join-Path $staging "node.exe") -Force
Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $staging "LICENSE.node.txt") -Force

$pkgPath = Join-Path $staging "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkg.version = $Version
# -Encoding UTF8 in Windows PowerShell 5.1 writes a BOM, and Node's JSON.parse
# chokes on it. Write UTF-8 without BOM explicitly.
$pkgJson = $pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($pkgPath, $pkgJson, (New-Object System.Text.UTF8Encoding($false)))

# Keep the app icon next to start scripts for the installer and shortcuts.
Copy-Item -LiteralPath (Join-Path $root "installer\OwnChat.ico") -Destination (Join-Path $staging "OwnChat.ico") -Force

Write-Host "Building installer for $Version..."
& $iscc "/DMyAppVersion=$Version" (Join-Path $root "installer\OwnChat.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed with exit code $LASTEXITCODE" }

$setup = Join-Path $dist "OwnChat-$Version-win64-setup.exe"
if (-not (Test-Path $setup)) { throw "Installer was not created: $setup" }

$portable = Join-Path $dist "OwnChat-$Version-win64-portable.zip"
if (Test-Path $portable) { Remove-Item $portable -Force }
Write-Host "Building portable zip..."
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $portable -CompressionLevel Optimal -Force

$lines = @()
foreach ($file in @($setup, $portable)) {
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  $lines += "$hash  $([System.IO.Path]::GetFileName($file))"
}
$lines | Set-Content (Join-Path $dist "SHA256SUMS.txt") -Encoding ASCII

Write-Host ""
Write-Host "Release assets:"
Get-ChildItem $dist -File | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host "SHA256:"
$lines | ForEach-Object { Write-Host "  $_" }
