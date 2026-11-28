@echo off
cd /d "%~dp0"
if exist ".tools\node-v22.14.0-win-x64\node.exe" set "PATH=%CD%\.tools\node-v22.14.0-win-x64;%PATH%"
call npm.cmd run build
if errorlevel 1 exit /b 1
call npm.cmd run duels:host
