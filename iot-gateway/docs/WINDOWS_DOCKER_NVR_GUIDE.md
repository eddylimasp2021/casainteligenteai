# GUIA OFICIAL DE INSTALAÇÃO E OPERAÇÃO DO GATEWAY DE VÍDEO CFTV / NVR
## Casa Inteligente I.A. — HomePulse AI (Docker no Windows)

Este guia documenta a arquitetura de vídeo de ultra baixa latência do **DVR / NVR HomePulse**, utilizando o **go2rtc** em Docker no Windows para conectar câmeras IP RTSP e transmitir vídeo nativo em **WebRTC** e **HLS** para o navegador.

---

## 1. Arquitetura de Transmissão

```
[ Câmera IP / DVR / NVR ] (192.168.0.139:554 RTSP)
           │
           ▼ (RTSP TCP/UDP sobre porta 554 na Rede Local)
[ go2rtc (Docker Desktop no Windows) ]
           │
           ├──> WebRTC (WHEP / DTLS-SRTP, latência < 100ms)
           ├──> MSE (fMP4 WebSocket)
           ├──> HLS (.m3u8 para compatibilidade)
           └──> Snapshots JPEG (/api/frame.jpeg)
           │
           ▼
[ Navegador Web (Lovable / HomePulse AI) ]
```

### Segurança das Credenciais
- As senhas das câmeras RTSP ficam armazenadas **apenas localmente no arquivo `go2rtc.yaml`** do host Windows.
- O frontend no navegador acessa apenas o identificador seguro da câmera (ex.: `src=garagem_rua`).
- Nenhuma senha de câmera trafega em texto aberto no navegador, logs ou histórico de navegação.

---

## 2. Portas e Endpoints Utilizados

| Porta | Protocolo | Função | Acesso Recomendado |
| :---: | :---: | :--- | :--- |
| **1984** | HTTP / WebSocket | API REST do go2rtc, WebSockets, WHEP WebRTC e Snapshots | Rede Local / Docker |
| **8554** | RTSP | Servidor RTSP local para retransmissão e gravadores NVR | Rede Local |
| **8555** | TCP & UDP | Tráfego de Mídia WebRTC (RTP / DTLS-SRTP) | Rede Local |
| **554** | RTSP | Porta nativa da câmera IP física | **NUNCA expor na internet** |

---

## 3. Comandos PowerShell para Gestão do Docker no Windows

Abra o **PowerShell** no diretório do projeto:

### 3.1. Iniciar o Gateway de Mídia (go2rtc):
```powershell
docker compose -f iot-gateway/deploy/docker-compose.yml up -d go2rtc
```

### 3.2. Verificar Status e Saúde do Container:
```powershell
docker ps -f name=ci-go2rtc
```
*(Deve exibir `STATUS: Up ... (healthy)`)*

### 3.3. Consultar Logs em Tempo Real (Sem vazamento de senhas):
```powershell
docker logs -f ci-go2rtc
```

### 3.4. Reiniciar o Gateway:
```powershell
docker compose -f iot-gateway/deploy/docker-compose.yml restart go2rtc
```

### 3.5. Parar o Gateway:
```powershell
docker compose -f iot-gateway/deploy/docker-compose.yml stop go2rtc
```

---

## 4. Cadastrando e Testando Câmeras Dinamicamente

Você pode adicionar novos fluxos de câmeras via comando PowerShell ou adicionando no arquivo `iot-gateway/deploy/go2rtc.yaml`:

### Adicionar Fluxo via API REST (Sem reiniciar o Docker):
```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:1984/api/streams?name=garagem_rua&src=rtsp://admin:ambar786@192.168.0.139:554/onvif1"
```

### Listar Fluxos Ativos:
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:1984/api/streams"
```

### Testar Captura de Frame JPEG Real:
```powershell
Invoke-WebRequest -Uri "http://localhost:1984/api/frame.jpeg?src=garagem_rua" -OutFile "camera_frame.jpg"
```

---

## 5. Requisitos de Navegador e HTTPS (Lovable Cloud)

Como o aplicativo web está hospedado em **HTTPS** (`https://casainteligenteai.lovable.app`) e o gateway de vídeo roda no seu computador local em **HTTP** (`http://localhost:1984`), o Google Chrome e o Microsoft Edge exigem permissão de conteúdo local:

1. Acesse o site no navegador: `https://casainteligenteai.lovable.app/dvr-nvr`.
2. Clique no ícone de configurações / cadeado ao lado da URL na barra de endereços.
3. Clique em **"Configurações do site"** (Site settings).
4. Localize a opção **"Conteúdo não seguro"** (Insecure content) e altere de *Bloquear* para **"Permitir"**.
5. Recarregue a página (`F5`).
6. O streaming WebRTC e HLS funcionará instantaneamente com vídeo fluido e latência de ~60ms!
