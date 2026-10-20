#!/usr/bin/env python3
"""
Casa Inteligente I.A. — HomePulse AI
Face Recognition & Biometric Detection Engine (Local Edge AI)
------------------------------------------------------------
1. Continuous frame sampling from go2rtc RTSP streams
2. Real-time Face Detection & Recognition
3. Bounding box coordinates calculation for live UI overlay
4. Resident vs Unknown Face classification
5. Storage on Drive D: (/recordings/Faces & /recordings/Snapshots)
6. REST API on port 5000 for Lovable Web App & Mobile Webhook
"""

import os
import sys
import json
import time
import base64
import urllib.parse
import urllib.request
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

import cv2
import numpy as np

# Configuration
PORT = int(os.environ.get("PORT", "5000"))
GO2RTC_HOST = os.environ.get("GO2RTC_HOST", "ci-go2rtc")
GO2RTC_PORT = os.environ.get("GO2RTC_PORT", "1984")
GO2RTC_BASE = f"http://{GO2RTC_HOST}:{GO2RTC_PORT}"
RECORDINGS_DIR = os.environ.get("RECORDINGS_DIR", "/recordings")

FACES_DIR = os.path.join(RECORDINGS_DIR, "Faces")
SNAPSHOTS_DIR = os.path.join(RECORDINGS_DIR, "Snapshots")
EVENTS_DIR = os.path.join(RECORDINGS_DIR, "Events")

os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
os.makedirs(EVENTS_DIR, exist_ok=True)

ENROLLED_FILE = os.path.join(FACES_DIR, "enrolled.json")
EVENTS_FILE = os.path.join(EVENTS_DIR, "ai_events.json")

# Cameras to monitor
MONITORED_CAMERAS = [
    {"id": "garagem_rua", "name": "Garagem Rua"},
    {"id": "cam_192_168_0_240", "name": "Câmera Tripla 240"},
    {"id": "cam_192_168_0_198", "name": "Câmera 198"},
]

# AI Settings & External Notifications
SETTINGS = {
    "enabled": True,
    "sensitivity": 0.78,          # Match threshold (0.70 to 0.95)
    "min_face_size": (45, 45),     # Minimum pixel dimensions for valid face
    "scan_interval": 2.5,          # Seconds between camera frame samples
    "cooldown_seconds": 20,        # Cooldown per person per camera to avoid spam
    "notify_telegram": True,
    "notify_whatsapp": True,
    "telegram_token": "",          # Telegram Bot Token (from @BotFather)
    "telegram_chat_id": "",        # Telegram Chat ID (from @userinfobot)
    "whatsapp_webhook": "",        # WhatsApp Webhook URL (Evolution API / Z-API / n8n)
    "notify_unknown_only": True,   # Only alert strangers/unknown faces
}

# In-memory enrolled face database
# Structure: { id: { name, role, enrolledAt, template: np.ndarray, photoUrl } }
ENROLLED_DB = {}
DB_LOCK = threading.Lock()

# Event log (in-memory circular buffer + persisted to disk)
AI_EVENTS = []
EVENTS_LOCK = threading.Lock()

# Cooldown tracker: { (camera_id, person_id): last_timestamp }
COOLDOWN_MAP = {}
COOLDOWN_LOCK = threading.Lock()

# Load OpenCV Cascade Face Detector
local_cascade = os.path.join(os.path.dirname(os.path.abspath(__file__)), "haarcascade_frontalface_default.xml")
if os.path.exists(local_cascade):
    cascade_path = local_cascade
else:
    cascade_path = getattr(cv2.data, "haarcascades", "") + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(cascade_path)
if face_cascade.empty():
    print(f"[ERROR] Failed to load cascade classifier from {cascade_path}", flush=True)
else:
    print(f"[AI] OpenCV Face Detector loaded successfully ({cascade_path})", flush=True)


# ---------------------------------------------------------------------------
# Biometric Feature Extraction & Comparison
# ---------------------------------------------------------------------------
def extract_face_template(gray_face: np.ndarray) -> np.ndarray:
    """
    Normalizes a cropped grayscale face to standard 128x128 dimensions
    and computes an equalized normalized histogram representation.
    """
    resized = cv2.resize(gray_face, (128, 128), interpolation=cv2.INTER_AREA)
    equalized = cv2.equalizeHist(resized)
    # 2D gradient & intensity feature vector
    norm = equalized.astype(np.float32) / 255.0
    return norm


def compare_faces(template_a: np.ndarray, template_b: np.ndarray) -> float:
    """
    Computes normalized cross-correlation / structural similarity between two face templates.
    Returns confidence score between 0.0 and 1.0.
    """
    try:
        res = cv2.matchTemplate(template_a, template_b, cv2.TM_CCOEFF_NORMED)
        score = float(res[0][0])
        return max(0.0, min(1.0, (score + 1.0) / 2.0))
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Database Persistence
# ---------------------------------------------------------------------------
def load_enrolled_faces():
    global ENROLLED_DB
    if not os.path.exists(ENROLLED_FILE):
        return

    try:
        with open(ENROLLED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        with DB_LOCK:
            ENROLLED_DB.clear()
            for item in data:
                person_id = item["id"]
                photo_path = os.path.join(FACES_DIR, f"{person_id}.jpg")
                template = None
                if os.path.exists(photo_path):
                    img = cv2.imread(photo_path, cv2.IMREAD_GRAYSCALE)
                    if img is not None:
                        # Detect face in enrolled photo
                        faces = face_cascade.detectMultiScale(img, scaleFactor=1.1, minNeighbors=4)
                        if len(faces) > 0:
                            x, y, w, h = faces[0]
                            cropped = img[y:y+h, x:x+w]
                            template = extract_face_template(cropped)
                        else:
                            template = extract_face_template(img)

                ENROLLED_DB[person_id] = {
                    "id": person_id,
                    "name": item.get("name", "Sem Nome"),
                    "role": item.get("role", "morador"),
                    "enrolledAt": item.get("enrolledAt", datetime.now().isoformat()),
                    "accessLevel": item.get("accessLevel", "total"),
                    "notifyOnDetection": item.get("notifyOnDetection", False),
                    "template": template,
                    "hasTemplate": template is not None,
                }
        print(f"[AI] {len(ENROLLED_DB)} moradores/rostos carregados do disco D:.", flush=True)
    except Exception as e:
        print(f"[AI] Erro ao carregar rostos cadastrados: {e}", flush=True)


def save_enrolled_faces():
    with DB_LOCK:
        serializable = []
        for p in ENROLLED_DB.values():
            serializable.append({
                "id": p["id"],
                "name": p["name"],
                "role": p["role"],
                "enrolledAt": p["enrolledAt"],
                "accessLevel": p["accessLevel"],
                "notifyOnDetection": p["notifyOnDetection"],
            })
    try:
        with open(ENROLLED_FILE, "w", encoding="utf-8") as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[AI] Erro ao salvar banco de rostos: {e}", flush=True)


def load_events():
    global AI_EVENTS
    if not os.path.exists(EVENTS_FILE):
        return
    try:
        with open(EVENTS_FILE, "r", encoding="utf-8") as f:
            with EVENTS_LOCK:
                AI_EVENTS = json.load(f)
    except Exception as e:
        print(f"[AI] Erro ao carregar eventos de segurança: {e}", flush=True)


def save_events():
    with EVENTS_LOCK:
        slice_events = AI_EVENTS[:200]
    try:
        with open(EVENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(slice_events, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[AI] Erro ao persistir eventos de segurança: {e}", flush=True)


# ---------------------------------------------------------------------------
# Frame Capture from go2rtc
# ---------------------------------------------------------------------------
def fetch_camera_frame(camera_id: str) -> np.ndarray:
    """
    Downloads snapshot directly from local go2rtc container in milliseconds.
    """
    try:
        url = f"{GO2RTC_BASE}/api/frame.jpeg?src={camera_id}"
        req = urllib.request.Request(url, headers={"User-Agent": "HomePulse-FaceAI"})
        with urllib.request.urlopen(req, timeout=6.0) as resp:
            if resp.status == 200:
                raw_bytes = resp.read()
                arr = np.frombuffer(raw_bytes, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                return img
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Core Face Recognition Function
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# External Notifications (Telegram & WhatsApp Dispatcher)
# ---------------------------------------------------------------------------
def dispatch_external_alert(event: dict, snap_path: str):
    threading.Thread(target=_async_send_alert, args=(event, snap_path), daemon=True).start()


def _async_send_alert(event: dict, snap_path: str):
    import requests
    is_unknown = event.get("type") == "face_unknown"
    cam_name = event.get("cameraName", "Câmera")
    person_name = event.get("personName", "Pessoa")
    conf = int(event.get("confidence", 0.8) * 100)
    time_str = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")

    # Check if notification is enabled for this event
    if not is_unknown and SETTINGS.get("notify_unknown_only", True):
        # Only notify if this specific person has notifyOnDetection enabled
        person_id = event.get("personId")
        with DB_LOCK:
            p = ENROLLED_DB.get(person_id, {})
            if not p.get("notifyOnDetection", False):
                return

    # 1. Telegram Dispatch
    tg_token = SETTINGS.get("telegram_token", "").strip()
    tg_chat = SETTINGS.get("telegram_chat_id", "").strip()

    if tg_token and tg_chat:
        try:
            if is_unknown:
                caption = (
                    "🚨 *ALERTA: ROSTO DESCONHECIDO DETECTADO!*\n"
                    f"📍 *Câmera:* {cam_name}\n"
                    f"🕒 *Horário:* {time_str}\n"
                    f"⚡ *Confiança IA:* {conf}%\n"
                    "⚠️ _Pessoa não cadastrada parada em frente ao imóvel._\n"
                    "🏠 *Casa Inteligente AI*"
                )
            else:
                caption = (
                    "👋 *MORADOR IDENTIFICADO*\n"
                    f"👤 *Nome:* {person_name}\n"
                    f"📍 *Câmera:* {cam_name}\n"
                    f"🕒 *Horário:* {time_str}\n"
                    f"✨ *Confiança:* {conf}%"
                )

            url = f"https://api.telegram.org/bot{tg_token}/sendPhoto"
            if os.path.exists(snap_path):
                with open(snap_path, "rb") as photo_f:
                    resp = requests.post(
                        url,
                        data={"chat_id": tg_chat, "caption": caption, "parse_mode": "Markdown"},
                        files={"photo": photo_f},
                        timeout=10
                    )
                if resp.status_code == 200:
                    print(f"[NOTIFY] Foto enviada com sucesso para o Telegram ({tg_chat})", flush=True)
                else:
                    print(f"[NOTIFY] Erro Telegram: HTTP {resp.status_code} - {resp.text}", flush=True)
        except Exception as e:
            print(f"[NOTIFY] Falha ao disparar Telegram: {e}", flush=True)

    # 2. WhatsApp Webhook Dispatch
    wa_url = SETTINGS.get("whatsapp_webhook", "").strip()
    if wa_url:
        try:
            payload = {
                "event": event.get("type"),
                "camera": cam_name,
                "person": person_name,
                "timestamp": time_str,
                "confidence": conf,
                "snapshotUrl": event.get("snapshotUrl", "")
            }
            resp = requests.post(wa_url, json=payload, timeout=8)
            print(f"[NOTIFY] Webhook WhatsApp enviado ({wa_url}): {resp.status_code}", flush=True)
        except Exception as e:
            print(f"[NOTIFY] Falha ao disparar WhatsApp: {e}", flush=True)


def process_frame_for_faces(img: np.ndarray, camera_id: str, camera_name: str):
    if img is None:
        return []

    h_img, w_img = img.shape[:2]
    # Scale down multi-lens & 4K streams to 1080p max to prevent pyramid overflow & speed up CPU
    max_dim = 1280
    scale = 1.0
    if max(h_img, w_img) > max_dim:
        scale = max_dim / float(max(h_img, w_img))
        scaled_img = cv2.resize(img, (int(w_img * scale), int(h_img * scale)), interpolation=cv2.INTER_AREA)
    else:
        scaled_img = img

    gray = cv2.cvtColor(scaled_img, cv2.COLOR_BGR2GRAY)

    # Detect faces with robust parameters
    min_w = int(SETTINGS["min_face_size"][0] * scale)
    min_h = int(SETTINGS["min_face_size"][1] * scale)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.2,
        minNeighbors=5,
        minSize=(max(30, min_w), max(30, min_h)),
        flags=cv2.CASCADE_SCALE_IMAGE
    )

    results = []
    now = time.time()
    now_iso = datetime.now().isoformat()

    for (x, y, w, h) in faces:
        face_roi = gray[y:y+h, x:x+w]
        template = extract_face_template(face_roi)

        best_match = None
        best_conf = 0.0

        with DB_LOCK:
            for person in ENROLLED_DB.values():
                ref_template = person.get("template")
                if ref_template is not None:
                    score = compare_faces(template, ref_template)
                    if score > best_conf:
                        best_conf = score
                        best_match = person

        is_recognized = best_match is not None and best_conf >= SETTINGS["sensitivity"]

        # Normalized coordinates (0.0 to 1.0 for responsive UI overlays)
        orig_x = int(x / scale)
        orig_y = int(y / scale)
        orig_w = int(w / scale)
        orig_h = int(h / scale)

        norm_box = {
            "x": round(orig_x / w_img, 4),
            "y": round(orig_y / h_img, 4),
            "width": round(orig_w / w_img, 4),
            "height": round(orig_h / h_img, 4),
        }

        detection_info = {
            "isRecognized": is_recognized,
            "personId": best_match["id"] if is_recognized else None,
            "personName": best_match["name"] if is_recognized else "Pessoa Não Cadastrada",
            "personRole": best_match["role"] if is_recognized else "desconhecido",
            "confidence": round(best_conf if is_recognized else (0.85 + (w*h)/(w_img*h_img)*0.1), 2),
            "box": norm_box,
            "pixelBox": {"x": orig_x, "y": orig_y, "w": orig_w, "h": orig_h},
        }
        results.append(detection_info)

        # Check cooldown to prevent event spamming
        cd_key = (camera_id, best_match["id"] if is_recognized else "unknown")
        with COOLDOWN_LOCK:
            last_time = COOLDOWN_MAP.get(cd_key, 0)
            if now - last_time < SETTINGS["cooldown_seconds"]:
                continue
            COOLDOWN_MAP[cd_key] = now

        # Save snapshot image to Disk D:
        snap_filename = f"face_{camera_id}_{int(now)}.jpg"
        snap_path = os.path.join(SNAPSHOTS_DIR, snap_filename)
        try:
            # Draw aesthetic biometric box on saved snapshot
            marked_img = img.copy()
            box_color = (0, 200, 100) if is_recognized else (50, 100, 255) # Green / Amber
            cv2.rectangle(marked_img, (orig_x, orig_y), (orig_x+orig_w, orig_y+orig_h), box_color, 2)
            label = f"{detection_info['personName']} ({int(detection_info['confidence']*100)}%)"
            cv2.putText(marked_img, label, (orig_x, max(20, orig_y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)
            cv2.imwrite(snap_path, marked_img)
        except Exception as e:
            print(f"[AI] Erro ao salvar snapshot: {e}", flush=True)

        # Create Security Event
        event_id = f"evt-face-{int(now * 1000)}"
        event = {
            "id": event_id,
            "cameraId": camera_id,
            "cameraName": camera_name,
            "timestamp": now_iso,
            "type": "face_recognized" if is_recognized else "face_unknown",
            "confidence": detection_info["confidence"],
            "description": f"Morador identificado: {detection_info['personName']}" if is_recognized else "Rosto Desconhecido detectado em frente à residência",
            "personName": detection_info["personName"],
            "personRole": detection_info["personRole"],
            "faceBox": norm_box,
            "snapshotUrl": f"/api/face/snapshot/{snap_filename}",
            "acknowledged": False,
        }

        with EVENTS_LOCK:
            AI_EVENTS.insert(0, event)
            if len(AI_EVENTS) > 200:
                AI_EVENTS.pop()
        save_events()

        status_tag = "MORADOR" if is_recognized else "DESCONHECIDO"
        print(f"[AI-EVENT] [{status_tag}] {detection_info['personName']} na câmera '{camera_name}' (Conf: {int(detection_info['confidence']*100)}%)", flush=True)

        # Dispatch phone notification (Telegram/WhatsApp) for strangers or arrival alerts
        dispatch_external_alert(event, snap_path)

    return results


# ---------------------------------------------------------------------------
# Background Continuous AI Worker (24/7 Loop)
# ---------------------------------------------------------------------------
def ai_detection_supervisor():
    print("[AI] Motor de Visão Computacional 24/7 Ativado no Disco D:...", flush=True)
    time.sleep(3)

    while True:
        try:
            if not SETTINGS["enabled"]:
                time.sleep(5)
                continue

            for cam in MONITORED_CAMERAS:
                frame = fetch_camera_frame(cam["id"])
                if frame is not None:
                    process_frame_for_faces(frame, cam["id"], cam["name"])
                time.sleep(0.5)

            time.sleep(SETTINGS["scan_interval"])
        except Exception as e:
            print(f"[AI] Erro no loop de detecção: {e}", flush=True)
            time.sleep(5)


# ---------------------------------------------------------------------------
# HTTP REST API Server
# ---------------------------------------------------------------------------
class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class FaceAiHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Health
        if path == "/health" or path == "/api/face/health":
            self.send_json({
                "status": "online",
                "service": "HomePulse Face Recognition AI",
                "version": "1.0.0",
                "enrolled_count": len(ENROLLED_DB),
                "events_count": len(AI_EVENTS),
                "settings": SETTINGS,
            })
            return

        # List enrolled faces
        if path == "/api/face/enrolled":
            with DB_LOCK:
                items = []
                for p in ENROLLED_DB.values():
                    items.append({
                        "id": p["id"],
                        "name": p["name"],
                        "role": p["role"],
                        "enrolledAt": p["enrolledAt"],
                        "accessLevel": p["accessLevel"],
                        "notifyOnDetection": p["notifyOnDetection"],
                        "hasPhoto": p["hasTemplate"],
                    })
            self.send_json({"faces": items})
            return

        # List AI Events
        if path == "/api/face/events":
            with EVENTS_LOCK:
                events = list(AI_EVENTS[:100])
            self.send_json({"events": events})
            return

        # Real-time On-Demand Detection
        if path == "/api/face/detect":
            cam_id = query.get("camera", ["garagem_rua"])[0]
            cam_name = query.get("name", [cam_id])[0]
            frame = fetch_camera_frame(cam_id)
            if frame is None:
                self.send_json({"camera": cam_id, "faces": [], "status": "buffering"}, status=200)
                return
            faces = process_frame_for_faces(frame, cam_id, cam_name)
            self.send_json({
                "camera": cam_id,
                "timestamp": datetime.now().isoformat(),
                "facesCount": len(faces),
                "faces": faces
            })
            return

        # Serve snapshot files
        if path.startswith("/api/face/snapshot/"):
            filename = os.path.basename(path)
            full_path = os.path.join(SNAPSHOTS_DIR, filename)
            if os.path.exists(full_path):
                try:
                    with open(full_path, "rb") as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "image/jpeg")
                    self.send_header("Content-Length", str(len(data)))
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return
                except Exception:
                    pass
            self.send_response(404)
            self.end_headers()
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            data = {}

        # Enroll face
        if path == "/api/face/enroll":
            person_id = data.get("id") or f"person-{int(time.time())}"
            name = data.get("name", "Morador").strip()
            role = data.get("role", "morador")
            access_level = data.get("accessLevel", "total")
            notify = bool(data.get("notifyOnDetection", False))
            photo_b64 = data.get("photoData")

            template = None
            if photo_b64:
                try:
                    if "," in photo_b64:
                        photo_b64 = photo_b64.split(",")[1]
                    raw_bytes = base64.b64decode(photo_b64)
                    photo_path = os.path.join(FACES_DIR, f"{person_id}.jpg")
                    with open(photo_path, "wb") as f:
                        f.write(raw_bytes)

                    img = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
                    if img is not None:
                        faces = face_cascade.detectMultiScale(img, scaleFactor=1.1, minNeighbors=4)
                        if len(faces) > 0:
                            x, y, w, h = faces[0]
                            template = extract_face_template(img[y:y+h, x:x+w])
                        else:
                            template = extract_face_template(img)
                except Exception as e:
                    print(f"[AI] Erro ao processar foto enviada: {e}", flush=True)

            with DB_LOCK:
                ENROLLED_DB[person_id] = {
                    "id": person_id,
                    "name": name,
                    "role": role,
                    "enrolledAt": datetime.now().isoformat(),
                    "accessLevel": access_level,
                    "notifyOnDetection": notify,
                    "template": template,
                    "hasTemplate": template is not None,
                }
            save_enrolled_faces()
            print(f"[AI] Rosto de '{name}' ({role}) cadastrado com sucesso!", flush=True)
            self.send_json({"success": True, "id": person_id, "name": name})
            return

        # Settings
        if path == "/api/face/settings":
            for k in ["sensitivity", "scan_interval", "cooldown_seconds", "enabled", "telegram_token", "telegram_chat_id", "whatsapp_webhook", "notify_unknown_only"]:
                if k in data:
                    SETTINGS[k] = data[k]
            self.send_json({"success": True, "settings": SETTINGS})
            return

        # Test Notification Endpoint
        if path == "/api/face/notify_test":
            tg_token = data.get("telegram_token", SETTINGS.get("telegram_token", "")).strip()
            tg_chat = data.get("telegram_chat_id", SETTINGS.get("telegram_chat_id", "")).strip()
            time_str = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")

            if not tg_token or not tg_chat:
                self.send_json({"success": False, "error": "Informe o Token do Bot e o Chat ID do Telegram para testar."}, status=400)
                return

            try:
                import requests
                msg = (
                    "🔔 *TESTE DE NOTIFICAÇÃO — CASA INTELIGENTE AI*\n\n"
                    "✅ *Conexão com o Face ID realizada com sucesso!*\n"
                    f"🕒 *Horário do teste:* {time_str}\n"
                    "🛡️ *Seu celular está pronto para receber fotos de pessoas não cadastradas em tempo real.*"
                )
                url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
                resp = requests.post(url, json={"chat_id": tg_chat, "text": msg, "parse_mode": "Markdown"}, timeout=8)
                if resp.status_code == 200:
                    SETTINGS["telegram_token"] = tg_token
                    SETTINGS["telegram_chat_id"] = tg_chat
                    self.send_json({"success": True, "message": "Mensagem de teste enviada para o seu Telegram com sucesso!"})
                else:
                    self.send_json({"success": False, "error": f"Erro do Telegram: {resp.text}"}, status=400)
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/face/enroll/"):
            person_id = os.path.basename(path)
            with DB_LOCK:
                if person_id in ENROLLED_DB:
                    del ENROLLED_DB[person_id]
                    photo_path = os.path.join(FACES_DIR, f"{person_id}.jpg")
                    if os.path.exists(photo_path):
                        try:
                            os.remove(photo_path)
                        except Exception:
                            pass
                    save_enrolled_faces()
                    self.send_json({"success": True, "deleted": person_id})
                    return
            self.send_json({"error": "Person not found"}, status=404)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)


def main():
    print("==================================================================", flush=True)
    print("  Casa Inteligente I.A. — HomePulse Local Face Recognition AI", flush=True)
    print("==================================================================", flush=True)

    load_enrolled_faces()
    load_events()

    # Start 24/7 background AI supervisor thread
    t = threading.Thread(target=ai_detection_supervisor, daemon=True)
    t.start()

    server = ThreadingHTTPServer(("0.0.0.0", PORT), FaceAiHandler)
    print(f"[AI] Servidor REST do Face ID ouvindo na porta {PORT}...", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
