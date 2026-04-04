@echo off
setlocal enabledelayedexpansion
pushd %~dp0

set "PATH=%USERPROFILE%\.bun\bin;%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
set "_need_prereqs=0"

where bun > nul 2>&1
if %errorlevel% neq 0 set "_need_prereqs=1"

where git > nul 2>&1
if %errorlevel% neq 0 set "_need_prereqs=1"

if "%_need_prereqs%"=="1" (
    where powershell > nul 2>&1
    if !errorlevel! neq 0 (
        echo Missing prerequisites were detected, and PowerShell is unavailable for automatic installation.
        echo Install Bun from https://bun.sh/ and Git from https://git-scm.com/downloads
        goto end
    )

    echo Installing missing prerequisites automatically...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Prerequisites.ps1" -RequireGit
    if !errorlevel! neq 0 goto end
)

if not exist .git (
    echo [91mNot running from a Git repository. Reinstall using an officially supported method to get updates.[0m
    echo See: https://docs.sillytavern.app/installation/windows/
    goto end
)

call git pull --rebase --autostash
if %errorlevel% neq 0 (
    REM In case there is still something wrong.
    echo [91mThere were errors while updating.[0m
    echo See the update FAQ at https://docs.sillytavern.app/installation/updating/
    goto end
)

set NODE_ENV=production
call bun install --frozen-lockfile --production
if %errorlevel% neq 0 goto end

bun server.js %*

:end
pause
popd
endlocal
