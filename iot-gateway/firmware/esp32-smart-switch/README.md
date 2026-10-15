# Firmware ESP32 — Smart Switch / Relé Inteligente (Protocolo CI v1)

Este firmware implementa um nó IoT oficial para a plataforma **Casa Inteligente I.A.** utilizando o microcontrolador ESP32.

---

## 1. Recursos Implementados

- **Protocolo CI v1**: Comunicação bidirecional via MQTT seguindo os padrões de tópicos e schemas do sistema.
- **Last Will and Testament (LWT)**: O broker detecta queda ou perda de sinal do ESP32 e atualiza a disponibilidade para `offline`.
- **Confirmação Real de Execução**: Ao receber um comando, responde primeiro com `ACKNOWLEDGED`, comuta o relé e emite `SUCCEEDED` acompanhado do novo estado reportado.
- **Telemetria de Conectividade**: Envia periodicamente intensidade do sinal Wi-Fi (RSSI), memória livre (Heap) e tempo de atividade (Uptime).
- **Segurança**: Credenciais isoladas no arquivo local `config.h`, protegido de inclusão em commits do Git.

---

## 2. Requisitos de Hardware

- Módulo **ESP32 DevKit v1** (ESP-WROOM-32).
- Módulo Relé 5V com acoplador óptico (opcional; por padrão utiliza o LED integrado no pino **GPIO 2**).
- Fonte de alimentação 5V / 1A com cabo micro-USB de boa qualidade.

> [!WARNING]
> **AVISO DE SEGURANÇA ELÉTRICA**:
> Para prototipagem e testes iniciais, utilize apenas o LED integrado no pino 2 ou lâmpadas/cargas de baixa tensão (5V/12V).
> A conexão a redes elétricas residenciais de 110V/220V exige módulos relé devidamente isolados, fusíveis de proteção, aterramento e execução por profissional qualificado.

---

## 3. Configuração do Ambiente de Compilação

### Opção A: Arduino IDE
1. Instale a placa ESP32 pelo Gerenciador de Placas (`https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`).
2. Instale as bibliotecas via Gerenciador de Bibliotecas:
   - **PubSubClient** (por Nick O'Leary)
   - **ArduinoJson** (por Benoît Blanchon, versão 6 ou 7)
3. Duplique o arquivo `config.h.example` e renomeie-o para `config.h`:
   ```bash
   cp config.h.example config.h
   ```
4. Edite `config.h` com seu SSID, senha de Wi-Fi e endereço IP do Broker Mosquitto.
5. Selecione a placa `DOIT ESP32 DEVKIT V1`, a porta serial correspondente e clique em **Carregar (Upload)**.

---

## 4. Monitoramento Serial

Abra o Monitor Serial configurado para **115200 baud**:

```text
=== CASA INTELIGENTE I.A. ESP32 SWITCH ===
[CI-ESP32] Conectando ao Wi-Fi: MinhaRede
.....
[CI-ESP32] Wi-Fi Conectado! IP: 192.168.1.150
[CI-ESP32] Conectando ao broker MQTT...
[CI-ESP32] Broker MQTT conectado!
[CI-ESP32] Inscrito em: ci/v1/casa-001/ci-esp32-relay-01/command
[CI-ESP32] Estado publicado: {"schemaVersion":1,"deviceId":"ci-esp32-relay-01","reported":{"power":false,"on":false},"timestamp":"2026-10-14T20:00:00Z"}
```

---

## 5. Teste de Acionamento via Linha de Comando (Mosquitto Pub)

Para ligar o relé do ESP32 via terminal:

```bash
mosquitto_pub -h 192.168.1.100 -p 1883 -u esp32_client -P sua_senha_secreta_mqtt \
  -t "ci/v1/casa-001/ci-esp32-relay-01/command" \
  -m '{"schemaVersion":1,"commandId":"11111111-2222-3333-4444-555555555555","deviceId":"ci-esp32-relay-01","action":"set_power","parameters":{"value":true},"issuedAt":"2026-10-14T20:00:00Z","expiresAt":"2026-10-14T20:01:00Z"}'
```

O ESP32 comutará o GPIO 2 imediatamente e publicará a confirmação em `ci/v1/casa-001/ci-esp32-relay-01/result`.
