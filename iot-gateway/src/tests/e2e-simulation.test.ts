import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mqtt, { type MqttClient } from "mqtt";
import { CasaMqttBroker } from "../broker/mqtt-broker.js";
import { MqttTransport } from "../mqtt/client.js";
import { CommandManager } from "../commands/command-manager.js";
import { GatewayEventBus } from "../events/event-bus.js";
import { createLogger } from "../observability/logger.js";
import { loadConfig } from "../config/index.js";

const TEST_PORT = 18889;
const TEST_HOST = "127.0.0.1";

describe("End-to-End Real IoT Pipeline Simulation (Cloud -> Gateway -> MQTT -> ESP32 -> State ACK)", () => {
  let broker: CasaMqttBroker;
  let transport: MqttTransport;
  let commandManager: CommandManager;
  let eventBus: GatewayEventBus;
  let simulatedEsp32: MqttClient;

  const householdId = "11111111-2222-3333-4444-555555555555";
  const deviceId = "ci-esp32-living-room";

  beforeAll(async () => {
    // 1. Start MQTT Broker
    broker = new CasaMqttBroker({
      port: TEST_PORT,
      host: TEST_HOST,
      allowAnonymous: false,
      users: [
        { username: "casa-gateway-user", password: "casa-gateway-pass-secure", role: "gateway" },
        { username: "esp32_client", password: "esp32-secret-key-2026", role: "esp32" },
      ],
    });
    await broker.start();

    // 2. Setup Gateway transport & command manager
    const config = loadConfig({
      NODE_ENV: "test",
      MQTT_URL: `mqtt://${TEST_HOST}:${TEST_PORT}`,
      MQTT_USERNAME: "casa-gateway-user",
      MQTT_PASSWORD: "casa-gateway-pass-secure",
      GATEWAY_ID: "gw-test-e2e",
      LOG_LEVEL: "fatal",
    });

    const logger = createLogger(config);
    eventBus = new GatewayEventBus();
    commandManager = new CommandManager(logger);
    transport = new MqttTransport(config, logger, commandManager, eventBus);

    await transport.connect();

    // 3. Connect Simulated Physical ESP32 Device
    simulatedEsp32 = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
      username: "esp32_client",
      password: "esp32-secret-key-2026",
    });

    await new Promise<void>((resolve) => simulatedEsp32.once("connect", () => resolve()));
  });

  afterAll(async () => {
    simulatedEsp32.end(true);
    await transport.close();
    await broker.stop();
  });

  it("completes full closed-loop command lifecycle with physical confirmation", async () => {
    const commandTopic = `ci/v1/${householdId}/${deviceId}/command`;
    const resultTopic = `ci/v1/${householdId}/${deviceId}/result`;
    const stateTopic = `ci/v1/${householdId}/${deviceId}/state`;

    // 1. ESP32 subscribes to incoming commands
    await new Promise<void>((resolve, reject) => {
      simulatedEsp32.subscribe(commandTopic, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Simulated ESP32 firmware loop: listen for command, execute relay toggle, send ACK and State
    simulatedEsp32.on("message", (topic, payload) => {
      if (topic === commandTopic) {
        const cmd = JSON.parse(payload.toString());

        // Simulate physical relay actuation (10ms)
        setTimeout(() => {
          // Send Command Execution Result ACK
          simulatedEsp32.publish(
            resultTopic,
            JSON.stringify({
              schemaVersion: 1,
              commandId: cmd.commandId,
              deviceId,
              status: "SUCCEEDED",
              executionDurationMs: 12,
              reportedState: { power: "on" },
              timestamp: new Date().toISOString(),
            }),
            { qos: 1 }
          );

          // Send Confirmed Physical Device State
          simulatedEsp32.publish(
            stateTopic,
            JSON.stringify({
              schemaVersion: 1,
              deviceId,
              reported: { power: "on", relay1: true },
              timestamp: new Date().toISOString(),
            }),
            { qos: 1 }
          );
        }, 10);
      }
    });

    // 3. Cloud / Dashboard issues a command
    const storedCmd = commandManager.createCommand({
      householdId,
      deviceId,
      action: "turn_on",
      parameters: { power: "on" },
      ttlSeconds: 10,
    });

    expect(storedCmd.status).toBe("CREATED");

    // 4. Listen for EventBus confirmed state
    const confirmedStatePromise = new Promise<{ power: string; relay1: boolean }>((resolve) => {
      eventBus.onDeviceState((evt) => {
        if (evt.deviceId === deviceId) {
          resolve(evt.reported as { power: string; relay1: boolean });
        }
      });
    });

    // 5. Gateway dispatches command over MQTT
    await transport.publishCommand(storedCmd);
    expect(commandManager.getCommand(storedCmd.commandId)?.status).toBe("SENT");

    // 6. Await physical device confirmation via event bus and command manager
    const [confirmedState, finalizedCmd] = await Promise.all([
      confirmedStatePromise,
      commandManager.waitForCompletion(storedCmd.commandId),
    ]);

    expect(confirmedState.power).toBe("on");
    expect(confirmedState.relay1).toBe(true);

    // 7. Verify CommandManager finalized state is SUCCEEDED (no mock, real ACK packet received)
    expect(finalizedCmd.status).toBe("SUCCEEDED");
    expect(finalizedCmd.resultPayload).toEqual({ power: "on" });
  });
});
