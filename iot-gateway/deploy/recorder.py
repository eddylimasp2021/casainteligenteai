import os
import sys
import time
import json
import subprocess
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_DIR = os.path.join(BASE_DIR, "bin")
FFMPEG_EXE = os.path.join(BIN_DIR, "ffmpeg.exe")
CONFIG_JSON = os.path.join(BASE_DIR, "recorder_config.json")

# Default config
DEFAULT_CONFIG = {
    "recordingsDirectory": "D:\\Gravacoes_CFTV",
    "segmentMinutes": 15,
    "enabled": True,
    "cameras": [
        {"name": "Garagem_Rua", "stream": "garagem_rua"},
        {"name": "Camera_Externa_198", "stream": "cam_192_168_0_198"},
        {"name": "Camera_Tripla_240", "stream": "cam_192_168_0_240"}
    ]
}

def load_config():
    if os.path.exists(CONFIG_JSON):
        try:
            with open(CONFIG_JSON, "r", encoding="utf-8") as f:
                return {**DEFAULT_CONFIG, **json.load(f)}
        except:
            pass
    return DEFAULT_CONFIG

def save_config(cfg):
    try:
        with open(CONFIG_JSON, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except:
        pass

active_recorders = {}

def start_camera_recording(cam, base_dir, seg_minutes):
    cam_name = cam["name"]
    stream = cam["stream"]
    cam_dir = os.path.join(base_dir, cam_name)
    os.makedirs(cam_dir, exist_ok=True)
    
    rtsp_url = f"rtsp://127.0.0.1:8554/{stream}"
    output_pattern = os.path.join(cam_dir, f"{cam_name}_%Y-%m-%d_%H-%M-%S.mp4")
    seg_seconds = seg_minutes * 60
    
    # ffmpeg command com video copy direto e audio aac (evita erro de pcm_alaw em container mp4)
    cmd = [
        FFMPEG_EXE,
        "-y",
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-c:v", "copy",
        "-c:a", "aac",
        "-f", "segment",
        "-segment_time", str(seg_seconds),
        "-segment_format", "mp4",
        "-reset_timestamps", "1",
        "-strftime", "1",
        "-movflags", "+faststart",
        output_pattern
    ]
    
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p

def recorder_worker():
    print("[NVR RECORDER] Iniciando motor de gravacao continua...")
    cfg = load_config()
    base_dir = cfg["recordingsDirectory"]
    os.makedirs(base_dir, exist_ok=True)
    print(f"[NVR RECORDER] Destino das gravacoes: {base_dir}")
    
    while True:
        cfg = load_config()
        if cfg.get("enabled", True):
            for cam in cfg["cameras"]:
                cname = cam["name"]
                proc = active_recorders.get(cname)
                if proc is None or proc.poll() is not None:
                    try:
                        print(f"[NVR RECORDER] Conectando gravador na camera: {cname}...")
                        active_recorders[cname] = start_camera_recording(cam, cfg["recordingsDirectory"], cfg.get("segmentMinutes", 15))
                    except Exception as e:
                        print(f"[NVR RECORDER] Erro ao iniciar {cname}: {e}")
        time.sleep(5)

class ApiHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/recorder/status":
            cfg = load_config()
            status = {
                "ok": True,
                "recordingsDirectory": cfg["recordingsDirectory"],
                "activeCameras": list(active_recorders.keys()),
                "timestamp": datetime.now().isoformat()
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(status).encode("utf-8"))
        elif self.path == "/api/recorder/open-folder":
            cfg = load_config()
            p = cfg["recordingsDirectory"]
            if os.path.exists(p):
                subprocess.Popen(f'explorer "{p}"', shell=True)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "opened": p}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/recorder/config":
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                cfg = load_config()
                if "recordingsDirectory" in data:
                    new_dir = data["recordingsDirectory"]
                    os.makedirs(new_dir, exist_ok=True)
                    cfg["recordingsDirectory"] = new_dir
                    # Stop active recorders so they restart in the new folder
                    for k, proc in list(active_recorders.items()):
                        try:
                            proc.terminate()
                        except:
                            pass
                    active_recorders.clear()
                save_config(cfg)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "config": cfg}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    server = HTTPServer(("0.0.0.0", 8089), ApiHandler)
    server.serve_forever()

if __name__ == "__main__":
    t_rec = Thread(target=recorder_worker, daemon=True)
    t_rec.start()
    print("[NVR RECORDER API] Escutando em http://127.0.0.1:8089...")
    run_server()
