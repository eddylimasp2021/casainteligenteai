import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { z } from "zod";
import type { GatewayConfig } from "../config/index.js";
import type { Logger } from "../observability/logger.js";
import type { CommandManager, StoredCommand } from "../commands/command-manager.js";
import type { GatewayEventBus } from "../events/event-bus.js";

const StateMessageSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string().min(1),
  reported: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
});

const AvailabilityMessageSchema = z.object({
  status: z.enum(["online", "offline"]),
  timestamp: z.string().datetime().optional(),
});

const TelemetryMessageSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string().min(1),
  telemetry: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
});

export class MqttTransport {
  private client: MqttClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxPayloadBytes = 64 * 1024; // 64 KB limit

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private commandManager: CommandManager,
    private eventBus: GatewayEventBus
  ) {}

  public async connect(): Promise<void> {
    const lwtTopic = `ci/v1/gateways/${this.config.GATEWAY_ID}/availability`;
    const options: IClientOptions = {
      clientId: `${this.config.MQTT_CLIENT_ID}-${Math.random().toString(16).slice(2, 8)}`,
      username: this.config.MQTT_USERNAME || undefined,
      password: this.config.MQTT_PASSWORD || undefined,
      clean: true,
      reconnectPeriod: this.config.MQTT_RECONNECT_PERIOD_MS,
      connectTimeout: this.config.MQTT_CONNECT_TIMEOUT_MS,
      will: {
        topic: lwtTopic,
        payload: Buffer.from(JSON.stringify({ status: "offline", gatewayId: this.config.GATEWAY_ID, timestamp: new Date().toISOString() })),
        qos: 1,
        retain: true,
      },
    };

    this.logger.info({ url: this.config.MQTT_URL }, "Connecting to MQTT broker...");

    return new Promise((resolve) => {
      this.client = mqtt.connect(this.config.MQTT_URL, options);

      this.client.on("connect", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info("Connected to MQTT broker");

        // Publish gateway online status
        this.client?.publish(
          lwtTopic,
          JSON.stringify({ status: "online", gatewayId: this.config.GATEWAY_ID, timestamp: new Date().toISOString() }),
          { qos: 1, retain: true }
        );

        // Subscribe to standard CI v1 namespaces:
        // ci/v1/+/+/state, ci/v1/+/+/availability, ci/v1/+/+/result, ci/v1/+/+/telemetry
        const subscriptions = [
          "ci/v1/+/+/state",
          "ci/v1/+/+/availability",
          "ci/v1/+/+/result",
          "ci/v1/+/+/telemetry",
        ];

        this.client?.subscribe(subscriptions, { qos: 1 }, (err) => {
          if (err) {
            this.logger.error({ err: err.message }, "Failed to subscribe to CI v1 MQTT topics");
          } else {
            this.logger.info({ subscriptions }, "Subscribed to MQTT topics");
          }
        });

        resolve();
      });

      this.client.on("reconnect", () => {
        this.reconnectAttempts++;
        const jitter = Math.floor(Math.random() * 500);
        this.logger.warn({ attempt: this.reconnectAttempts, jitter }, "Reconnecting to MQTT broker...");
      });

      this.client.on("error", (err) => {
        this.logger.error({ error: err.message }, "MQTT transport error");
      });

      this.client.on("close", () => {
        this.isConnected = false;
        this.logger.warn("MQTT connection closed");
      });

      this.client.on("message", (topic, payloadBuffer) => {
        this.handleIncomingMessage(topic, payloadBuffer);
      });
    });
  }

  public getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private handleIncomingMessage(topic: string, payloadBuffer: Buffer) {
    if (payloadBuffer.length > this.maxPayloadBytes) {
      this.logger.warn({ topic, size: payloadBuffer.length }, "Dropped MQTT message exceeding max payload size");
      return;
    }

    const parts = topic.split("/");
    if (parts.length < 5 || parts[0] !== "ci" || parts[1] !== "v1") {
      return;
    }

    const householdId = parts[2]!;
    const deviceId = parts[3]!;
    const messageType = parts[4]!;

    let raw: unknown;
    try {
      raw = JSON.parse(payloadBuffer.toString("utf8"));
    } catch {
      this.logger.warn({ topic }, "Received malformed JSON on MQTT");
      return;
    }

    switch (messageType) {
      case "state": {
        const parsed = StateMessageSchema.safeParse(raw);
        if (parsed.success) {
          this.eventBus.emitDeviceState({
            householdId,
            deviceId,
            reported: parsed.data.reported,
            timestamp: parsed.data.timestamp,
          });
        } else {
          this.logger.warn({ topic, issues: parsed.error.issues }, "Invalid state message format");
        }
        break;
      }

      case "availability": {
        const parsed = AvailabilityMessageSchema.safeParse(raw);
        if (parsed.success) {
          this.eventBus.emitDeviceAvailability({
            householdId,
            deviceId,
            availability: parsed.data.status,
            timestamp: parsed.data.timestamp ?? new Date().toISOString(),
          });
        }
        break;
      }

      case "result": {
        this.commandManager.handleDeviceResult(raw);
        break;
      }

      case "telemetry": {
        const parsed = TelemetryMessageSchema.safeParse(raw);
        if (parsed.success) {
          this.eventBus.emitDeviceTelemetry({
            householdId,
            deviceId,
            telemetry: parsed.data.telemetry,
            timestamp: parsed.data.timestamp,
          });
        }
        break;
      }

      default:
        this.logger.debug({ topic }, "Unhandled MQTT topic type");
    }
  }

  public async publishCommand(command: StoredCommand): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("MQTT transport is not connected to broker");
    }

    if (this.commandManager.isExpired(command)) {
      this.commandManager.transition(command.commandId, "EXPIRED", {
        errorCode: "CMD_EXPIRED",
        errorMessage: "Command expired before transmission",
      });
      throw new Error(`Command ${command.commandId} has expired`);
    }

    const topic = `ci/v1/${command.householdId}/${command.deviceId}/command`;
    const payload = JSON.stringify({
      schemaVersion: 1,
      commandId: command.commandId,
      deviceId: command.deviceId,
      action: command.action,
      parameters: command.parameters,
      issuedAt: command.issuedAt,
      expiresAt: command.expiresAt,
    });

    return new Promise((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (err) {
          this.logger.error({ commandId: command.commandId, err: err.message }, "Failed to publish MQTT command");
          this.commandManager.transition(command.commandId, "FAILED", {
            errorCode: "MQTT_PUB_ERR",
            errorMessage: err.message,
          });
          reject(err);
        } else {
          this.commandManager.transition(command.commandId, "SENT");
          resolve();
        }
      });
    });
  }

  public async close(): Promise<void> {
    if (this.client) {
      const lwtTopic = `ci/v1/gateways/${this.config.GATEWAY_ID}/availability`;
      await new Promise<void>((resolve) => {
        this.client?.publish(
          lwtTopic,
          JSON.stringify({ status: "offline", gatewayId: this.config.GATEWAY_ID, timestamp: new Date().toISOString() }),
          { qos: 1, retain: true },
          () => resolve()
        );
      });
      await new Promise<void>((resolve) => this.client?.end(false, {}, () => resolve()));
      this.client = null;
      this.isConnected = false;
      this.logger.info("MQTT transport disconnected gracefully");
    }
  }
}
