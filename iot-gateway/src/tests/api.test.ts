import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp, type GatewayApplication } from "../app.js";
import { loadConfig } from "../config/index.js";

describe("Gateway REST API Integration Tests", () => {
  let gateway: GatewayApplication;
  const testToken = "test-secret-gateway-token-12345";

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "9876",
      HOST: "127.0.0.1",
      GATEWAY_ID: "gw-test-01",
      GATEWAY_API_TOKEN: testToken,
      MQTT_URL: "mqtt://127.0.0.1:1883",
      LOG_LEVEL: "fatal",
    });

    gateway = await buildApp(config);
  });

  afterAll(async () => {
    await gateway.stop();
  });

  it("GET /health should return 200 without exposing secret keys", async () => {
    const res = await gateway.app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.gateway.id).toBe("gw-test-01");
    // Check that raw secret tokens are not present in config dump
    expect(body.config.GATEWAY_API_TOKEN).toBeUndefined();
    expect(body.config.MQTT_PASSWORD).toBeUndefined();
  });

  it("GET /api/v1/integrations should return 401 when Authorization header is missing", async () => {
    const res = await gateway.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
    });

    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations should return 403 when token is incorrect", async () => {
    const res = await gateway.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("GET /api/v1/integrations should return 200 with valid Bearer token", async () => {
    const res = await gateway.app.inject({
      method: "GET",
      url: "/api/v1/integrations",
      headers: {
        authorization: `Bearer ${testToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.integrations)).toBe(true);
    expect(body.integrations.length).toBeGreaterThan(0);
    // Should contain esp32, home_assistant, zigbee2mqtt, matter
    const types = body.integrations.map((i: { type: string }) => i.type);
    expect(types).toContain("esp32");
    expect(types).toContain("home_assistant");
    expect(types).toContain("zigbee2mqtt");
    expect(types).toContain("matter");
  });

  it("POST /api/v1/devices/:id/commands should reject invalid payload", async () => {
    const res = await gateway.app.inject({
      method: "POST",
      url: "/api/v1/devices/dev-1/commands",
      headers: {
        authorization: `Bearer ${testToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // missing householdId and action
        invalidField: 123,
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Invalid command parameters");
  });
});
