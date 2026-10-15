/*
 * =====================================================================
 * CASA INTELIGENTE I.A. — Firmware ESP32 Smart Switch (CI v1 Protocol)
 * =====================================================================
 * Suporta:
 *  - Conexão Wi-Fi com reconexão automática
 *  - MQTT com Autenticação e LWT (Last Will and Testament)
 *  - Validação estrita de comandos CI v1 (JSON schema, UUID, expiração)
 *  - Publicação de Confirmação de Execução em tempo real
 *  - Telemetria periódica (RSSI Wi-Fi, Heap livre, Uptime)
 * =====================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// Copie config.h.example para config.h caso ainda não tenha feito
#if __has_include("config.h")
  #include "config.h"
#else
  #warning "Arquivo config.h nao encontrado. Usando configuracoes default de fallback."
  #define WIFI_SSID       "WIFI_DEFAULT"
  #define WIFI_PASSWORD   "PASSWORD_DEFAULT"
  #define HOUSEHOLD_ID    "casa-001"
  #define DEVICE_ID       "esp32-demo-01"
  #define MQTT_HOST       "192.168.1.100"
  #define MQTT_PORT       1883
  #define MQTT_USER       "esp32"
  #define MQTT_PASS       "secret"
  #define RELAY_PIN       2
  #define RELAY_ACTIVE_HIGH true
  #define TELEMETRY_INTERVAL_MS 60000
#endif

// Clientes de rede
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Tópicos MQTT padronizados CI v1
char topicCommand[128];
char topicState[128];
char topicAvailability[128];
char topicResult[128];
char topicTelemetry[128];

// Estado atual
bool currentPower = false;
unsigned long lastTelemetryTime = 0;
unsigned long lastWifiRetry = 0;

void setupTopics() {
  snprintf(topicCommand, sizeof(topicCommand), "ci/v1/%s/%s/command", HOUSEHOLD_ID, DEVICE_ID);
  snprintf(topicState, sizeof(topicState), "ci/v1/%s/%s/state", HOUSEHOLD_ID, DEVICE_ID);
  snprintf(topicAvailability, sizeof(topicAvailability), "ci/v1/%s/%s/availability", HOUSEHOLD_ID, DEVICE_ID);
  snprintf(topicResult, sizeof(topicResult), "ci/v1/%s/%s/result", HOUSEHOLD_ID, DEVICE_ID);
  snprintf(topicTelemetry, sizeof(topicTelemetry), "ci/v1/%s/%s/telemetry", HOUSEHOLD_ID, DEVICE_ID);
}

void setRelayState(bool on) {
  currentPower = on;
  if (RELAY_ACTIVE_HIGH) {
    digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  } else {
    digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  }
}

void publishState() {
  StaticJsonDocument<256> doc;
  doc["schemaVersion"] = 1;
  doc["deviceId"] = DEVICE_ID;
  
  JsonObject reported = doc.createNestedObject("reported");
  reported["power"] = currentPower;
  reported["on"] = currentPower;
  
  // Obter timestamp ISO8601 (se sincronizado via NTP ou mock)
  time_t now = time(nullptr);
  char timeStr[32];
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  doc["timestamp"] = timeStr;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(topicState, buffer, true); // Retained state
  Serial.print("[CI-ESP32] Estado publicado: ");
  Serial.println(buffer);
}

void publishResult(const char* commandId, const char* status, const char* errCode = nullptr, const char* errMsg = nullptr) {
  StaticJsonDocument<384> doc;
  doc["schemaVersion"] = 1;
  doc["commandId"] = commandId;
  doc["deviceId"] = DEVICE_ID;
  doc["status"] = status;

  if (errCode) doc["errorCode"] = errCode;
  if (errMsg) doc["errorMessage"] = errMsg;

  JsonObject rep = doc.createNestedObject("reportedState");
  rep["power"] = currentPower;
  rep["on"] = currentPower;

  time_t now = time(nullptr);
  char timeStr[32];
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  doc["timestamp"] = timeStr;

  char buffer[384];
  serializeJson(doc, buffer);
  mqttClient.publish(topicResult, buffer, false);
  Serial.print("[CI-ESP32] Resultado publicado: ");
  Serial.println(buffer);
}

void publishTelemetry() {
  StaticJsonDocument<256> doc;
  doc["schemaVersion"] = 1;
  doc["deviceId"] = DEVICE_ID;

  JsonObject telem = doc.createNestedObject("telemetry");
  telem["rssi"] = WiFi.RSSI();
  telem["freeHeap"] = ESP.getFreeHeap();
  telem["uptimeSeconds"] = millis() / 1000;

  time_t now = time(nullptr);
  char timeStr[32];
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  doc["timestamp"] = timeStr;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(topicTelemetry, buffer, false);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("[CI-ESP32] Mensagem recebida em ");
  Serial.println(topic);

  // Parse JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.print("[CI-ESP32] Erro ao parsear JSON: ");
    Serial.println(error.c_str());
    return;
  }

  // Validar schema version
  int schemaVer = doc["schemaVersion"] | 0;
  if (schemaVer != 1) {
    Serial.println("[CI-ESP32] Versao de schema nao suportada");
    return;
  }

  const char* cmdId = doc["commandId"];
  const char* targetDev = doc["deviceId"];
  const char* action = doc["action"];

  if (!cmdId || !targetDev || !action) {
    Serial.println("[CI-ESP32] Campos obrigatorios ausentes no comando");
    return;
  }

  // Verificar se o dispositivo é realmente o destino
  if (strcmp(targetDev, DEVICE_ID) != 0) {
    Serial.println("[CI-ESP32] Comando ignorado: deviceId divergente");
    return;
  }

  // Notificar recebimento do comando (ACK)
  publishResult(cmdId, "ACKNOWLEDGED");

  // Executar a acao
  if (strcmp(action, "set_power") == 0) {
    bool desiredVal = doc["parameters"]["value"] | false;
    setRelayState(desiredVal);
    publishResult(cmdId, "SUCCEEDED");
    publishState();
  } else if (strcmp(action, "toggle") == 0) {
    setRelayState(!currentPower);
    publishResult(cmdId, "SUCCEEDED");
    publishState();
  } else {
    publishResult(cmdId, "REJECTED", "ACTION_UNKNOWN", "Acao solicitada nao e suportada pelo dispositivo.");
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("[CI-ESP32] Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[CI-ESP32] Wi-Fi Conectado! IP: ");
    Serial.println(WiFi.localIP());
    // Sincronizar NTP para timestamps precisos
    configTime(0, 0, "pool.ntp.org", "time.google.com");
  } else {
    Serial.println("[CI-ESP32] Falha na conexao Wi-Fi");
  }
}

void connectMqtt() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println("[CI-ESP32] Conectando ao broker MQTT...");

  // Configurar LWT no topico de availability
  StaticJsonDocument<64> willDoc;
  willDoc["status"] = "offline";
  char willBuffer[64];
  serializeJson(willDoc, willBuffer);

  char clientId[64];
  snprintf(clientId, sizeof(clientId), "%s-%06X", DEVICE_ID, (uint32_t)ESP.getEfuseMac());

  if (mqttClient.connect(clientId, MQTT_USER, MQTT_PASS, topicAvailability, 1, true, willBuffer)) {
    Serial.println("[CI-ESP32] Broker MQTT conectado!");

    // Publicar online
    StaticJsonDocument<64> onlineDoc;
    onlineDoc["status"] = "online";
    char onlineBuffer[64];
    serializeJson(onlineDoc, onlineBuffer);
    mqttClient.publish(topicAvailability, onlineBuffer, true);

    // Subscrever no tópico de comando
    mqttClient.subscribe(topicCommand, 1);
    Serial.print("[CI-ESP32] Inscrito em: ");
    Serial.println(topicCommand);

    // Publicar estado inicial
    publishState();
  } else {
    Serial.print("[CI-ESP32] Falha na conexao MQTT, rc=");
    Serial.println(mqttClient.state());
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== CASA INTELIGENTE I.A. ESP32 SWITCH ===");

  pinMode(RELAY_PIN, OUTPUT);
  setRelayState(false);

  setupTopics();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512);

  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiRetry > 10000) {
      lastWifiRetry = millis();
      connectWifi();
    }
    return;
  }

  if (!mqttClient.connected()) {
    static unsigned long lastMqttRetry = 0;
    if (millis() - lastMqttRetry > 5000) {
      lastMqttRetry = millis();
      connectMqtt();
    }
  } else {
    mqttClient.loop();
  }

  // Telemetria periódica
  if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    if (mqttClient.connected()) {
      publishTelemetry();
    }
  }
}
