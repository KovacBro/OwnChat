$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$edgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$url = "http://127.0.0.1:17321"

$runtime = Join-Path $root "data\runtime.json"
if (Test-Path $runtime) {
  try {
    $info = Get-Content $runtime -Raw | ConvertFrom-Json
    if ($info.url) { $url = $info.url }
  } catch {}
}

$alive = $false
try {
  $response = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 2
  $alive = $response.StatusCode -eq 200
} catch {}

if (-not $alive) {
  $node = Join-Path $root "node.exe"
  if (-not (Test-Path $node)) { $node = "node" }
  $outLog = Join-Path $root "data\server.log"
  $errLog = Join-Path $root "data\server.err.log"
  Start-Process -FilePath $node -ArgumentList @("server.js", "--managed") -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  Start-Sleep -Seconds 2
  if (Test-Path $runtime) {
    try {
      $info = Get-Content $runtime -Raw | ConvertFrom-Json
      if ($info.url) { $url = $info.url }
    } catch {}
  }
}

if ($edge) {
  $profile = Join-Path $root "data\edge-profile"
  Start-Process -FilePath $edge -ArgumentList @(
    "--app=$url/?app=1",
    "--window-size=1180,780",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$profile"
  )
} else {
  Start-Process $url
}
