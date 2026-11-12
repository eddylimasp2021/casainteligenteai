@echo off
title HomePulse AI - Iniciar CFTV 1-Clique
color 0A
chcp 65001 >nul

cd /d "%~dp0"

echo [1/2] Verificando ambiente Python...
where python >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    python "iot-gateway\deploy\iniciar_cftv.py"
    goto FIM
)

where py >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    py "iot-gateway\deploy\iniciar_cftv.py"
    goto FIM
)

echo [2/2] Python no PATH ausente. Executando via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'iot-gateway\deploy\iniciar_cftv.ps1'"

:FIM
echo.
echo =======================================================================
echo Pressione qualquer tecla para fechar...
pause >nul
