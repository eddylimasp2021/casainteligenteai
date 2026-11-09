@echo off
title HomePulse AI - Iniciar CFTV 1-Clique
color 0A
chcp 65001 >nul

cd /d "%~dp0"

where python >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    python "iot-gateway\deploy\iniciar_cftv.py"
    goto END
)

where py >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    py "iot-gateway\deploy\iniciar_cftv.py"
    goto END
)

echo Executando via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'iot-gateway\deploy\iniciar_cftv.ps1'"

:END
