/**
 * Gerenciador e Motor de Execução de Cenas (Scenes)
 * Casa Inteligente AI — HomePulse
 */

import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/lib/queries";
import { Scene, SceneExecutionResult, SceneIconName, SceneColorTheme } from "@/types/scenes";
import { LG_COMMANDS } from "@/lib/smart-tv";

const SCENES_STORAGE_PREFIX = "homepulse_scenes_v1_";

export function getDefaultScenes(householdId: string): Scene[] {
  const now = new Date().toISOString();
  return [
    {
      id: "scene-cinema",
      householdId,
      name: "Modo Cinema",
      description: "Iluminação reduzida, TV ligada e clima agradável para assistir filmes.",
      icon: "film",
      color: "purple",
      isFavorite: true,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-sleep",
      householdId,
      name: "Hora de Dormir",
      description: "Desliga todas as luzes e telas, tranca portas e ajusta o clima para descanso.",
      icon: "moon",
      color: "indigo",
      isFavorite: true,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-good-morning",
      householdId,
      name: "Bom Dia",
      description: "Abre cortinas, acende luzes suaves da cozinha e inicia o dia.",
      icon: "sun",
      color: "amber",
      isFavorite: true,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-leaving",
      householdId,
      name: "Saindo de Casa",
      description: "Desliga aparelhos, tranca fechaduras e ativa monitoramento de presença.",
      icon: "log-out",
      color: "rose",
      isFavorite: true,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-arriving",
      householdId,
      name: "Chegando em Casa",
      description: "Luzes de recepção acesas, portas destrancadas e temperatura confortável.",
      icon: "home",
      color: "emerald",
      isFavorite: true,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-focus",
      householdId,
      name: "Modo Foco / Trabalho",
      description: "Iluminação neutra e alta, ambiente climatizado e sem distrações.",
      icon: "briefcase",
      color: "blue",
      isFavorite: false,
      actions: [],
      createdAt: now,
    },
    {
      id: "scene-party",
      householdId,
      name: "Festa & Confraternização",
      description: "Iluminação colorida e vibrante com som ambiente nas áreas sociais.",
      icon: "party-popper",
      color: "orange",
      isFavorite: false,
      actions: [],
      createdAt: now,
    },
  ];
}

export function getStoredScenes(householdId: string): Scene[] {
  if (typeof window === "undefined" || !householdId) return [];
  try {
    const raw = localStorage.getItem(`${SCENES_STORAGE_PREFIX}${householdId}`);
    if (!raw) {
      const defaults = getDefaultScenes(householdId);
      saveStoredScenes(householdId, defaults);
      return defaults;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erro ao carregar cenas salvas:", e);
    return getDefaultScenes(householdId);
  }
}

export function saveStoredScenes(householdId: string, scenes: Scene[]): void {
  if (typeof window === "undefined" || !householdId) return;
  try {
    localStorage.setItem(`${SCENES_STORAGE_PREFIX}${householdId}`, JSON.stringify(scenes));
    window.dispatchEvent(
      new CustomEvent("homepulse:scenes-updated", { detail: { householdId, scenes } })
    );
  } catch (e) {
    console.error("Erro ao salvar cenas:", e);
  }
}

export function saveSingleScene(householdId: string, scene: Scene): void {
  const current = getStoredScenes(householdId);
  const index = current.findIndex((s) => s.id === scene.id);
  let updated: Scene[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...scene, updatedAt: new Date().toISOString() };
  } else {
    updated = [scene, ...current];
  }
  saveStoredScenes(householdId, updated);
}

export function deleteStoredScene(householdId: string, id: string): void {
  const current = getStoredScenes(householdId);
  const filtered = current.filter((s) => s.id !== id);
  saveStoredScenes(householdId, filtered);
}

export function toggleSceneFavorite(householdId: string, id: string): boolean {
  const current = getStoredScenes(householdId);
  const item = current.find((s) => s.id === id);
  if (!item) return false;
  item.isFavorite = !item.isFavorite;
  saveStoredScenes(householdId, current);
  return item.isFavorite;
}

/**
 * Ativa uma cena disparando todas as ações contra os dispositivos reais
 */
export async function activateScene(
  scene: Scene,
  devicesList: Device[]
): Promise<SceneExecutionResult> {
  let executedCount = 0;
  let failedCount = 0;
  const logs: string[] = [];

  // Se a cena não tiver ações customizadas salvas, executa uma lógica inteligente padrão baseada no tipo de cena
  if (!scene.actions || scene.actions.length === 0) {
    // Ação padrão inteligente baseada no nome/tipo da cena
    for (const dev of devicesList) {
      try {
        const patchState: Record<string, any> = {};
        const isTv =
          dev.category === "entretenimento" ||
          dev.device_type === "televisao" ||
          (dev.model && dev.model.includes("70LB7200"));
        const tvIp = dev.ip_address || "192.168.0.168";

        if (scene.id === "scene-sleep" || scene.id === "scene-leaving") {
          // Desliga luzes, tomadas e entretenimento, tranca fechaduras
          if (dev.category === "iluminacao" || dev.category === "energia") {
            patchState.on = false;
          } else if (dev.category === "seguranca" && dev.capabilities.includes("lock")) {
            patchState.locked = true;
          } else if (isTv) {
            patchState.on = false;
            try {
              await LG_COMMANDS.powerOff(tvIp);
            } catch {}
          }
        } else if (scene.id === "scene-cinema") {
          if (dev.category === "iluminacao") {
            patchState.on = true;
            if (dev.capabilities.includes("brightness")) patchState.brightness = 20;
          } else if (isTv) {
            patchState.on = true;
          } else if (dev.category === "climatizacao" && dev.capabilities.includes("temperature")) {
            patchState.on = true;
            patchState.temperature = 22;
          }
        } else if (scene.id === "scene-good-morning" || scene.id === "scene-arriving") {
          if (dev.category === "iluminacao") {
            patchState.on = true;
            if (dev.capabilities.includes("brightness")) patchState.brightness = 75;
          } else if (dev.category === "seguranca" && dev.capabilities.includes("lock")) {
            patchState.locked = false;
          } else if (dev.category === "climatizacao") {
            patchState.on = true;
            patchState.temperature = 23;
          }
        } else if (scene.id === "scene-focus") {
          if (dev.category === "iluminacao") {
            patchState.on = true;
            if (dev.capabilities.includes("brightness")) patchState.brightness = 100;
          } else if (dev.category === "climatizacao") {
            patchState.on = true;
            patchState.temperature = 22;
          }
        } else if (scene.id === "scene-party") {
          if (dev.category === "iluminacao") {
            patchState.on = true;
            if (dev.capabilities.includes("brightness")) patchState.brightness = 85;
          }
        }

        if (Object.keys(patchState).length > 0) {
          const { error } = await supabase.rpc("set_device_state", {
            _device: dev.id,
            _patch: patchState as never,
            _confirmed: true,
          });

          if (error) {
            failedCount++;
            logs.push(`Falha em "${dev.name}": ${error.message}`);
          } else {
            executedCount++;
            logs.push(`✓ "${dev.name}" ajustado para cena ${scene.name}`);
          }
        }
      } catch (err: any) {
        failedCount++;
        logs.push(`Erro em "${dev.name}": ${err?.message || "Exceção"}`);
      }
    }
  } else {
    // Executa as ações explicitamente configuradas
    for (const action of scene.actions) {
      try {
        const dev = devicesList.find((d) => d.id === action.deviceId);
        const patchState: Record<string, any> = {};

        if (typeof action.params.on === "boolean") patchState.on = action.params.on;
        if (typeof action.params.locked === "boolean") patchState.locked = action.params.locked;
        if (typeof action.params.brightness === "number") patchState.brightness = action.params.brightness;
        if (typeof action.params.temperature === "number") patchState.temperature = action.params.temperature;
        if (typeof action.params.volume === "number") patchState.volume = action.params.volume;

        const { error } = await supabase.rpc("set_device_state", {
          _device: action.deviceId,
          _patch: patchState as never,
          _confirmed: true,
        });

        const isTv =
          dev?.category === "entretenimento" ||
          dev?.device_type === "televisao" ||
          (dev?.model && dev.model.includes("70LB7200"));
        const tvIp = dev?.ip_address || "192.168.0.168";

        if (isTv) {
          try {
            if (action.params.on === false) {
              await LG_COMMANDS.powerOff(tvIp);
            } else if (typeof action.params.volume === "number") {
              await LG_COMMANDS.setVolume(tvIp, action.params.volume);
            }
          } catch {}
        }

        if (error) {
          failedCount++;
          logs.push(`Falha em "${action.deviceName}": ${error.message}`);
        } else {
          executedCount++;
          logs.push(`✓ "${action.deviceName}" atualizado (${action.actionType})`);
        }
      } catch (err: any) {
        failedCount++;
        logs.push(`Erro em "${action.deviceName}": ${err?.message || "Exceção"}`);
      }
    }
  }

  // Atualiza última ativação
  const now = new Date().toISOString();
  scene.lastActivatedAt = now;
  saveSingleScene(scene.householdId, scene);

  // Registra no histórico de auditoria
  try {
    await supabase.from("audit_logs").insert({
      household_id: scene.householdId,
      action: `scene_activated:${scene.id}`,
      source: "scenes_engine",
      result: failedCount === 0 ? "success" : executedCount > 0 ? "partial" : "error",
      details: {
        scene_name: scene.name,
        executedCount,
        failedCount,
        logs,
      },
    });
  } catch (e) {
    console.warn("Falha ao registrar audit log de cena:", e);
  }

  // Dispara evento para interface reagir
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("homepulse:scene-activated", {
        detail: { sceneId: scene.id, sceneName: scene.name, timestamp: now },
      })
    );
  }

  return {
    sceneId: scene.id,
    sceneName: scene.name,
    success: failedCount === 0,
    executedCount,
    failedCount,
    logs,
  };
}
