import { describe, it, expect, beforeEach } from "vitest";
import pino from "pino";
import { CommandManager } from "../commands/command-manager.js";

describe("CommandManager State Machine & Deduplication", () => {
  let commandManager: CommandManager;
  const logger = pino({ level: "silent" });

  beforeEach(() => {
    commandManager = new CommandManager(logger);
  });

  it("should create a command with valid UUID and CREATED status", () => {
    const cmd = commandManager.createCommand({
      householdId: "house-1",
      deviceId: "esp32-relay-1",
      action: "set_power",
      parameters: { value: true },
      ttlMs: 5000,
    });

    expect(cmd.commandId).toBeDefined();
    expect(cmd.status).toBe("CREATED");
    expect(cmd.householdId).toBe("house-1");
    expect(cmd.action).toBe("set_power");
    expect(cmd.parameters).toEqual({ value: true });
  });

  it("should prevent duplicate commandIds (replay attack prevention)", () => {
    const customId = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    commandManager.createCommand({
      householdId: "house-1",
      deviceId: "esp32-relay-1",
      action: "set_power",
      parameters: { value: true },
      commandId: customId,
    });

    expect(() =>
      commandManager.createCommand({
        householdId: "house-1",
        deviceId: "esp32-relay-1",
        action: "set_power",
        parameters: { value: true },
        commandId: customId,
      })
    ).toThrow(/already exists/);
  });

  it("should transition through state machine correctly", () => {
    const cmd = commandManager.createCommand({
      householdId: "house-1",
      deviceId: "esp32-relay-1",
      action: "set_power",
      parameters: { value: true },
    });

    commandManager.transition(cmd.commandId, "AUTHORIZED");
    expect(commandManager.getCommand(cmd.commandId)?.status).toBe("AUTHORIZED");

    commandManager.transition(cmd.commandId, "QUEUED");
    expect(commandManager.getCommand(cmd.commandId)?.status).toBe("QUEUED");

    commandManager.transition(cmd.commandId, "SENT");
    const sent = commandManager.getCommand(cmd.commandId);
    expect(sent?.status).toBe("SENT");
    expect(sent?.sentAt).toBeDefined();

    commandManager.transition(cmd.commandId, "ACKNOWLEDGED");
    expect(commandManager.getCommand(cmd.commandId)?.status).toBe("ACKNOWLEDGED");

    commandManager.transition(cmd.commandId, "SUCCEEDED", {
      resultPayload: { power: true },
    });
    const finished = commandManager.getCommand(cmd.commandId);
    expect(finished?.status).toBe("SUCCEEDED");
    expect(finished?.completedAt).toBeDefined();
    expect(finished?.resultPayload).toEqual({ power: true });
  });

  it("should handle device result payload correctly", () => {
    const cmd = commandManager.createCommand({
      householdId: "house-1",
      deviceId: "esp32-relay-1",
      action: "set_power",
      parameters: { value: true },
    });

    const result = commandManager.handleDeviceResult({
      schemaVersion: 1,
      commandId: cmd.commandId,
      deviceId: "esp32-relay-1",
      status: "SUCCEEDED",
      reportedState: { on: true, power: 120 },
      timestamp: new Date().toISOString(),
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe("SUCCEEDED");
    expect(result?.resultPayload).toEqual({ on: true, power: 120 });
  });

  it("should correctly identify expired commands", () => {
    const cmd = commandManager.createCommand({
      householdId: "house-1",
      deviceId: "esp32-relay-1",
      action: "set_power",
      parameters: { value: true },
      ttlMs: -1000, // already expired
    });

    expect(commandManager.isExpired(cmd)).toBe(true);
  });

  it("should timeout when waiting for device that never answers", async () => {
    const cmd = commandManager.createCommand({
      householdId: "house-1",
      deviceId: "silent-device",
      action: "set_power",
      parameters: { value: true },
    });

    const res = await commandManager.waitForCompletion(cmd.commandId, 50); // 50ms timeout
    expect(res.status).toBe("TIMED_OUT");
    expect(res.errorCode).toBe("CMD_TIMEOUT");
  });
});
