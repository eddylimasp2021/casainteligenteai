import pino from "pino";
import type { GatewayConfig } from "../config/index.js";

export function createLogger(config: GatewayConfig) {
  const isDev = config.NODE_ENV === "development";
  return pino({
    level: config.LOG_LEVEL,
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
    redact: [
      "password",
      "token",
      "GATEWAY_API_TOKEN",
      "MQTT_PASSWORD",
      "HOME_ASSISTANT_TOKEN",
      "SUPABASE_SERVICE_ROLE_KEY",
      "authorization",
      "headers.authorization",
    ],
  });
}

export type Logger = ReturnType<typeof createLogger>;
