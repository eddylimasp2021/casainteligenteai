import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { GatewayConfig } from "./config/index.js";
import { createLogger } from "./observability/logger.js";
import { GatewayEventBus } from "./events/event-bus.js";
import { CommandManager } from "./commands/command-manager.js";
import { MqttTransport } from "./mqtt/client.js";
import { Esp32Adapter } from "./adapters/esp32/esp32-adapter.js";
import { HomeAssistantAdapter } from "./adapters/home-assistant/ha-adapter.js";
import { Zigbee2MqttAdapter } from "./adapters/zigbee2mqtt/z2m-adapter.js";
import { MatterAdapter } from "./adapters/matter/matter-adapter.js";
import { DeviceRegistry } from "./devices/device-registry.js";
import { registerRoutes } from "./api/routes.js";
import type { IAdapter } from "./adapters/base-adapter.js";
import { CasaMqttBroker } from "./broker/mqtt-broker.js";

export interface GatewayApplication {
  app: FastifyInstance;
  mqttTransport: MqttTransport;
  mqttBroker?: CasaMqttBroker | null;
  commandManager: CommandManager;
  deviceRegistry: DeviceRegistry;
  eventBus: GatewayEventBus;
  adapters: IAdapter[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function buildApp(config: GatewayConfig): Promise<GatewayApplication> {
  const logger = createLogger(config);
  const eventBus = new GatewayEventBus();
  const commandManager = new CommandManager(logger);
  const mqttTransport = new MqttTransport(config, logger, commandManager, eventBus);
  const deviceRegistry = new DeviceRegistry(config, logger, eventBus);

  // Initialize adapters
  const esp32Adapter = new Esp32Adapter(mqttTransport, eventBus, logger);
  const haAdapter = new HomeAssistantAdapter(config, logger, eventBus);
  const z2mAdapter = new Zigbee2MqttAdapter(config, logger, mqttTransport, eventBus);
  const matterAdapter = new MatterAdapter(config, logger);

  const adapters: IAdapter[] = [esp32Adapter, haAdapter, z2mAdapter, matterAdapter];

  // Optional embedded MQTT broker
  let mqttBroker: CasaMqttBroker | null = null;
  if (config.EMBEDDED_MQTT_BROKER) {
    mqttBroker = new CasaMqttBroker(
      {
        port: config.MQTT_BROKER_PORT,
        host: config.MQTT_BROKER_HOST,
        allowAnonymous: false,
      },
      logger
    );
  }

  const app: FastifyInstance = fastify({
    logger: false,
  });

  // Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: false, // Allows Swagger UI
  });
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Casa Inteligente IoT Gateway API",
        description: "API profissional do Gateway IoT para Casa Inteligente I.A. (MQTT, ESP32, Zigbee, Matter, Home Assistant)",
        version: "1.0.0",
      },
      servers: [{ url: `http://${config.HOST}:${config.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Register endpoints
  registerRoutes(app, {
    config,
    logger,
    commandManager,
    deviceRegistry,
    adapters,
    mqttTransport,
  });

  const start = async () => {
    logger.info("Initializing IoT Gateway services...");

    // Start embedded MQTT broker if configured
    if (mqttBroker) {
      logger.info({ port: config.MQTT_BROKER_PORT }, "Starting embedded Casa MQTT Broker...");
      try {
        await mqttBroker.start();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ err: msg }, "Embedded MQTT broker start issue (external broker may be running); proceeding");
      }
    }

    await deviceRegistry.initialize();

    // Connect to MQTT
    try {
      await mqttTransport.connect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err: msg }, "MQTT broker initial connection failed; continuing in degraded mode with auto-reconnect");
    }

    // Initialize adapters concurrently
    await Promise.allSettled(adapters.map((a) => a.initialize()));

    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`IoT Gateway listening at http://${config.HOST}:${config.PORT}`);
    logger.info(`OpenAPI documentation available at http://${config.HOST}:${config.PORT}/docs`);
  };

  const stop = async () => {
    logger.info("Shutting down IoT Gateway...");
    await app.close();
    await Promise.allSettled(adapters.map((a) => a.close()));
    await mqttTransport.close();
    await deviceRegistry.close();
    if (mqttBroker) {
      await mqttBroker.stop();
    }
    logger.info("IoT Gateway stopped cleanly");
  };

  return {
    app,
    mqttTransport,
    mqttBroker,
    commandManager,
    deviceRegistry,
    eventBus,
    adapters,
    start,
    stop,
  };
}
