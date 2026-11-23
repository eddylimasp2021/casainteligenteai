import json
import urllib.request
import urllib.error
from datetime import datetime

SYNC_TOPIC = 'homepulse-cftv-gw-eddylima-synctoken'
NTFY_URL = f'https://ntfy.sh/{SYNC_TOPIC}'

def publish_active_gateway(tunnel_url: str) -> bool:
    clean_url = tunnel_url.strip().rstrip('/')
    payload = json.dumps({
        'gateway_url': clean_url,
        'tunnel_url': clean_url,
        'updated_at': datetime.now().isoformat(),
        'status': 'online'
    }).encode('utf-8')
    try:
        req = urllib.request.Request(
            NTFY_URL,
            data=payload,
            headers={
                'Title': 'HOMEPULSE_CFTV_GATEWAY',
                'Priority': 'high',
                'X-Tags': 'cftv,camera,video',
                'User-Agent': 'HomePulse-Gateway-Publisher/1.0'
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                print(f' [NUVEM OK] Link sincronizado com sucesso na nuvem global: {clean_url}')
                return True
    except Exception as e:
        print(f' [AVISO] Falha ao publicar túnel no canal de nuvem: {e}')
    return False

def get_latest_gateway_url() -> str:
    try:
        req = urllib.request.Request(
            f'{NTFY_URL}/json?poll=1&since=24h',
            headers={'User-Agent': 'HomePulse-Gateway-Poller/1.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            lines = resp.read().decode('utf-8').strip().split('\n')
            for line in reversed(lines):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get('event') == 'message':
                        msg = data.get('message', '')
                        if msg.startswith('http'):
                            return msg.strip().rstrip('/')
                        parsed = json.loads(msg)
                        gw = parsed.get('gateway_url') or parsed.get('tunnel_url')
                        if gw and gw.startswith('http'):
                            return gw.strip().rstrip('/')
                except:
                    continue
    except Exception:
        pass
    return None
