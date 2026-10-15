import { loadConfig } from "../config/index.js";
import { createLogger } from "../observability/logger.js";
import { CasaMqttBroker } from "./mqtt-broker.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);

  const port = config.MQTT_BROKER_PORT || 1883;
  const host = config.MQTT_BROKER_HOST || "0.0.0.0";

  logger.info("Starting standalone Casa Inteligente MQTT Broker...");

  const broker = new CasaMqttBroker(
    {
      port,
      host,
      allowAnonymous: false,
    },
    logger
  );

  const shutdown = async (sig: string) => {
    logger.info({ signal: sig }, "Shutting down MQTT Broker...");
    await broker.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await broker.start();
    logger.info(`Casa Inteligente MQTT Broker ready on tcp://${host}:${port}`);
    logger.info("Authentication: enabled (casa-gateway-user, esp32_client, zigbee2mqtt_user)");
  } catch (err) {
    logger.error({ err }, "Failed to start MQTT Broker");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal broker error:", err);
  process.exit(1);
});
