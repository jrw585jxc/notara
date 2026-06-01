@echo off
setlocal EnableDelayedExpansion
title Notara Builder

chcp 65001 >nul 2>&1
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
color 00
mode con: cols=58 lines=30

for /f %%a in ('powershell -NoProfile -Command "[char]27"') do set "ESC=%%a"

set "R=%ESC%[0m"
set "BOLD=%ESC%[1m"
set "BLUE=%ESC%[38;5;111m"
set "LBLUE=%ESC%[38;5;153m"
set "GREEN=%ESC%[38;5;78m"
set "RED=%ESC%[38;5;203m"
set "GRAY=%ESC%[38;5;242m"
set "WHITE=%ESC%[38;5;252m"

set "BAR0=........................"
set "BAR1=########................"
set "BAR2=################........"
set "BAR3=########################"

set "STEP=0"

cd /d "%~dp0"

:: Extend PATH to cover common Node.js install locations (nvm, per-user, global)
for /f "delims=" %%p in ('powershell -NoProfile -Command "$p=@($env:APPDATA+'\nvm',$env:ProgramFiles+'\nodejs',$env:LOCALAPPDATA+'\Programs\nodejs',$env:ProgramFiles+'\Node.js'); ($p|?{Test-Path $_}) -join ';'"') do set "PATH=%%p;%PATH%"

:: Run steps

set "STEP=1" & call :render
call npm install --legacy-peer-deps --silent 2>nul
if %errorlevel% neq 0 ( set "ERRMSG=npm install failed" & goto :fail )

set "STEP=2" & call :render
call npm run build >nul 2>nul
if %errorlevel% neq 0 ( set "ERRMSG=Compile step failed" & goto :fail )

set "STEP=3" & call :render
call npx electron-forge make --platform win32 --arch x64 >nul 2>nul
if %errorlevel% neq 0 ( set "ERRMSG=Packaging failed" & goto :fail )

set "STEP=4" & call :render
pause
exit /b 0

:: Fail

:fail
call :render
echo.
    echo    %RED%  x  !ERRMSG!%R%
echo.
pause
exit /b 1

:: Render

:render
cls
echo.
echo.
echo    %BLUE%%BOLD%  Notara%R%  %GRAY%builder%R%
echo.

set /a _done=STEP-1
if !_done! lss 0 set _done=0
if !_done! gtr 3 set _done=3
set /a _pct=_done*33
if !_done!==3 set _pct=100
call set "_bar=%%BAR!_done!%%"

if !_done!==3 (
    echo    %GREEN%[!_bar!]%R%  %WHITE%!_pct!%%%R%
) else (
    echo    %BLUE%[!_bar!]%R%  %WHITE%!_pct!%%%R%
)
echo.

call :step 1 "Installing dependencies"
call :step 2 "Compiling frontend     "
call :step 3 "Packaging installer    "

if !STEP!==4 (
    echo.
    echo    %GRAY%  . . . . . . . . . . . . . . . . . . .%R%
    echo.
    echo    %GREEN%%BOLD%  Build complete%R%
    echo.
    echo    %GRAY%  Installer%R%
    echo    %LBLUE%  out\make\squirrel.windows\x64\%R%
    echo.
    echo    %GRAY%  Portable%R%
    echo    %LBLUE%  out\make\zip\win32-x64\%R%
    echo.
)
goto :eof

:step
set /a _n=%~1
if !STEP! gtr !_n! (
    echo    %GREEN%  done%R%  %GRAY%%~2%R%
) else if !STEP!==!_n! (
    echo    %BLUE%  wait%R%  %WHITE%%~2%R%
) else (
    echo    %GRAY%  ----  %~2%R%
)
goto :eof
