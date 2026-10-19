@echo off
title HomePulse AI - Gateway CFTV
color 0A
chcp 65001 >nul

echo ==========================================================
echo        HOMEPULSE AI - GATEWAY DE CAMERAS CFTV
echo ==========================================================
echo.
echo [1/3] Verificando Docker Desktop e motor de containers...

:: Teste rapido: se o Docker ja esta 100% responsivo, pula direto para os servicos
docker version >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Motor do Docker ja esta operacional e pronto!
    goto DOCKER_READY
)

:: Verifica se a GUI do Docker Desktop esta aberta
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe">NUL
if "%ERRORLEVEL%"=="0" goto CHECK_ENGINE

echo [i] Docker Desktop fechado. Iniciando agora...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo Aguarde enquanto o Docker inicializa no Windows...

:CHECK_ENGINE
set /a TRIES=0

:RETRY_ENGINE
docker version >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Motor do Docker esta pronto e operacional!
    goto DOCKER_READY
)

set /a TRIES=%TRIES%+1
if %TRIES% GEQ 15 (
    echo.
    echo [!] AVISO: O motor do Docker travou ou esta em estado zumbi no Windows.
    echo [i] Executando restauracao automatica limpa (encerra processos presos e reinicia)...
    taskkill /F /IM "Docker Desktop.exe" /IM "com.docker.backend.exe" /IM "com.docker.proxy.exe" /IM "com.docker.build.exe" /IM "docker-agent.exe" /IM "wsl.exe" /IM "wslhost.exe" >nul 2>&1
    wsl --shutdown >nul 2>&1
    timeout /t 3 /nobreak >nul
    echo [i] Subindo Docker Desktop limpo...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    set /a TRIES=0
    goto WAIT_CLEAN_RESTART
)

echo Aguardando motor do Docker (%TRIES%/15)...
timeout /t 3 /nobreak >nul
goto RETRY_ENGINE

:WAIT_CLEAN_RESTART
set /a TRIES=%TRIES%+1
docker version >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [OK] Motor do Docker restaurado com sucesso!
    goto DOCKER_READY
)
if %TRIES% GEQ 20 (
    echo.
    echo [X] Erro critico: O Docker Desktop nao respondeu apos reinicializacao.
    echo     Verifique as configuracoes do Docker Desktop ou reinicie o PC.
    pause
    exit /b 1
)
echo Aguardando inicializacao limpa do Docker (%TRIES%/20)...
timeout /t 3 /nobreak >nul
goto WAIT_CLEAN_RESTART

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
