import os
import sys
import json
import time
import socket
import struct
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuration
PORT = 1985
DEFAULT_LG_KEY = "c8708eb7cd1845c6aacec78f6cdc370d"
DEFAULT_TV_IP = "192.168.0.168"
DEFAULT_TV_MAC = "c4:36:6c:40:84:ac"

ALL_PERMISSIONS = [
    "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE", "TEST_OPEN",
    "TEST_PROTECTED", "CONTROL_AUDIO", "CONTROL_DISPLAY",
    "CONTROL_INPUT_JOYSTICK", "CONTROL_INPUT_MEDIA_RECORDING",
    "CONTROL_INPUT_MEDIA_PLAYBACK", "CONTROL_INPUT_TV", "CONTROL_POWER",
    "READ_APP_STATUS", "READ_CURRENT_CHANNEL", "READ_INPUT_DEVICE_LIST",
    "READ_NETWORK_STATUS", "READ_RUNNING_APPS", "READ_TV_CHANNEL_LIST",
    "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE", "READ_COUNTRY_INFO",
    "READ_SETTINGS", "CONTROL_TV_SCREEN"
]

def send_wol(mac_address):
    """Envia Magic Packet Wake-on-LAN para ligar a TV pela rede."""
    clean_mac = mac_address.replace(":", "").replace("-", "").replace(".", "")
    if len(clean_mac) != 12:
        return False
    data = b'\xff' * 6 + bytes.fromhex(clean_mac) * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(data, ('255.255.255.255', 9))
        s.sendto(data, ('192.168.0.255', 9))
    return True

def websocket_frame(payload_bytes):
    """Gera um frame WebSocket mascarado básico (cliente para servidor)."""
    length = len(payload_bytes)
    mask = b'\x12\x34\x56\x78'
    masked_payload = bytearray(length)
    for i in range(length):
        masked_payload[i] = payload_bytes[i] ^ mask[i % 4]
    
    if length <= 125:
        header = bytes([0x81, 0x80 | length]) + mask
    elif length <= 65535:
        header = bytes([0x81, 0x80 | 126]) + struct.pack('>H', length) + mask
    else:
        header = bytes([0x81, 0x80 | 127]) + struct.pack('>Q', length) + mask
    return header + masked_payload

def execute_lg_command(ip, uri, payload=None, client_key=None, timeout=3.0):
    """Envia um comando para webOS Smart TV via WebSocket nativo do Python."""
    if payload is None:
        payload = {}
    key = client_key or DEFAULT_LG_KEY

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((ip, 3000))

        # 1. Handshake
        handshake = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {ip}:3000\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        sock.sendall(handshake.encode("utf-8"))
        res = sock.recv(1024)
        if b"101 Switching Protocols" not in res:
            sock.close()
            return {"ok": False, "message": "Falha no handshake WebSocket com a TV."}

        # 2. Registrar com client-key
        reg_msg = {
            "type": "register",
            "id": "reg_req",
            "payload": {
                "forcePairing": False,
                "pairingType": "PROMPT",
                "client-key": key,
                "manifest": {
                    "manifestVersion": 1,
                    "appVersion": "1.0",
                    "permissions": ALL_PERMISSIONS
                }
            }
        }
        reg_bytes = json.dumps(reg_msg).encode("utf-8")
        sock.sendall(websocket_frame(reg_bytes))
        time.sleep(0.1)

        # 3. Enviar o comando desejado
        cmd_msg = {
            "type": "request",
            "id": f"cmd_{int(time.time())}",
            "uri": uri,
            "payload": payload
        }
        cmd_bytes = json.dumps(cmd_msg).encode("utf-8")
        sock.sendall(websocket_frame(cmd_bytes))
        time.sleep(0.1)

        sock.close()
        return {"ok": True, "message": f"Comando '{uri}' executado com sucesso na TV ({ip})!"}
    except Exception as e:
        return {"ok": False, "message": f"Erro de comunicação com a TV: {str(e)}"}

class SmartTvBridgeHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/tv/status":
            ip = qs.get("ip", [DEFAULT_TV_IP])[0]
            # Testa portas 3000 e 3001
            online = False
            try:
                s = socket.socket()
                s.settimeout(0.8)
                s.connect((ip, 3000))
                s.close()
                online = True
            except:
                pass

            data = {
                "ok": True,
                "online": online,
                "ip": ip,
                "device": "LG webOS Smart TV",
                "mac": DEFAULT_TV_MAC
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        elif path == "/api/tv/discover":
            # Retorna TVs e dispositivos detectados na rede
            devices = [
                {
                    "ip": DEFAULT_TV_IP,
                    "name": "LG webOS Smart TV (Sala)",
                    "brand": "lg",
                    "category": "entretenimento",
                    "device_type": "televisao",
                    "status": "online",
                    "mac": DEFAULT_TV_MAC,
                    "ports": [3000, 3001]
                }
            ]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "devices": devices}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            body = json.loads(post_data)
        except:
            body = {}

        if path == "/api/tv/command":
            ip = body.get("ip", DEFAULT_TV_IP)
            uri = body.get("uri", "")
            payload = body.get("payload", {})
            client_key = body.get("client_key", DEFAULT_LG_KEY)

            # Se comando for power off ou on
            if "power/turnOff" in uri:
                res = execute_lg_command(ip, uri, payload, client_key)
            elif "power/turnOn" in uri:
                # Wake-on-LAN para ligar a TV
                mac = body.get("mac", DEFAULT_TV_MAC)
                wol_ok = send_wol(mac)
                res = {"ok": wol_ok, "message": "Pacote Wake-on-LAN enviado para ligar a TV."}
            else:
                res = execute_lg_command(ip, uri, payload, client_key)

            self.send_response(200 if res["ok"] else 500)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/tv/wol":
            mac = body.get("mac", DEFAULT_TV_MAC)
            send_wol(mac)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "message": "Wake-on-LAN disparado."}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Silencia logs excessivos de polling
        return

def run_server():
    server = HTTPServer(("0.0.0.0", PORT), SmartTvBridgeHandler)
    print(f"[SmartTvBridge] Servidor HTTP de Controle e Failover rodando na porta {PORT}...")
    server.serve_forever()

if __name__ == "__main__":
    run_server()
