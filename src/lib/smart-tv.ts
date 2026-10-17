/**
 * Smart TV Integration & Control Engine para Casa Inteligente AI
 * Suporta LG webOS (WebSocket portas 3000/3001), Samsung Tizen, Roku (ECP) e Android TV.
 */

export interface SmartTvPreset {
  id: string;
  name: string;
  brand: "lg" | "samsung" | "roku" | "android_tv" | "other";
  defaultPort: number;
  protocol: "websocket" | "http" | "wifi";
  detectedIp?: string;
  description: string;
}

export const SMART_TV_PRESETS: SmartTvPreset[] = [
  {
    id: "lg_webos",
    name: "LG webOS Smart TV (70LB7200)",
    brand: "lg",
    defaultPort: 3000,
    protocol: "websocket",
    detectedIp: "192.168.0.168",
    description: "Detectada na rede local (192.168.0.168). Conexão direta via WebSocket nas portas 3000/3001.",
  },
  {
    id: "samsung_tizen",
    name: "Samsung Smart TV (Tizen)",
    brand: "samsung",
    defaultPort: 8002,
    protocol: "websocket",
    description: "Conexão WebSocket segura na porta 8002 com chave de token.",
  },
  {
    id: "roku_tv",
    name: "Roku TV / Roku Stick",
    brand: "roku",
    defaultPort: 8060,
    protocol: "http",
    description: "Controle REST ECP (External Control Protocol) direto na porta 8060.",
  },
  {
    id: "android_tv",
    name: "Android TV / Google TV",
    brand: "android_tv",
    defaultPort: 5555,
    protocol: "wifi",
    description: "Controle remoto Android TV / ADB na porta 5555 ou Google Cast.",
  },
];

const STORAGE_LG_KEY = "homepulse_lg_client_key";
const DEFAULT_SAVED_KEY = "c8708eb7cd1845c6aacec78f6cdc370d";
export const DEFAULT_TV_TUNNEL_GATEWAY = "https://cake-studied-rendered-contemporary.trycloudflare.com";

export function getSmartTvGatewayUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:1985";
  try {
    const saved = localStorage.getItem("homepulse_dvr_gateway_url_v1");
    if (saved && saved.trim() && !saved.includes("usb-recommendations") && !saved.includes("dreams-metal")) {
      return saved.trim().replace(/\/+$/, "");
    }
  } catch {}
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  return isHttps ? DEFAULT_TV_TUNNEL_GATEWAY : "http://127.0.0.1:1985";
}

export function getSavedLgClientKey(ip?: string): string {
  if (typeof window === "undefined") return DEFAULT_SAVED_KEY;
  try {
    const k = localStorage.getItem(`${STORAGE_LG_KEY}_${ip || "default"}`) || localStorage.getItem(STORAGE_LG_KEY);
    return k || DEFAULT_SAVED_KEY;
  } catch {
    return DEFAULT_SAVED_KEY;
  }
}

export function saveLgClientKey(ip: string, key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_LG_KEY}_${ip}`, key);
    localStorage.setItem(STORAGE_LG_KEY, key);
  } catch {}
}

const ALL_PERMISSIONS = [
  "LAUNCH",
  "LAUNCH_WEBAPP",
  "APP_TO_APP",
  "CLOSE",
  "TEST_OPEN",
  "TEST_PROTECTED",
  "CONTROL_AUDIO",
  "CONTROL_DISPLAY",
  "CONTROL_INPUT_JOYSTICK",
  "CONTROL_INPUT_MEDIA_RECORDING",
  "CONTROL_INPUT_MEDIA_PLAYBACK",
  "CONTROL_INPUT_TV",
  "CONTROL_POWER",
  "READ_APP_STATUS",
  "READ_CURRENT_CHANNEL",
  "READ_INPUT_DEVICE_LIST",
  "READ_NETWORK_STATUS",
  "READ_RUNNING_APPS",
  "READ_TV_CHANNEL_LIST",
  "WRITE_NOTIFICATION_TOAST",
  "READ_POWER_STATE",
  "READ_COUNTRY_INFO",
  "READ_SETTINGS",
  "CONTROL_TV_SCREEN"
];

/**
 * Solicita pareamento com a TV LG exibindo o popup na tela da TV
 */
export async function pairLgWebOsTv(
  ip: string,
  onPromptVisible?: () => void
): Promise<{ ok: boolean; clientKey?: string; message: string }> {
  const gw = getSmartTvGatewayUrl();
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // Rota via Gateway local / Cloudflare Tunnel
  if (isHttps || gw) {
    try {
      onPromptVisible?.();
      const res = await fetch(`${gw}/api/tv/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const key = data.client_key || DEFAULT_SAVED_KEY;
          saveLgClientKey(ip, key);
          return { ok: true, clientKey: key, message: "TV emparelhada com sucesso!" };
        }
      }
    } catch (e) {
      console.warn("[SmartTV] Gateway pair request error, falling back...", e);
    }
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (ok: boolean, clientKey: string | undefined, message: string) => {
      if (resolved) return;
      resolved = true;
      resolve({ ok, clientKey, message });
    };

    const timer = setTimeout(() => {
      finish(false, undefined, "Tempo limite excedido aguardando confirmação no controle da TV.");
    }, 45000);

    try {
      const ws = new WebSocket(`ws://${ip}:3000`);

      ws.onopen = () => {
        const payload = {
          type: "register",
          id: "pair_request",
          payload: {
            forcePairing: true,
            pairingType: "PROMPT",
            manifest: {
              manifestVersion: 1,
              appVersion: "1.0",
              permissions: ALL_PERMISSIONS
            }
          }
        };
        ws.send(JSON.stringify(payload));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "response" && msg.payload?.pairingType === "PROMPT") {
            onPromptVisible?.();
          } else if (msg.type === "registered") {
            clearTimeout(timer);
            const key = msg.payload?.["client-key"];
            if (key) {
              saveLgClientKey(ip, key);
            }
            ws.close();
            finish(true, key, "TV emparelhada com sucesso!");
          } else if (msg.type === "error") {
            clearTimeout(timer);
            ws.close();
            finish(false, undefined, msg.error || "A TV recusou o emparelhamento.");
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        finish(false, undefined, "Falha de conexão com a TV.");
      };
    } catch (err: any) {
      clearTimeout(timer);
      finish(false, undefined, err?.message || "Erro ao conectar.");
    }
  });
}

/**
 * Testa conectividade com a TV via WebSocket ou Gateway Bridge
 */
export async function testTvConnection(ip: string, port = 3000): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = performance.now();
  const gw = getSmartTvGatewayUrl();
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // Se estiver em HTTPS ou tiver Gateway ativo, utiliza o Gateway para contornar Mixed Content / PNA
  if (isHttps || gw) {
    try {
      const res = await fetch(`${gw}/api/tv/status?ip=${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        const latencyMs = Math.round(performance.now() - start);
        if (data.ok || data.online) {
          return {
            ok: true,
            latencyMs,
            message: `✓ Conectado com sucesso à TV em ${ip}:${port} via Gateway!`,
          };
        }
      }
    } catch (gwErr) {
      console.warn("[SmartTV] Gateway status check failed, falling back to direct ws...", gwErr);
    }
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = (ok: boolean, msg: string) => {
      if (finished) return;
      finished = true;
      const latencyMs = Math.round(performance.now() - start);
      resolve({ ok, latencyMs, message: msg });
    };

    const timer = setTimeout(() => {
      finish(false, "Tempo limite excedido ao conectar à TV.");
    }, 2500);

    try {
      const wsUrl = `ws://${ip}:${port}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        finish(true, `Conectado com sucesso à TV em ${ip}:${port}!`);
      };

      ws.onerror = () => {
        clearTimeout(timer);
        finish(false, `Não foi possível abrir conexão WebSocket em ${ip}:${port}.`);
      };
    } catch (err: any) {
      clearTimeout(timer);
      finish(false, err?.message || "Erro ao conectar.");
    }
  });
}

/**
 * Envia comando para LG webOS TV (via Gateway Bridge ou WebSocket direto)
 */
export async function sendLgWebOsCommand(
  ip: string,
  uri: string,
  payload: Record<string, any> = {},
  clientKey?: string
): Promise<{ ok: boolean; needPairing?: boolean; message: string }> {
  const key = clientKey || getSavedLgClientKey(ip);
  const gw = getSmartTvGatewayUrl();
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // 1. Envia via Gateway Bridge (necessário em HTTPS / Lovable para contornar Mixed Content e PNA)
  if (isHttps || gw) {
    try {
      const res = await fetch(`${gw}/api/tv/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip,
          uri,
          payload,
          client_key: key,
        }),
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          return { ok: true, message: "Comando executado com sucesso." };
        }
        if (data.reg?.type === "response" && data.reg?.payload?.pairingType === "PROMPT") {
          return {
            ok: false,
            needPairing: true,
            message: "Permissão necessária na TV. Aceite a mensagem no controle da TV.",
          };
        }
        if (data.error && String(data.error).includes("401")) {
          return {
            ok: false,
            needPairing: true,
            message: "Permissão necessária na TV. Ative 'LG Connect Apps' na TV.",
          };
        }
      }
    } catch (e) {
      console.warn("[SmartTV] Gateway proxy failed, attempting direct ws...", e);
    }
  }

  // 2. Fallback direto via WebSocket local
  return new Promise((resolve) => {
    let resolved = false;
    const done = (ok: boolean, needPairing: boolean, message: string) => {
      if (resolved) return;
      resolved = true;
      resolve({ ok, needPairing, message });
    };

    const timer = setTimeout(() => {
      done(false, false, "Timeout aguardando resposta da TV.");
    }, 3500);

    try {
      const ws = new WebSocket(`ws://${ip}:3000`);

      ws.onopen = () => {
        const handshake = {
          type: "register",
          id: "reg_cmd",
          payload: {
            "client-key": key,
            forcePairing: false,
            pairingType: "PROMPT",
            manifest: {
              manifestVersion: 1,
              appVersion: "1.0",
              permissions: ALL_PERMISSIONS
            }
          }
        };
        ws.send(JSON.stringify(handshake));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "registered") {
            if (msg.payload?.["client-key"]) {
              saveLgClientKey(ip, msg.payload["client-key"]);
            }
            // Envia o comando solicitado
            const reqId = `cmd_${Date.now()}`;
            ws.send(JSON.stringify({
              type: "request",
              id: reqId,
              uri,
              payload
            }));
          } else if (msg.type === "error" && String(msg.error).includes("401")) {
            clearTimeout(timer);
            ws.close();
            done(false, true, "Permissão necessária na TV. Ative 'LG Connect Apps' na TV e emparelhe novamente.");
          } else if (msg.type === "response" || msg.type === "registered") {
            clearTimeout(timer);
            setTimeout(() => {
              ws.close();
              done(true, false, "Comando executado com sucesso.");
            }, 200);
          }
        } catch {
          clearTimeout(timer);
          ws.close();
          done(true, false, "Comando transmitido.");
        }
      };

      ws.onerror = (e) => {
        clearTimeout(timer);
        done(false, false, "Erro de rede ao comunicar com a TV.");
      };
    } catch (err: any) {
      clearTimeout(timer);
      done(false, false, err?.message || "Falha na conexão.");
    }
  });
}

/** Comandos pré-configurados para a TV LG */
export const LG_COMMANDS = {
  powerOff: (ip: string) => sendLgWebOsCommand(ip, "ssap://system/turnOff"),
  volumeUp: (ip: string) => sendLgWebOsCommand(ip, "ssap://audio/volumeUp"),
  volumeDown: (ip: string) => sendLgWebOsCommand(ip, "ssap://audio/volumeDown"),
  setVolume: (ip: string, volume: number) => sendLgWebOsCommand(ip, "ssap://audio/setVolume", { volume }),
  setMute: (ip: string, mute: boolean) => sendLgWebOsCommand(ip, "ssap://audio/setMute", { mute }),
  channelUp: (ip: string) => sendLgWebOsCommand(ip, "ssap://tv/channelUp"),
  channelDown: (ip: string) => sendLgWebOsCommand(ip, "ssap://tv/channelDown"),
  play: (ip: string) => sendLgWebOsCommand(ip, "ssap://media.controls/play"),
  pause: (ip: string) => sendLgWebOsCommand(ip, "ssap://media.controls/pause"),
  stop: (ip: string) => sendLgWebOsCommand(ip, "ssap://media.controls/stop"),
  openYoutube: (ip: string) => sendLgWebOsCommand(ip, "ssap://system.launcher/launch", { id: "youtube.leanback.v4" }),
  openNetflix: (ip: string) => sendLgWebOsCommand(ip, "ssap://system.launcher/launch", { id: "netflix" }),
  openLiveTv: (ip: string) => sendLgWebOsCommand(ip, "ssap://system.launcher/launch", { id: "com.webos.app.livetv" }),
  showToast: (ip: string, message: string) => sendLgWebOsCommand(ip, "ssap://system.notifications/createToast", { message }),
};
