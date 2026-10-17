# ===================================================================
# HomePulse AI - Robo de Auto-Sincronizacao de Tunel CFTV Cloudflare
# ===================================================================

param(
    [switch]$Watch = $false,
    [int]$IntervalSeconds = 15
)

$ErrorActionPreference = "SilentlyContinue"

function Get-ActiveTunnelUrl {
    try {
        $logs = docker logs ci-tunnel 2>&1
        $match = ($logs | Select-String -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" | Select-Object -Last 1).Line
        if ($match -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            return $matches[0].Trim()
        }
    } catch {}
    return $null
}

function Sync-TunnelUrl([string]$url) {
    if (-not $url) { return }

    Write-Host "[Auto-Sync] Tunel Cloudflare Detectado: $url" -ForegroundColor Green

    # 1. Copia para a area de transferencia
    try {
        Set-Clipboard -Value $url
        Write-Host "  [OK] URL copiada para a Area de Transferencia!" -ForegroundColor Cyan
    } catch {}

    # 2. Salva no public/cftv_gateway.json
    try {
        $jsonContent = "{`"tunnel_url`":`"$url`",`"updated_at`":`"$(Get-Date -Format s)`",`"status`":`"online`"}"
        $publicFile = Join-Path $PSScriptRoot "..\..\public\cftv_gateway.json"
        if (-not (Test-Path (Split-Path -Parent $publicFile))) {
            $publicFile = "D:\DEV-Apps\casainteligenteai\public\cftv_gateway.json"
        }
        [System.IO.File]::WriteAllText($publicFile, $jsonContent)
        Write-Host "  [OK] Sincronizado com public\cftv_gateway.json" -ForegroundColor Gray
    } catch {}

    # 3. Notifica o gravador local (porta 1985)
    try {
        $postData = "{`"url`":`"$url`"}"
        Invoke-RestMethod -Uri "http://127.0.0.1:1985/api/tunnel_info" -Method Post -Body $postData -ContentType "application/json" -TimeoutSec 3 | Out-Null
        Write-Host "  [OK] Gravador CFTV (porta 1985) notificado" -ForegroundColor Gray
    } catch {}
}

# Execucao inicial
$current = Get-ActiveTunnelUrl
if ($current) {
    Sync-TunnelUrl $current
} else {
    Write-Host "[Auto-Sync] Nenhum tunel trycloudflare encontrado nos logs do ci-tunnel." -ForegroundColor Yellow
}

# Modo Continuo se chamado com -Watch
if ($Watch) {
    Write-Host "[Auto-Sync] Monitor continuo ativo. Checando a cada $IntervalSeconds segundos..." -ForegroundColor Magenta
    $lastUrl = $current

    while ($true) {
        Start-Sleep -Seconds $IntervalSeconds
        $latest = Get-ActiveTunnelUrl
        if ($latest -and $latest -ne $lastUrl) {
            Write-Host "[Auto-Sync] Mudanca de tunel detectada!" -ForegroundColor Yellow
            Sync-TunnelUrl $latest
            $lastUrl = $latest
        }
    }
}
