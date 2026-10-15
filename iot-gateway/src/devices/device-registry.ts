import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GatewayConfig } from "../config/index.js";
import type { Logger } from "../observability/logger.js";
import type { UnifiedDevice } from "./unified-model.js";
import type { GatewayEventBus } from "../events/event-bus.js";

export class DeviceRegistry {
  private devices = new Map<string, UnifiedDevice>();
  private supabase: SupabaseClient | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private eventBus: GatewayEventBus
  ) {
    if (this.config.SUPABASE_URL && this.config.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      this.logger.info("Supabase backend client initialized for gateway sync");
    } else {
      this.logger.warn("Supabase credentials not configured; gateway running in standalone/offline mode");
    }
  }

  public async initialize(): Promise<void> {
    // Register event listeners
    this.eventBus.onDeviceDiscovered((dev) => this.registerDevice(dev));

    this.eventBus.onDeviceState(async (evt) => {
      const dev = this.devices.get(evt.deviceId);
      if (dev) {
        dev.reportedState = { ...dev.reportedState, ...evt.reported };
        dev.availability = "online";
        dev.lastSeenAt = evt.timestamp;
      }
      await this.persistDeviceState(evt.householdId, evt.deviceId, evt.reported, evt.timestamp);
    });

    this.eventBus.onDeviceAvailability(async (evt) => {
      const dev = this.devices.get(evt.deviceId);
      if (dev) {
        dev.availability = evt.availability;
        dev.lastSeenAt = evt.timestamp;
      }
      await this.persistAvailability(evt.householdId, evt.deviceId, evt.availability, evt.timestamp);
    });

    this.eventBus.onDeviceTelemetry(async (evt) => {
      await this.persistTelemetry(evt.householdId, evt.deviceId, evt.telemetry, evt.timestamp);
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  public registerDevice(device: UnifiedDevice): void {
    this.devices.set(device.id, device);
    this.logger.info({ id: device.id, name: device.name, integration: device.integration }, "Registered unified device");
  }

  public getDevice(id: string): UnifiedDevice | undefined {
    return this.devices.get(id);
  }

  public listDevices(householdId?: string): UnifiedDevice[] {
    const all = Array.from(this.devices.values());
    if (!householdId) return all;
    return all.filter((d) => d.householdId === householdId);
  }

  private startHeartbeat(): void {
    if (!this.supabase) return;

    const sendPing = async () => {
      try {
        await this.supabase?.from("iot_gateways").upsert(
          {
            gateway_key: this.config.GATEWAY_ID,
            name: this.config.GATEWAY_NAME,
            household_id: "00000000-0000-0000-0000-000000000000",
            version: "1.0.0",
            status: "online",
            supported_integrations: ["mqtt", "esp32", "home_assistant", "zigbee2mqtt", "matter"],
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "gateway_key" }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.debug({ err: msg }, "Gateway heartbeat ping failed");
      }
    };

    void sendPing();
    this.heartbeatTimer = setInterval(sendPing, 30_000);
  }

  private async persistDeviceState(householdId: string, deviceId: string, reported: Record<string, unknown>, timestamp: string): Promise<void> {
    if (!this.supabase) return;
    try {
      await this.supabase.from("iot_events").insert({
        household_id: householdId,
        topic: `ci/v1/${householdId}/${deviceId}/state`,
        event_type: "state",
        payload: reported,
        source: "gateway",
      });

      await this.supabase
        .from("devices")
        .update({
          state: reported,
          status: "online",
          last_seen_at: timestamp,
        })
        .eq("external_id", deviceId);
    } catch (err: unknown) {
      this.logger.debug({ err }, "Failed to persist device state to Supabase");
    }
  }

  private async persistAvailability(_householdId: string, deviceId: string, availability: "online" | "offline", timestamp: string): Promise<void> {
    if (!this.supabase) return;
    try {
      await this.supabase
        .from("devices")
        .update({
          status: availability,
          last_seen_at: timestamp,
        })
        .eq("external_id", deviceId);
    } catch (err: unknown) {
      this.logger.debug({ err }, "Failed to persist device availability to Supabase");
    }
  }

  private async persistTelemetry(householdId: string, _deviceId: string, telemetry: Record<string, unknown>, timestamp: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const records = Object.entries(telemetry)
        .filter(([_, v]) => typeof v === "number")
        .map(([k, v]) => ({
          household_id: householdId,
          metric: k,
          value: v as number,
          recorded_at: timestamp,
        }));

      if (records.length > 0) {
        await this.supabase.from("iot_telemetry").insert(records);
      }
    } catch (err: unknown) {
      this.logger.debug({ err }, "Failed to persist telemetry to Supabase");
    }
  }

  public async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
