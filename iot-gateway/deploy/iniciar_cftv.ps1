$deployDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binDir = Join-Path $deployDir "bin"
$go2rtc = Join-Path $binDir "go2rtc.exe"
$cloudflared = Join-Path $binDir "cloudflared.exe"
$config = Join-Path $deployDir "go2rtc.yaml"

Write-Host "==================================================================" -ForegroundColor Green
Write-Host "     HOMEPULSE AI - GATEWAY CFTV PROFISSIONAL (1-CLIQUE)" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

Stop-Process -Name "go2rtc", "cloudflared" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "`nIniciando Gateway go2rtc..." -ForegroundColor Cyan
$gProc = Start-Process -FilePath $go2rtc -ArgumentList "-config", "`"$config`"" -PassThru -WindowStyle Hidden

Write-Host "Iniciando Tunel Cloudflare HTTPS..." -ForegroundColor Cyan
$cfProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://127.0.0.1:1984" -PassThru -NoNewWindow -RedirectStandardError (Join-Path $binDir "tunnel.log")

$tunnelUrl = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $logPath = Join-Path $binDir "tunnel.log"
    if (Test-Path $logPath) {
        $content = Get-Content $logPath -ErrorAction SilentlyContinue
        $match = $content | Select-String -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" | Select-Object -Last 1
        if ($match) {
            $tunnelUrl = $match.Matches[0].Value
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host "`n[SUCESSO] Tunel Ativo: $tunnelUrl" -ForegroundColor Green
    Set-Clipboard -Value $tunnelUrl
    Start-Process "https://casainteligenteai.lovable.app/dvr-nvr?gateway=$tunnelUrl"
} else {
    Write-Host "`n[AVISO] Conectando modo local..." -ForegroundColor Yellow
    Start-Process "https://casainteligenteai.lovable.app/dvr-nvr?gateway=http://127.0.0.1:1984"
}
