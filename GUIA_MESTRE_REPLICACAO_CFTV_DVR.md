# 📦 Módulo Mestre de CFTV DVR/NVR Profissional — Guia de Replicação & Portabilidade

Este documento contém a arquitetura completa, código-fonte essencial, dependências e o passo a passo exato para você **copiar, colar e rodar este módulo de CFTV/DVR em qualquer outro projeto seu** (React, Vite, Next.js, Electron ou aplicação Python).

---

## 🏛️ 1. Arquitetura do Sistema (Como Tudo se Conecta)

```mermaid
flowchart TD
    subgraph LAN["Rede Local / Câmeras Físicas"]
        CAM1["Câmera 1 (Ex: Yoosee .149 - /onvif2)"]
        CAM2["Câmera 2 (Ex: Garagem .139 - /onvif1)"]
        CAM3["Câmera 3 (Ex: IP Externa .198 - /onvif1)"]
        CAM4["Câmera 4 (Ex: Tripla 3-em-1 .240)"]
    end

    subgraph BackendLocal["Gateway Local no PC das Câmeras"]
        GO2RTC["go2rtc.exe (Porta 1984)<br>Multiplexador RTSP & WebRTC (<100ms)"]
        CLOUDFLARE["cloudflared.exe<br>Túnel HTTPS Grátis (WHEP Seguro)"]
        RECORDER["recorder.py + ffmpeg.exe<br>Gravação Contínua em Disco (MP4/AAC)"]
    end

    subgraph Frontend["Frontend Web (Vercel / Lovable / Local)"]
        PLAYER["RealCameraPlayer (React)<br>WebRTC + Fallback Snapshot JPEG"]
        MOSAICO["Mosaico Dinâmico (1x1, 2x2, 3x2, 3x3)<br>Drag & Drop + Adicionar/Remover Telas"]
        PRO_VIEW["Modo DVR Profissional (Zero Borders, 100vh)"]
    end

    CAM1 & CAM2 & CAM3 & CAM4 -->|RTSP Porta 554| GO2RTC
    GO2RTC -->|RTSP Loopback 8554| RECORDER
    RECORDER -->|Grava MP4 Contínuo| DISK["Disco Rígido (C:, D: ou E:\Gravacoes_CFTV)"]
    GO2RTC -->|Porta 1984| CLOUDFLARE
    CLOUDFLARE -->|WHEP HTTPS Seguro| PLAYER
    PLAYER --> MOSAICO
    MOSAICO --> PRO_VIEW
```

---

## 📂 2. Arquivos Necessários para Copiar para o Novo Projeto

Você só precisa copiar duas pastas do projeto atual para o novo:

### Pasta 1: `iot-gateway/deploy/` (O Motor do Gateway Local)
* `INICIAR_CFTV_1_CLIQUE.bat`: O arquivo que o cliente clica para ligar tudo.
* `iniciar_cftv.py`: Orquestrador Python que sobe o vídeo, túnel e gravador.
* `go2rtc.yaml`: O arquivo de configuração de rotas das câmeras.
* `recorder.py`: O gravador contínuo em disco MP4.
* `bin/go2rtc.exe`: O binário leve do go2rtc (20 MB).
* `bin/cloudflared.exe`: O binário para gerar o link HTTPS seguro.
* `bin/ffmpeg.exe`: O binário estático do FFmpeg para gravação e áudio AAC.

### Pasta 2: Frontend React (`src/`)
* `src/routes/_app/dvr-nvr.tsx` (ou o componente equivalente de página).
* `src/components/dvr-nvr/real-camera-player.tsx` (O player de alta performance WebRTC).
* `src/components/dvr-nvr/camera-manager-dialog.tsx` (Janela para Adicionar/Editar Câmeras).
* `src/types/dvr-nvr.ts` (Tipagens TypeScript).

---

## ⚙️ 3. O Arquivo Mestre de Câmeras (`go2rtc.yaml`)

Este é o arquivo onde você cadastra as câmeras no gateway local:

```yaml
# ==============================================================================
# Configuração go2rtc para Câmeras IP e CFTV
# ==============================================================================

api:
  listen: ":1984"
  origin: "*"

rtsp:
  listen: ":8554"

webrtc:
  listen: ":8555"
  candidates:
    - 127.0.0.1:8555
    - stun:8555
  ice_servers:
    - urls:
        - "stun:stun.l.google.com:19302"
        - "stun:stun1.l.google.com:19302"

streams:
  # Câmera Yoosee (sempre usar onvif2)
  cam_yoosee_149:
    - rtsp://admin:ambar786!@192.168.0.149:554/onvif2

  # Câmera Genérica / ICSee / XMeye (usar onvif1)
  garagem_rua:
    - rtsp://admin:ambar786!@192.168.0.139:554/onvif1

  # Câmera IP Externa H.264
  cam_externa_198:
    - rtsp://admin:ambar786@192.168.0.198:554/onvif1

  # Câmera Tripla 3-em-1 (H.265 Full HD)
  cam_tripla_240:
    - rtsp://admin:ambar786@@192.168.0.240:554/onvif1

  # Transcodificação automática para navegadores que não rodam H.265 direto
  garagem_rua_h264:
    - ffmpeg:rtsp://127.0.0.1:8554/garagem_rua#video=h264#audio=copy
```

---

## 📋 4. Dicionário de Fabricantes (Caminhos RTSP Padrão)

Quando for plugar qualquer câmera no outro projeto, consulte esta tabela:

| Fabricante / App | Porta RTSP | Caminho Stream Principal | Caminho Stream Secundário (Fluido) |
| :--- | :--- | :--- | :--- |
| **Yoosee** | `554` | `/onvif2` | `/onvif1` |
| **ICSee / XMeye / Genéricas** | `554` | `/onvif1` | `/onvif2` |
| **Intelbras** | `554` | `/cam/realmonitor?channel=1&subtype=0` | `/cam/realmonitor?channel=1&subtype=1` |
| **Hikvision** | `554` | `/Streaming/Channels/101` | `/Streaming/Channels/102` |
| **Dahua** | `554` | `/cam/realmonitor?channel=1&subtype=0` | `/cam/realmonitor?channel=1&subtype=1` |
| **TP-Link Tapo** | `554` | `/stream1` | `/stream2` |

> [!IMPORTANT]
> **Atenção aos caracteres especiais nas senhas:** Se a senha tiver `@`, use `@@` ou `%40`. Se tiver `!`, use `%21`.

---

## 🚀 5. Como Iniciar no Novo Projeto

1. **No computador onde as câmeras estão na mesma rede:**
   - Dê 2 cliques em `INICIAR_CFTV_1_CLIQUE.bat`.
   - O script vai gerar automaticamente um link HTTPS seguro na nuvem (ex: `https://seu-tunel.trycloudflare.com`) e copiar para a sua área de transferência.

2. **No Frontend Web (Vercel ou outro domínio):**
   - Acesse a página com o parâmetro: `https://seu-novo-projeto.com/dvr-nvr?gateway=https://seu-tunel.trycloudflare.com`
   - O frontend sincroniza o gateway na nuvem e todas as telas carregam instantaneamente com WebRTC (<100ms)!

3. **Gravações Contínuas em Disco:**
   - O `recorder.py` roda silencioso em segundo plano dividindo as gravações em arquivos `.mp4` de 15 minutos na pasta `D:\Gravacoes_CFTV` com áudio AAC estéreo.
