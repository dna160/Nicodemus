# Nicodemus Modal Deployment Script (PowerShell)
# Deploys the Modal app with direct HTTP calls to Claude API

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Nicodemus Modal Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[✓] Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[✗] ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://www.python.org/" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[1/4] Creating Python virtual environment..." -ForegroundColor Yellow
python -m venv .venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "[✗] ERROR: Failed to create virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[✓] Virtual environment created" -ForegroundColor Green

Write-Host ""
Write-Host "[2/4] Activating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[✗] ERROR: Failed to activate virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[✓] Virtual environment activated" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] Installing Modal CLI and dependencies..." -ForegroundColor Yellow
pip install --upgrade pip wheel setuptools | Out-Null
pip install modal | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[✗] ERROR: Failed to install Modal" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[✓] Modal installed" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] Setting Modal authentication token..." -ForegroundColor Yellow
modal token set --token-id "ak-vVywpNbP14lsgnicIY600l" --token-secret "as-zoD8rPXrx8ufuwfx99ptsG"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[✗] ERROR: Failed to set Modal token" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[✓] Modal token configured" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Ready to deploy!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. In this same terminal, run:" -ForegroundColor White
Write-Host "   modal deploy modal_app.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Wait for deployment to complete (takes 1-2 minutes)" -ForegroundColor White
Write-Host ""
Write-Host "3. Open a new terminal and run:" -ForegroundColor White
Write-Host "   pnpm dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Open http://localhost:3000/dashboard in your browser" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to continue"
