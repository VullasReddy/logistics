@echo off
REM ==============================================================
REM  TTC Fleet360 - one-click start for Windows
REM  Double-click this file. Needs only Node.js (https://nodejs.org).
REM  First run installs packages (5-10 min), later runs take ~20 sec.
REM ==============================================================
title TTC Fleet360
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Opening https://nodejs.org ...
  echo  Install the LTS version, then double-click START.bat again.
  start https://nodejs.org
  pause
  exit /b 1
)

echo Node.js found:
node -v

if not exist "backend\node_modules" (
  echo.
  echo [1/3] Installing backend packages...
  pushd backend & call npm install & popd
)
if not exist "frontend\node_modules" (
  echo.
  echo [2/3] Installing frontend packages...
  pushd frontend & call npm install & popd
)
if not exist "local-runner\node_modules\@electric-sql\pglite-socket" (
  echo.
  echo [3/3] Installing local database...
  pushd local-runner & call npm install & popd
)

echo.
pushd local-runner
node run-local.js
popd
pause
