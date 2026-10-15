import { EventEmitter } from "node:events";
import type { UnifiedDevice } from "../devices/unified-model.js";
import type { StoredCommand } from "../commands/command-manager.js";

export interface DeviceStateEvent {
  householdId: string;
  deviceId: string;
  reported: Record<string, unknown>;
  timestamp: string;
}

export interface DeviceAvailabilityEvent {
  householdId: string;
  deviceId: string;
  availability: "online" | "offline";
  timestamp: string;
}

export interface DeviceTelemetryEvent {
  householdId: string;
  deviceId: string;
  telemetry: Record<string, unknown>;
  timestamp: string;
}

export class GatewayEventBus extends EventEmitter {
  public emitDeviceState(event: DeviceStateEvent) {
    this.emit("device:state", event);
  }

  public onDeviceState(listener: (event: DeviceStateEvent) => void) {
    this.on("device:state", listener);
  }

  public emitDeviceAvailability(event: DeviceAvailabilityEvent) {
    this.emit("device:availability", event);
  }

  public onDeviceAvailability(listener: (event: DeviceAvailabilityEvent) => void) {
    this.on("device:availability", listener);
  }

  public emitDeviceTelemetry(event: DeviceTelemetryEvent) {
    this.emit("device:telemetry", event);
  }

  public onDeviceTelemetry(listener: (event: DeviceTelemetryEvent) => void) {
    this.on("device:telemetry", listener);
  }

  public emitDeviceDiscovered(device: UnifiedDevice) {
    this.emit("device:discovered", device);
  }

  public onDeviceDiscovered(listener: (device: UnifiedDevice) => void) {
    this.on("device:discovered", listener);
  }

  public emitCommandUpdated(command: StoredCommand) {
    this.emit("command:updated", command);
  }

  public onCommandUpdated(listener: (command: StoredCommand) => void) {
    this.on("command:updated", listener);
  }
}
