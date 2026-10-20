@echo off
title HomePulse AI - Instalador de Inicializacao Automatica
color 0A
chcp 65001 >nul

echo ==========================================================
echo    HOMEPULSE AI - CONFIGURAR CÂMERAS SEMPRE ATIVAS 24/7
echo ==========================================================
echo.
echo [1/2] Criando inicializacao automatica com o Windows (Startup)...

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\HomePulse_CFTV.lnk\"); $s.TargetPath = '%~dp0INICIAR_CFTV_HOMEPULSE.bat'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save(); Write-Host '[OK] Inicializacao automatica configurada com sucesso!' -ForegroundColor Green"

echo.
echo [2/2] Configurando plano de energia do Windows para nao suspender...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
echo [OK] Suspensao automatica desativada (o PC ficara ligado 24/7 gravando).

echo.
echo ==========================================================
echo Concluido! Suas cameras agora:
echo  - Iniciam sozinhas sempre que o computador ligar.
echo  - O computador nao vai suspender/dormir na tomada.
echo  - Os containers possuem autorestart (restart: always).
echo  - O gravador possui limpeza automatica para nunca lotar o disco.
echo ==========================================================
echo.
pause
