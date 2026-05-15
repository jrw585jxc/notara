@echo off
title Notara - Build Windows App
color 0B

cd /d "%~dp0"

echo.
echo  ==========================================
echo   Notara - Building Windows Installer
echo  ==========================================
echo.
echo  Working folder: %CD%
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo  [!] Node.js is not installed.
    echo  Opening the Node.js download page...
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js found: %NODE_VER%
echo.

:: Install / update all dependencies
echo  [1/3] Installing dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)
echo.

:: Compile TypeScript + Vite
echo  [2/3] Compiling Notara...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Compile step failed. See errors above.
    pause
    exit /b 1
)
echo.

:: Package with electron-forge (Node 24 compatible)
echo  [3/3] Packaging installer...
call npx electron-forge make --platform win32 --arch x64
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Packaging failed. See errors above.
    pause
    exit /b 1
)

echo.
color 0A
echo  ==========================================
echo   Build complete!
echo  ==========================================
echo.
echo  Your files are in the out\make folder:
echo    squirrel.windows\x64\Notara-Setup.exe  - installer
echo    zip\win32-x64\Notara-win32-x64.zip    - portable zip
echo.
echo  Opening output folder...
start "" "%~dp0out"
echo.
pause
