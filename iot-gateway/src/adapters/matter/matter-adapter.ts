import type { IAdapter, IntegrationHealth } from "../base-adapter.js";
import type { UnifiedDevice } from "../../devices/unified-model.js";
import type { StoredCommand } from "../../commands/command-manager.js";
import type { GatewayConfig } from "../../config/index.js";
import type { Logger } from "../../observability/logger.js";

export interface MatterCommissionParams {
  pairingCode?: string;
  qrCodePayload?: string;
  ipAddress?: string;
}

export interface MatterAttributeRead {
  endpointId: number;
  clusterId: number;
  attributeId: number;
  value: unknown;
}

export class MatterAdapter implements IAdapter {
  public readonly type = "matter";
  public readonly name = "Matter Controller Adapter";
  private devices = new Map<string, UnifiedDevice>();
  private isConnected = false;
  private lastComm?: string;
  private lastError?: string;

  constructor(
    private config: GatewayConfig,
    private logger: Logger
  ) {}

  public async initialize(): Promise<void> {
    if (!this.config.MATTER_ENABLED || !this.config.MATTER_CONTROLLER_URL) {
      this.logger.info("Matter controller not configured or disabled; running in degraded/offline mode.");
      this.lastError = "Controlador Matter ou Thread Border Router não detectado na rede local.";
      this.isConnected = false;
      return;
    }

    try {
      const res = await fetch(`${this.config.MATTER_CONTROLLER_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        this.isConnected = true;
        this.lastComm = new Date().toISOString();
        this.logger.info("Connected to local Matter controller");
      } else {
        this.isConnected = false;
        this.lastError = `Matter controller returned HTTP ${res.status}`;
      }
    } catch (err: unknown) {
      this.isConnected = false;
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = `Falha ao conectar ao controlador Matter: ${msg}`;
    }
  }

  public getStatus(): IntegrationHealth {
    return {
      name: this.name,
      type: this.type,
      status: this.isConnected ? "connected" : "disconnected",
      lastCommunication: this.lastComm,
      deviceCount: this.devices.size,
      errorMessage: this.lastError,
    };
  }

  public getDiscoveredDevices(): UnifiedDevice[] {
    return Array.from(this.devices.values());
  }

  public async discoverDevices(): Promise<UnifiedDevice[]> {
    if (!this.isConnected) {
      throw new Error("Matter controller is not reachable. Ensure a Thread Border Router is operational.");
    }
    return this.getDiscoveredDevices();
  }

  public async commissionDevice(params: MatterCommissionParams): Promise<{ nodeId: string; success: boolean }> {
    if (!this.isConnected) {
      throw new Error("Cannot commission Matter device: controller is offline.");
    }
    // Pairing codes are deliberately not logged for security compliance
    this.logger.info("Initiating Matter device commissioning...");
    const res = await fetch(`${this.config.MATTER_CONTROLLER_URL}/commission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Commissioning failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { nodeId: string };
    return { nodeId: data.nodeId, success: true };
  }

  public async removeDevice(nodeId: string): Promise<void> {
    if (!this.isConnected) throw new Error("Matter controller offline.");
    this.devices.delete(nodeId);
  }

  public async readAttributes(nodeId: string, endpointId: number, clusterId: number): Promise<MatterAttributeRead[]> {
    if (!this.isConnected) throw new Error("Matter controller offline.");
    const res = await fetch(
      `${this.config.MATTER_CONTROLLER_URL}/nodes/${nodeId}/endpoints/${endpointId}/clusters/${clusterId}/attributes`
    );
    return (await res.json()) as MatterAttributeRead[];
  }

  public async subscribeAttributes(nodeId: string, _callback: (read: MatterAttributeRead) => void): Promise<() => void> {
    this.logger.debug({ nodeId }, "Attribute subscription registered");
    return () => {};
  }

  public async executeCommand(command: StoredCommand, device: UnifiedDevice): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Matter controller is not available to execute commands.");
    }

    const res = await fetch(`${this.config.MATTER_CONTROLLER_URL}/nodes/${device.externalId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: command.action,
        parameters: command.parameters,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Matter command failed with HTTP ${res.status}`);
    }
    this.lastComm = new Date().toISOString();
  }

  public async close(): Promise<void> {
    this.isConnected = false;
    this.devices.clear();
  }
}
