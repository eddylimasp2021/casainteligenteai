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
  HOME_ASSISTANT_URL: z.string().url().optional().or(z.literal("")).transform((v) => v || undefined),
  HOME_ASSISTANT_TOKEN: z.string().optional().or(z.literal("")).transform((v) => v || undefined),

  // Zigbee2MQTT
  ZIGBEE2MQTT_BASE_TOPIC: z.string().min(1).default("zigbee2mqtt"),

  // Matter
  MATTER_CONTROLLER_URL: z.string().url().optional().or(z.literal("")).transform((v) => v || undefined),
  MATTER_ENABLED: z.coerce.boolean().default(false),

  // Supabase Backend (pode usar Anon/Publishable Key + Auth de Usuário sem expor service_role)
  SUPABASE_URL: z.string().url().optional().or(z.literal("")).transform((v) => v || undefined),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  HOUSEHOLD_ID: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  GATEWAY_AUTH_EMAIL: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  GATEWAY_AUTH_PASSWORD: z.string().optional().or(z.literal("")).transform((v) => v || undefined),

  // Embedded MQTT Broker (permite executar broker sem Docker no Windows)
  EMBEDDED_MQTT_BROKER: z.coerce.boolean().default(false),
  MQTT_BROKER_PORT: z.coerce.number().int().min(1024).max(65535).default(1883),
  MQTT_BROKER_HOST: z.string().default("0.0.0.0"),

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

  if (!overrideEnv && process.env.NODE_ENV !== "test") {
    try {
      // Native Node.js built-in .env loader
      process.loadEnvFile();
    } catch {
      // Ignore if .env is missing
    }
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
    EMBEDDED_MQTT_BROKER: cfg.EMBEDDED_MQTT_BROKER,
    MQTT_BROKER_PORT: cfg.MQTT_BROKER_PORT,
    HOME_ASSISTANT_CONFIGURED: Boolean(cfg.HOME_ASSISTANT_URL && cfg.HOME_ASSISTANT_TOKEN),
    ZIGBEE2MQTT_BASE_TOPIC: cfg.ZIGBEE2MQTT_BASE_TOPIC,
    MATTER_ENABLED: cfg.MATTER_ENABLED,
    SUPABASE_CONFIGURED: Boolean(cfg.SUPABASE_URL && (cfg.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_ANON_KEY)),
    SUPABASE_AUTH_MODE: cfg.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : cfg.GATEWAY_AUTH_EMAIL ? "service_account" : "anon",
    HOUSEHOLD_BOUND: Boolean(cfg.HOUSEHOLD_ID),
    LOG_LEVEL: cfg.LOG_LEVEL,
    COMMAND_TIMEOUT_MS: cfg.COMMAND_TIMEOUT_MS,
  };
}
