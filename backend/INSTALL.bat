@echo off
REM One-Click DoseGuard Backend Installer

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   DoseGuard Backend - One-Click Setup
echo =====================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    color CF
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% detected
echo.

echo [*] Installing dependencies...
call npm install >nul 2>&1
if errorlevel 1 (
    color CF
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

echo [*] Setting up database...
call node setup.js
if errorlevel 1 (
    color CF
    echo.
    echo [ERROR] Database setup failed
    echo.
    echo Make sure XAMPP MySQL is running!
    echo.
    pause
    exit /b 1
)
echo.

echo [OK] Configuration verified
echo.
echo =====================================================
echo   Setup Complete!
echo =====================================================
echo.
echo Next steps:
echo   1. Run: npm run dev
echo   2. Visit: http://localhost:3001
echo.
pause
