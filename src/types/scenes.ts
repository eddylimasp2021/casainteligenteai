/**
 * Tipos para Cenas (Scenes) — Casa Inteligente AI (HomePulse AI)
 */

export type SceneIconName =
  | "film"
  | "moon"
  | "sun"
  | "home"
  | "log-out"
  | "party-popper"
  | "coffee"
  | "briefcase"
  | "sparkles"
  | "heart"
  | "shield"
  | "zap";

export type SceneColorTheme =
  | "amber"
  | "indigo"
  | "rose"
  | "cyan"
  | "emerald"
  | "purple"
  | "orange"
  | "blue";

export interface SceneAction {
  id: string;
  deviceId: string;
  deviceName: string;
  roomName?: string;
  actionType:
    | "turn_on"
    | "turn_off"
    | "set_brightness"
    | "set_temperature"
    | "set_volume"
    | "lock"
    | "unlock";
  params: {
    on?: boolean;
    locked?: boolean;
    brightness?: number;
    temperature?: number;
    volume?: number;
    [key: string]: any;
  };
}

export interface Scene {
  id: string;
  householdId: string;
  name: string;
  description: string;
  icon: SceneIconName;
  color: SceneColorTheme;
  actions: SceneAction[];
  isFavorite: boolean;
  lastActivatedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SceneExecutionResult {
  sceneId: string;
  sceneName: string;
  success: boolean;
  executedCount: number;
  failedCount: number;
  logs: string[];
}
