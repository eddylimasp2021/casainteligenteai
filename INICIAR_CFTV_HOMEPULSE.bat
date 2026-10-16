@echo off
title HomePulse AI - Gateway CFTV
color 0A
chcp 65001 >nul

echo ==========================================================
echo        HOMEPULSE AI - GATEWAY DE CAMERAS CFTV
echo ==========================================================
echo.
echo [1/3] Verificando Docker Desktop...

tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Docker Desktop ja esta em execucao.
) else (
    echo [i] Iniciando o Docker Desktop em segundo plano...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Aguardando inicializacao do Docker (15 segundos)...
    timeout /t 15 /nobreak >nul
)

echo.
echo [2/3] Garantindo servicos go2rtc e Tunnel ativos...
cd /d "d:\Sistema ja  ok\casainteligenteai\iot-gateway\deploy"
docker compose up -d

echo.
echo [3/3] Servicos CFTV em execucao:
docker ps --filter "name=ci-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ==========================================================
powershell -NoProfile -Command "$m = (docker logs ci-tunnel 2>&1 | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1).Line; if ($m -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') { Write-Host 'URL do Tunnel Cloudflare Ativo: ' -ForegroundColor Cyan -NoNewline; Write-Host $matches[0] -ForegroundColor Yellow } else { Write-Host 'Gateway local: http://127.0.0.1:1984' -ForegroundColor Cyan }"
echo ==========================================================
echo.
echo Tudo pronto! O streaming esta ativo e funcionando.
echo.
set /p OPEN_APP="Deseja abrir o HomePulse AI no navegador agora? (S/N): "
if /I "%OPEN_APP%"=="S" (
    start https://casainteligenteai.lovable.app/dvr-nvr
)

pause
