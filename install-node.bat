@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Node.js Installer
echo ========================================
echo   Node.js Auto Installer
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Node.js already installed:
    node -v
    echo.
    pause
    exit /b 0
)

echo [1/3] Downloading Node.js (~30MB)...
echo.

curl -L -o "%TEMP%\node-installer.msi" "https://cdn.npmmirror.com/binaries/node/v22.19.0/node-v22.19.0-x64.msi"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Download failed. Check your network.
    echo   Manual download: https://nodejs.org/zh-cn/
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing Node.js...
echo.

msiexec /i "%TEMP%\node-installer.msi" /qn /norestart
if %errorlevel% neq 0 (
    echo [WARN] Silent install failed, trying with UI...
    start /wait msiexec /i "%TEMP%\node-installer.msi"
)

echo.
echo [3/3] Verifying...

set "PATH=%PATH%;%ProgramFiles%\nodejs"

where node >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo ========================================
    echo   [OK] Node.js installed!
    echo.
    node -v
    echo ========================================
) else (
    echo.
    echo [INFO] Done. Close and reopen terminal, then run start.bat
)

del "%TEMP%\node-installer.msi" >nul 2>&1

echo.
pause
