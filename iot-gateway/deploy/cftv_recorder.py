#!/usr/bin/env python3
"""
Casa Inteligente I.A. — HomePulse AI
CFTV NVR Recording Engine, Search API & Video Streamer
------------------------------------------------------
1. Continuous zero-CPU recording via FFmpeg (-c:v copy -c:a aac)
2. Segments saved into /recordings/<camera_name>/<YYYY-MM-DD>/<HH-MM-SS>.mp4 (mounted on D:\\Gravacoes_CFTV)
3. HTTP Search API: GET /api/recordings?camera=...&date=...
4. Video file streaming with HTTP 206 Partial Content (Byte Range requests)
5. Disk usage metrics: GET /api/storage
6. Reverse proxy for go2rtc (WebRTC, Snapshots, Streams) -> http://ci-go2rtc:1984
"""

import os
import sys
import json
import time
import shutil
import urllib.parse
import urllib.request
import urllib.error
import threading
import subprocess
import struct
import socket
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

PORT = 1985
GO2RTC_HOST = os.environ.get("GO2RTC_HOST", "ci-go2rtc")
GO2RTC_PORT = os.environ.get("GO2RTC_PORT", "1984")
GO2RTC_BASE = f"http://{GO2RTC_HOST}:{GO2RTC_PORT}"
RECORDINGS_DIR = os.environ.get("RECORDINGS_DIR", "/recordings")
SEGMENT_SECONDS = int(os.environ.get("SEGMENT_SECONDS", "900"))  # 15 minutes per chunk

ACTIVE_TUNNEL_INFO = {
    "url": "https://cake-studied-rendered-contemporary.trycloudflare.com",
    "updated_at": datetime.now().isoformat(),
    "status": "online"
}

CAMERAS = [
    {
        "id": "garagem_rua",
        "name": "Garagem / Rua",
        "stream": "garagem_rua",
        "rtsp": f"rtsp://{GO2RTC_HOST}:8554/garagem_rua",
    },
    {
        "id": "cam_192_168_0_198",
        "name": "Câmera 198",
        "stream": "cam_192_168_0_198",
        "rtsp": f"rtsp://{GO2RTC_HOST}:8554/cam_192_168_0_198",
    },
    {
        "id": "cam_192_168_0_240",
        "name": "Câmera 240 (Tripla)",
        "stream": "cam_192_168_0_240",
        "rtsp": f"rtsp://{GO2RTC_HOST}:8554/cam_192_168_0_240",
    },
]

def ensure_camera_dir(camera_id: str, date_str: str) -> str:
    path = os.path.join(RECORDINGS_DIR, camera_id, date_str)
    os.makedirs(path, exist_ok=True)
    return path

def is_stream_ready_in_go2rtc(stream_name: str) -> bool:
    try:
        url = f"{GO2RTC_BASE}/api/streams"
        req = urllib.request.Request(url, headers={"User-Agent": "cftv-recorder"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if stream_name in data:
                    producers = data[stream_name].get("producers", [])
                    return len(producers) > 0
    except Exception:
        pass
    return False

# ---------------------------------------------------------------------------
# Background Recording Supervisor
# ---------------------------------------------------------------------------
def run_ffmpeg_recorder(camera: dict):
    cam_id = camera["id"]
    stream_name = camera.get("stream", cam_id)
    rtsp_url = camera["rtsp"]
    transport = camera.get("transport", "tcp")
    print(f"[NVR] Iniciando monitor de gravação para câmera '{cam_id}'...", flush=True)

    while True:
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            ensure_camera_dir(cam_id, today_str)

            output_pattern = os.path.join(RECORDINGS_DIR, cam_id, "%Y-%m-%d", "%H-%M-%S.mp4")

            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel", "warning",
                "-fflags", "+genpts+discardcorrupt",
                "-rtsp_transport", transport,
                "-i", rtsp_url,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "64k",
                "-f", "segment",
                "-segment_time", str(SEGMENT_SECONDS),
                "-segment_format", "mp4",
                "-reset_timestamps", "1",
                "-strftime", "1",
                output_pattern
            ]

            print(f"[NVR-{cam_id}] Executando FFmpeg: {' '.join(cmd)}", flush=True)
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

            # Check daily directory roll
            while proc.poll() is None:
                current_day = datetime.now().strftime("%Y-%m-%d")
                ensure_camera_dir(cam_id, current_day)
                time.sleep(10)

            ret = proc.returncode
            stderr_out = proc.stderr.read() if proc.stderr else ""
            print(f"[NVR-{cam_id}] FFmpeg encerrou com código {ret}. Detalhes: {stderr_out[-200:]}", flush=True)

        except Exception as e:
            print(f"[NVR-{cam_id}] Erro no supervisor: {e}", flush=True)

        print(f"[NVR-{cam_id}] Aguardando 20 segundos antes de tentar novamente...", flush=True)
        time.sleep(20)

def cleanup_old_recordings():
    """
    Gerenciador de Retenção Contínua 24/7:
    1. Remove automaticamente gravações com mais de 30 dias.
    2. Se o disco atingir 85% de uso, purga progressivamente o dia mais antigo.
    """
    while True:
        try:
            total, used, free = shutil.disk_usage(RECORDINGS_DIR)
            used_percent = (used / total) * 100 if total > 0 else 0
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")

            for cam in CAMERAS:
                cam_id = cam["id"]
                cam_path = os.path.join(RECORDINGS_DIR, cam_id)
                if not os.path.isdir(cam_path):
                    continue

                date_folders = sorted([d for d in os.listdir(cam_path) if os.path.isdir(os.path.join(cam_path, d))])

                # 1. Purga de gravações com mais de 30 dias
                for df in date_folders:
                    try:
                        folder_date = datetime.strptime(df, "%Y-%m-%d")
                        if (now - folder_date).days > 30:
                            target_dir = os.path.join(cam_path, df)
                            print(f"[Purge] Removendo gravações antigas (>30 dias): {target_dir}", flush=True)
                            shutil.rmtree(target_dir, ignore_errors=True)
                    except ValueError:
                        pass

                # 2. Se o disco passar de 85%, libera o dia mais antigo (exceto hoje)
                if used_percent > 85.0 and date_folders:
                    oldest_date = date_folders[0]
                    if oldest_date != today_str:
                        target_dir = os.path.join(cam_path, oldest_date)
                        print(f"[Purge] Disco em {used_percent:.1f}% (>85%). Liberando dia mais antigo: {target_dir}", flush=True)
                        shutil.rmtree(target_dir, ignore_errors=True)

        except Exception as e:
            print(f"[Purge] Erro no gerenciador de retenção: {e}", flush=True)

        time.sleep(3600)  # Executa a cada 1 hora

def start_recorders():
    for cam in CAMERAS:
        t = threading.Thread(target=run_ffmpeg_recorder, args=(cam,), daemon=True)
        t.start()
    t_clean = threading.Thread(target=cleanup_old_recordings, daemon=True)
    t_clean.start()

# ---------------------------------------------------------------------------
# Smart TV (LG webOS / Tizen / Local IoT) Bridge
# ---------------------------------------------------------------------------
def make_ws_frame(data_str: str) -> bytes:
    data = data_str.encode('utf-8')
    length = len(data)
    mask = os.urandom(4)
    if length <= 125:
        header = struct.pack('!BB', 0x81, 0x80 | length)
    elif length <= 65535:
        header = struct.pack('!BBH', 0x81, 0x80 | 126, length)
    else:
        header = struct.pack('!BBQ', 0x81, 0x80 | 127, length)
    return header + mask + bytearray(b ^ mask[i % 4] for i, b in enumerate(data))

def read_ws_frame(sock) -> str:
    head = sock.recv(2)
    if len(head) < 2:
        return ""
    b1, b2 = head[0], head[1]
    length = b2 & 0x7F
    if length == 126:
        ext = sock.recv(2)
        length = struct.unpack('!H', ext)[0]
    elif length == 127:
        ext = sock.recv(8)
        length = struct.unpack('!Q', ext)[0]
    data = b''
    while len(data) < length:
        chunk = sock.recv(length - len(data))
        if not chunk:
            break
        data += chunk
    return data.decode('utf-8', errors='replace')

def execute_lg_tv_command(ip="192.168.0.168", uri="", payload=None, client_key="c8708eb7cd1845c6aacec78f6cdc370d", permissions=None, timeout=3.5):
    if payload is None:
        payload = {}
    if permissions is None:
        permissions = ['CONTROL_AUDIO', 'CONTROL_POWER', 'WRITE_NOTIFICATION_TOAST']
    try:
        s = socket.socket()
        s.settimeout(timeout)
        s.connect((ip, 3000))
        s.sendall(b'GET / HTTP/1.1\r\nHost: ' + ip.encode() + b':3000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n')
        s.recv(1024)

        reg = {
            'type': 'register',
            'id': 'reg_gw',
            'payload': {
                'forcePairing': False,
                'pairingType': 'PROMPT',
                'client-key': client_key or 'c8708eb7cd1845c6aacec78f6cdc370d',
                'manifest': {
                    'manifestVersion': 1,
                    'appVersion': '1.0',
                    'permissions': permissions
                }
            }
        }
        s.sendall(make_ws_frame(json.dumps(reg)))
        reg_resp = read_ws_frame(s)
        reg_data = json.loads(reg_resp) if reg_resp else {}

        if not uri:
            s.close()
            return {
                "ok": True,
                "online": True,
                "registered": reg_data.get("type") == "registered",
                "client_key": reg_data.get("payload", {}).get("client-key", client_key),
                "reg": reg_data
            }

        cmd_id = f"cmd_{int(time.time()*1000)}"
        cmd = {
            'type': 'request',
            'id': cmd_id,
            'uri': uri,
            'payload': payload
        }
        s.sendall(make_ws_frame(json.dumps(cmd)))
        cmd_resp = read_ws_frame(s)
        s.close()
        cmd_data = json.loads(cmd_resp) if cmd_resp else {}
        is_ok = bool(cmd_data.get("payload", {}).get("returnValue", False) or cmd_data.get("type") == "response")
        return {
            "ok": is_ok,
            "response": cmd_data,
            "reg": reg_data
        }
    except Exception as e:
        return {"ok": False, "online": False, "error": str(e)}

# ---------------------------------------------------------------------------
# HTTP Handler: Reverse Proxy, Search API & Video Streamer
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Snapshot cache & single-flight lock to protect go2rtc from polling storms
# ---------------------------------------------------------------------------
_FRAME_CACHE = {}
_FRAME_LOCK = threading.Lock()
_IN_FLIGHT_EVENTS = {}

def get_cached_frame(src: str, max_age: float = 1.5):
    with _FRAME_LOCK:
        entry = _FRAME_CACHE.get(src)
        if entry and (time.time() - entry["timestamp"] < max_age):
            return entry["data"]
    return None

def set_cached_frame(src: str, data: bytes):
    with _FRAME_LOCK:
        _FRAME_CACHE[src] = {"data": data, "timestamp": time.time()}
class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class CFTVGatewayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = 30
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: List Recordings for Camera & Date
        if path == "/api/recordings":
            self.handle_list_recordings(query)
            return

        # 1.1 API: Active Tunnel Info
        if path == "/api/tunnel_info":
            self.send_json_response(ACTIVE_TUNNEL_INFO)
            return

        # 1.2 API: Smart TV Status
        if path == "/api/tv/status":
            ip = query.get("ip", ["192.168.0.168"])[0]
            res = execute_lg_tv_command(ip=ip, uri="ssap://audio/getVolume")
            self.send_json_response(res)
            return

        # 2. API: List available recording dates
        if path == "/api/recordings/dates":
            self.handle_list_dates(query)
            return

        # 3. API: Storage Disk Stats
        if path == "/api/storage":
            self.handle_storage_stats()
            return

        # 4. Video Playback: /recordings/...
        if path.startswith("/recordings/"):
            self.handle_serve_recording(path)
            return

        # 4.5 API: Optimized Snapshot with In-Memory Cache and Single-Flight
        if path == "/api/frame.jpeg":
            self.handle_frame_jpeg(query)
            return

        # 4.6 API: Reverse Proxy to Face AI engine
        if path.startswith("/api/face"):
            self.proxy_to_face_ai("GET")
            return

        # 5. Fallback: Reverse Proxy to go2rtc
        self.proxy_to_go2rtc("GET")

    def do_HEAD(self):
        self.proxy_to_go2rtc("HEAD")

    def do_POST(self):
        # Update tunnel URL
        if self.path == "/api/tunnel_info":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
                new_url = data.get("url", "").strip()
                if new_url:
                    ACTIVE_TUNNEL_INFO["url"] = new_url
                    ACTIVE_TUNNEL_INFO["updated_at"] = datetime.now().isoformat()
                    ACTIVE_TUNNEL_INFO["status"] = "online"
                self.send_json_response({"status": "ok", "tunnel": ACTIVE_TUNNEL_INFO})
            except Exception as e:
                self.send_json_response({"status": "error", "message": str(e)})
            return

        # Smart TV API: Command execution
        if self.path == "/api/tv/command":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
                ip = data.get("ip", "192.168.0.168")
                uri = data.get("uri", "")
                payload = data.get("payload", {})
                client_key = data.get("client_key") or "c8708eb7cd1845c6aacec78f6cdc370d"
                res = execute_lg_tv_command(ip=ip, uri=uri, payload=payload, client_key=client_key)
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({"ok": False, "error": str(e)})
            return

        # Smart TV API: Pairing trigger
        if self.path == "/api/tv/pair":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
                ip = data.get("ip", "192.168.0.168")
                res = execute_lg_tv_command(
                    ip=ip,
                    uri="ssap://system.notifications/createToast",
                    payload={"message": "Casa Inteligente AI emparelhada com sucesso!"},
                    client_key="c8708eb7cd1845c6aacec78f6cdc370d"
                )
                self.send_json_response(res)
            except Exception as e:
                self.send_json_response({"ok": False, "error": str(e)})
            return

        # Reverse Proxy to Face AI engine
        if path.startswith("/api/face"):
            self.proxy_to_face_ai("POST")
            return

        # Forward all other POSTs (e.g. WebRTC SDP negotiation) to go2rtc
        self.proxy_to_go2rtc("POST")

    def do_PUT(self):
        self.proxy_to_go2rtc("PUT")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/face"):
            self.proxy_to_face_ai("DELETE")
            return
        self.proxy_to_go2rtc("DELETE")

    def proxy_to_face_ai(self, method: str):
        target_url = f"http://ci-face-ai:5000{self.path}"
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            req = urllib.request.Request(target_url, data=body, method=method)
            for k, v in self.headers.items():
                if k.lower() not in ("host", "content-length"):
                    req.add_header(k, v)
            with urllib.request.urlopen(req, timeout=12) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "content-length"):
                        self.send_header(k, v)
                data = resp.read()
                self.send_header("Content-Length", str(len(data)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            err_data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Length", str(len(err_data)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(err_data)
        except Exception as e:
            self.send_json_response({"error": f"Face AI unreachable: {e}"}, status=502)

    # -----------------------------------------------------------------------
    # API: List Recordings
    # -----------------------------------------------------------------------
    def handle_list_recordings(self, query):
        camera = query.get("camera", [""])[0]
        date_str = query.get("date", [""])[0]

        if not date_str:
            date_str = datetime.now().strftime("%Y-%m-%d")

        # Normalize camera identifier
        camera_id = self.resolve_camera_id(camera)

        target_dir = os.path.join(RECORDINGS_DIR, camera_id, date_str)
        recordings = []

        if os.path.isdir(target_dir):
            files = sorted(os.listdir(target_dir))
            for f in files:
                if f.endswith(".mp4") or f.endswith(".mkv"):
                    f_path = os.path.join(target_dir, f)
                    try:
                        stat = os.stat(f_path)
                        # Filename format expected: HH-MM-SS.mp4
                        parts = f.replace(".mp4", "").replace(".mkv", "").split("-")
                        if len(parts) >= 2:
                            hour = int(parts[0])
                            minute = int(parts[1])
                            sec = int(parts[2]) if len(parts) > 2 else 0
                        else:
                            hour, minute, sec = 0, 0, 0

                        start_minute = hour * 60 + minute
                        start_time_str = f"{hour:02d}:{minute:02d}:{sec:02d}"

                        # Estimate duration from file size and segment settings
                        duration = SEGMENT_SECONDS
                        end_minute = min(1439, start_minute + int(duration / 60))

                        recordings.append({
                            "id": f"{camera_id}_{date_str}_{f}",
                            "camera": camera_id,
                            "filename": f,
                            "date": date_str,
                            "startTime": start_time_str,
                            "startMinute": start_minute,
                            "endMinute": end_minute,
                            "durationSeconds": duration,
                            "sizeBytes": stat.st_size,
                            "url": f"/recordings/{camera_id}/{date_str}/{f}",
                            "type": "continuous",
                            "status": "ready"
                        })
                    except Exception as e:
                        print(f"[API] Erro ao ler metadados de {f}: {e}", flush=True)

        resp = {
            "status": "ok",
            "camera": camera_id,
            "date": date_str,
            "totalSegments": len(recordings),
            "recordings": recordings
        }

        self.send_json_response(resp)

    # -----------------------------------------------------------------------
    # API: List Available Dates with Recordings
    # -----------------------------------------------------------------------
    def handle_list_dates(self, query):
        camera = query.get("camera", [""])[0]
        camera_id = self.resolve_camera_id(camera)

        cam_dir = os.path.join(RECORDINGS_DIR, camera_id)
        dates = []
        if os.path.isdir(cam_dir):
            for d in sorted(os.listdir(cam_dir), reverse=True):
                sub = os.path.join(cam_dir, d)
                if os.path.isdir(sub) and any(f.endswith(".mp4") for f in os.listdir(sub)):
                    dates.append(d)

        self.send_json_response({
            "status": "ok",
            "camera": camera_id,
            "dates": dates
        })

    # -----------------------------------------------------------------------
    # API: Disk Storage Stats
    # -----------------------------------------------------------------------
    def handle_storage_stats(self):
        try:
            total, used, free = shutil.disk_usage(RECORDINGS_DIR)
            percent = round((used / total) * 100, 1) if total > 0 else 0
        except Exception:
            total, used, free, percent = 0, 0, 0, 0

        self.send_json_response({
            "status": "ok",
            "mountPath": "D:\\Gravacoes_CFTV",
            "totalBytes": total,
            "usedBytes": used,
            "freeBytes": free,
            "usedPercent": percent
        })

    # -----------------------------------------------------------------------
    # Video Streaming with HTTP 206 Byte-Range
    # -----------------------------------------------------------------------
    def handle_serve_recording(self, path):
        # path is /recordings/<camera>/<date>/<file>
        clean_rel = path.replace("/recordings/", "").lstrip("/")
        full_path = os.path.join(RECORDINGS_DIR, clean_rel)

        if not os.path.isfile(full_path):
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Video file not found")
            return

        file_size = os.path.getsize(full_path)
        range_header = self.headers.get("Range")

        if range_header:
            # Handle Range: bytes=start-end
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
                self.send_cors_headers()
                self.end_headers()

                with open(full_path, "rb") as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk_size = min(65536, remaining)
                        data = f.read(chunk_size)
                        if not data:
                            break
                        self.wfile.write(data)
                        remaining -= len(data)
                return
            except (BrokenPipeError, ConnectionResetError):
                return
            except Exception as e:
                print(f"[Streamer] Erro ao servir range {range_header}: {e}", flush=True)

        # Full file fallback
        self.send_response(200)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(file_size))
        self.send_cors_headers()
        self.end_headers()

        try:
            with open(full_path, "rb") as f:
                shutil.copyfileobj(f, self.wfile, length=65536)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # -----------------------------------------------------------------------
    # -----------------------------------------------------------------------
    # Optimized Snapshot Handling (Throttling, In-Memory Cache & Dedup)
    # -----------------------------------------------------------------------
    def handle_frame_jpeg(self, query: dict):
        raw_src = query.get("src", [""])[0]
        src = self.resolve_camera_id(raw_src) if raw_src else ""
        if not src:
            src = raw_src or "cam_192_168_0_240"

        # 1. Return fresh cached frame (< 1.5 seconds old) immediately
        cached = get_cached_frame(src, max_age=1.5)
        if cached:
            self.send_frame_response(cached)
            return

        # 2. Request deduplication (single-flight)
        with _FRAME_LOCK:
            in_flight = _IN_FLIGHT_EVENTS.get(src)
            if in_flight is not None:
                is_leader = False
            else:
                in_flight = threading.Event()
                _IN_FLIGHT_EVENTS[src] = in_flight
                is_leader = True

        if not is_leader:
            # Wait up to 3.0s for the leader thread to fetch the fresh frame
            in_flight.wait(timeout=3.0)
            cached = get_cached_frame(src, max_age=3.0)
            if cached:
                self.send_frame_response(cached)
                return
            # Stale fallback: return any existing frame from memory
            with _FRAME_LOCK:
                entry = _FRAME_CACHE.get(src)
                if entry:
                    self.send_frame_response(entry["data"])
                    return

        # 3. Leader thread: Fetch frame from go2rtc with 4s timeout
        try:
            target_url = f"{GO2RTC_BASE}/api/frame.jpeg?src={urllib.parse.quote(src)}"
            req = urllib.request.Request(target_url, headers={"User-Agent": "CFTV-Gateway/1.0"})
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                frame_data = resp.read()
                if frame_data:
                    set_cached_frame(src, frame_data)
                    self.send_frame_response(frame_data)
                    return
        except Exception as e:
            # Stale fallback on timeout or error: keep UI smooth without failing
            with _FRAME_LOCK:
                entry = _FRAME_CACHE.get(src)
                if entry:
                    self.send_frame_response(entry["data"])
                    return
            print(f"[Snapshot] Frame indisponivel temporariamente ({src}): {e}", flush=True)
            self.send_response(504)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Snapshot timeout")
        finally:
            if is_leader:
                with _FRAME_LOCK:
                    _IN_FLIGHT_EVENTS.pop(src, None)
                in_flight.set()

    def send_frame_response(self, frame_data: bytes):
        try:
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(frame_data)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(frame_data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # Reverse Proxy to go2rtc
    # -----------------------------------------------------------------------
    def proxy_to_go2rtc(self, method: str):
        target_url = f"{GO2RTC_BASE}{self.path}"
        req_headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ["host", "content-length"]:
                req_headers[key] = val

        body = None
        content_len = self.headers.get("Content-Length")
        if content_len:
            body = self.rfile.read(int(content_len))

        try:
            req = urllib.request.Request(target_url, data=body, headers=req_headers, method=method)
            with urllib.request.urlopen(req, timeout=8) as resp:
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    if k.lower() not in ["access-control-allow-origin", "transfer-encoding"]:
                        self.send_header(k, v)
                self.send_cors_headers()
                self.end_headers()

                shutil.copyfileobj(resp, self.wfile, length=65536)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_cors_headers()
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                pass
        except Exception as e:
            print(f"[Proxy] Erro ao encaminhar {method} {self.path} para go2rtc: {e}", flush=True)
            self.send_response(502)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(f"Gateway Proxy Error: {e}".encode("utf-8"))

    # -----------------------------------------------------------------------
    # Utilities
    # -----------------------------------------------------------------------
    def resolve_camera_id(self, input_str: str) -> str:
        s = input_str.lower().strip()
        if "garagem" in s or "139" in s:
            return "garagem_rua"
        if "198" in s:
            return "cam_192_168_0_198"
        if "240" in s:
            return "cam_192_168_0_240"
        return input_str or "garagem_rua"

    def send_json_response(self, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Silent or minimal logging to prevent spam
        return

def main():
    print("==========================================================")
    print(f" HomePulse AI — NVR Recorder & Playback Gateway v2.0")
    print(f" Porta HTTP/Proxy: {PORT}")
    print(f" go2rtc Destino: {GO2RTC_BASE}")
    print(f" Pasta de Gravações: {RECORDINGS_DIR}")
    print("==========================================================", flush=True)

    # 1. Start background FFmpeg recording threads
    start_recorders()

    # 2. Start HTTP server
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadingHTTPServer(server_address, CFTVGatewayHandler)
    print(f"[NVR] Gateway HTTP pronto em http://0.0.0.0:{PORT}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[NVR] Encerrando...", flush=True)
        httpd.server_close()

if __name__ == "__main__":
    main()
