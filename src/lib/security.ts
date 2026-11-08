/**
 * Motor e Gerenciador de Segurança e Alarme Perimetral
 * Casa Inteligente AI — HomePulse
 */

import { supabase } from "@/integrations/supabase/client";
import { Device, Room, stateOf } from "@/lib/queries";
import {
  AlarmMode,
  SecuritySystemState,
  SecurityAlert,
  SecurityZone,
} from "@/types/security";

const SECURITY_STORAGE_PREFIX = "homepulse_security_v1_";

export function getDefaultSecurityState(householdId: string): SecuritySystemState {
  const now = new Date().toISOString();
  return {
    householdId,
    mode: "disarmed",
    pinRequired: true,
    pinCode: "1234",
    lastChangedAt: now,
    changedBy: "Sistema",
    exitDelaySeconds: 30,
    entryDelaySeconds: 30,
    alerts: [
      {
        id: "alert-init-1",
        householdId,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        severity: "info",
        title: "Perímetro Verificado",
        message: "Todas as fechaduras e sensores operando normalmente.",
        zoneName: "Geral",
        acknowledged: true,
      },
    ],
  };
}

export function getSecurityState(householdId: string): SecuritySystemState {
  if (typeof window === "undefined" || !householdId) {
    return getDefaultSecurityState("default");
  }
  try {
    const raw = localStorage.getItem(`${SECURITY_STORAGE_PREFIX}${householdId}`);
    if (!raw) {
      const def = getDefaultSecurityState(householdId);
      saveSecurityState(def);
      return def;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erro ao carregar estado de segurança:", e);
    return getDefaultSecurityState(householdId);
  }
}

export function saveSecurityState(state: SecuritySystemState): void {
  if (typeof window === "undefined" || !state.householdId) return;
  try {
    localStorage.setItem(
      `${SECURITY_STORAGE_PREFIX}${state.householdId}`,
      JSON.stringify(state)
    );
    window.dispatchEvent(
      new CustomEvent("homepulse:security-state-changed", { detail: state })
    );
  } catch (e) {
    console.error("Erro ao salvar estado de segurança:", e);
  }
}

export async function setAlarmMode(
  householdId: string,
  newMode: AlarmMode,
  userName?: string
): Promise<SecuritySystemState> {
  const current = getSecurityState(householdId);
  const now = new Date().toISOString();

  current.mode = newMode;
  current.lastChangedAt = now;
  current.changedBy = userName || "Morador";

  // Cria alerta de auditoria
  let alertTitle = "Alarme Desarmado";
  let alertMessage = "O sistema foi desarmado normalmente.";
  let severity: "info" | "warning" | "critical" = "info";

  if (newMode === "armed_home") {
    alertTitle = "Alarme Armado (Modo Casa)";
    alertMessage = "Sensores de portas e janelas ativos. Livre circulação interna.";
    severity = "info";
  } else if (newMode === "armed_away") {
    alertTitle = "Alarme Armado (Modo Ausente / Total)";
    alertMessage = "Todas as zonas internas e perimetrais estão ativas.";
    severity = "warning";
  } else if (newMode === "panic") {
    alertTitle = "🚨 ALERTA DE PÂNICO DISPARADO";
    alertMessage = "Sirenes acionadas e notificação de emergência enviada!";
    severity = "critical";
  }

  const newAlert: SecurityAlert = {
    id: `alert-${Date.now()}`,
    householdId,
    timestamp: now,
    severity,
    title: alertTitle,
    message: alertMessage,
    acknowledged: false,
  };

  current.alerts = [newAlert, ...current.alerts.slice(0, 25)];
  saveSecurityState(current);

  // Registra no audit log do Supabase
  try {
    await supabase.from("audit_logs").insert({
      household_id: householdId,
      action: `alarm_mode:${newMode}`,
      source: "security_panel",
      result: "success",
      details: {
        newMode,
        changedBy: current.changedBy,
      },
    });
  } catch (e) {
    console.warn("Falha ao registrar audit log de segurança:", e);
  }

  return current;
}

export function acknowledgeAlert(householdId: string, alertId: string): void {
  const current = getSecurityState(householdId);
  current.alerts = current.alerts.map((a) =>
    a.id === alertId ? { ...a, acknowledged: true } : a
  );
  saveSecurityState(current);
}

export function clearAlerts(householdId: string): void {
  const current = getSecurityState(householdId);
  current.alerts = [];
  saveSecurityState(current);
}

export function updateSecurityPin(householdId: string, newPin: string): boolean {
  if (!newPin || newPin.length < 4) return false;
  const current = getSecurityState(householdId);
  current.pinCode = newPin;
  saveSecurityState(current);
  return true;
}

/**
 * Mapeia os dispositivos cadastrados para zonas de segurança com status em tempo real
 */
export function buildSecurityZones(
  devices: Device[],
  rooms: Room[]
): SecurityZone[] {
  const zones: SecurityZone[] = [];

  for (const dev of devices) {
    const room = rooms.find((r) => r.id === dev.room_id);
    const roomName = room?.name || "Área Comum";
    const st = stateOf(dev);

    // Fechaduras
    if (dev.capabilities.includes("lock") || dev.category === "seguranca") {
      const isLocked = st.locked !== false;
      zones.push({
        id: `zone-${dev.id}`,
        deviceId: dev.id,
        name: dev.name,
        roomName,
        type: "lock",
        status: isLocked ? "secure" : "triggered",
        lastTriggeredAt: isLocked ? undefined : "Recentemente",
      });
      continue;
    }

    // Sensores de movimento / presença
    if (st.motion !== undefined || dev.device_type === "sensor_presenca") {
      const hasMotion = Boolean(st.motion);
      zones.push({
        id: `zone-${dev.id}`,
        deviceId: dev.id,
        name: dev.name,
        roomName,
        type: "motion",
        status: hasMotion ? "triggered" : "secure",
        lastTriggeredAt: hasMotion ? "Movimento agora" : undefined,
      });
      continue;
    }

    // Câmeras de segurança
    if (dev.device_type === "camera" || dev.category === "cftv") {
      zones.push({
        id: `zone-${dev.id}`,
        deviceId: dev.id,
        name: dev.name,
        roomName,
        type: "camera",
        status: dev.status === "online" ? "secure" : "offline",
      });
    }
  }

  // Se não houver sensores físicos cadastrados ainda, adiciona zonas virtuais inteligentes padrão
  if (zones.length === 0) {
    zones.push(
      {
        id: "zone-portao-principal",
        name: "Portão Social & Entrada",
        roomName: "Entrada Principal",
        type: "door",
        status: "secure",
      },
      {
        id: "zone-porta-sala",
        name: "Fechadura Biométrica Sala",
        roomName: "Sala de Estar",
        type: "lock",
        status: "secure",
      },
      {
        id: "zone-sensor-garagem",
        name: "Sensor de Presença Garagem",
        roomName: "Garagem",
        type: "motion",
        status: "secure",
      },
      {
        id: "zone-janela-cozinha",
        name: "Sensor Magnético Janela",
        roomName: "Cozinha",
        type: "window",
        status: "secure",
      },
      {
        id: "zone-cftv-perimetro",
        name: "Monitoramento CFTV 24/7",
        roomName: "Perímetro Externo",
        type: "camera",
        status: "secure",
      }
    );
  }

  return zones;
}
