@echo off
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.14.0-win-x64\node.exe" set "PATH=%~dp0.tools\node-v22.14.0-win-x64;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules call npm.cmd install
if errorlevel 1 exit /b 1
call npm.cmd run dev
