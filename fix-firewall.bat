@echo off
echo ============================================
echo  DoseGuard - Windows Firewall Fix
echo  Run this as Administrator
echo ============================================
echo.

:: Remove any old DoseGuard rules first
netsh advfirewall firewall delete rule name="DoseGuard Backend - TCP 3001" >nul 2>&1

:: Add inbound rule - allow TCP 3001 on all profiles (Private, Domain, Public)
netsh advfirewall firewall add rule name="DoseGuard Backend - TCP 3001" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3001 ^
    profile=any ^
    description="Allow DoseGuard Node.js API on port 3001 for Android LAN access"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Firewall rule added for port 3001
) else (
    echo.
    echo [ERROR] Failed to add rule. Make sure you right-clicked and chose "Run as Administrator"
    pause
    exit /b 1
)

echo.
echo --- Verifying Rule ---
netsh advfirewall firewall show rule name="DoseGuard Backend - TCP 3001"

echo.
echo --- Backend Listener Check ---
netstat -ano | findstr :3001

echo.
echo ============================================
echo  DONE. Test from Android phone browser:
echo  http://10.0.0.73:3001/health
echo ============================================
echo.
pause
