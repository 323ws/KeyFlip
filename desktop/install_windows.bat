@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo             KeyFlip Desktop Installer
echo ===================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 1. Check for Prebuilt Binary or Setup
if exist "%SCRIPT_DIR%..\dist\KeyFlip-Setup.exe" (
    echo [FOUND] Pre-built NSIS Installer found!
    echo Launching installer...
    start "" "%SCRIPT_DIR%..\dist\KeyFlip-Setup.exe"
    exit /b 0
)

if exist "%SCRIPT_DIR%..\dist\KeyFlip-Portable.exe" (
    echo [FOUND] Pre-built Portable Binary found!
    set "TARGET_DIR=%LOCALAPPDATA%\KeyFlip"
    if not exist "!TARGET_DIR!" mkdir "!TARGET_DIR!"
    copy /y "%SCRIPT_DIR%..\dist\KeyFlip-Portable.exe" "!TARGET_DIR!\KeyFlip.exe" >nul
    echo [OK] Copied KeyFlip to !TARGET_DIR!\KeyFlip.exe
    start "" "!TARGET_DIR!\KeyFlip.exe"
    exit /b 0
)

:: 2. Check Rust & Node prerequisites for local build
echo Checking build prerequisites...
where cargo >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Rust / Cargo is not installed.
    echo Please install Rust from: https://rustup.rs/
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Build UI Layouts
echo Building layouts...
node ..\scripts\build-layouts.js

:: 4. Build Desktop Binary
echo Compiling KeyFlip Desktop App (Release mode)...
cargo build --release --manifest-path src-tauri\Cargo.toml

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

set "EXE_PATH=%SCRIPT_DIR%src-tauri\target\release\keyflip.exe"
if exist "!EXE_PATH!" (
    set "TARGET_DIR=%LOCALAPPDATA%\KeyFlip"
    if not exist "!TARGET_DIR!" mkdir "!TARGET_DIR!"
    copy /y "!EXE_PATH!" "!TARGET_DIR!\KeyFlip.exe" >nul
    echo.
    echo ===================================================
    echo  KeyFlip successfully installed to:
    echo  !TARGET_DIR!\KeyFlip.exe
    echo ===================================================
    echo.
    start "" "!TARGET_DIR!\KeyFlip.exe"
) else (
    echo [ERROR] Compiled binary not found at !EXE_PATH!
    pause
    exit /b 1
)

exit /b 0
