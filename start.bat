@echo off
REM God's L'Eye — one-step launcher for Windows. Double-click this file.
setlocal
cd /d "%~dp0"

echo God's L'Eye - starting up.

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Install the LTS version from https://nodejs.org
  echo That takes about two minutes. Then double-click this file again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo.
  echo Node is too old. Install the LTS version from https://nodejs.org ^(20 or newer^) and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "app" (
  echo.
  echo The app folder is missing. Unzip the whole download and keep this launcher next to the app folder.
  echo.
  pause
  exit /b 1
)

cd app

if not exist node_modules (
  echo First run: installing what the app needs. This happens once and takes a minute or two.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo The install failed, most often because there is no internet connection.
    echo.
    pause
    exit /b 1
  )
)

echo Starting. Your browser will open in a few seconds.
echo Keep this window open while you work - closing it stops the dashboard.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:5173"
call npm run dev

echo.
echo The dashboard has stopped.
pause
