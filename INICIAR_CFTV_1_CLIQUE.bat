@echo off
title HomePulse AI - Iniciar CFTV 1-Clique
color 0A
chcp 65001 >nul

cd /d "%~dp0"

echo =======================================================================
echo   HOMEPULSE AI - INICIALIZADOR CFTV E GRAVADOR NVR
echo =======================================================================
echo.

set "SCRIPT_PATH="

if exist "backend_gateway\iniciar_cftv.py" (
    set "SCRIPT_PATH=backend_gateway\iniciar_cftv.py"
) else if exist "iot-gateway\deploy\iniciar_cftv.py" (
    set "SCRIPT_PATH=iot-gateway\deploy\iniciar_cftv.py"
) else if exist "iniciar_cftv.py" (
    set "SCRIPT_PATH=iniciar_cftv.py"
)

if "%SCRIPT_PATH%"=="" (
    echo [ERRO] O arquivo iniciar_cftv.py nao foi encontrado nesta pasta!
    echo.
    echo =======================================================================
    echo Pressione qualquer tecla para fechar...
    pause >nul
    exit /b 1
)

echo [1/2] Verificando ambiente Python...
where python >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    python "%SCRIPT_PATH%"
    goto FIM
)

where py >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    py "%SCRIPT_PATH%"
    goto FIM
)

echo [2/2] Python nao encontrado no PATH do Windows. Executando via PowerShell...
if exist "backend_gateway\iniciar_cftv.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'backend_gateway\iniciar_cftv.ps1'"
) else if exist "iot-gateway\deploy\iniciar_cftv.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'iot-gateway\deploy\iniciar_cftv.ps1'"
)

:FIM
echo.
echo =======================================================================
echo Pressione qualquer tecla para fechar...
pause >nul
