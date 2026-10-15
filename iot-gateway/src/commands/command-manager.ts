import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Logger } from "../observability/logger.js";

export type CommandState =
  | "CREATED"
  | "AUTHORIZED"
  | "QUEUED"
  | "SENT"
  | "ACKNOWLEDGED"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "REJECTED"
  | "TIMED_OUT"
  | "CANCELLED";

export const CommandPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  commandId: z.string().uuid(),
  deviceId: z.string().min(1).max(128),
  householdId: z.string().min(1).max(128).optional(),
  action: z.string().min(1).max(64),
  parameters: z.record(z.string(), z.unknown()),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type CommandPayload = z.infer<typeof CommandPayloadSchema>;

export const CommandResultSchema = z.object({
  schemaVersion: z.literal(1),
  commandId: z.string().uuid(),
  deviceId: z.string().min(1).max(128),
  status: z.enum(["ACKNOWLEDGED", "SUCCEEDED", "FAILED", "REJECTED"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  reportedState: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type CommandResult = z.infer<typeof CommandResultSchema>;

export interface StoredCommand {
  commandId: string;
  householdId: string;
  deviceId: string;
  action: string;
  parameters: Record<string, unknown>;
  status: CommandState;
  issuedAt: string;
  expiresAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  resultPayload?: Record<string, unknown>;
}

export class CommandManager {
  private commands = new Map<string, StoredCommand>();
  private pendingResolvers = new Map<
    string,
    {
      resolve: (value: StoredCommand) => void;
      reject: (reason: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private logger: Logger) {}

  public createCommand(params: {
    householdId: string;
    deviceId: string;
    action: string;
    parameters: Record<string, unknown>;
    ttlMs?: number;
    commandId?: string;
  }): StoredCommand {
    const now = Date.now();
    const commandId = params.commandId ?? randomUUID();

    if (this.commands.has(commandId)) {
      throw new Error(`Command with ID ${commandId} already exists (deduplication protected).`);
    }

    const ttl = params.ttlMs ?? 30_000;
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttl).toISOString();

    // Validate payload against schema
    CommandPayloadSchema.parse({
      schemaVersion: 1,
      commandId,
      deviceId: params.deviceId,
      householdId: params.householdId,
      action: params.action,
      parameters: params.parameters,
      issuedAt,
      expiresAt,
    });

    const command: StoredCommand = {
      commandId,
      householdId: params.householdId,
      deviceId: params.deviceId,
      action: params.action,
      parameters: params.parameters,
      status: "CREATED",
      issuedAt,
      expiresAt,
    };

    this.commands.set(commandId, command);
    this.logger.debug({ commandId, deviceId: params.deviceId, action: params.action }, "Command created");
    return command;
  }

  public transition(commandId: string, toStatus: CommandState, details?: {
    errorCode?: string;
    errorMessage?: string;
    resultPayload?: Record<string, unknown>;
  }): StoredCommand {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      throw new Error(`Command ${commandId} not found.`);
    }

    const prev = cmd.status;
    cmd.status = toStatus;

    if (toStatus === "SENT") {
      cmd.sentAt = new Date().toISOString();
    } else if (toStatus === "ACKNOWLEDGED") {
      cmd.acknowledgedAt = new Date().toISOString();
    } else if (["SUCCEEDED", "FAILED", "EXPIRED", "REJECTED", "TIMED_OUT", "CANCELLED"].includes(toStatus)) {
      cmd.completedAt = new Date().toISOString();
      if (details?.errorCode) cmd.errorCode = details.errorCode;
      if (details?.errorMessage) cmd.errorMessage = details.errorMessage;
      if (details?.resultPayload) cmd.resultPayload = details.resultPayload;

      // Settle any waiting promise
      const waiter = this.pendingResolvers.get(commandId);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.pendingResolvers.delete(commandId);
        waiter.resolve(cmd);
      }
    }

    this.logger.info(
      { commandId, from: prev, to: toStatus, deviceId: cmd.deviceId },
      `Command transition: ${prev} -> ${toStatus}`
    );

    return cmd;
  }

  public isExpired(command: StoredCommand): boolean {
    return new Date(command.expiresAt).getTime() <= Date.now();
  }

  public getCommand(commandId: string): StoredCommand | undefined {
    return this.commands.get(commandId);
  }

  public listCommands(householdId?: string): StoredCommand[] {
    const list = Array.from(this.commands.values());
    if (!householdId) return list;
    return list.filter((c) => c.householdId === householdId);
  }

  /**
   * Waits for a command to finish (SUCCEEDED or failure status), with a safety timeout.
   */
  public waitForCompletion(commandId: string, timeoutMs = 15_000): Promise<StoredCommand> {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      return Promise.reject(new Error(`Command ${commandId} not found.`));
    }

    if (["SUCCEEDED", "FAILED", "EXPIRED", "REJECTED", "TIMED_OUT", "CANCELLED"].includes(cmd.status)) {
      return Promise.resolve(cmd);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolvers.delete(commandId);
        this.transition(commandId, "TIMED_OUT", {
          errorCode: "CMD_TIMEOUT",
          errorMessage: "Device did not report confirmation within the timeout period.",
        });
        const updated = this.commands.get(commandId)!;
        resolve(updated);
      }, timeoutMs);

      this.pendingResolvers.set(commandId, { resolve, reject, timer });
    });
  }

  /**
   * Handle incoming device result message
   */
  public handleDeviceResult(rawPayload: unknown): StoredCommand | null {
    const parsed = CommandResultSchema.safeParse(rawPayload);
    if (!parsed.success) {
      this.logger.warn({ error: parsed.error.format() }, "Invalid device result payload received");
      return null;
    }

    const { commandId, status, errorCode, errorMessage, reportedState } = parsed.data;
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      this.logger.warn({ commandId }, "Received result for unknown or purged command");
      return null;
    }

    if (status === "ACKNOWLEDGED") {
      return this.transition(commandId, "ACKNOWLEDGED");
    } else if (status === "SUCCEEDED") {
      return this.transition(commandId, "SUCCEEDED", { resultPayload: reportedState });
    } else if (status === "REJECTED") {
      return this.transition(commandId, "REJECTED", { errorCode, errorMessage });
    } else {
      return this.transition(commandId, "FAILED", { errorCode, errorMessage });
    }
  }

  /**
   * Clean up old commands (older than 1 hour) to keep memory bounded.
   */
  public cleanupOldCommands(maxAgeMs = 3600_000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, cmd] of this.commands.entries()) {
      if (new Date(cmd.issuedAt).getTime() < cutoff) {
        this.commands.delete(id);
      }
    }
  }
}
