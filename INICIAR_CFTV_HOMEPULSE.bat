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
if "%ERRORLEVEL%"=="0" goto DOCKER_RUNNING

echo [i] Docker Desktop fechado. Iniciando o Docker Desktop agora...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo Aguarde enquanto o Docker inicializa no Windows...

:WAIT_DOCKER
timeout /t 4 /nobreak >nul
docker version >nul 2>&1
if "%ERRORLEVEL%"=="0" goto DOCKER_READY
echo Aguardando motor do Docker ficar pronto...
goto WAIT_DOCKER

:DOCKER_RUNNING
echo [OK] Docker Desktop ja esta aberto.

:DOCKER_READY
echo.
echo [2/3] Subindo servicos das cameras e gravador no Disco D...
cd /d "d:\Sistema ja  ok\casainteligenteai\iot-gateway\deploy"
docker compose up -d

echo.
echo [3/3] Servicos CFTV em execucao:
docker ps --filter "name=ci-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ==========================================================
powershell -NoProfile -Command "$m = (docker logs ci-tunnel 2>&1 | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1).Line; if ($m -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') { Write-Host 'URL do Tunnel Cloudflare Ativo: ' -ForegroundColor Cyan -NoNewline; Write-Host $matches[0] -ForegroundColor Yellow } else { Write-Host 'Gateway local: http://127.0.0.1:1985' -ForegroundColor Cyan }"
echo ==========================================================
echo.
echo Tudo pronto! O streaming e as gravacoes estao ativos.
echo.
set /p OPEN_APP="Deseja abrir o HomePulse AI no navegador agora? [S/N]: "
if /I "%OPEN_APP%"=="S" (
    start https://casainteligenteai.lovable.app/dvr-nvr
)

pause
