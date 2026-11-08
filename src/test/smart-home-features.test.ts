import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDefaultScenes,
  getStoredScenes,
  saveSingleScene,
  toggleSceneFavorite,
} from "@/lib/scenes";
import {
  getDefaultSecurityState,
  getSecurityState,
  setAlarmMode,
  buildSecurityZones,
  acknowledgeAlert,
} from "@/lib/security";
import { calculateEnergyOverview } from "@/lib/energy";
import { Device, Room } from "@/lib/queries";

describe("Fase 2: Motor de Cenas Inteligentes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("deve carregar cenas predefinidas quando o armazenamento estiver vazio", () => {
    const scenes = getDefaultScenes("hh-123");
    expect(scenes.length).toBeGreaterThanOrEqual(6);

    const cinema = scenes.find((s) => s.id === "scene-cinema");
    expect(cinema).toBeDefined();
    expect(cinema?.name).toBe("Modo Cinema");
    expect(cinema?.isFavorite).toBe(true);

    const sleep = scenes.find((s) => s.id === "scene-sleep");
    expect(sleep).toBeDefined();
    expect(sleep?.name).toBe("Hora de Dormir");
  });

  it("deve alternar status de favorita em uma cena", () => {
    const scenes = getStoredScenes("hh-123");
    const target = scenes[0];
    const initialFav = target.isFavorite;

    const newFav = toggleSceneFavorite("hh-123", target.id);
    expect(newFav).toBe(!initialFav);

    const updated = getStoredScenes("hh-123");
    expect(updated[0].isFavorite).toBe(!initialFav);
  });

  it("deve salvar e atualizar uma nova cena personalizada", () => {
    const customScene = {
      id: "scene-custom-test",
      householdId: "hh-123",
      name: "Jantar Especial",
      description: "Luz baixa e som suave",
      icon: "heart" as const,
      color: "rose" as const,
      actions: [],
      isFavorite: true,
      createdAt: new Date().toISOString(),
    };

    saveSingleScene("hh-123", customScene);
    const scenes = getStoredScenes("hh-123");
    const found = scenes.find((s) => s.id === "scene-custom-test");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Jantar Especial");
  });
});

describe("Fase 4: Sistema de Segurança e Alarme Perimetral", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("deve iniciar com alarme desarmado e zonas seguras", () => {
    const state = getDefaultSecurityState("hh-sec");
    expect(state.mode).toBe("disarmed");
    expect(state.pinCode).toBe("1234");
  });

  it("deve alterar modos de alarme corretamente e registrar alerta", async () => {
    const armedState = await setAlarmMode("hh-sec", "armed_away", "Tester");
    expect(armedState.mode).toBe("armed_away");
    expect(armedState.changedBy).toBe("Tester");
    expect(armedState.alerts.length).toBeGreaterThan(0);
    expect(armedState.alerts[0].title).toContain("Modo Ausente");
  });

  it("deve mapear dispositivos para zonas de segurança", () => {
    const mockDevices: Device[] = [
      {
        id: "dev-lock-1",
        household_id: "hh-sec",
        name: "Fechadura Sala",
        category: "seguranca",
        device_type: "fechadura",
        capabilities: ["lock"],
        status: "online",
        state: { locked: true },
        room_id: "room-1",
        created_at: "",
        updated_at: "",
        metadata: {},
        power_source: "battery",
        battery_level: 90,
        firmware_version: "1.0",
        ip_address: "192.168.0.50",
        mac_address: null,
        model: "Smart Lock",
        serial_number: null,
        vendor: "Intelbras",
      },
      {
        id: "dev-sensor-1",
        household_id: "hh-sec",
        name: "Sensor Porta",
        category: "seguranca",
        device_type: "sensor_presenca",
        capabilities: [],
        status: "online",
        state: { motion: false },
        room_id: "room-1",
        created_at: "",
        updated_at: "",
        metadata: {},
        power_source: "battery",
        battery_level: 95,
        firmware_version: "1.0",
        ip_address: null,
        mac_address: null,
        model: "Door Sensor",
        serial_number: null,
        vendor: "Tuya",
      },
    ];

    const mockRooms: Room[] = [
      {
        id: "room-1",
        household_id: "hh-sec",
        name: "Entrada",
        floor: 1,
        sort_order: 1,
        created_at: "",
      },
    ];

    const zones = buildSecurityZones(mockDevices, mockRooms);
    expect(zones.length).toBe(2);
    expect(zones[0].type).toBe("lock");
    expect(zones[0].status).toBe("secure");
  });

  it("deve permitir reconhecer alertas de segurança", async () => {
    const armed = await setAlarmMode("hh-sec", "panic", "Morador");
    const alertId = armed.alerts[0].id;
    expect(armed.alerts[0].acknowledged).toBe(false);

    acknowledgeAlert("hh-sec", alertId);
    const updated = getSecurityState("hh-sec");
    const targetAlert = updated.alerts.find((a) => a.id === alertId);
    expect(targetAlert?.acknowledged).toBe(true);
  });
});

describe("Fase 4: Motor de Telemetria de Energia", () => {
  it("deve calcular demanda instantânea e projeção mensal de custo", () => {
    const mockDevices: Device[] = [
      {
        id: "dev-ac-1",
        household_id: "hh-1",
        name: "Ar Condicionado Suíte",
        category: "climatizacao",
        device_type: "ar_condicionado",
        capabilities: ["temperature"],
        status: "online",
        state: { on: true, temperature: 22 },
        room_id: null,
        created_at: "",
        updated_at: "",
        metadata: {},
        power_source: "mains",
        battery_level: null,
        firmware_version: "1.0",
        ip_address: "192.168.0.88",
        mac_address: null,
        model: "Inverter 12000 BTU",
        serial_number: null,
        vendor: "LG",
      },
      {
        id: "dev-light-1",
        household_id: "hh-1",
        name: "Lustre Sala",
        category: "iluminacao",
        device_type: "lampada",
        capabilities: ["brightness"],
        status: "online",
        state: { on: true, brightness: 100 },
        room_id: null,
        created_at: "",
        updated_at: "",
        metadata: {},
        power_source: "mains",
        battery_level: null,
        firmware_version: "1.0",
        ip_address: null,
        mac_address: null,
        model: "Smart Bulb",
        serial_number: null,
        vendor: "Philips Hue",
      },
    ];

    const overview = calculateEnergyOverview(mockDevices, [], 0.85);

    expect(overview.currentPowerW).toBeGreaterThan(1000);
    expect(overview.todayKwh).toBeGreaterThan(0);
    expect(overview.projectedMonthBillReais).toBeGreaterThan(0);
    expect(overview.hourlyHistory.length).toBe(24);
    expect(overview.categoryShares.length).toBeGreaterThan(0);

    // O ar condicionado deve ser identificado como maior consumidor
    expect(overview.deviceBreakdown[0].deviceId).toBe("dev-ac-1");
    expect(overview.deviceBreakdown[0].isHighConsumer).toBe(true);
  });
});
