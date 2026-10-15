import type { UnifiedDevice } from "../devices/unified-model.js";
import type { StoredCommand } from "../commands/command-manager.js";

export type AdapterStatus = "connected" | "disconnected" | "degraded" | "error";

export interface IntegrationHealth {
  name: string;
  type: "mqtt" | "home_assistant" | "zigbee2mqtt" | "matter" | "esp32";
  status: AdapterStatus;
  lastCommunication?: string;
  deviceCount: number;
  errorMessage?: string;
}

export interface IAdapter {
  readonly type: "mqtt" | "home_assistant" | "zigbee2mqtt" | "matter" | "esp32";
  readonly name: string;
  initialize(): Promise<void>;
  getStatus(): IntegrationHealth;
  getDiscoveredDevices(): UnifiedDevice[];
  executeCommand(command: StoredCommand, device: UnifiedDevice): Promise<void>;
  close(): Promise<void>;
}
