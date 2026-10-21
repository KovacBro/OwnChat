$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "data\server.pid"
if (Test-Path $pidFile) {
  $serverPid = (Get-Content $pidFile -Raw).Trim()
  if ($serverPid -match '^\d+$') {
    Stop-Process -Id ([int]$serverPid) -Force
    Write-Host "OwnChat stopped (PID $serverPid)."
    Remove-Item $pidFile -Force
    exit
  }
}
Write-Host "OwnChat is not running."
