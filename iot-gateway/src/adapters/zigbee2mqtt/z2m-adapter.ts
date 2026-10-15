import type { IAdapter, IntegrationHealth } from "../base-adapter.js";
import type { UnifiedDevice, DeviceCapability } from "../../devices/unified-model.js";
import type { StoredCommand } from "../../commands/command-manager.js";
import type { GatewayConfig } from "../../config/index.js";
import type { Logger } from "../../observability/logger.js";
import type { MqttTransport } from "../../mqtt/client.js";
import type { GatewayEventBus } from "../../events/event-bus.js";

export class Zigbee2MqttAdapter implements IAdapter {
  public readonly type = "zigbee2mqtt";
  public readonly name = "Zigbee2MQTT Adapter";
  private devices = new Map<string, UnifiedDevice>();
  private lastComm?: string;
  private bridgeOnline = false;

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private mqttTransport: MqttTransport,
    private eventBus: GatewayEventBus
  ) {}

  public async initialize(): Promise<void> {
    const baseTopic = this.config.ZIGBEE2MQTT_BASE_TOPIC;
    this.logger.info({ baseTopic }, "Initializing Zigbee2MQTT adapter...");

    // Listen to all MQTT messages under zigbee2mqtt/# routed by MqttTransport
    this.eventBus.onZigbeeMessage((evt) => {
      this.handleZigbeeMessage(evt.topic, evt.payload);
    });
  }

  public handleZigbeeMessage(topic: string, payload: unknown): void {
    const baseTopic = this.config.ZIGBEE2MQTT_BASE_TOPIC;
    this.lastComm = new Date().toISOString();

    // 1. Bridge Status
    if (topic === `${baseTopic}/bridge/state`) {
      if (typeof payload === "object" && payload !== null && "state" in payload) {
        this.bridgeOnline = (payload as { state: string }).state === "online";
      } else if (typeof payload === "string") {
        this.bridgeOnline = payload.toLowerCase() === "online";
      }
      this.logger.info({ bridgeOnline: this.bridgeOnline }, "Zigbee2MQTT bridge state update");
      return;
    }

    // 2. Discovered Devices List from Bridge
    if (topic === `${baseTopic}/bridge/devices` && Array.isArray(payload)) {
      this.logger.info({ count: payload.length }, "Zigbee2MQTT bridge devices list received");
      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const raw = item as Record<string, unknown>;

        // Skip the coordinator itself
        if (raw.type === "Coordinator") continue;

        const friendlyName = (raw.friendly_name as string) || (raw.ieee_address as string);
        if (!friendlyName) continue;

        const deviceId = `zigbee_${friendlyName}`;
        let existing = this.devices.get(deviceId);

        const definition = raw.definition as Record<string, unknown> | undefined;
        const vendor = (definition?.vendor as string) || (raw.vendor as string) || "Zigbee";
        const model = (definition?.model as string) || (raw.model_id as string) || "Device";

        if (!existing) {
          const unified: UnifiedDevice = {
            id: deviceId,
            householdId: "z2m",
            name: `${vendor} ${model} (${friendlyName})`,
            integration: "zigbee2mqtt",
            externalId: friendlyName,
            availability: raw.disabled ? "offline" : "online",
            capabilities: this.extractCapabilitiesFromDefinition(definition),
            desiredState: {},
            reportedState: {},
            lastSeenAt: this.lastComm,
          };

          this.devices.set(deviceId, unified);
          this.eventBus.emitDeviceDiscovered(unified);
          this.logger.info({ deviceId, name: unified.name }, "Discovered Zigbee device from bridge");
        }
      }
      return;
    }

    // 3. Individual Device State Update (e.g. zigbee2mqtt/living_room_lamp)
    if (topic.startsWith(`${baseTopic}/`)) {
      const subtopic = topic.slice(baseTopic.length + 1);

      // Ignore internal bridge subtopics and /set topics
      if (subtopic.startsWith("bridge/") || subtopic.endsWith("/set") || subtopic.endsWith("/get")) {
        return;
      }

      if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
        const friendlyName = subtopic;
        this.handleDeviceUpdate(friendlyName, payload as Record<string, unknown>);
      }
    }
  }

  public handleDeviceUpdate(friendlyName: string, payload: Record<string, unknown>): void {
    this.lastComm = new Date().toISOString();
    const deviceId = friendlyName.startsWith("zigbee_") ? friendlyName : `zigbee_${friendlyName}`;
    let dev = this.devices.get(deviceId);

    if (!dev) {
      const capabilities = this.extractCapabilities(payload);
      dev = {
        id: deviceId,
        householdId: "z2m",
        name: `Zigbee (${friendlyName.replace(/^zigbee_/, "")})`,
        integration: "zigbee2mqtt",
        externalId: friendlyName.replace(/^zigbee_/, ""),
        availability: "online",
        capabilities,
        desiredState: {},
        reportedState: payload,
        batteryLevel: typeof payload.battery === "number" ? payload.battery : undefined,
        signalQuality: typeof payload.linkquality === "number" ? payload.linkquality : undefined,
        lastSeenAt: this.lastComm,
      };
      this.devices.set(deviceId, dev);
      this.eventBus.emitDeviceDiscovered(dev);
    } else {
      dev.reportedState = { ...dev.reportedState, ...payload };
      if (typeof payload.battery === "number") dev.batteryLevel = payload.battery;
      if (typeof payload.linkquality === "number") dev.signalQuality = payload.linkquality;
      dev.lastSeenAt = this.lastComm;
    }

    // Emit updated state to EventBus for dashboard synchronization
    this.eventBus.emitDeviceState({
      householdId: "z2m",
      deviceId,
      reported: dev.reportedState,
      timestamp: this.lastComm,
    });
  }

  private extractCapabilities(payload: Record<string, unknown>): DeviceCapability[] {
    const caps: DeviceCapability[] = [];
    if ("state" in payload) {
      caps.push({ id: "power", type: "power", readable: true, writable: true });
    }
    if ("brightness" in payload) {
      caps.push({ id: "brightness", type: "brightness", readable: true, writable: true });
    }
    if ("color" in payload || "color_temp" in payload) {
      caps.push({ id: "color", type: "color", readable: true, writable: true });
    }
    if ("temperature" in payload) {
      caps.push({ id: "temperature", type: "temperature", readable: true, writable: false, unit: "°C" });
    }
    if ("humidity" in payload) {
      caps.push({ id: "humidity", type: "humidity", readable: true, writable: false, unit: "%" });
    }
    if ("occupancy" in payload) {
      caps.push({ id: "motion", type: "motion", readable: true, writable: false });
    }
    if ("contact" in payload) {
      caps.push({ id: "contact", type: "contact", readable: true, writable: false });
    }
    return caps;
  }

  private extractCapabilitiesFromDefinition(definition?: Record<string, unknown>): DeviceCapability[] {
    const caps: DeviceCapability[] = [];
    if (!definition || !Array.isArray(definition.exposes)) {
      caps.push({ id: "power", type: "power", readable: true, writable: true });
      return caps;
    }

    for (const exp of definition.exposes as Array<Record<string, unknown>>) {
      const type = exp.type as string;
      const name = exp.name as string;

      if (type === "light" || name === "state" || type === "switch") {
        caps.push({ id: "power", type: "power", readable: true, writable: true });
      }
      if (name === "brightness") {
        caps.push({ id: "brightness", type: "brightness", readable: true, writable: true });
      }
      if (name === "temperature") {
        caps.push({ id: "temperature", type: "temperature", readable: true, writable: false, unit: "°C" });
      }
      if (name === "humidity") {
        caps.push({ id: "humidity", type: "humidity", readable: true, writable: false, unit: "%" });
      }
      if (name === "occupancy") {
        caps.push({ id: "motion", type: "motion", readable: true, writable: false });
      }
      if (name === "contact") {
        caps.push({ id: "contact", type: "contact", readable: true, writable: false });
      }
    }

    return caps.length > 0 ? caps : [{ id: "power", type: "power", readable: true, writable: true }];
  }

  public getStatus(): IntegrationHealth {
    const mqttStatus = this.mqttTransport.getStatus();
    return {
      name: this.name,
      type: this.type,
      status: mqttStatus.connected ? "connected" : "disconnected",
      lastCommunication: this.lastComm,
      deviceCount: this.devices.size,
      errorMessage: mqttStatus.connected ? undefined : "Broker MQTT desconectado (Zigbee2MQTT depende do broker)",
    };
  }

  public getDiscoveredDevices(): UnifiedDevice[] {
    return Array.from(this.devices.values());
  }

  public async executeCommand(command: StoredCommand, device: UnifiedDevice): Promise<void> {
    const baseTopic = this.config.ZIGBEE2MQTT_BASE_TOPIC;
    const target = device.externalId.replace(/^zigbee_/, "");
    const deviceTopic = `${baseTopic}/${target}/set`;

    let payload: Record<string, unknown> = {};
    if (command.action === "turn_on" || (command.action === "set_power" && command.parameters.value === true)) {
      payload = { state: "ON" };
    } else if (command.action === "turn_off" || (command.action === "set_power" && command.parameters.value === false)) {
      payload = { state: "OFF" };
    } else {
      payload = command.parameters;
    }

    this.logger.info({ deviceTopic, payload }, "Publishing command to Zigbee2MQTT device");
    await this.mqttTransport.publishRaw(deviceTopic, JSON.stringify(payload), 1);
    this.lastComm = new Date().toISOString();
  }

  public async close(): Promise<void> {
    this.devices.clear();
  }
}
