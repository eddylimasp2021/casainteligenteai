import WebSocket from "ws";
import type { IAdapter, IntegrationHealth } from "../base-adapter.js";
import type { UnifiedDevice, DeviceCapability } from "../../devices/unified-model.js";
import type { StoredCommand } from "../../commands/command-manager.js";
import type { GatewayConfig } from "../../config/index.js";
import type { Logger } from "../../observability/logger.js";
import type { GatewayEventBus } from "../../events/event-bus.js";

// Whitelist of allowed HA domains and services
const ALLOWED_SERVICES: Record<string, string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off", "toggle"],
  cover: ["open_cover", "close_cover", "stop_cover", "set_cover_position"],
  climate: ["set_temperature", "set_hvac_mode"],
  lock: ["lock", "unlock"],
};

export class HomeAssistantAdapter implements IAdapter {
  public readonly type = "home_assistant";
  public readonly name = "Home Assistant Adapter";
  private ws: WebSocket | null = null;
  private isConnected = false;
  private messageId = 1;
  private devices = new Map<string, UnifiedDevice>();
  private lastComm?: string;
  private lastError?: string;

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private eventBus: GatewayEventBus
  ) {}

  public async initialize(): Promise<void> {
    if (!this.config.HOME_ASSISTANT_URL || !this.config.HOME_ASSISTANT_TOKEN) {
      this.logger.info("Home Assistant not configured; running in degraded/offline mode.");
      this.lastError = "URL ou token do Home Assistant não configurados.";
      return;
    }

    try {
      await this.fetchInitialEntities();
      this.connectWebSocket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.logger.warn({ err: msg }, "Failed to connect to Home Assistant on startup; will retry");
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    if (!this.config.HOME_ASSISTANT_URL || !this.config.HOME_ASSISTANT_TOKEN) {
      return { success: false, message: "URL ou token do Home Assistant não fornecidos no ambiente." };
    }

    try {
      const res = await fetch(`${this.config.HOME_ASSISTANT_URL}/api/config`, {
        headers: {
          Authorization: `Bearer ${this.config.HOME_ASSISTANT_TOKEN}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return { success: false, message: `Home Assistant retornou HTTP ${res.status}: ${res.statusText}` };
      }

      const data = (await res.json()) as { version?: string; location_name?: string };
      this.lastComm = new Date().toISOString();
      return {
        success: true,
        message: `Conectado com sucesso ao Home Assistant (${data.location_name ?? "Instância Local"})`,
        version: data.version,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Erro ao conectar: ${msg}` };
    }
  }

  private async fetchInitialEntities(): Promise<void> {
    const res = await fetch(`${this.config.HOME_ASSISTANT_URL}/api/states`, {
      headers: {
        Authorization: `Bearer ${this.config.HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Home Assistant API returned HTTP ${res.status}`);
    }

    const states = (await res.json()) as Array<{
      entity_id: string;
      state: string;
      attributes: Record<string, unknown>;
      last_updated: string;
    }>;

    for (const item of states) {
      const domain = item.entity_id.split(".")[0];
      if (domain && ALLOWED_SERVICES[domain]) {
        const unified = this.mapStateToUnified(item);
        this.devices.set(unified.externalId, unified);
        this.eventBus.emitDeviceDiscovered(unified);
      }
    }
    this.lastComm = new Date().toISOString();
  }

  private connectWebSocket(): void {
    if (!this.config.HOME_ASSISTANT_URL || !this.config.HOME_ASSISTANT_TOKEN) return;

    const wsUrl = this.config.HOME_ASSISTANT_URL.replace(/^http/, "ws") + "/api/websocket";
    this.logger.info({ wsUrl }, "Connecting to Home Assistant WebSocket...");

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      this.logger.info("Home Assistant WebSocket connected");
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleWsMessage(msg);
      } catch {
        // ignore malformed ws messages
      }
    });

    this.ws.on("close", () => {
      this.isConnected = false;
      this.logger.warn("Home Assistant WebSocket closed; will reconnect in 10s");
      setTimeout(() => this.connectWebSocket(), 10000);
    });

    this.ws.on("error", (err) => {
      this.lastError = err.message;
      this.logger.error({ err: err.message }, "Home Assistant WebSocket error");
    });
  }

  private handleWsMessage(msg: { type: string; [key: string]: unknown }): void {
    if (msg.type === "auth_required") {
      this.ws?.send(
        JSON.stringify({
          type: "auth",
          access_token: this.config.HOME_ASSISTANT_TOKEN,
        })
      );
    } else if (msg.type === "auth_ok") {
      this.isConnected = true;
      this.lastComm = new Date().toISOString();
      this.logger.info("Home Assistant WebSocket authentication successful");

      // Subscribe to state_changed events
      this.ws?.send(
        JSON.stringify({
          id: this.messageId++,
          type: "subscribe_events",
          event_type: "state_changed",
        })
      );
    } else if (msg.type === "event") {
      const eventData = msg.event as {
        event_type: string;
        data?: { entity_id: string; new_state?: { entity_id: string; state: string; attributes: Record<string, unknown>; last_updated: string } };
      };
      if (eventData?.data?.new_state) {
        const newState = eventData.data.new_state;
        const domain = newState.entity_id.split(".")[0];
        if (domain && ALLOWED_SERVICES[domain]) {
          const unified = this.mapStateToUnified(newState);
          this.devices.set(unified.externalId, unified);
          this.lastComm = new Date().toISOString();
          this.eventBus.emitDeviceState({
            householdId: "ha-local",
            deviceId: unified.externalId,
            reported: unified.reportedState,
            timestamp: unified.lastSeenAt ?? new Date().toISOString(),
          });
        }
      }
    }
  }

  private mapStateToUnified(item: { entity_id: string; state: string; attributes: Record<string, unknown>; last_updated: string }): UnifiedDevice {
    const domain = item.entity_id.split(".")[0]!;
    const name = (item.attributes.friendly_name as string) || item.entity_id;
    const isOnline = item.state !== "unavailable" && item.state !== "unknown";

    const capabilities: DeviceCapability[] = [];
    if (domain === "light") {
      capabilities.push({ id: "power", type: "power", readable: true, writable: true });
      if (item.attributes.brightness !== undefined) {
        capabilities.push({ id: "brightness", type: "brightness", readable: true, writable: true });
      }
      if (item.attributes.rgb_color !== undefined) {
        capabilities.push({ id: "color", type: "color", readable: true, writable: true });
      }
    } else if (domain === "switch") {
      capabilities.push({ id: "power", type: "power", readable: true, writable: true });
    } else if (domain === "climate") {
      capabilities.push({ id: "temperature", type: "temperature", readable: true, writable: true, unit: "°C" });
    } else if (domain === "lock") {
      capabilities.push({ id: "lock", type: "lock", readable: true, writable: true });
    }

    return {
      id: item.entity_id,
      householdId: "ha-local",
      name,
      integration: "home_assistant",
      externalId: item.entity_id,
      availability: isOnline ? "online" : "offline",
      capabilities,
      desiredState: {},
      reportedState: {
        state: item.state,
        on: item.state === "on" || item.state === "open" || item.state === "unlocked",
        ...item.attributes,
      },
      lastSeenAt: item.last_updated,
    };
  }

  public getStatus(): IntegrationHealth {
    const isConfigured = Boolean(this.config.HOME_ASSISTANT_URL && this.config.HOME_ASSISTANT_TOKEN);
    return {
      name: this.name,
      type: this.type,
      status: !isConfigured ? "disconnected" : this.isConnected ? "connected" : "degraded",
      lastCommunication: this.lastComm,
      deviceCount: this.devices.size,
      errorMessage: this.lastError,
    };
  }

  public async waitForConnected(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (!this.isConnected && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 20));
    }
    return this.isConnected;
  }

  public getDiscoveredDevices(): UnifiedDevice[] {
    return Array.from(this.devices.values());
  }

  public async executeCommand(command: StoredCommand, device: UnifiedDevice): Promise<void> {
    if (!this.config.HOME_ASSISTANT_URL || !this.config.HOME_ASSISTANT_TOKEN) {
      throw new Error("Home Assistant is not configured on this gateway");
    }

    const domain = device.externalId.split(".")[0]!;
    let service = command.action;

    // Map common actions to HA domain services
    if (command.action === "set_power") {
      service = command.parameters.value ? "turn_on" : "turn_off";
    } else if (command.action === "lock") {
      service = "lock";
    } else if (command.action === "unlock") {
      service = "unlock";
    }

    const allowed = ALLOWED_SERVICES[domain];
    if (!allowed || !allowed.includes(service)) {
      throw new Error(`Unauthorized or unsupported Home Assistant service: ${domain}.${service}`);
    }

    const url = `${this.config.HOME_ASSISTANT_URL}/api/services/${domain}/${service}`;
    const payload: Record<string, unknown> = {
      entity_id: device.externalId,
    };

    if (command.parameters.brightness !== undefined) {
      payload.brightness = command.parameters.brightness;
    }
    if (command.parameters.temperature !== undefined) {
      payload.temperature = command.parameters.temperature;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Home Assistant service call failed with HTTP ${res.status}`);
    }

    this.lastComm = new Date().toISOString();
  }

  public async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
