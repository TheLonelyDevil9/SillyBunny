@echo off
setlocal enabledelayedexpansion
pushd %~dp0

set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
where bun > nul 2>&1
if %errorlevel% neq 0 (
    where powershell > nul 2>&1
    if !errorlevel! neq 0 (
        echo Bun could not be found in PATH, and PowerShell is unavailable for automatic installation.
        echo Install Bun manually from https://bun.sh/
        goto end
    )

    echo Bun was not found. Installing prerequisites automatically...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Prerequisites.ps1"
    if !errorlevel! neq 0 goto end
)

set NODE_ENV=production
call bun install --frozen-lockfile --production
if %errorlevel% neq 0 goto end

bun server.js %*

:end
pause
popd
endlocal
