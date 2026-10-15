import { z } from "zod";

export type DeviceAvailability = "online" | "offline" | "unknown";

export type CapabilityType =
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

export interface DeviceCapability {
  id: string;
  type: CapabilityType;
  readable: boolean;
  writable: boolean;
  unit?: string;
}

export interface UnifiedDevice {
  id: string;
  householdId: string;
  roomId?: string;
  name: string;
  integration: "mqtt" | "home_assistant" | "zigbee2mqtt" | "matter" | "esp32";
  externalId: string;
  availability: DeviceAvailability;
  capabilities: DeviceCapability[];
  desiredState: Record<string, unknown>;
  reportedState: Record<string, unknown>;
  batteryLevel?: number;
  signalQuality?: number;
  lastSeenAt?: string;
}

export const UnifiedDeviceSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().min(1),
  roomId: z.string().uuid().optional(),
  name: z.string().min(1).max(128),
  integration: z.enum(["mqtt", "home_assistant", "zigbee2mqtt", "matter", "esp32"]),
  externalId: z.string().min(1).max(256),
  availability: z.enum(["online", "offline", "unknown"]).default("unknown"),
  capabilities: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "power",
        "brightness",
        "color",
        "temperature",
        "humidity",
        "lock",
        "motion",
        "contact",
        "energy",
        "custom",
      ]),
      readable: z.boolean(),
      writable: z.boolean(),
      unit: z.string().optional(),
    })
  ),
  desiredState: z.record(z.string(), z.unknown()).default({}),
  reportedState: z.record(z.string(), z.unknown()).default({}),
  batteryLevel: z.number().min(0).max(100).optional(),
  signalQuality: z.number().optional(),
  lastSeenAt: z.string().datetime().optional(),
});
