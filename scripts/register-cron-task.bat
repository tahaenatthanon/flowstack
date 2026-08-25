@echo off
REM =============================================
REM Flowstack Cron Tick — Windows Task Scheduler
REM =============================================
REM Registers ONE scheduled task that runs api/cron/tick.php every 1 minute.
REM tick.php then dispatches the individual jobs according to cron_jobs.cron_expression
REM in the database. The schedule of each job lives in the DB (editable from
REM Admin > Cron Jobs) — NOT here. This script only registers "call tick every minute".
REM
REM Requires an elevated prompt: right-click this file > "Run as administrator".

setlocal EnableDelayedExpansion

set TASK_NAME=Flowstack Cron Tick
set PHP_EXE=C:\xampp\php\php.exe

REM Resolve the repository root from this script's own location (scripts\..)
for %%I in ("%~dp0..") do set "REPO_DIR=%%~fI"
set TICK_SCRIPT=%REPO_DIR%\api\cron\tick.php

echo ============================================
echo   Flowstack Cron Tick — Task Registration
echo ============================================
echo.
echo [INFO] Task name  : %TASK_NAME%
echo [INFO] PHP        : %PHP_EXE%
echo [INFO] Script     : %TICK_SCRIPT%
echo [INFO] Interval   : every 1 minute
echo [INFO] Run as     : SYSTEM (runs even when nobody is logged in)
echo.

REM --- Preflight: administrator rights ---------------------------------------
REM "net session" only succeeds when elevated. Without elevation, schtasks /create
REM with /RU SYSTEM fails with "Access is denied" — check up front and say why.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must run with Administrator rights.
    echo         Close this window, right-click register-cron-task.bat
    echo         and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

REM --- Preflight: files exist ------------------------------------------------
if not exist "%PHP_EXE%" (
    echo [ERROR] PHP not found: %PHP_EXE%
    echo         Edit PHP_EXE at the top of this script to match your XAMPP install.
    echo.
    pause
    exit /b 1
)
if not exist "%TICK_SCRIPT%" (
    echo [ERROR] Tick script not found: %TICK_SCRIPT%
    echo         Run this script from the repository's scripts\ folder.
    echo.
    pause
    exit /b 1
)

REM --- Warn if the task already exists --------------------------------------
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] A task named "%TASK_NAME%" already exists and will be replaced.
    echo.
)

REM --- Create the task ------------------------------------------------------
REM /SC MINUTE /MO 1 = every minute (the smallest interval schtasks supports)
REM /RU SYSTEM       = no stored password, no console window, runs without login
REM /F               = replace an existing task with the same name
REM The \" escaping keeps the command line valid if a path contains spaces.
echo [INFO] Creating scheduled task...
schtasks /create /tn "%TASK_NAME%" /tr "\"%PHP_EXE%\" \"%TICK_SCRIPT%\"" /sc minute /mo 1 /ru SYSTEM /f
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] schtasks failed with error code %errorlevel%
    echo         Nothing was registered. The cron jobs will NOT run automatically.
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Task registered.
echo.

REM --- Relax the power conditions --------------------------------------------
REM schtasks ALWAYS creates tasks with DisallowStartIfOnBatteries=true and
REM StopIfGoingOnBatteries=true, and offers no command-line flag to change them.
REM On a laptop that means cron stops the moment the machine is unplugged, with
REM no trace at all: the Microsoft-Windows-TaskScheduler/Operational log is
REM disabled by default, and the task still reports Status=Ready / Last Result=0.
REM Observed on this machine: a 15-hour gap where no job ran overnight.
REM Set-ScheduledTask replaces the whole settings object, so the two defaults
REM worth keeping (IgnoreNew, 72h limit) are restated here explicitly.
echo [INFO] Allowing the task to run on battery power...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 72); Set-ScheduledTask -TaskName '%TASK_NAME%' -Settings $s | Out-Null"
if %errorlevel% neq 0 (
    echo [WARN] Could not clear the battery restrictions. The task IS registered
    echo        and will run on AC power, but it will stop on battery. Fix it by
    echo        hand in Task Scheduler: open the task, Properties ^> Conditions,
    echo        clear both "Power" checkboxes.
    echo.
)

echo [INFO] Verifying...
schtasks /query /tn "%TASK_NAME%" /fo list
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = Get-ScheduledTask -TaskName '%TASK_NAME%'; 'Starts on battery:     ' + (-not $t.Settings.DisallowStartIfOnBatteries); 'Keeps going on battery:' + (-not $t.Settings.StopIfGoingOnBatteries)"
echo.
echo ============================================
echo   Next Steps
echo ============================================
echo 1. Wait ~2 minutes, then open Admin ^> Cron Jobs in the app.
echo 2. The "overdue" banner should disappear and "Last called by scheduler"
echo    should start moving for the enabled jobs.
echo 3. To stop the scheduler:  schtasks /delete /tn "%TASK_NAME%" /f
echo.
echo [NOTE] Windows never runs scheduled tasks while the machine is asleep or
echo        shut down. tick.php recovers on its own: any job whose next_run_at
echo        is already in the past is treated as due and runs on the first tick
echo        after the machine wakes. Nothing is lost, but a job scheduled for a
echo        fixed time (e.g. 07:30) will run late by however long the machine
echo        was off. Keep this box awake if that matters.
echo.
echo Press any key to exit...
pause >nul
endlocal
