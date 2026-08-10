@echo off
REM =============================================
REM MariaDB Database Backup Script for XAMPP
REM =============================================
REM This script creates a full backup of all databases
REM before upgrading MariaDB

echo ============================================
echo   MariaDB Backup Script for XAMPP
echo ============================================
echo.

REM Set backup directory
set BACKUP_DIR=C:\xampp\htdocs\flowstack\backups

REM Create backup directory if not exists
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

REM Set timestamp
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "MIN=%dt:~10,2%"
set "TIMESTAMP=%YYYY%%MM%%DD%_%HH%%MIN%"

REM Set backup filename
set BACKUP_FILE=%BACKUP_DIR%\flowstack_backup_%TIMESTAMP%.sql

echo [INFO] Backup started at %date% %time%
echo [INFO] Backup file: %BACKUP_FILE%
echo.

REM Change to MySQL bin directory
cd C:\xampp\mysql\bin

REM Run mysqldump
echo [INFO] Dumping all databases...
mysqldump -u root -p --all-databases --single-transaction --routines --triggers --events > "%BACKUP_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Backup completed successfully!
    echo [INFO] File: %BACKUP_FILE%
    
    REM Get file size
    for %%A in ("%BACKUP_FILE%") do set "SIZE=%%~zA"
    echo [INFO] File size: !SIZE! bytes
    
    echo.
    echo ============================================
    echo   Next Steps:
    echo ============================================
    echo 1. Verify backup file exists
    echo 2. Test restore on staging environment
    echo 3. Proceed with MariaDB upgrade
    echo.
) else (
    echo.
    echo [ERROR] Backup failed with error code %errorlevel%
    echo Please check MySQL service is running
    echo.
    pause
    exit /b 1
)

echo.
echo Press any key to exit...
pause >nul
