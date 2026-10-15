# Firmware ESP32 — Casa Inteligente I.A. (Protocolo CI v1)

Este diretório contém o firmware oficial de referência em C++ (Arduino Framework / ESP-IDF) para microcontroladores ESP32 na plataforma **Casa Inteligente I.A. — HomePulse**.

---

## 1. Características Técnicas do Firmware

- **Protocolo de Comunicação**: MQTT 3.1.1 sobre TCP (porta 1883) ou TLS (porta 8883).
- **Segurança e Isolamento**:
  - Autenticação com credenciais dedicadas (`MQTT_USER` / `MQTT_PASS`).
  - Respeito estrito às ACLs: apenas assina tópicos de comando específicos da sua residência (`ci/v1/{householdId}/{deviceId}/command`).
  - LWT (*Last Will and Testament*) em `ci/v1/{householdId}/{deviceId}/availability` informando `offline` automaticamente se o ESP32 perder energia ou sinal Wi-Fi.
- **Confirmação Física de Comando (Zero-Mock)**:
  - Ao receber um comando JSON com UUID e expiração (`expiresAt`), o microcontrolador aciona o GPIO do relé.
  - Publica confirmação imediata no tópico `result` com `status: "SUCCEEDED"` e tempo real de execução em milissegundos (`executionDurationMs`).
  - Publica novo estado físico no tópico `state` com retenção (*retained*).
- **Telemetria Periódica**:
  - Publica RSSI do sinal Wi-Fi, memória Heap livre em bytes, temperatura do chip e uptime.

---

## 2. Pinagem de Hardware (Wiring)

| Componente | Pino no ESP32 | Descrição |
| :--- | :---: | :--- |
| **Relé / LED** | **GPIO 2** | Saída digital para acionamento do relé (ou LED onboard da placa DevKit). |
| **GND** | **GND** | Referência comum da placa e do módulo relé. |
| **VCC** | **VIN / 5V** | Alimentação do módulo relé (5V) ou 3.3V dependendo do modelo. |

> [!TIP]
> Caso utilize um módulo relé de lógica invertida (ativo em nível lógico LOW), configure `#define RELAY_ACTIVE_HIGH false` no arquivo `config.h`.

---

## 3. Como Gravar o Firmware no ESP32

### Via Arduino IDE:
1. Instale o pacote de placas ESP32 pela URL de placas adicionais:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. No **Gerenciador de Bibliotecas**, instale:
   - `PubSubClient` (por Nick O'Leary)
   - `ArduinoJson` (versão 6 ou 7 por Benoit Blanchon)
3. No diretório `firmware/esp32-smart-switch`:
   - Copie `config.h.example` para `config.h`.
   - Preencha `WIFI_SSID`, `WIFI_PASSWORD` e o `MQTT_HOST` (IP do computador que está rodando o IoT Gateway).
4. Selecione a placa (ex: **DOIT ESP32 DEVKIT V1**) e a porta COM.
5. Clique em **Upload**.

---

## 4. Teste em Tempo Real Sem Placa Física (Simulador de Hardware)

Se você estiver em um computador Windows e ainda não conectou o ESP32 na porta USB, pode testar o ciclo de vida completo do dispositivo usando o simulador Node.js embutido:

```bash
cd iot-gateway
npm run simulate:esp32
```

O simulador se conectará ao broker MQTT local, responderá a comandos de liga/desliga com confirmação física real em milissegundos e enviará telemetria a cada 30 segundos!
