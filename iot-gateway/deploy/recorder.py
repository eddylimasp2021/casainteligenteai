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
    rtsp_url = cam.get("rtspUrl") or f"rtsp://127.0.0.1:8554/{cam.get('stream', cam_name)}"
    codec_mode = cam.get("codec", "copy")
    cam_dir = os.path.join(base_dir, cam_name)
    os.makedirs(cam_dir, exist_ok=True)
    
    output_pattern = os.path.join(cam_dir, f"{cam_name}_%Y-%m-%d_%H-%M-%S.mp4")
    seg_seconds = seg_minutes * 60
    
    # Monta comando FFmpeg com fMP4 (+frag_keyframe+empty_moov+default_base_moof)
    # permitindo que cada arquivo gravado no HD físico seja reproduzido imediatamente no navegador!
    cmd = [
        FFMPEG_EXE,
        "-y",
        "-i", rtsp_url,
    ]
    if codec_mode == "transcode_h264":
        cmd += [
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-profile:v", "baseline",
            "-level", "3.0",
            "-pix_fmt", "yuv420p",
        ]
    else:
        cmd += [
            "-c:v", "copy",
        ]
    cmd += [
        "-c:a", "aac",
        "-f", "segment",
        "-segment_time", str(seg_seconds),
        "-segment_format", "mp4",
        "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
        "-reset_timestamps", "1",
        "-strftime", "1",
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

        elif self.path.startswith("/api/recordings/dates"):
            # GET /api/recordings/dates?camera=...
            from urllib.parse import urlparse, parse_qs
            import re
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            camera = qs.get("camera", [""])[0].strip()

            cfg = load_config()
            base_dir = cfg.get("recordingsDirectory", "D:\\Gravacoes_CFTV")
            cam_folder_map = {
                "garagem_rua": "garagem_rua",
                "garagem": "garagem_rua",
                "cam_192_168_0_198": "Camera_Externa_198",
                "198": "Camera_Externa_198",
                "cam_192_168_0_240": "Camera_Tripla_240",
                "240": "Camera_Tripla_240",
                "tripla": "Camera_Tripla_240",
                "cam_192_168_0_149": "Camera_Yoosee_149",
                "149": "Camera_Yoosee_149",
                "yoosee": "Camera_Yoosee_149",
            }
            cam_lower = camera.lower()
            target_folder = None
            for k, fld in cam_folder_map.items():
                if k in cam_lower:
                    target_folder = fld
                    break
            if not target_folder:
                target_folder = cam_folder_map.get(camera, camera)

            dates_dict = {}
            if target_folder and os.path.isdir(os.path.join(base_dir, target_folder)):
                search_folders = [os.path.join(base_dir, target_folder)]
            else:
                search_folders = [os.path.join(base_dir, f) for f in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, f))]

            for sdir in search_folders:
                if not os.path.isdir(sdir):
                    continue
                for f in os.listdir(sdir):
                    if not (f.endswith(".mp4") or f.endswith(".mkv")):
                        continue
                    m = re.search(r'(\d{4}-\d{2}-\d{2})', f)
                    if m:
                        d = m.group(1)
                        try:
                            sz = os.path.getsize(os.path.join(sdir, f))
                            if sz > 100 * 1024:
                                if d not in dates_dict:
                                    dates_dict[d] = {"date": d, "count": 0, "sizeBytes": 0}
                                dates_dict[d]["count"] += 1
                                dates_dict[d]["sizeBytes"] += sz
                        except:
                            pass

            sorted_dates = sorted(list(dates_dict.values()), key=lambda x: x["date"], reverse=True)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "camera": camera, "dates": sorted_dates}).encode("utf-8"))
            return

        elif self.path.startswith("/api/recordings"):
            # GET /api/recordings?camera=garagem_rua&date=2026-11-13
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            camera = qs.get("camera", [""])[0].strip()
            date_str = qs.get("date", [""])[0].strip() or datetime.now().strftime("%Y-%m-%d")

            cfg = load_config()
            base_dir = cfg.get("recordingsDirectory", "D:\\Gravacoes_CFTV")

            # Map camera names with flexible fallback
            cam_folder_map = {
                "garagem_rua": "garagem_rua",
                "garagem": "garagem_rua",
                "cam_192_168_0_198": "Camera_Externa_198",
                "198": "Camera_Externa_198",
                "cam_192_168_0_240": "Camera_Tripla_240",
                "240": "Camera_Tripla_240",
                "tripla": "Camera_Tripla_240",
                "cam_192_168_0_149": "Camera_Yoosee_149",
                "149": "Camera_Yoosee_149",
                "yoosee": "Camera_Yoosee_149",
            }
            cam_lower = camera.lower()
            target_folder = None
            for k, fld in cam_folder_map.items():
                if k in cam_lower:
                    target_folder = fld
                    break
            if not target_folder:
                target_folder = cam_folder_map.get(camera, camera)
            cam_dir = os.path.join(base_dir, target_folder)

            # Also check if files are in cam_dir or date_str subfolder
            recordings = []
            search_dirs = [cam_dir, os.path.join(cam_dir, date_str)]

            for sdir in search_dirs:
                if not os.path.isdir(sdir):
                    continue
                for f in sorted(os.listdir(sdir)):
                    if not (f.endswith(".mp4") or f.endswith(".mkv")):
                        continue
                    # Match date if contained in filename (e.g. Garagem_Rua_2026-11-13_11-10-39.mp4)
                    if date_str in f or os.path.basename(sdir) == date_str:
                        f_path = os.path.join(sdir, f)
                        try:
                            stat = os.stat(f_path)
                            # Filename format: Camera_Tripla_240_2026-11-12_15-00-02.mp4 or Garagem_Rua_2026-11-13_11-10-39.mp4
                            clean_stem = f.replace(".mp4", "").replace(".mkv", "")
                            parts = clean_stem.split("_")
                            hour, minute, sec = 0, 0, 0
                            # A última parte é a hora HH-MM-SS
                            time_part = parts[-1]
                            if "-" in time_part:
                                subp = time_part.split("-")
                                if len(subp) >= 2 and all(p.isdigit() for p in subp):
                                    hour = int(subp[0])
                                    minute = int(subp[1])
                                    sec = int(subp[2]) if len(subp) > 2 else 0
                            
                            start_min = hour * 60 + minute
                            duration = cfg.get("segmentMinutes", 15) * 60
                            end_min = min(1439, start_min + int(duration / 60))

                            rel_path = f"{target_folder}/{f}" if sdir == cam_dir else f"{target_folder}/{date_str}/{f}"

                            recordings.append({
                                "id": f"{camera}_{f}",
                                "camera": camera,
                                "filename": f,
                                "date": date_str,
                                "startTime": f"{hour:02d}:{minute:02d}:{sec:02d}",
                                "startMinute": start_min,
                                "endMinute": end_min,
                                "durationSeconds": duration,
                                "sizeBytes": stat.st_size,
                                "url": f"/recordings/{rel_path}",
                                "type": "continuous",
                                "status": "ready"
                            })
                        except Exception as err:
                            print(f"[RECORDER API] Erro ao ler metadados {f}: {err}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "camera": camera,
                "date": date_str,
                "totalSegments": len(recordings),
                "recordings": recordings
            }).encode("utf-8"))

        elif self.path.startswith("/api/transcode/"):
            # Transcodifica sob demanda um arquivo H.265 para H.264 streamável no navegador
            # GET /api/transcode/<clean_rel>
            clean_rel = self.path.replace("/api/transcode/", "").lstrip("/")
            cfg = load_config()
            full_path = os.path.join(cfg.get("recordingsDirectory", "D:\\Gravacoes_CFTV"), clean_rel)

            if not os.path.isfile(full_path):
                self.send_response(404)
                self.end_headers()
                return

            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.end_headers()

            # Executa ffmpeg convertendo em tempo real para MP4 fragmentado H.264
            cmd = [
                FFMPEG_EXE,
                "-i", full_path,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-profile:v", "baseline",
                "-level", "3.0",
                "-pix_fmt", "yuv420p",
                "-vf", "scale=-2:720",
                "-c:a", "aac",
                "-b:a", "64k",
                "-f", "mp4",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "pipe:1"
            ]
            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                while True:
                    data = proc.stdout.read(65536)
                    if not data:
                        break
                    self.wfile.write(data)
                proc.wait()
            except:
                pass
            return

        elif self.path.startswith("/recordings/"):
            # Serve video with HTTP 206 Partial Content
            clean_rel = self.path.replace("/recordings/", "").lstrip("/")
            cfg = load_config()
            full_path = os.path.join(cfg.get("recordingsDirectory", "D:\\Gravacoes_CFTV"), clean_rel)

            if not os.path.isfile(full_path):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Arquivo de gravacao nao encontrado.")
                return

            file_size = os.path.getsize(full_path)
            range_header = self.headers.get("Range")

            if range_header:
                try:
                    range_str = range_header.replace("bytes=", "").strip()
                    start_str, end_str = range_str.split("-")
                    start = int(start_str) if start_str else 0
                    end = int(end_str) if end_str else file_size - 1
                    if end >= file_size:
                        end = file_size - 1
                    length = end - start + 1

                    self.send_response(206)
                    self.send_header("Content-Type", "video/mp4")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()

                    with open(full_path, "rb") as f:
                        f.seek(start)
                        rem = length
                        while rem > 0:
                            chunk = f.read(min(65536, rem))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            rem -= len(chunk)
                    return
                except:
                    pass

            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            with open(full_path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
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
