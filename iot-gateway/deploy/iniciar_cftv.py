import os
import sys
import subprocess
import time
import re
import webbrowser

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEPLOY_DIR = os.path.join(ROOT_DIR, "iot-gateway", "deploy")
BIN_DIR = os.path.join(DEPLOY_DIR, "bin")
GO2RTC_EXE = os.path.join(BIN_DIR, "go2rtc.exe")
CLOUDFLARED_EXE = os.path.join(BIN_DIR, "cloudflared.exe")
FFMPEG_EXE = os.path.join(BIN_DIR, "ffmpeg.exe")
RECORDER_PY = os.path.join(DEPLOY_DIR, "recorder.py")
SMART_BRIDGE_PY = os.path.join(DEPLOY_DIR, "smart_bridge.py")
CONFIG_YAML = os.path.join(DEPLOY_DIR, "go2rtc.yaml")

print("=" * 75)
print("  HOMEPULSE AI - GATEWAY CFTV, GRAVADOR NVR & PONTE IOT/TV (1-CLIQUE)")
print("=" * 75)

# 1. Kill old processes
print("\n[1/6] Finalizando instâncias anteriores...")
subprocess.run(["taskkill", "/F", "/IM", "go2rtc.exe"], capture_output=True)
subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe"], capture_output=True)
subprocess.run(["taskkill", "/F", "/IM", "ffmpeg.exe"], capture_output=True)
time.sleep(1)

# 2. Check binaries
print("[2/6] Verificando executáveis nativos (go2rtc, cloudflared, ffmpeg)...")
if not os.path.exists(GO2RTC_EXE) or not os.path.exists(CLOUDFLARED_EXE) or not os.path.exists(FFMPEG_EXE):
    print("Executáveis ausentes, verifique o diretório iot-gateway/deploy/bin")
    sys.exit(1)

print("[OK] Todos os executáveis nativos estão prontos!")

# 3. Start go2rtc
print("\n[3/6] Iniciando Servidor WebRTC / RTSP (go2rtc na porta 1984)...")
go2rtc_proc = subprocess.Popen([GO2RTC_EXE, "-config", CONFIG_YAML], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

# 4. Start Smart TV & IoT Control Bridge (porta 1985)
print("[4/6] Iniciando Ponte de Controle de Smart TV & IoT (Failover na porta 1985)...")
bridge_proc = subprocess.Popen([sys.executable, SMART_BRIDGE_PY], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

# 5. Start NVR Recorder (gravação física nos discos C:, D:, E:)
print("[5/6] Iniciando Gravador Físico NVR (MP4 contínuo no disco)...")
recorder_proc = subprocess.Popen([sys.executable, RECORDER_PY], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

# 6. Start cloudflared with http2 (evita erro de handshake QUIC e erro 1033)
print("[6/6] Conectando Túnel Seguro Cloudflare HTTPS (Aguarde ~7 segundos)...")
cf_proc = subprocess.Popen(
    [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:1984", "--protocol", "http2"],
    stderr=subprocess.PIPE,
    stdout=subprocess.DEVNULL,
    text=True,
    bufsize=1,
    encoding="utf-8",
    errors="replace"
)

tunnel_url = None
start_time = time.time()

while time.time() - start_time < 20:
    line = cf_proc.stderr.readline()
    if not line:
        time.sleep(0.2)
        continue
    
    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
    if match:
        tunnel_url = match.group(0)
        break

print("\n" + "=" * 75)
if tunnel_url:
    print(" [SUCESSO] Gateway CFTV Online e Túnel Seguro Ativo!")
    print("  • Link HTTPS Seguro : " + tunnel_url)
    print("  • Servidor Local    : http://127.0.0.1:1984")
    print("  • Ponte IoT & TV    : http://127.0.0.1:1985 (Plug & Play Ativo)")
    print("  • Gravador Ativo    : Gravando fluxos MP4 contínuos no disco")
    print("  • Câmeras Prontas   : Garagem (.139), IP Externa (.198), Tripla (.240)")
    print("  • Smart TV LG       : 192.168.0.168 (Controle Direto & WOL)")
    
    # Copy to clipboard via powershell
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{tunnel_url}'"], capture_output=True)
        print("\n [OK] Link copiado para a Área de Transferência!")
    except:
        pass
    
    app_url = f"https://casainteligenteai.lovable.app/dvr-nvr?gateway={tunnel_url}"
    print(f"\n Abrindo no seu navegador: {app_url}")
    webbrowser.open(app_url)
else:
    print(" [AVISO] O túnel demorou mais que o esperado.")
    print(" Abrindo aplicação no modo local: http://127.0.0.1:1984")
    webbrowser.open("https://casainteligenteai.lovable.app/dvr-nvr?gateway=http://127.0.0.1:1984")

print("=" * 75)
print("\nMantenha esta janela aberta enquanto estiver monitorando e gravando.")
print("Pressione Ctrl+C para encerrar os serviços.")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nEncerrando Gateway, Gravador CFTV e Ponte IoT...")
    go2rtc_proc.terminate()
    bridge_proc.terminate()
    recorder_proc.terminate()
    cf_proc.terminate()
    print("Finalizado com sucesso.")
