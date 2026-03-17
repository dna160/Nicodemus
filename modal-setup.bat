@echo off
REM Setup Modal secrets and deploy

setlocal enabledelayedexpansion

echo ============================================
echo Modal Deployment Setup
echo ============================================
echo.

REM Activate virtual environment
call .venv\Scripts\activate.bat

echo [1/3] Setting Modal authentication...
modal token set --token-id "ak-vVywpNbP14lsgnicIY600l" --token-secret "as-zoD8rPXrx8ufuwfx99ptsG"
if %errorlevel% neq 0 (
    echo ERROR: Failed to set Modal token
    pause
    exit /b 1
)
echo ✓ Modal token set

echo.
echo [2/3] Creating Modal secret for Claude API key...
REM Read CLAUDE_API_KEY from .env
for /f "tokens=2 delims==" %%a in ('findstr "^CLAUDE_API_KEY=" .env') do set CLAUDE_API_KEY=%%a

if "%CLAUDE_API_KEY%"=="" (
    echo ERROR: CLAUDE_API_KEY not found in .env file
    pause
    exit /b 1
)

echo CLAUDE_API_KEY=%CLAUDE_API_KEY% | modal secret create nicodemus-claude-key

if %errorlevel% neq 0 (
    echo WARNING: Could not create secret (may already exist)
    echo You can update it with:
    echo   echo CLAUDE_API_KEY=YOUR_KEY ^| modal secret update nicodemus-claude-key
)
echo ✓ Modal secret configured

echo.
echo [3/3] Deploying Modal app...
modal deploy modal_app.py --secret nicodemus-claude-key
if %errorlevel% neq 0 (
    echo ERROR: Deployment failed
    echo.
    echo Troubleshooting:
    echo 1. Check Modal logs: modal logs modal_app.py
    echo 2. Verify API key is correct in .env
    echo 3. Try: modal deploy --force modal_app.py
    pause
    exit /b 1
)

echo.
echo ============================================
echo ✓ Modal app deployed successfully!
echo ============================================
echo.
echo Your Modal API is ready at:
echo   https://leonardijohnson0--nicodemus-ai-api.modal.run
echo.
echo Next: Open a new terminal and run:
echo   pnpm dev
echo.
pause
