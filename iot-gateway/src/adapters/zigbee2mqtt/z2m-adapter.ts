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

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private mqttTransport: MqttTransport,
    private eventBus: GatewayEventBus
  ) {}

  public async initialize(): Promise<void> {
    this.logger.info({ baseTopic: this.config.ZIGBEE2MQTT_BASE_TOPIC }, "Initializing Zigbee2MQTT adapter...");

    // Listen to device state events if routed via MQTT
    this.eventBus.onDeviceState((evt) => {
      if (evt.deviceId.startsWith("zigbee_") || evt.householdId === "z2m") {
        this.handleDeviceUpdate(evt.deviceId, evt.reported);
      }
    });
  }

  public handleDeviceUpdate(deviceId: string, payload: Record<string, unknown>): void {
    this.lastComm = new Date().toISOString();
    let dev = this.devices.get(deviceId);

    if (!dev) {
      const capabilities = this.extractCapabilities(payload);
      dev = {
        id: deviceId,
        householdId: "z2m",
        name: `Zigbee (${deviceId.replace(/^zigbee_/, "")})`,
        integration: "zigbee2mqtt",
        externalId: deviceId,
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
    const deviceTopic = `${baseTopic}/${device.externalId.replace(/^zigbee_/, "")}/set`;

    let payload: Record<string, unknown> = {};
    if (command.action === "set_power") {
      payload = { state: command.parameters.value ? "ON" : "OFF" };
    } else {
      payload = command.parameters;
    }

    this.logger.info({ deviceTopic, payload }, "Publishing command to Zigbee2MQTT");
    this.lastComm = new Date().toISOString();
  }

  public async close(): Promise<void> {
    this.devices.clear();
  }
}
