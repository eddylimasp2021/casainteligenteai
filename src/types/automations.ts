/**
 * Tipos e Estruturas para Automações e Rotinas Domésticas com IA (AI Gateway)
 * Casa Inteligente AI — HomePulse
 */

export type AutomationTriggerType =
  | "time"
  | "sensor"
  | "camera_event"
  | "door_window"
  | "location"
  | "manual";

export interface AutomationTrigger {
  type: AutomationTriggerType;
  /** Horário no formato HH:mm (ex: "22:30", "07:00") */
  time?: string;
  /** Dias da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado). Vazio = todos os dias */
  daysOfWeek?: number[];
  /** ID do dispositivo sensor se o gatilho for baseado em evento */
  sensorDeviceId?: string;
  sensorDeviceName?: string;
  /** Tipo de evento do sensor */
  sensorCondition?:
    | "motion_detected"
    | "presence_detected"
    | "opened"
    | "closed"
    | "temp_above"
    | "temp_below";
  thresholdValue?: number;
  description: string;
}

export interface AutomationCondition {
  id: string;
  type: "time_range" | "days" | "presence" | "device_state" | "ambient";
  description: string;
  details?: Record<string, any>;
}

export type AutomationActionType =
  | "turn_on"
  | "turn_off"
  | "toggle"
  | "set_brightness"
  | "set_volume"
  | "set_temperature"
  | "lock"
  | "unlock"
  | "send_notification";

export interface AutomationAction {
  id: string;
  deviceId: string;
  deviceName: string;
  roomName?: string;
  actionType: AutomationActionType;
  params: {
    on?: boolean;
    locked?: boolean;
    brightness?: number;
    volume?: number;
    temperature?: number;
    message?: string;
    [key: string]: any;
  };
  delaySeconds?: number;
}

export type AutomationCategory =
  | "conforto"
  | "seguranca"
  | "energia"
  | "noturno"
  | "clima"
  | "geral";

export interface ConfigurableAutomation {
  id: string;
  householdId: string;
  name: string;
  description: string;
  category: AutomationCategory;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  /** Texto livre original que o morador digitou para gerar a rotina */
  createdFromPrompt?: string;
  /** Provedor ou modelo do AI Gateway que gerou esta rotina */
  modelUsed?: string;
  createdAt: string;
  updatedAt?: string;
  lastExecutedAt?: string;
  executionCount?: number;
}
