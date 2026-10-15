export type GatewayStatus = "online" | "offline" | "degraded" | "maintenance";
export type IntegrationType = "mqtt" | "home_assistant" | "zigbee2mqtt" | "matter" | "esp32";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "degraded";
export type CommandStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "QUEUED"
  | "SENT"
  | "ACKNOWLEDGED"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "REJECTED"
  | "TIMED_OUT"
  | "CANCELLED";
export type DeviceAvailability = "online" | "offline" | "unknown";

export interface IoTGateway {
  id: string;
  household_id: string;
  name: string;
  gateway_key: string;
  version: string;
  status: GatewayStatus;
  ip_address: string | null;
  supported_integrations: string[];
  metadata: Record<string, unknown>;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IoTIntegration {
  id: string;
  household_id: string;
  gateway_id: string | null;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  error_message: string | null;
  devices_count: number;
  created_at: string;
  updated_at: string;
}

export interface IoTCommand {
  id: string;
  command_id: string;
  household_id: string;
  device_id: string | null;
  iot_device_id: string | null;
  gateway_id: string | null;
  requested_by: string | null;
  action: string;
  parameters: Record<string, unknown>;
  status: CommandStatus;
  issued_at: string;
  expires_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  result_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface IoTDevice {
  id: string;
  household_id: string;
  device_id: string | null;
  gateway_id: string | null;
  integration_id: string | null;
  external_id: string;
  protocol: string;
  name: string;
  availability: DeviceAvailability;
  desired_state: Record<string, unknown>;
  reported_state: Record<string, unknown>;
  battery_level: number | null;
  signal_quality: number | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceCapability {
  id: string;
  type:
    | "power"
    | "brightness"
    | "color"
    | "temperature"
    | "humidity"
    | "lock"
    | "motion"
    | "contact"
    | "energy"
    | "custom";
  readable: boolean;
  writable: boolean;
  unit?: string;
}

export interface UnifiedDevice {
  id: string;
  householdId: string;
  roomId?: string;
  name: string;
  integration: string;
  externalId: string;
  availability: DeviceAvailability;
  capabilities: DeviceCapability[];
  desiredState: Record<string, unknown>;
  reportedState: Record<string, unknown>;
  lastSeenAt?: string;
  batteryLevel?: number;
  signalQuality?: number;
}
