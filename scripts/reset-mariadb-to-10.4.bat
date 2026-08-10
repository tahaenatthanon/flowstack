@echo off
REM =============================================
REM MariaDB Restore to 10.4.32 Script
REM =============================================
REM This script helps restore MariaDB to 10.4.32 version

echo ============================================
echo   MariaDB Restore to 10.4.32
echo ============================================
echo.
echo [WARNING] This will help restore MariaDB 10.4.32
echo.
echo Steps to fix the upgrade issue:
echo.
echo 1. Download XAMPP with MariaDB 10.4.32:
echo    https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.0.28/xampp-windows-x64-8.0.28-0-VS16-installer.exe
echo.
echo 2. Stop current MySQL service
echo.
echo 3. Replace mysql folder with 10.4.32 version
echo    OR reinstall XAMPP 8.0.28 (which has MariaDB 10.4)
echo.
echo 4. Start MySQL and verify it works
echo.
echo 5. Run mysqldump to backup all databases:
echo    cd C:\xampp\mysql\bin
echo    mysqldump -u root -p --all-databases > backup_before_upgrade.sql
echo.
echo 6. Then upgrade to MariaDB 11.5.2 with fresh data
echo.
echo.
echo Alternative - Quick fix (if you have backup):
echo.
echo If you have a backup of mysql\data folder from before:
echo 1. Stop MySQL
echo 2. Copy ib_logfile0 and ib_logfile1 from backup
echo 3. Start MySQL 10.4.32
echo.
pause
