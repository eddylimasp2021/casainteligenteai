@echo off
title HomePulse AI - Iniciar CFTV 1-Clique
color 0A
chcp 65001 >nul

echo ==============================================================================
echo           HOMEPULSE AI - GATEWAY CFTV PROFISSIONAL (1-CLIQUE)
echo ==============================================================================
echo.
echo [1/4] Finalizando instâncias anteriores para liberar portas...
taskkill /F /IM "go2rtc.exe" >nul 2>&1
taskkill /F /IM "cloudflared.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

set "BASE_DIR=%~dp0iot-gateway\deploy"
set "BIN_DIR=%BASE_DIR%\bin"
set "GO2RTC_BIN=%BIN_DIR%\go2rtc.exe"
set "CLOUDFLARED_BIN=%BIN_DIR%\cloudflared.exe"
set "CONFIG_FILE=%BASE_DIR%\go2rtc.yaml"
set "LOG_FILE=%BIN_DIR%\tunnel.log"

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo [2/4] Verificando executáveis nativos (Zero dependência de Docker)...
if not exist "%GO2RTC_BIN%" (
    echo [i] Baixando go2rtc nativo para Windows...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/AlexxIT/go2rtc/releases/download/v1.9.8/go2rtc_win64.zip' -OutFile '%BIN_DIR%\go2rtc.zip'; Expand-Archive -Path '%BIN_DIR%\go2rtc.zip' -DestinationPath '%BIN_DIR%' -Force; Remove-Item '%BIN_DIR%\go2rtc.zip' -Force"
)

if not exist "%CLOUDFLARED_BIN%" (
    echo [i] Baixando cloudflared nativo para Windows...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CLOUDFLARED_BIN%'"
)

echo [OK] Executáveis prontos!
echo.

echo [3/4] Iniciando Gateway de Mídia RTSP/WebRTC (go2rtc)...
start "go2rtc_gateway" /MIN "%GO2RTC_BIN%" -config "%CONFIG_FILE%"
timeout /t 2 /nobreak >nul

echo [4/4] Gerando Túnel Seguro Cloudflare HTTPS...
if exist "%LOG_FILE%" del /F /Q "%LOG_FILE%" >nul 2>&1
start "cloudflared_tunnel" /MIN cmd /c ""%CLOUDFLARED_BIN%" tunnel --url http://127.0.0.1:1984 > "%LOG_FILE%" 2>&1"

echo Aguardando link HTTPS seguro do túnel...
set "TUNNEL_URL="
for /L %%i in (1,1,15) do (
    if not defined TUNNEL_URL (
        for /f "tokens=*" %%a in ('powershell -NoProfile -Command "if (Test-Path '%LOG_FILE%') { $m = (Get-Content '%LOG_FILE%' | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1); if ($m) { $m.Matches[0].Value } }"') do (
            set "TUNNEL_URL=%%a"
        )
        if not defined TUNNEL_URL timeout /t 1 /nobreak >nul
    )
)

echo.
echo ==============================================================================
if defined TUNNEL_URL (
    echo [SUCESSO] Gateway CFTV online e conectado!
    echo.
    echo  - Link do Tnel HTTPS : %TUNNEL_URL%
    echo  - Servidor WebRTC Local: http://127.0.0.1:1984
    echo  - Cmeras Vinculadas   : Garagem (139), IP (198), Tripla Multi-Lente (240)
    echo.
    powershell -NoProfile -Command "Set-Clipboard -Value '%TUNNEL_URL%'"
    echo [OK] URL copiada para a Área de Transferência do Windows!
    echo.
    echo Abrindo HomePulse AI com sincronização automática em 1 clique...
    start "" "https://casainteligenteai.lovable.app/dvr-nvr?gateway=%TUNNEL_URL%"
) else (
    echo [AVISO] O túnel demorou a responder, mas o go2rtc está ativo localmente em:
    echo http://127.0.0.1:1984
    echo Abrindo aplicação no modo local...
    start "" "https://casainteligenteai.lovable.app/dvr-nvr?gateway=http://127.0.0.1:1984"
)
echo ==============================================================================
echo.
echo Dica: Mantenha esta janela minimizada enquanto estiver usando as câmeras.
echo Para encerrar, basta fechar esta janela ou executar o script novamente.
echo.
pause
