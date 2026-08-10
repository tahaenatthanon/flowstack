@echo off
REM =============================================
REM MariaDB Tablespace Fix Script
REM =============================================
REM This script fixes tablespace errors during restore

echo ============================================
echo   MariaDB Tablespace Fix Script
echo ============================================
echo.
echo [WARNING] This will DROP all user databases!
echo The mysql system tables will be reinitialized.
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause >nul

echo.
echo [INFO] Stopping MariaDB service...
net stop MySQL

echo.
echo [INFO] Backing up current mysql data folder...
if not exist "C:\xampp\mysql\data_broken" mkdir "C:\xampp\mysql\data_broken"
xcopy "C:\xampp\mysql\data\*.*" "C:\xampp\mysql\data_broken\" /E /I /Y

echo.
echo [INFO] Creating backup of user databases folder...
if not exist "C:\xampp\mysql\data_user_backup" mkdir "C:\xampp\mysql\data_user_backup"

REM List databases to backup
echo.
echo [INFO] Databases found:
dir /b "C:\xampp\mysql\data" | findstr /v /i ".frm .ibd mysql performance_test"

echo.
echo [NOTE] Please manually backup your database folders before proceeding!
echo        Copy folders like 'ahanwhankhao', 'flowstack', etc. to a safe location.
echo.

set /p CONFIRM="Have you backed up your user databases? (Type YES to continue): "

if not "%CONFIRM%"=="YES" (
    echo [INFO] Operation cancelled.
    pause
    exit /b 0
)

echo.
echo [INFO] Reinitializing MySQL system tables...
cd C:\xampp\mysql\bin

REM Remove mysql database files except for user databases
if exist "C:\xampp\mysql\data\mysql" rmdir "C:\xampp\mysql\data\mysql" /s /q

echo.
echo [INFO] Starting MySQL to initialize system tables...
net start MySQL

timeout /t 5 /nobreak

echo.
echo [INFO] Running mysql_upgrade...
mysql_upgrade -u root -p

echo.
echo [SUCCESS] System tables reinitialized!
echo.
echo Now restore your databases from backup:
echo 1. Create database: CREATE DATABASE flowstack;
echo 2. Restore: mysql -u root -p flowstack < flowstack_backup.sql

pause
