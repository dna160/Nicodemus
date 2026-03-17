@echo off
REM Nicodemus Modal Deployment Script
REM Deploys the Modal app with direct HTTP calls to Claude API

setlocal enabledelayedexpansion

echo ============================================
echo Nicodemus Modal Deployment
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [1/4] Creating Python virtual environment...
python -m venv .venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)
echo ✓ Virtual environment created

echo.
echo [2/4] Activating virtual environment...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)
echo ✓ Virtual environment activated

echo.
echo [3/4] Installing Modal CLI and dependencies...
pip install --upgrade pip wheel setuptools >nul 2>&1
pip install modal >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Modal
    pause
    exit /b 1
)
echo ✓ Modal installed

echo.
echo [4/4] Setting Modal authentication token...
modal token set --token-id "ak-vVywpNbP14lsgnicIY600l" --token-secret "as-zoD8rPXrx8ufuwfx99ptsG"
if %errorlevel% neq 0 (
    echo ERROR: Failed to set Modal token
    pause
    exit /b 1
)
echo ✓ Modal token configured

echo.
echo ============================================
echo Ready to deploy!
echo ============================================
echo.
echo Next steps:
echo.
echo 1. In this same terminal, run:
echo    modal deploy modal_app.py
echo.
echo 2. Wait for deployment to complete (takes 1-2 minutes)
echo.
echo 3. Open a new terminal and run:
echo    pnpm dev
echo.
echo 4. Open http://localhost:3000/dashboard in your browser
echo.
pause
