@echo off
REM Force SillyBunny to use Node.js instead of Bun.
REM Use this if Bun causes high CPU usage on your platform.
setlocal enabledelayedexpansion
pushd %~dp0

where node > nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js was not found in PATH.
    echo Install Node.js from https://nodejs.org/ or use Start.bat for Bun.
    goto end
)

set NODE_ENV=production
call npm install --no-audit --no-fund --omit=dev
if %errorlevel% neq 0 goto end

echo Entering SillyBunny (Node.js mode)...
set NODE_NO_WARNINGS=1
node --no-warnings server.js %*

:end
pause
popd
endlocal
