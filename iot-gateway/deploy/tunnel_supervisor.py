import subprocess
import time
import re
import os
import sys
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "tunnel.log")
URL_FILE = os.path.join(BASE_DIR, "active_tunnel.txt")
PUBLIC_JSON = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "public", "cftv_gateway.json"))
CF_EXE = os.path.join(BASE_DIR, "bin", "cloudflared.exe")

def main():
    print(f"[SUPERVISOR] Monitor de túnel iniciado. Binário: {CF_EXE}")
    while True:
        try:
            print("[SUPERVISOR] Abrindo novo túnel Cloudflare...")
            with open(LOG_FILE, "w", encoding="utf-8") as out:
                proc = subprocess.Popen([CF_EXE, "tunnel", "--url", "http://127.0.0.1:1985"], stdout=out, stderr=subprocess.STDOUT)
            
            # Aguarda URL
            tunnel_url = None
            for _ in range(25):
                time.sleep(1)
                if os.path.exists(LOG_FILE):
                    try:
                        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                            m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                            if m:
                                tunnel_url = m.group(0)
                                print(f"[SUPERVISOR] Túnel ativo detectado: {tunnel_url}")
                                with open(URL_FILE, "w", encoding="utf-8") as uf:
                                    uf.write(tunnel_url)
                                try:
                                    with open(PUBLIC_JSON, "w", encoding="utf-8") as pf:
                                        json.dump({
                                            "gateway_url": tunnel_url,
                                            "tunnel_url": tunnel_url,
                                            "updated_at": datetime.now().isoformat()
                                        }, pf, indent=2)
                                except Exception as je:
                                    print(f"[SUPERVISOR] Aviso ao gravar cftv_gateway.json: {je}")
                                break
                    except:
                        pass
            
            # Mantém processo rodando e reinicia caso encerre
            while proc.poll() is None:
                time.sleep(3)
            
            print(f"[SUPERVISOR] Processo encerrou com código {proc.returncode}. Reiniciando em 2s...")
            time.sleep(2)
        except Exception as e:
            print(f"[SUPERVISOR] Erro: {e}")
            time.sleep(3)

if __name__ == "__main__":
    main()
