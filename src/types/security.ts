/**
 * Tipos para o Sistema de Segurança e Alarme Perimetral
 * Casa Inteligente AI — HomePulse
 */

export type AlarmMode = "disarmed" | "armed_home" | "armed_away" | "panic";

export type ZoneType = "door" | "window" | "motion" | "lock" | "camera";

export type ZoneStatus = "secure" | "triggered" | "bypassed" | "offline";

export interface SecurityZone {
  id: string;
  name: string;
  roomName: string;
  type: ZoneType;
  status: ZoneStatus;
  deviceId?: string;
  lastTriggeredAt?: string;
  isBypassed?: boolean;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface SecurityAlert {
  id: string;
  householdId: string;
  timestamp: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  zoneName?: string;
  acknowledged: boolean;
}

export interface SecuritySystemState {
  householdId: string;
  mode: AlarmMode;
  pinRequired: boolean;
  pinCode?: string;
  lastChangedAt: string;
  changedBy?: string;
  alerts: SecurityAlert[];
  exitDelaySeconds: number;
  entryDelaySeconds: number;
}
