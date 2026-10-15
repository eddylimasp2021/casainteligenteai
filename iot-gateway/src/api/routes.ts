import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { GatewayConfig } from "../config/index.js";
import { sanitizeConfig } from "../config/index.js";
import type { Logger } from "../observability/logger.js";
import type { CommandManager } from "../commands/command-manager.js";
import type { DeviceRegistry } from "../devices/device-registry.js";
import type { IAdapter } from "../adapters/base-adapter.js";
import type { HomeAssistantAdapter } from "../adapters/home-assistant/ha-adapter.js";
import type { MqttTransport } from "../mqtt/client.js";

const PostCommandBodySchema = z.object({
  householdId: z.string().min(1),
  action: z.string().min(1).max(64),
  parameters: z.record(z.string(), z.unknown()).default({}),
  ttlMs: z.number().int().min(1000).max(120000).default(30000),
  waitForCompletion: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
});

export function registerRoutes(
  app: FastifyInstance,
  options: {
    config: GatewayConfig;
    logger: Logger;
    commandManager: CommandManager;
    deviceRegistry: DeviceRegistry;
    adapters: IAdapter[];
    mqttTransport: MqttTransport;
  }
) {
  const { config, logger, commandManager, deviceRegistry, adapters, mqttTransport } = options;

  // Simple token authentication hook for /api/* routes
  const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Missing or malformed Authorization header.",
      });
    }
    const token = authHeader.slice(7);
    if (token !== config.GATEWAY_API_TOKEN) {
      logger.warn({ ip: req.ip }, "Rejected unauthorized request with invalid token");
      return reply.status(403).send({
        error: "Forbidden",
        message: "Invalid Gateway API token.",
      });
    }
  };

  // 1. Health & Liveness
  app.get("/health", async () => {
    const mqttStatus = mqttTransport.getStatus();
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      gateway: {
        id: config.GATEWAY_ID,
        name: config.GATEWAY_NAME,
        version: "1.0.0",
      },
      transport: {
        mqtt: mqttStatus.connected ? "connected" : "disconnected",
      },
      config: sanitizeConfig(config),
    };
  });

  // 2. Readiness Check
  app.get("/ready", async (_req, reply) => {
    const mqttStatus = mqttTransport.getStatus();
    if (!mqttStatus.connected) {
      return reply.status(503).send({
        ready: false,
        reason: "MQTT transport disconnected",
      });
    }
    return { ready: true };
  });

  // 3. List Integrations Status
  app.get("/api/v1/integrations", { preHandler: requireAuth }, async () => {
    return {
      integrations: adapters.map((a) => a.getStatus()),
    };
  });

  // 4. Test Home Assistant Integration
  app.post("/api/v1/integrations/home-assistant/test", { preHandler: requireAuth }, async () => {
    const haAdapter = adapters.find((a) => a.type === "home_assistant") as HomeAssistantAdapter | undefined;
    if (!haAdapter) {
      return { success: false, message: "Home Assistant adapter is not registered." };
    }
    return await haAdapter.testConnection();
  });

  // 5. Test MQTT Integration
  app.post("/api/v1/integrations/mqtt/test", { preHandler: requireAuth }, async () => {
    const status = mqttTransport.getStatus();
    return {
      success: status.connected,
      message: status.connected
        ? "Conexão com o Broker MQTT estabelecida com sucesso."
        : "Não foi possível conectar ao Broker MQTT. Verifique URL, credenciais e firewall.",
      details: status,
    };
  });

  // 6. List Devices
  app.get<{ Querystring: { householdId?: string } }>(
    "/api/v1/devices",
    { preHandler: requireAuth },
    async (req) => {
      const list = deviceRegistry.listDevices(req.query.householdId);
      return { devices: list, total: list.length };
    }
  );

  // 7. Get Device by ID
  app.get<{ Params: { id: string } }>(
    "/api/v1/devices/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const dev = deviceRegistry.getDevice(req.params.id);
      if (!dev) {
        return reply.status(404).send({ error: "Device not found" });
      }
      return dev;
    }
  );

  // 8. Get Device State
  app.get<{ Params: { id: string } }>(
    "/api/v1/devices/:id/state",
    { preHandler: requireAuth },
    async (req, reply) => {
      const dev = deviceRegistry.getDevice(req.params.id);
      if (!dev) {
        return reply.status(404).send({ error: "Device not found" });
      }
      return {
        id: dev.id,
        availability: dev.availability,
        reportedState: dev.reportedState,
        desiredState: dev.desiredState,
        lastSeenAt: dev.lastSeenAt,
      };
    }
  );

  // 9. Send Command to Device (with state machine and real confirmation)
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/devices/:id/commands",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = PostCommandBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid command parameters",
          issues: parsed.error.issues,
        });
      }

      const { householdId, action, parameters, ttlMs, waitForCompletion, timeoutMs } = parsed.data;
      const deviceId = req.params.id;
      const dev = deviceRegistry.getDevice(deviceId);

      if (dev && dev.availability === "offline") {
        return reply.status(409).send({
          error: "Device is offline",
          message: `Cannot execute command: device ${dev.name} is currently offline.`,
        });
      }

      let cmd;
      try {
        cmd = commandManager.createCommand({
          householdId,
          deviceId,
          action,
          parameters,
          ttlMs,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: "Command creation error", message: msg });
      }

      commandManager.transition(cmd.commandId, "AUTHORIZED");
      commandManager.transition(cmd.commandId, "QUEUED");

      // Find appropriate adapter or route via MQTT
      const adapter = adapters.find((a) => a.type === dev?.integration);
      if (adapter && dev) {
        try {
          commandManager.transition(cmd.commandId, "SENT");
          await adapter.executeCommand(cmd, dev);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          commandManager.transition(cmd.commandId, "FAILED", {
            errorCode: "ADAPTER_ERR",
            errorMessage: msg,
          });
          return reply.status(502).send({ error: "Adapter execution failed", message: msg, command: cmd });
        }
      } else {
        // Fallback: publish via standard CI v1 MQTT
        try {
          await mqttTransport.publishCommand(cmd);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return reply.status(502).send({ error: "MQTT transport failed", message: msg, command: cmd });
        }
      }

      // If caller requested synchronous confirmation, wait for device result
      if (waitForCompletion) {
        const finished = await commandManager.waitForCompletion(cmd.commandId, timeoutMs);
        if (finished.status === "SUCCEEDED") {
          return reply.status(200).send({
            confirmed: true,
            status: finished.status,
            command: finished,
          });
        } else {
          return reply.status(422).send({
            confirmed: false,
            status: finished.status,
            message: "Não foi possível confirmar a execução física no dispositivo.",
            command: finished,
          });
        }
      }

      return reply.status(202).send({
        confirmed: false,
        status: cmd.status,
        message: "Comando enviado para a fila. Aguardando execução do dispositivo.",
        command: cmd,
      });
    }
  );

  // 10. Get Command Status by Command ID
  app.get<{ Params: { commandId: string } }>(
    "/api/v1/commands/:commandId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const cmd = commandManager.getCommand(req.params.commandId);
      if (!cmd) {
        return reply.status(404).send({ error: "Command not found or expired" });
      }
      return cmd;
    }
  );

  // 11. List recent commands / events
  app.get<{ Querystring: { householdId?: string } }>(
    "/api/v1/events",
    { preHandler: requireAuth },
    async (req) => {
      const list = commandManager.listCommands(req.query.householdId);
      return {
        commands: list.slice(-50).reverse(),
      };
    }
  );

  // 12. Camera Snapshot Proxy (allows browser to securely fetch snapshots from local IP cameras)
  app.get<{
    Querystring: { url: string; username?: string; password?: string };
  }>("/api/v1/cameras/proxy-snapshot", async (req, reply) => {
    const { url, username, password } = req.query;
    if (!url || !url.startsWith("http")) {
      return reply.status(400).send({ error: "Invalid URL parameter" });
    }

    try {
      const headers: Record<string, string> = {};
      if (username && password) {
        headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return reply.status(response.status).send({ error: `Camera returned HTTP ${response.status}` });
      }

      const buffer = await response.arrayBuffer();
      reply
        .header("Content-Type", response.headers.get("content-type") || "image/jpeg")
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .send(Buffer.from(buffer));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ error: "Failed to connect to local camera", details: errMsg });
    }
  });
}
