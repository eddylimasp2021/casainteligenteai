import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  GATEWAY_ID: z.string().min(1).default("gw-local-001"),
  GATEWAY_NAME: z.string().min(1).default("Casa Inteligente Gateway"),
  GATEWAY_API_TOKEN: z.string().min(8).default("dev-insecure-token-change-in-prod"),

  // MQTT
  MQTT_URL: z.string().url().default("mqtt://localhost:1883"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().default("casa-inteligente-gateway"),
  MQTT_RECONNECT_PERIOD_MS: z.coerce.number().min(500).default(2000),
  MQTT_CONNECT_TIMEOUT_MS: z.coerce.number().min(1000).default(10000),

  // Home Assistant
  HOME_ASSISTANT_URL: z.string().url().optional(),
  HOME_ASSISTANT_TOKEN: z.string().optional(),

  // Zigbee2MQTT
  ZIGBEE2MQTT_BASE_TOPIC: z.string().min(1).default("zigbee2mqtt"),

  // Matter
  MATTER_CONTROLLER_URL: z.string().url().optional(),
  MATTER_ENABLED: z.coerce.boolean().default(false),

  // Supabase Backend
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Observability & Security
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  COMMAND_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
  RATE_LIMIT_MAX: z.coerce.number().min(10).default(120),
});

export type GatewayConfig = z.infer<typeof EnvSchema>;

let cachedConfig: GatewayConfig | null = null;

export function loadConfig(overrideEnv?: Record<string, string | undefined>): GatewayConfig {
  if (cachedConfig && !overrideEnv) {
    return cachedConfig;
  }

  const env = overrideEnv ?? process.env;
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`[Gateway Config Error] Invalid environment configuration:\n${issues}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

export function sanitizeConfig(cfg: GatewayConfig): Record<string, unknown> {
  return {
    NODE_ENV: cfg.NODE_ENV,
    PORT: cfg.PORT,
    HOST: cfg.HOST,
    GATEWAY_ID: cfg.GATEWAY_ID,
    GATEWAY_NAME: cfg.GATEWAY_NAME,
    MQTT_URL: cfg.MQTT_URL,
    MQTT_CLIENT_ID: cfg.MQTT_CLIENT_ID,
    MQTT_HAS_AUTH: Boolean(cfg.MQTT_USERNAME && cfg.MQTT_PASSWORD),
    HOME_ASSISTANT_CONFIGURED: Boolean(cfg.HOME_ASSISTANT_URL && cfg.HOME_ASSISTANT_TOKEN),
    ZIGBEE2MQTT_BASE_TOPIC: cfg.ZIGBEE2MQTT_BASE_TOPIC,
    MATTER_ENABLED: cfg.MATTER_ENABLED,
    SUPABASE_CONFIGURED: Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY),
    LOG_LEVEL: cfg.LOG_LEVEL,
    COMMAND_TIMEOUT_MS: cfg.COMMAND_TIMEOUT_MS,
  };
}
