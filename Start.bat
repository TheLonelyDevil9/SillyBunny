@echo off
setlocal enabledelayedexpansion
pushd %~dp0

set "PATH=%USERPROFILE%\.bun\bin;%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
set "_need_git=0"
set "_auto_update=1"

if exist .git set "_need_git=1"
if /I "%SILLYBUNNY_AUTO_UPDATE%"=="0" set "_auto_update=0"
if /I "%SILLYBUNNY_AUTO_UPDATE%"=="false" set "_auto_update=0"
if /I "%SILLYBUNNY_AUTO_UPDATE%"=="no" set "_auto_update=0"
if /I "%SILLYBUNNY_AUTO_UPDATE%"=="off" set "_auto_update=0"

where bun > nul 2>&1
if %errorlevel% neq 0 (
    where powershell > nul 2>&1
    if !errorlevel! neq 0 (
        echo Bun could not be found in PATH, and PowerShell is unavailable for automatic installation.
        echo Install Bun manually from https://bun.sh/
        goto end
    )

    echo Bun was not found. Installing prerequisites automatically...
    if "%_need_git%"=="1" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Prerequisites.ps1" -RequireGit
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Prerequisites.ps1"
    )
    if !errorlevel! neq 0 goto end
)

if "%_need_git%"=="1" (
    where git > nul 2>&1
    if !errorlevel! neq 0 (
        where powershell > nul 2>&1
        if !errorlevel! neq 0 (
            echo Git could not be found in PATH, and PowerShell is unavailable for automatic installation.
            echo Install Git manually from https://git-scm.com/downloads
            goto end
        )

        echo Git was not found. Installing prerequisites automatically...
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Prerequisites.ps1" -RequireGit -RequireBun:$false
        if !errorlevel! neq 0 goto end
    )
)

if "%_need_git%"=="1" if "%_auto_update%"=="1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Self-Update.ps1" -Optional
    if !errorlevel! neq 0 goto end
)

set NODE_ENV=production
call bun install --frozen-lockfile --production
if %errorlevel% neq 0 goto end

REM Check if running on ARM — Bun has CPU overhead issues on ARM (oven-sh/bun#26415)
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    where node > nul 2>&1
    if !errorlevel! equ 0 (
        echo.
        echo [SillyBunny] ARM64 detected. Bun may use excessive CPU on this platform.
        echo [SillyBunny] Switching to Node.js automatically. Use Start.bat with SILLYBUNNY_USE_BUN=1 to override.
        echo.
        if /I not "%SILLYBUNNY_USE_BUN%"=="1" (
            set NODE_NO_WARNINGS=1
            node --no-warnings server.js %*
            goto end
        )
    )
)

bun server.js %*

:end
pause
popd
endlocal
