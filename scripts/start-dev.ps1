$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$netstatLines = netstat -ano | Select-String ":3000"
$pids = @()
foreach ($line in $netstatLines) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
  if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") {
    $pids += $parts[4]
  }
}

foreach ($nodePid in ($pids | Select-Object -Unique)) {
  try {
    taskkill /PID $nodePid /F *> $null
    Write-Host "Stopped old backend process on port 3000: $nodePid"
  } catch {
    Write-Host "Could not stop old process $nodePid. Close the old backend window manually if port 3000 is busy." -ForegroundColor Yellow
  }
}

Start-Process powershell -WindowStyle Normal -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$Root'; npm run backend:dev"
)

Start-Process powershell -WindowStyle Normal -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$Root'; npm run frontend:dev"
)

Write-Host "Opened backend and frontend dev windows."
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend: http://localhost:3000"
