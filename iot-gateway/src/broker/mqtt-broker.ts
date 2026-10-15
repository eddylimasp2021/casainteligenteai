import net from "net";
import { Aedes } from "aedes";
import type { Logger } from "../observability/logger.js";

export interface MqttBrokerUser {
  username: string;
  password?: string;
  role: "gateway" | "esp32" | "z2m" | "admin";
}

export interface MqttBrokerOptions {
  port?: number;
  host?: string;
  allowAnonymous?: boolean;
  users?: MqttBrokerUser[];
}

export function matchesMqttTopic(pattern: string, topic: string): boolean {
  if (pattern === "#") return true;
  if (pattern === topic) return true;

  const patternParts = pattern.split("/");
  const topicParts = topic.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];

    if (p === "#") {
      return true; // '#' matches everything that follows
    }

    if (i >= topicParts.length) {
      return false; // topic is shorter than pattern
    }

    if (p !== "+" && p !== topicParts[i]) {
      return false;
    }
  }

  // All parts matched; ensure topic has no remaining parts if pattern didn't end with '#'
  return patternParts.length === topicParts.length;
}

export class CasaMqttBroker {
  private aedes: any = null;
  private server: net.Server | null = null;
  private users: Map<string, MqttBrokerUser> = new Map();
  private isRunning = false;
  private clientCount = 0;

  constructor(
    private options: MqttBrokerOptions,
    private logger?: Logger
  ) {
    const defaultUsers: MqttBrokerUser[] = [
      {
        username: process.env.MQTT_USERNAME || "casa-gateway-user",
        password: process.env.MQTT_PASSWORD || "casa-gateway-pass-secure",
        role: "gateway",
      },
      {
        username: process.env.ESP32_MQTT_USER || "esp32_client",
        password: process.env.ESP32_MQTT_PASSWORD || "esp32-secret-key-2026",
        role: "esp32",
      },
      {
        username: process.env.Z2M_MQTT_USER || "zigbee2mqtt_user",
        password: process.env.Z2M_MQTT_PASSWORD || "z2m-secret-key-2026",
        role: "z2m",
      },
    ];

    const usersToRegister = options.users && options.users.length > 0 ? options.users : defaultUsers;
    for (const u of usersToRegister) {
      this.users.set(u.username, u);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    const port = this.options.port ?? 1883;
    const host = this.options.host ?? "0.0.0.0";

    this.aedes = await Aedes.createBroker();

    // 1. Authenticate hook
    this.aedes.authenticate = (
      client: any,
      username: string | undefined,
      password: Buffer | undefined,
      callback: (error: Error | null, success: boolean) => void
    ) => {
      if (this.options.allowAnonymous) {
        client.user = { username: "anonymous", role: "admin" };
        return callback(null, true);
      }

      if (!username) {
        this.logger?.warn({ clientId: client?.id }, "MQTT connection rejected: missing username");
        const err = new Error("Missing username");
        (err as any).returnCode = 4;
        return callback(err, false);
      }

      const configuredUser = this.users.get(username);
      if (!configuredUser) {
        this.logger?.warn({ clientId: client?.id, username }, "MQTT connection rejected: unknown user");
        const err = new Error("Bad username");
        (err as any).returnCode = 4;
        return callback(err, false);
      }

      const providedPassword = password ? password.toString("utf8") : "";
      if (configuredUser.password && configuredUser.password !== providedPassword) {
        this.logger?.warn({ clientId: client?.id, username }, "MQTT connection rejected: invalid password");
        const err = new Error("Bad password");
        (err as any).returnCode = 4;
        return callback(err, false);
      }

      client.user = configuredUser;
      this.logger?.info({ clientId: client?.id, username, role: configuredUser.role }, "MQTT client authenticated successfully");
      return callback(null, true);
    };

    // 2. Authorize Publish hook (strict ACL)
    this.aedes.authorizePublish = (
      client: any,
      packet: any,
      callback: (error: Error | null) => void
    ) => {
      // Internal broker packets or anonymous bypass
      if (!client || this.options.allowAnonymous) {
        return callback(null);
      }

      const topic: string = packet.topic;
      const user: MqttBrokerUser = client.user;

      if (!user) {
        return callback(new Error("Unauthenticated client cannot publish"));
      }

      let isAllowed = false;

      if (user.role === "gateway" || user.role === "admin") {
        // Gateway has full access to publish commands, states, and telemetry
        isAllowed = (
          matchesMqttTopic("ci/v1/#", topic) ||
          matchesMqttTopic("zigbee2mqtt/#", topic) ||
          matchesMqttTopic("homeassistant/#", topic)
        );
      } else if (user.role === "esp32") {
        // ESP32 devices can ONLY publish state, availability, result, and telemetry
        // They can NEVER publish to /command (prevents spoofing commands to other devices)
        isAllowed = (
          matchesMqttTopic("ci/v1/+/+/state", topic) ||
          matchesMqttTopic("ci/v1/+/+/availability", topic) ||
          matchesMqttTopic("ci/v1/+/+/result", topic) ||
          matchesMqttTopic("ci/v1/+/+/telemetry", topic)
        );
      } else if (user.role === "z2m") {
        isAllowed = (
          matchesMqttTopic("zigbee2mqtt/#", topic) ||
          matchesMqttTopic("ci/v1/+/+/state", topic)
        );
      }

      if (!isAllowed) {
        this.logger?.warn({ clientId: client.id, username: user.username, topic }, "MQTT publish denied by ACL");
        return callback(new Error(`ACL violation: '${user.username}' is not permitted to publish to '${topic}'`));
      }

      return callback(null);
    };

    // 3. Authorize Subscribe hook (strict ACL)
    this.aedes.authorizeSubscribe = (
      client: any,
      sub: { topic: string; qos: number },
      callback: (error: Error | null, subscription?: any) => void
    ) => {
      if (!client || this.options.allowAnonymous) {
        return callback(null, sub);
      }

      const topic: string = sub.topic;
      const user: MqttBrokerUser = client.user;

      if (!user) {
        return callback(new Error("Unauthenticated client cannot subscribe"), undefined);
      }

      let isAllowed = false;

      if (user.role === "gateway" || user.role === "admin") {
        isAllowed = (
          matchesMqttTopic("ci/v1/#", topic) ||
          matchesMqttTopic("zigbee2mqtt/#", topic) ||
          matchesMqttTopic("homeassistant/#", topic)
        );
      } else if (user.role === "esp32") {
        // ESP32 subscribes to incoming commands for its household/device
        isAllowed = (
          matchesMqttTopic("ci/v1/+/+/command", topic) ||
          matchesMqttTopic("ci/v1/+/+/availability", topic)
        );
      } else if (user.role === "z2m") {
        isAllowed = matchesMqttTopic("zigbee2mqtt/#", topic);
      }

      if (!isAllowed) {
        this.logger?.warn({ clientId: client.id, username: user.username, topic }, "MQTT subscribe denied by ACL");
        return callback(new Error(`ACL violation: '${user.username}' is not permitted to subscribe to '${topic}'`));
      }

      return callback(null, sub);
    };

    // 4. Connection event listeners
    this.aedes.on("client", (client: any) => {
      this.clientCount++;
      this.logger?.info({ clientId: client.id, activeClients: this.clientCount }, "MQTT client connected");
    });

    this.aedes.on("clientDisconnect", (client: any) => {
      this.clientCount = Math.max(0, this.clientCount - 1);
      this.logger?.info({ clientId: client.id, activeClients: this.clientCount }, "MQTT client disconnected");
    });

    // 5. Start TCP Server
    return new Promise((resolve, reject) => {
      this.server = net.createServer(this.aedes.handle);

      this.server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          this.logger?.warn(
            { port, host },
            `Port ${port} is already in use (possibly an existing Mosquitto broker or another gateway instance)`
          );
        } else {
          this.logger?.error({ err }, "MQTT broker TCP server error");
        }
        reject(err);
      });

      this.server.listen(port, host, () => {
        this.isRunning = true;
        this.logger?.info({ port, host }, `Casa Inteligente MQTT Broker running on tcp://${host}:${port}`);
        resolve();
      });
    });
  }

  public getClientCount(): number {
    return this.clientCount;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.aedes) {
            this.aedes.close(() => {
              this.isRunning = false;
              this.logger?.info("Casa Inteligente MQTT Broker stopped cleanly");
              resolve();
            });
          } else {
            this.isRunning = false;
            resolve();
          }
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }
}
