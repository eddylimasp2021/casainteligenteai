import mqtt, { type MqttClient } from "mqtt";

export interface Esp32SimulatorOptions {
  brokerUrl?: string;
  username?: string;
  password?: string;
  householdId?: string;
  deviceId?: string;
}

export class Esp32Simulator {
  private client: MqttClient | null = null;
  private power = false;
  private telemetryTimer: NodeJS.Timeout | null = null;
  private householdId: string;
  private deviceId: string;
  private brokerUrl: string;
  private username?: string;
  private password?: string;
  private isConnected = false;

  constructor(options: Esp32SimulatorOptions = {}) {
    this.householdId = options.householdId || "00000000-0000-0000-0000-000000000001";
    this.deviceId = options.deviceId || "ci-esp32-relay-01";
    this.brokerUrl = options.brokerUrl || process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
    this.username = options.username || process.env.ESP32_MQTT_USER || "esp32_client";
    this.password = options.password || process.env.ESP32_MQTT_PASSWORD || "esp32-secret-key-2026";
  }

  public async start(): Promise<void> {
    const lwtTopic = `ci/v1/${this.householdId}/${this.deviceId}/availability`;
    const commandTopic = `ci/v1/${this.householdId}/${this.deviceId}/command`;

    console.log(`[ESP32 Simulator] Conectando a ${this.brokerUrl} como ${this.username}...`);

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.brokerUrl, {
        clientId: `esp32-sim-${this.deviceId}-${Math.random().toString(16).slice(2, 6)}`,
        username: this.username,
        password: this.password,
        reconnectPeriod: 2000,
        connectTimeout: 5000,
        will: {
          topic: lwtTopic,
          payload: Buffer.from(JSON.stringify({ status: "offline", timestamp: new Date().toISOString() })),
          qos: 1,
          retain: true,
        },
      });

      this.client.on("connect", () => {
        this.isConnected = true;
        console.log(`[ESP32 Simulator] Conectado com sucesso ao Broker MQTT!`);
        console.log(`[ESP32 Simulator] Dispositivo: ${this.deviceId} | Residência: ${this.householdId}`);

        // 1. Publicar disponibilidade online
        this.client?.publish(
          lwtTopic,
          JSON.stringify({ status: "online", timestamp: new Date().toISOString() }),
          { qos: 1, retain: true }
        );

        // 2. Publicar estado inicial
        this.publishState();

        // 3. Assinar tópico de comandos
        this.client?.subscribe(commandTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[ESP32 Simulator] Erro ao assinar ${commandTopic}:`, err.message);
          } else {
            console.log(`[ESP32 Simulator] Pronto para receber comandos em: ${commandTopic}`);
          }
        });

        // 4. Iniciar telemetria a cada 30s
        this.telemetryTimer = setInterval(() => this.publishTelemetry(), 30000);

        resolve();
      });

      this.client.on("error", (err) => {
        console.error(`[ESP32 Simulator] Erro MQTT:`, err.message);
        if (!this.isConnected) reject(err);
      });

      this.client.on("message", (topic, payload) => {
        if (topic === commandTopic) {
          this.handleCommand(payload.toString());
        }
      });
    });
  }

  private handleCommand(rawPayload: string): void {
    const resultTopic = `ci/v1/${this.householdId}/${this.deviceId}/result`;

    try {
      const data = JSON.parse(rawPayload);
      const commandId = data.commandId;
      const action = data.action;

      console.log(`[ESP32 Simulator] -> Comando recebido: [${action}] (ID: ${commandId})`);

      // Atuação no Relé Virtual
      if (action === "turn_on" || action === "on") {
        this.power = true;
      } else if (action === "turn_off" || action === "off") {
        this.power = false;
      } else if (action === "toggle") {
        this.power = !this.power;
      } else if (action === "set_power") {
        this.power = Boolean(data.parameters?.value);
      }

      console.log(`[ESP32 Simulator] <- Relé acionado! Novo estado físico: ${this.power ? "LIGADO (ON)" : "DESLIGADO (OFF)"}`);

      // Publicar Confirmação de Execução (ACK)
      const ack = {
        schemaVersion: 1,
        commandId,
        deviceId: this.deviceId,
        status: "SUCCEEDED",
        executionDurationMs: Math.floor(Math.random() * 15) + 5,
        reportedState: { power: this.power ? "on" : "off", relay: this.power },
        timestamp: new Date().toISOString(),
      };
      this.client?.publish(resultTopic, JSON.stringify(ack), { qos: 1 });

      // Publicar Estado Atualizado
      this.publishState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ESP32 Simulator] Erro ao processar comando:", msg);
    }
  }

  private publishState(): void {
    const stateTopic = `ci/v1/${this.householdId}/${this.deviceId}/state`;
    const statePayload = {
      schemaVersion: 1,
      deviceId: this.deviceId,
      reported: {
        power: this.power ? "on" : "off",
        relay: this.power,
        on: this.power,
      },
      timestamp: new Date().toISOString(),
    };
    this.client?.publish(stateTopic, JSON.stringify(statePayload), { qos: 1, retain: true });
    console.log(`[ESP32 Simulator] Estado físico confirmado publicado em: ${stateTopic}`);
  }

  private publishTelemetry(): void {
    const telemetryTopic = `ci/v1/${this.householdId}/${this.deviceId}/telemetry`;
    const telemetryPayload = {
      schemaVersion: 1,
      deviceId: this.deviceId,
      telemetry: {
        wifiRssi: -55 - Math.floor(Math.random() * 10),
        freeHeapBytes: 184500 + Math.floor(Math.random() * 2000),
        chipTemperature: (42.5 + Math.random() * 2).toFixed(1),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      timestamp: new Date().toISOString(),
    };
    this.client?.publish(telemetryTopic, JSON.stringify(telemetryPayload), { qos: 0 });
  }

  public async stop(): Promise<void> {
    if (this.telemetryTimer) clearInterval(this.telemetryTimer);

    if (this.client) {
      const lwtTopic = `ci/v1/${this.householdId}/${this.deviceId}/availability`;
      await new Promise<void>((resolve) => {
        this.client?.publish(
          lwtTopic,
          JSON.stringify({ status: "offline", timestamp: new Date().toISOString() }),
          { qos: 1, retain: true },
          () => resolve()
        );
      });
      await new Promise<void>((resolve) => this.client?.end(false, {}, () => resolve()));
      this.client = null;
      this.isConnected = false;
      console.log("[ESP32 Simulator] Desconectado limpo.");
    }
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith("esp32-node.ts") || process.argv[1]?.endsWith("esp32-node.js")) {
  const sim = new Esp32Simulator();
  sim.start().catch((err) => {
    console.error("Erro fatal ao iniciar simulador ESP32:", err);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log("\nEncerrando simulador ESP32...");
    await sim.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
