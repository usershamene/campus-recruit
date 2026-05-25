@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Campus Recruit Server
echo ========================================
echo   Campus Recruit - Server
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Run install-node.bat first.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js ready
echo [*] Starting server...
echo [*] Visit http://localhost:8080
echo.

node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server failed. Check if port 8080 is in use.
)

echo.
echo [INFO] Server stopped.
pause
