$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BackendEnv = Join-Path $Root "backend\.env"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-EnvFile {
  if (Test-Path -LiteralPath $BackendEnv) {
    Write-Host "backend\.env already exists; keeping your current config."
    return
  }

  @'
DATABASE_URL="file:./dev.db"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_FAST_MODEL="deepseek-v4-flash"
DEEPSEEK_STRONG_MODEL="deepseek-v4-pro"
USE_MOCK_LLM="true"
PORT=3000
CORS_ORIGIN="*"
'@ | Set-Content -LiteralPath $BackendEnv -Encoding UTF8

  Write-Host "Created backend\.env. It uses mock LLM by default."
}

Set-Location -LiteralPath $Root

Write-Step "Preparing backend .env"
Ensure-EnvFile

Write-Step "Installing dependencies"
if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  npm install
} else {
  Write-Host "node_modules already exists; skipping npm install."
}

Write-Step "Generating Prisma Client"
npm run prisma:generate -w backend

Write-Step "Creating local SQLite database tables"
npm run prisma:migrate -w backend -- --name init

Write-Step "Seeding default scenario and prompts"
npm run prisma:seed -w backend

Write-Host ""
Write-Host "Setup completed." -ForegroundColor Green
Write-Host "Next: double-click start-dev.bat, or run npm run backend:dev and npm run frontend:dev."
