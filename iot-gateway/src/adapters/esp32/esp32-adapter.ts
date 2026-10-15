import type { IAdapter, IntegrationHealth } from "../base-adapter.js";
import type { UnifiedDevice } from "../../devices/unified-model.js";
import type { StoredCommand } from "../../commands/command-manager.js";
import type { MqttTransport } from "../../mqtt/client.js";
import type { GatewayEventBus } from "../../events/event-bus.js";
import type { Logger } from "../../observability/logger.js";

export class Esp32Adapter implements IAdapter {
  public readonly type = "esp32";
  public readonly name = "ESP32 CI-v1 Adapter";
  private devices = new Map<string, UnifiedDevice>();
  private lastComm: string | undefined;

  constructor(
    private mqttTransport: MqttTransport,
    private eventBus: GatewayEventBus,
    private logger: Logger
  ) {}

  public async initialize(): Promise<void> {
    this.logger.info("Initializing ESP32 adapter...");

    // Listen to state reports from ESP32 devices
    this.eventBus.onDeviceState((evt) => {
      this.lastComm = evt.timestamp;
      let dev = this.devices.get(evt.deviceId);
      if (!dev) {
        dev = {
          id: evt.deviceId,
          householdId: evt.householdId,
          name: `ESP32 Device (${evt.deviceId.slice(-6)})`,
          integration: "esp32",
          externalId: evt.deviceId,
          availability: "online",
          capabilities: [
            { id: "power", type: "power", readable: true, writable: true },
            { id: "energy", type: "energy", readable: true, writable: false, unit: "W" },
          ],
          desiredState: {},
          reportedState: evt.reported,
          lastSeenAt: evt.timestamp,
        };
        this.devices.set(evt.deviceId, dev);
        this.eventBus.emitDeviceDiscovered(dev);
      } else {
        dev.reportedState = { ...dev.reportedState, ...evt.reported };
        dev.availability = "online";
        dev.lastSeenAt = evt.timestamp;
      }
    });

    this.eventBus.onDeviceAvailability((evt) => {
      this.lastComm = evt.timestamp;
      const dev = this.devices.get(evt.deviceId);
      if (dev) {
        dev.availability = evt.availability;
        dev.lastSeenAt = evt.timestamp;
      }
    });

    this.eventBus.onDeviceTelemetry((evt) => {
      this.lastComm = evt.timestamp;
      const dev = this.devices.get(evt.deviceId);
      if (dev) {
        dev.lastSeenAt = evt.timestamp;
        if (typeof evt.telemetry.rssi === "number") {
          dev.signalQuality = evt.telemetry.rssi;
        }
      }
    });
  }

  public getStatus(): IntegrationHealth {
    const mqttStatus = this.mqttTransport.getStatus();
    return {
      name: this.name,
      type: this.type,
      status: mqttStatus.connected ? "connected" : "disconnected",
      lastCommunication: this.lastComm,
      deviceCount: this.devices.size,
      errorMessage: mqttStatus.connected ? undefined : "Broker MQTT desconectado",
    };
  }

  public getDiscoveredDevices(): UnifiedDevice[] {
    return Array.from(this.devices.values());
  }

  public async executeCommand(command: StoredCommand, _device: UnifiedDevice): Promise<void> {
    await this.mqttTransport.publishCommand(command);
  }

  public async close(): Promise<void> {
    this.devices.clear();
  }
}
