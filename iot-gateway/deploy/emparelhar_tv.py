import socket
import json
import time
import struct
import re

ip = "192.168.0.168"
port = 3000

print("=" * 60)
print("HOMEPULSE AI - PAREAMENTO AUTOMATICO COM SMART TV LG")
print(f"Conectando na TV ({ip}:{port})...")
print("=" * 60)

try:
    s = socket.socket()
    s.settimeout(60.0)
    s.connect((ip, port))

    handshake = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {ip}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(handshake.encode())
    s.recv(1024)

    def make_frame(msg):
        b = json.dumps(msg).encode("utf-8")
        length = len(b)
        mask = b"\x55\x66\x77\x88"
        masked = bytearray(length)
        for i in range(length):
            masked[i] = b[i] ^ mask[i % 4]
        if length <= 125:
            h = bytes([0x81, 0x80 | length]) + mask
        else:
            h = bytes([0x81, 0x80 | 126]) + struct.pack(">H", length) + mask
        return h + masked

    reg = {
        "type": "register",
        "id": "reg_pair_active",
        "payload": {
            "forcePairing": True,
            "pairingType": "PROMPT",
            "manifest": {
                "manifestVersion": 1,
                "appVersion": "1.0",
                "permissions": [
                    "CONTROL_AUDIO", "CONTROL_POWER", "READ_RUNNING_APPS",
                    "LAUNCH", "WRITE_NOTIFICATION_TOAST", "CONTROL_INPUT_TV"
                ]
            }
        }
    }
    s.sendall(make_frame(reg))
    print("\n>>> POPUP ENVIADO PARA A TELA DA SUA TV! <<<")
    print("Pegue o controle remoto da TV e clique em 'SIM' ou 'PERMITIR'.")
    print("Aguardando sua confirmação (até 60 segundos)...\n")

    start = time.time()
    while time.time() - start < 60:
        try:
            raw = s.recv(4096)
            if not raw:
                break
            text = raw.decode("utf-8", errors="ignore")
            print("Resposta da TV:", text)
            if "client-key" in text:
                m = re.search(r'"client-key"\s*:\s*"([^"]+)"', text)
                if m:
                    key = m.group(1)
                    print("\n" + "=" * 60)
                    print("✓ SUCESSO! CHAVE DE PAREAMENTO RECEBIDA:", key)
                    print("=" * 60)
                    with open("iot-gateway/deploy/tv_key.txt", "w", encoding="utf-8") as f:
                        f.write(key)
                    break
        except socket.timeout:
            print("Tempo limite excedido aguardando o botão no controle da TV.")
            break
    s.close()
except Exception as e:
    print("Erro ao conectar na TV:", e)
