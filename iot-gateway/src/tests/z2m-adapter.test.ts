import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mqtt, { type MqttClient } from "mqtt";
import { CasaMqttBroker } from "../broker/mqtt-broker.js";
import { MqttTransport } from "../mqtt/client.js";
import { Zigbee2MqttAdapter } from "../adapters/zigbee2mqtt/z2m-adapter.js";
import { CommandManager } from "../commands/command-manager.js";
import { GatewayEventBus } from "../events/event-bus.js";
import { createLogger } from "../observability/logger.js";
import { loadConfig } from "../config/index.js";
import type { UnifiedDevice } from "../devices/unified-model.js";

const TEST_PORT = 18890;
const TEST_HOST = "127.0.0.1";

describe("Zigbee2MQTT Adapter Integration Tests", () => {
  let broker: CasaMqttBroker;
  let transport: MqttTransport;
  let z2mAdapter: Zigbee2MqttAdapter;
  let eventBus: GatewayEventBus;
  let simulatedZ2mClient: MqttClient;

  beforeAll(async () => {
    // 1. Broker
    broker = new CasaMqttBroker({
      port: TEST_PORT,
      host: TEST_HOST,
      allowAnonymous: false,
      users: [
        { username: "casa-gateway-user", password: "casa-gateway-pass-secure", role: "gateway" },
        { username: "zigbee2mqtt_user", password: "z2m-secret-key-2026", role: "z2m" },
      ],
    });
    await broker.start();

    // 2. Gateway MqttTransport
    const config = loadConfig({
      NODE_ENV: "test",
      MQTT_URL: `mqtt://${TEST_HOST}:${TEST_PORT}`,
      MQTT_USERNAME: "casa-gateway-user",
      MQTT_PASSWORD: "casa-gateway-pass-secure",
      ZIGBEE2MQTT_BASE_TOPIC: "zigbee2mqtt",
      LOG_LEVEL: "fatal",
    });

    const logger = createLogger(config);
    eventBus = new GatewayEventBus();
    const commandManager = new CommandManager(logger);
    transport = new MqttTransport(config, logger, commandManager, eventBus);
    await transport.connect();

    // 3. Adapter
    z2mAdapter = new Zigbee2MqttAdapter(config, logger, transport, eventBus);
    await z2mAdapter.initialize();

    // 4. Simulated Zigbee2MQTT Daemon Client
    simulatedZ2mClient = mqtt.connect(`mqtt://${TEST_HOST}:${TEST_PORT}`, {
      username: "zigbee2mqtt_user",
      password: "z2m-secret-key-2026",
    });
    await new Promise<void>((res) => simulatedZ2mClient.once("connect", () => res()));
  });

  afterAll(async () => {
    simulatedZ2mClient.end(true);
    await z2mAdapter.close();
    await transport.close();
    await broker.stop();
  });

  it("discovers Zigbee devices from bridge/devices payload", async () => {
    const discoveredDevices: UnifiedDevice[] = [];
    eventBus.onDeviceDiscovered((d) => discoveredDevices.push(d));

    // Simulate Zigbee2MQTT publishing devices list
    const bridgeDevicesPayload = [
      {
        ieee_address: "0x00158d0001d2a45b",
        friendly_name: "lampada_sala",
        type: "Router",
        definition: {
          vendor: "Philips",
          model: "Hue White",
          exposes: [{ type: "light" }, { name: "brightness" }],
        },
      },
      {
        ieee_address: "0x00158d0001e3b56c",
        friendly_name: "sensor_porta",
        type: "EndDevice",
        definition: {
          vendor: "Aqara",
          model: "Door Sensor",
          exposes: [{ name: "contact" }, { name: "battery" }],
        },
      },
    ];

    simulatedZ2mClient.publish(
      "zigbee2mqtt/bridge/devices",
      JSON.stringify(bridgeDevicesPayload),
      { qos: 1 }
    );

    // Give 50ms for MQTT packet routing
    await new Promise((r) => setTimeout(r, 60));

    const devices = z2mAdapter.getDiscoveredDevices();
    expect(devices.length).toBe(2);

    const lamp = devices.find((d) => d.externalId === "lampada_sala");
    expect(lamp).toBeDefined();
    expect(lamp?.name).toContain("Philips");
    expect(lamp?.capabilities.some((c) => c.id === "brightness")).toBe(true);

    const sensor = devices.find((d) => d.externalId === "sensor_porta");
    expect(sensor).toBeDefined();
    expect(sensor?.capabilities.some((c) => c.id === "contact")).toBe(true);
  });

  it("updates state and battery from device telemetry and broadcasts via EventBus", async () => {
    const statePromise = new Promise<any>((resolve) => {
      eventBus.onDeviceState((evt) => {
        if (evt.deviceId === "zigbee_lampada_sala") {
          resolve(evt.reported);
        }
      });
    });

    // Simulate device reporting state
    simulatedZ2mClient.publish(
      "zigbee2mqtt/lampada_sala",
      JSON.stringify({ state: "ON", brightness: 180, linkquality: 75, battery: 92 }),
      { qos: 1 }
    );

    const reported = await statePromise;
    expect(reported.state).toBe("ON");
    expect(reported.brightness).toBe(180);

    const lamp = z2mAdapter.getDiscoveredDevices().find((d) => d.externalId === "lampada_sala");
    expect(lamp?.batteryLevel).toBe(92);
    expect(lamp?.signalQuality).toBe(75);
  });

  it("executes command by publishing to zigbee2mqtt/<device>/set", async () => {
    const lamp = z2mAdapter.getDiscoveredDevices().find((d) => d.externalId === "lampada_sala")!;

    // Simulated Z2M listens on set topic
    const setPromise = new Promise<string>((resolve) => {
      simulatedZ2mClient.subscribe("zigbee2mqtt/lampada_sala/set", { qos: 1 }, () => {
        simulatedZ2mClient.once("message", (t, msg) => {
          if (t === "zigbee2mqtt/lampada_sala/set") {
            resolve(msg.toString());
          }
        });
      });
    });

    await z2mAdapter.executeCommand(
      {
        commandId: "cmd-z2m-01",
        householdId: "z2m",
        deviceId: lamp.id,
        action: "turn_off",
        parameters: {},
        status: "SENT",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      },
      lamp
    );

    const setPayload = await setPromise;
    expect(JSON.parse(setPayload)).toEqual({ state: "OFF" });
  });
});
