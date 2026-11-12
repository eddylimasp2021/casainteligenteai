# 📦 Módulo de CFTV / NVR Profissional - Guia de Portabilidade & Reutilização

Este documento compila a arquitetura, arquivos-chave, dependências e o passo a passo completo para exportar e integrar todo o sistema de **Câmeras CFTV com WebRTC de Baixa Latência, Isolamento Multi-Lentes, Gravação Física Contínua em Disco (MP4) e Modo DVR Profissional** em qualquer outro projeto React/Node/Python.

---

## 🏛️ 1. Visão Geral da Arquitetura (Dual-Engine)

```
┌────────────────────────────────────────────────────────┐
│               FRONTEND (React / WebRTC)                │
│  - RealCameraPlayer (Player WebRTC + Instant JPEG)     │
│  - LiveCameraView (Simulação Procedural / Canvas OSD)  │
│  - Mosaico Dinâmico Adaptável (1x1, 2x2, 3x2, 3x3)     │
│  - Modo DVR Profissional (Zero borders, 100vh)        │
│  - 2-Way Audio (Escuta + Interfone Push-to-Talk)       │
└───────────────────────────┬────────────────────────────┘
                            │ WebSocket / WHEP / REST
                            ▼
┌────────────────────────────────────────────────────────┐
│            GATEWAY LOCAL & MOTOR DE VÍDEO              │
│  1. go2rtc.exe (Porta 1984): WebRTC / RTSP Multiplex   │
│  2. cloudflared.exe: Túnel Seguro HTTPS Instantâneo    │
│  3. recorder.py + ffmpeg.exe: Gravação Física em Disco │
│  4. smart_bridge.py (Porta 1985): Ponte IoT / TV       │
└───────────────────────────┬────────────────────────────┘
                            │ RTSP Local
                            ▼
┌────────────────────────────────────────────────────────┐
│                 CÂMERAS FÍSICAS NA LAN                 │
│  - 192.168.0.139 (Garagem Rua - H.265 / ONVIF)         │
│  - 192.168.0.198 (Câmera Externa - H.264 / ONVIF)      │
│  - 192.168.0.240 (Câmera Tripla 3-em-1 - Multi-Lentes) │
└────────────────────────────────────────────────────────┘
```

---

## 📁 2. Inventário de Arquivos do Módulo

Para levar para o seu novo projeto, copie os seguintes arquivos e pastas:

### A. Backend & Gateway Local (`iot-gateway/deploy/`)
| Arquivo | Função |
| :--- | :--- |
| `INICIAR_CFTV_1_CLIQUE.bat` | Inicializador mestre para o usuário final com 2 cliques. |
| `iniciar_cftv.py` | Orquestrador Python: sobe `go2rtc`, `recorder.py`, `smart_bridge.py` e extrai a URL HTTPS do túnel Cloudflare para a área de transferência. |
| `go2rtc.yaml` | Mapeamento RTSP das câmeras físicas (`cam_240`, `cam_198`, `garagem_rua`) com transcodificação inteligente H.264. |
| `recorder.py` | Microserviço que roda com `ffmpeg.exe` gravando blocos contínuos de vídeo em pastas locais (`C:\Gravacoes_CFTV`, `D:\`, `E:\`). |
| `smart_bridge.py` | Ponte HTTP/WebSocket local (porta 1985) para controle de Smart TVs LG/Samsung e Wake-on-LAN sem bloqueio de navegador. |
| `bin/go2rtc.exe` | Binário compilado do go2rtc (servidor WebRTC ultra-rápido). |
| `bin/cloudflared.exe` | Binário para criar túnel HTTPS zero-trust gratuito. |
| `bin/ffmpeg.exe` | Binário estático do FFmpeg para gravação e transcodificação. |

### B. Frontend React / TypeScript (`src/`)
| Arquivo | Função |
| :--- | :--- |
| `src/routes/_app/dvr-nvr.tsx` | Página completa da Central DVR/NVR: mosaico, arrastar e soltar, adicionar/remover telas, seletor de discos e **Modo DVR Profissional**. |
| `src/components/dvr-nvr/real-camera-player.tsx` | Player WebRTC de altíssima performance: conecta no go2rtc, faz fallback instantâneo para Snapshot JPEG, controla 2-way audio (interfone) e isola lentes. |
| `src/components/dvr-nvr/live-camera-view.tsx` | Player com renderizador procedural em HTML5 Canvas para quando as câmeras estiverem offline ou em demonstração. |
| `src/components/dvr-nvr/storage-settings-dialog.tsx` | Modal de gerenciamento de armazenamento (seleção de discos C:, D:, E: com 1 clique). |
| `src/components/dvr-nvr/camera-manager-dialog.tsx` | Modal para adicionar/editar câmeras IP (RTSP, portas ONVIF, usuário e senha). |
| `src/components/dvr-nvr/multi-lens-config-dialog.tsx` | Assistente de calibração para câmeras triplas e duplas. |
| `src/types/dvr-nvr.ts` | Tipos TypeScript completos (`IpCamera`, `StorageDisk`, `AiSecurityEvent`, etc.). |

---

## ⚡ 3. Núcleo das Principais Inovações (Snippets Prontos)

### 1. Conexão WebRTC Fluida com go2rtc (`real-camera-player.tsx`)
```typescript
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

pc.ontrack = (event) => {
  if (videoRef.current && event.streams[0]) {
    videoRef.current.srcObject = event.streams[0];
    setStreamState("playing");
  }
};

// Handshake WHEP com go2rtc
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const res = await fetch(`${gatewayBase}/api/webrtc?src=${encodeURIComponent(streamName)}`, {
  method: "POST",
  body: offer.sdp,
  headers: { "Content-Type": "application/sdp" },
});
const answerSdp = await res.text();
await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
```

### 2. Algoritmo de Isolamento 16:9 de Câmera Tripla (`getMediaStyle`)
Permite dividir um único fluxo panorâmico vertical (3 lentes juntas) em 3 câmeras separadas e perfeitamente enquadradas em 16:9 sem distorção:
```typescript
const getMediaStyle = (activeLens: number, totalLenses = 3) => {
  if (totalLenses <= 1 || activeLens === 0) {
    return {
      position: "absolute" as const,
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "contain" as const,
    };
  }
  // Desloca o topo para focar na lente selecionada (1=superior, 2=central, 3=inferior)
  const topPercent = -(activeLens - 1) * 100;
  return {
    position: "absolute" as const,
    left: "0%",
    width: "100%",
    height: `${totalLenses * 100}%`,
    top: `${topPercent}%`,
    objectFit: "fill" as const,
    maxWidth: "none",
    maxHeight: "none",
  };
};
```

### 3. Modo DVR Profissional (Zero Borders & Full Height)
Para preencher monitores dedicados ou TVs de segurança sem barras pretas:
```tsx
<div
  className={
    isProfessionalView
      ? "grid grid-cols-3 grid-rows-2 w-full h-[calc(100vh-20px)] gap-1 p-1"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
  }
>
  {/* Cada slot com height 100% */}
  <div className={`relative w-full ${isProfessionalView ? "h-full rounded-md" : "rounded-2xl"}`}>
    <RealCameraPlayer camera={camera} gatewayUrl={gatewayUrl} />
  </div>
</div>
```

---

## 🚀 4. Como Subir no Seu Outro Projeto

1. **No seu novo projeto React:**
   - Instale as dependências: `npm i lucide-react sonner clsx tailwind-merge`
   - Copie a pasta `src/components/dvr-nvr/`, `src/types/dvr-nvr.ts` e a rota `dvr-nvr.tsx`.

2. **Na máquina onde as câmeras estão conectadas:**
   - Copie a pasta `iot-gateway/deploy/`.
   - Ajuste os IPs das suas câmeras no arquivo `go2rtc.yaml`.
   - Dê dois cliques em `INICIAR_CFTV_1_CLIQUE.bat`.

Pronto! Seu novo projeto terá exatamente a mesma fluidez instantânea, mosaico adaptável e gravação física em disco!
