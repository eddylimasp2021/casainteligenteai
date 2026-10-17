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

:CHECK_ENGINE
echo [i] Verificando se o motor Linux do Docker esta respondendo...
set /a TRIES=0

:RETRY_ENGINE
docker version >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Motor do Docker esta pronto e operacional!
    goto DOCKER_READY
)

set /a TRIES=%TRIES%+1
if %TRIES% GEQ 10 (
    echo.
    echo [!] AVISO: O motor do Docker esta demorando para responder ou travou.
    echo [i] Por favor, clique com botao direito no icone da baleia do Docker (proximo ao relogio)
    echo     e escolha "Restart Docker Desktop", depois execute este arquivo novamente.
    echo.
    pause
    exit /b 1
)

echo Aguardando inicializacao completa do motor do Docker (%TRIES%/10)...
timeout /t 3 /nobreak >nul
goto RETRY_ENGINE

:DOCKER_RUNNING
echo [OK] Docker Desktop ja esta aberto no Windows.
goto CHECK_ENGINE

:DOCKER_READY
echo.
echo [2/3] Subindo servicos das cameras e gravador no Disco D...
cd /d "%~dp0iot-gateway\deploy"
docker compose up -d

echo.
echo [3/3] Servicos CFTV em execucao:
docker ps --filter "name=ci-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo ==========================================================
echo [Auto-Sync] Sincronizando URL do Tunel Cloudflare...
powershell -NoProfile -Command "$q = docker ps -q --filter 'name=ci-quick-tunnel'; if (-not $q) { docker rm -f ci-quick-tunnel 2>$null; docker run -d --name ci-quick-tunnel --network deploy_ci-iot-net cloudflare/cloudflared:latest tunnel --url http://recorder:1985 >$null; Start-Sleep -Seconds 3 }; $m = (docker logs ci-quick-tunnel 2>&1 | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1).Line; if ($m -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') { $u = $matches[0].Trim(); Write-Host 'URL do Tunnel Ativo: ' -ForegroundColor Cyan -NoNewline; Write-Host $u -ForegroundColor Yellow; Set-Clipboard -Value $u; Write-Host '[OK] Link copiado para a Area de Transferencia!' -ForegroundColor Green; Write-Host '     No navegador, basta clicar em Gateway CFTV > Colar do Robo!' -ForegroundColor DarkGray } else { Write-Host 'Gateway local: http://127.0.0.1:1985' -ForegroundColor Cyan }"
echo ==========================================================
echo.
echo Tudo pronto! O streaming e as gravacoes estao ativos.
echo.
set /p OPEN_APP="Deseja abrir o HomePulse AI no navegador agora? [S/N]: "
if /I "%OPEN_APP%"=="S" (
    start https://casainteligenteai.lovable.app/dvr-nvr
)

pause
