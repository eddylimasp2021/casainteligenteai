import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { GatewayConfig } from "../config/index.js";
import type { Logger } from "../observability/logger.js";
import type { UnifiedDevice } from "./unified-model.js";
import type { GatewayEventBus } from "../events/event-bus.js";

export class DeviceRegistry {
  private devices = new Map<string, UnifiedDevice>();
  private supabase: SupabaseClient | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private realtimeChannel: RealtimeChannel | null = null;

  constructor(
    private config: GatewayConfig,
    private logger: Logger,
    private eventBus: GatewayEventBus
  ) {
    const key = this.config.SUPABASE_SERVICE_ROLE_KEY || this.config.SUPABASE_ANON_KEY;
    if (this.config.SUPABASE_URL && key) {
      this.supabase = createClient(this.config.SUPABASE_URL, key, {
        auth: { persistSession: false },
      });
      const mode = this.config.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon/service_account";
      this.logger.info({ mode }, "Supabase backend client initialized for gateway sync");
    } else {
      this.logger.warn("Supabase credentials not configured; gateway running in standalone/offline mode");
    }
  }

  public async initialize(): Promise<void> {
    this.eventBus.onDeviceDiscovered((dev) => this.registerDevice(dev));
    if (this.config.NODE_ENV === "test") return;
    if (this.supabase && this.config.GATEWAY_AUTH_EMAIL && this.config.GATEWAY_AUTH_PASSWORD) {
      try {
        const { error } = await this.supabase.auth.signInWithPassword({
          email: this.config.GATEWAY_AUTH_EMAIL,
          password: this.config.GATEWAY_AUTH_PASSWORD,
        });
        if (error) {
          this.logger.warn({ error: error.message }, "Gateway user authentication failed; will continue with anon key");
        } else {
          this.logger.info("Gateway authenticated successfully with scoped user credentials");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn({ err: msg }, "Error during gateway user sign-in");
      }
    }

    // 2. Register event bus listeners for physical device updates
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

    // 3. Start WebSocket Realtime listener for incoming commands from the cloud
    this.subscribeRealtimeCommands();

    // 4. Start heartbeat ping to backend
    this.startHeartbeat();
  }

  private subscribeRealtimeCommands(): void {
    if (!this.supabase) return;

    const channelName = `gateway-${this.config.GATEWAY_ID}-commands`;
    this.logger.info({ channelName }, "Connecting outbound WebSocket to Supabase Realtime for commands...");

    // Filter by household if configured, or listen to all authorized household devices
    const filter = this.config.HOUSEHOLD_ID ? `household_id=eq.${this.config.HOUSEHOLD_ID}` : undefined;

    this.realtimeChannel = this.supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter,
        },
        (payload) => {
          this.handleRealtimeDeviceUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.logger.info("Realtime WebSocket channel SUBSCRIBED: listening for cloud commands");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.logger.warn({ status }, "Realtime WebSocket channel status changed");
        }
      });
  }

  private handleRealtimeDeviceUpdate(record: Record<string, unknown>): void {
    if (!record || typeof record !== "object") return;
    const state = record.state as Record<string, unknown> | undefined;
    const pending = state?.pending as Record<string, unknown> | undefined;

    // Only process real physical devices waiting for gateway execution
    if (pending && !record.simulated) {
      const deviceId = (record.external_id || record.id) as string;
      const householdId = (record.household_id || this.config.HOUSEHOLD_ID || "unknown") as string;

      this.logger.info(
        { deviceId, pending, householdId },
        "Realtime WebSocket: Incoming physical device command from cloud"
      );

      // Emit command event to internal bus so MQTT/HA adapters dispatch to physical device
      this.eventBus.emit("device:command:received", {
        deviceId,
        householdId,
        patch: pending,
        rawRecord: record,
      });
    }
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
            household_id: this.config.HOUSEHOLD_ID ?? "00000000-0000-0000-0000-000000000000",
            version: "1.0.0",
            status: "online",
            supported_integrations: ["mqtt", "esp32", "home_assistant", "zigbee2mqtt", "matter"],
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "gateway_key" }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.debug({ err: msg }, "Gateway heartbeat ping failed (tabela iot_gateways pode estar pendente)");
      }
    };

    void sendPing();
    this.heartbeatTimer = setInterval(sendPing, 30_000);
  }

  private async persistDeviceState(householdId: string, deviceId: string, reported: Record<string, unknown>, timestamp: string): Promise<void> {
    if (!this.supabase) return;
    try {
      // 1. Gravar em iot_events se a tabela existir
      await this.supabase.from("iot_events").insert({
        household_id: householdId,
        topic: `ci/v1/${householdId}/${deviceId}/state`,
        event_type: "state",
        payload: reported,
        source: "gateway",
      });

      // 2. Atualizar estado físico confirmado na tabela devices (removendo pending)
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
    if (this.realtimeChannel && this.supabase) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}
