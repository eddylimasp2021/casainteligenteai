import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mqtt, { type MqttClient } from "mqtt";
import { CasaMqttBroker, matchesMqttTopic } from "../broker/mqtt-broker.js";

const TEST_PORT = 18888;
const TEST_HOST = "127.0.0.1";

describe("CasaMqttBroker & MQTT ACL Verification", () => {
  let broker: CasaMqttBroker;

  beforeAll(async () => {
    broker = new CasaMqttBroker({
      port: TEST_PORT,
      host: TEST_HOST,
      allowAnonymous: false,
      users: [
        {
          username: "gateway-tester",
          password: "gateway-password-123",
          role: "gateway",
        },
        {
          username: "esp32-tester",
          password: "esp32-password-456",
          role: "esp32",
        },
      ],
    });

    await broker.start();
  });

  afterAll(async () => {
    await broker.stop();
  });

  describe("Topic Matching (matchesMqttTopic)", () => {
    it("matches exact topics", () => {
      expect(matchesMqttTopic("ci/v1/house/device/command", "ci/v1/house/device/command")).toBe(true);
      expect(matchesMqttTopic("ci/v1/house/device/command", "ci/v1/house/device/state")).toBe(false);
    });

    it("matches single-level wildcard (+)", () => {
      expect(matchesMqttTopic("ci/v1/+/+/command", "ci/v1/house-1/device-2/command")).toBe(true);
      expect(matchesMqttTopic("ci/v1/+/+/command", "ci/v1/house-1/device-2/state")).toBe(false);
      expect(matchesMqttTopic("ci/v1/+/+/command", "ci/v1/house-1/device-2/sub/command")).toBe(false);
    });

    it("matches multi-level wildcard (#)", () => {
      expect(matchesMqttTopic("ci/v1/#", "ci/v1/house-1/device-2/state")).toBe(true);
      expect(matchesMqttTopic("ci/v1/#", "ci/v1/a/b/c/d/e")).toBe(true);
      expect(matchesMqttTopic("ci/v1/#", "other/v1/house-1")).toBe(false);
    });
  });

  describe("Authentication", () => {
    it("rejects connection without username", async () => {
      await new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
          reconnectPeriod: 0,
          connectTimeout: 2000,
        });

        client.on("error", (err) => {
          expect(err.message).toContain("Connection refused");
          client.end(true);
          resolve();
        });

        client.on("connect", () => {
          client.end(true);
          reject(new Error("Should not have connected without username"));
        });
      });
    });

    it("rejects connection with invalid password", async () => {
      await new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
          username: "gateway-tester",
          password: "wrong-password",
          reconnectPeriod: 0,
          connectTimeout: 2000,
        });

        client.on("error", (err) => {
          expect(err.message).toContain("Connection refused");
          client.end(true);
          resolve();
        });

        client.on("connect", () => {
          client.end(true);
          reject(new Error("Should not have connected with wrong password"));
        });
      });
    });

    it("successfully connects with valid credentials", async () => {
      await new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
          username: "gateway-tester",
          password: "gateway-password-123",
          reconnectPeriod: 0,
        });

        client.on("connect", () => {
          expect(client.connected).toBe(true);
          client.end(true);
          resolve();
        });

        client.on("error", (err) => {
          client.end(true);
          reject(err);
        });
      });
    });
  });

  describe("End-to-End Gateway & ESP32 Communication with ACLs", () => {
    let gatewayClient: MqttClient;
    let esp32Client: MqttClient;

    beforeAll(async () => {
      gatewayClient = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
        username: "gateway-tester",
        password: "gateway-password-123",
      });

      esp32Client = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
        username: "esp32-tester",
        password: "esp32-password-456",
      });

      await Promise.all([
        new Promise<void>((resolve) => gatewayClient.once("connect", () => resolve())),
        new Promise<void>((resolve) => esp32Client.once("connect", () => resolve())),
      ]);
    });

    afterAll(async () => {
      gatewayClient.end(true);
      esp32Client.end(true);
    });

    it("allows ESP32 to subscribe to command and Gateway to publish command", async () => {
      const commandTopic = "ci/v1/house-alpha/device-beta/command";
      const commandPayload = JSON.stringify({ action: "turn_on", commandId: "cmd-123" });

      // ESP32 subscribes to command
      await new Promise<void>((resolve, reject) => {
        esp32Client.subscribe(commandTopic, { qos: 1 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Gateway publishes command and ESP32 receives it
      const received = await new Promise<string>((resolve) => {
        esp32Client.once("message", (topic, message) => {
          if (topic === commandTopic) {
            resolve(message.toString());
          }
        });

        gatewayClient.publish(commandTopic, commandPayload, { qos: 1 });
      });

      expect(JSON.parse(received)).toEqual({ action: "turn_on", commandId: "cmd-123" });
    });

    it("allows ESP32 to publish state and Gateway to receive state", async () => {
      const stateTopic = "ci/v1/house-alpha/device-beta/state";
      const statePayload = JSON.stringify({ schemaVersion: 1, deviceId: "device-beta", reported: { power: "on" }, timestamp: new Date().toISOString() });

      // Gateway subscribes to all CI states
      await new Promise<void>((resolve, reject) => {
        gatewayClient.subscribe("ci/v1/+/+/state", { qos: 1 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // ESP32 publishes its updated state
      const received = await new Promise<string>((resolve) => {
        gatewayClient.once("message", (topic, message) => {
          if (topic === stateTopic) {
            resolve(message.toString());
          }
        });

        esp32Client.publish(stateTopic, statePayload, { qos: 1 });
      });

      expect(JSON.parse(received).reported).toEqual({ power: "on" });
    });

    it("enforces ACL: denies ESP32 from subscribing to unauthorized topics", async () => {
      const forbiddenTopic = "zigbee2mqtt/#";

      const err = await new Promise<Error | null>((resolve) => {
        esp32Client.subscribe(forbiddenTopic, (e) => {
          resolve(e ?? null);
        });
      });

      expect(err).not.toBeNull();
    });
  });
});
