import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { HomeAssistantAdapter } from "../adapters/home-assistant/ha-adapter.js";
import { GatewayEventBus } from "../events/event-bus.js";
import { createLogger } from "../observability/logger.js";
import { loadConfig } from "../config/index.js";
import type { UnifiedDevice } from "../devices/unified-model.js";

const HA_PORT = 18123;
const HA_TOKEN = "ha-super-secret-long-lived-access-token-123";

describe("Home Assistant Adapter Integration Tests", () => {
  let httpServer: http.Server;
  let wss: WebSocketServer;
  let adapter: HomeAssistantAdapter;
  let eventBus: GatewayEventBus;
  let receivedServiceCall: { url: string; body: any } | null = null;
  let connectedWsClient: WebSocket | null = null;

  beforeAll(async () => {
    // 1. Create Mock Home Assistant HTTP & WebSocket Server
    httpServer = http.createServer((req, res) => {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${HA_TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }

      if (req.url === "/api/config" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ version: "2026.10.1", location_name: "Casa Inteligente Lab" }));
        return;
      }

      if (req.url === "/api/states" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify([
            {
              entity_id: "light.living_room",
              state: "on",
              attributes: { friendly_name: "Luz da Sala", brightness: 200 },
              last_updated: new Date().toISOString(),
            },
            {
              entity_id: "switch.kitchen_fan",
              state: "off",
              attributes: { friendly_name: "Exaustor Cozinha" },
              last_updated: new Date().toISOString(),
            },
          ])
        );
        return;
      }

      if (req.url?.startsWith("/api/services/") && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          receivedServiceCall = { url: req.url!, body: JSON.parse(body) };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify([{ entity_id: receivedServiceCall.body.entity_id }]));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // Attach WebSocket Server
    wss = new WebSocketServer({ server: httpServer, path: "/api/websocket" });
    wss.on("connection", (ws) => {
      connectedWsClient = ws;
      // Step 1: Request authentication
      ws.send(JSON.stringify({ type: "auth_required", ha_version: "2026.10.1" }));

      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth") {
          if (msg.access_token === HA_TOKEN) {
            ws.send(JSON.stringify({ type: "auth_ok", ha_version: "2026.10.1" }));
          } else {
            ws.send(JSON.stringify({ type: "auth_invalid", message: "Invalid token" }));
            ws.close();
          }
        } else if (msg.type === "subscribe_events") {
          ws.send(JSON.stringify({ id: msg.id, type: "result", success: true, result: null }));
        }
      });
    });

    await new Promise<void>((resolve) => httpServer.listen(HA_PORT, "127.0.0.1", () => resolve()));

    // 2. Setup Adapter
    const config = loadConfig({
      NODE_ENV: "test",
      HOME_ASSISTANT_URL: `http://127.0.0.1:${HA_PORT}`,
      HOME_ASSISTANT_TOKEN: HA_TOKEN,
      LOG_LEVEL: "fatal",
    });

    const logger = createLogger(config);
    eventBus = new GatewayEventBus();
    adapter = new HomeAssistantAdapter(config, logger, eventBus);
  });

  afterAll(async () => {
    await adapter.close();
    wss.close();
    await new Promise<void>((res) => httpServer.close(() => res()));
  });

  it("successfully tests connection and retrieves Home Assistant version", async () => {
    const res = await adapter.testConnection();
    expect(res.success).toBe(true);
    expect(res.version).toBe("2026.10.1");
    expect(res.message).toContain("Casa Inteligente Lab");
  });

  it("fetches initial entities and converts them to UnifiedDevice model", async () => {
    const discovered: UnifiedDevice[] = [];
    eventBus.onDeviceDiscovered((d) => discovered.push(d));

    await adapter.initialize();
    await adapter.waitForConnected(3000);

    const devices = adapter.getDiscoveredDevices();
    expect(devices.length).toBe(2);

    const light = devices.find((d) => d.externalId === "light.living_room");
    expect(light).toBeDefined();
    expect(light?.name).toBe("Luz da Sala");
    expect(light?.availability).toBe("online");
    expect(light?.capabilities.some((c) => c.id === "brightness")).toBe(true);

    const status = adapter.getStatus();
    expect(status.status).toBe("connected");
    expect(status.deviceCount).toBe(2);
  });

  it("receives real-time state_changed events over WebSocket and emits to EventBus", async () => {
    await adapter.waitForConnected(3000);

    const statePromise = new Promise<{ deviceId: string; reported: any }>((resolve) => {
      eventBus.onDeviceState((evt) => {
        if (evt.deviceId === "light.living_room") {
          resolve(evt);
        }
      });
    });

    // Simulate Home Assistant emitting a state_changed event over WebSocket
    connectedWsClient?.send(
      JSON.stringify({
        type: "event",
        event: {
          event_type: "state_changed",
          data: {
            entity_id: "light.living_room",
            new_state: {
              entity_id: "light.living_room",
              state: "off",
              attributes: { friendly_name: "Luz da Sala", brightness: 0 },
              last_updated: new Date().toISOString(),
            },
          },
        },
      })
    );

    const receivedState = await statePromise;
    expect(receivedState.deviceId).toBe("light.living_room");
    expect(receivedState.reported.state).toBe("off");
    expect(receivedState.reported.on).toBe(false);
  });

  it("executes service commands against Home Assistant REST API", async () => {
    const targetDev = adapter.getDiscoveredDevices().find((d) => d.externalId === "light.living_room")!;

    await adapter.executeCommand(
      {
        commandId: "cmd-ha-01",
        householdId: "h1",
        deviceId: targetDev.id,
        action: "turn_off",
        parameters: {},
        status: "SENT",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      },
      targetDev
    );

    expect(receivedServiceCall).not.toBeNull();
    expect(receivedServiceCall?.url).toBe("/api/services/light/turn_off");
    expect(receivedServiceCall?.body.entity_id).toBe("light.living_room");
  });

  it("rejects unauthorized services or invalid domains", async () => {
    const targetDev = adapter.getDiscoveredDevices().find((d) => d.externalId === "light.living_room")!;

    await expect(
      adapter.executeCommand(
        {
          commandId: "cmd-ha-hack",
          householdId: "h1",
          deviceId: targetDev.id,
          action: "shell_command_run_exploit",
          parameters: {},
          status: "SENT",
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10000).toISOString(),
        },
        targetDev
      )
    ).rejects.toThrow("Unauthorized or unsupported Home Assistant service");
  });
});
