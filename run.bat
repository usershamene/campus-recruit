@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Campus Recruit
echo ========================================
echo   Campus Recruit
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Node.js not found. Downloading...
    echo.
    curl -L -o "%TEMP%\node-installer.msi" "https://cdn.npmmirror.com/binaries/node/v22.19.0/node-v22.19.0-x64.msi"
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Download failed. Check your network.
        echo   Manual download: https://nodejs.org/zh-cn/
        pause
        exit /b 1
    )
    echo.
    echo [2/3] Installing Node.js...
    msiexec /i "%TEMP%\node-installer.msi" /qn /norestart
    if %errorlevel% neq 0 (
        echo Silent install failed, trying with UI...
        start /wait msiexec /i "%TEMP%\node-installer.msi"
    )
    del "%TEMP%\node-installer.msi" >nul 2>&1
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
    echo.
    echo [3/3] Node.js installed!
    node -v
    echo.
) else (
    echo [OK] Node.js ready:
    node -v
    echo.
)

:: Start server
echo Starting server...
echo.

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8080"

node server.js

echo.
echo Server stopped.
pause
