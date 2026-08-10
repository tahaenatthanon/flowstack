@echo off
REM =============================================
REM MariaDB Database Restore Script for XAMPP
REM =============================================
REM This script restores database from backup

echo ============================================
echo   MariaDB Restore Script for XAMPP
echo ============================================
echo.

REM Set backup directory
set BACKUP_DIR=C:\xampp\htdocs\flowstack\backups

REM Check if backup directory exists
if not exist "%BACKUP_DIR%" (
    echo [ERROR] Backup directory not found: %BACKUP_DIR%
    pause
    exit /b 1
)

echo Available backup files:
echo.
dir /b "%BACKUP_DIR%\*.sql"
echo.

set /p BACKUP_FILE="Enter backup filename (or press Enter to use latest): "

REM If no input, use the latest backup
if "%BACKUP_FILE%"=="" (
    for /f "delims=" %%i in ('dir /b /o-d "%BACKUP_DIR%\*.sql" ^| findstr /r "^flowstack_backup"') do (
        set "LATEST_BACKUP=%%i"
        goto :found
    )
    :found
    set "BACKUP_FILE=%LATEST_BACKUP%"
)

set "FULL_PATH=%BACKUP_DIR%\%BACKUP_FILE%"

REM Check if file exists
if not exist "%FULL_PATH%" (
    echo [ERROR] Backup file not found: %FULL_PATH%
    pause
    exit /b 1
)

echo.
echo [WARNING] This will restore database from: %BACKUP_FILE%
echo [WARNING] All current data will be replaced!
echo.

set /p CONFIRM="Type 'YES' to confirm restore: "

if not "%CONFIRM%"=="YES" (
    echo [INFO] Restore cancelled.
    pause
    exit /b 0
)

echo.
echo [INFO] Restore started at %date% %time%
echo.

REM Change to MySQL bin directory
cd C:\xampp\mysql\bin

REM Run mysql restore
echo [INFO] Restoring database...
mysql -u root -p < "%FULL_PATH%"

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Restore completed successfully!
) else (
    echo.
    echo [ERROR] Restore failed with error code %errorlevel%
    pause
    exit /b 1
)

echo.
echo Press any key to exit...
pause >nul
