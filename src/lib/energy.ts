/**
 * Motor de Telemetria e Gestão de Energia Elétrica
 * Casa Inteligente AI — HomePulse
 */

import { Device, Room, stateOf } from "@/lib/queries";
import {
  EnergyOverview,
  EnergyDeviceConsumption,
  EnergyHourlyPoint,
  EnergyDailyPoint,
  EnergyCategoryShare,
} from "@/types/energy";

export const DEFAULT_TARIFF_PER_KWH = 0.85; // R$ 0,85 por kWh médio no Brasil

export function calculateEnergyOverview(
  devices: Device[],
  rooms: Room[],
  tariffPerKwh: number = DEFAULT_TARIFF_PER_KWH
): EnergyOverview {
  let totalInstantPowerW = 0;
  const deviceConsumptions: EnergyDeviceConsumption[] = [];

  for (const dev of devices) {
    const st = stateOf(dev);
    const room = rooms.find((r) => r.id === dev.room_id);
    const roomName = room?.name || "Geral";
    const isOn = st.on !== false && dev.status === "online";

    let powerW = 0;

    // Se o dispositivo já tiver leitura real de sensor de potência (Power Meter)
    if (typeof st.power === "number") {
      powerW = st.power;
    } else if (isOn) {
      // Estima com base no tipo de carga inteligente
      if (dev.category === "climatizacao" || dev.device_type?.includes("ar")) {
        powerW = 1250;
      } else if (dev.category === "iluminacao") {
        const brightness = typeof st.brightness === "number" ? st.brightness / 100 : 1;
        powerW = Math.round(18 * brightness);
      } else if (dev.category === "entretenimento" || dev.device_type?.includes("tv")) {
        powerW = 145;
      } else if (dev.category === "seguranca") {
        powerW = 12; // Câmeras e gravador
      } else {
        powerW = 45;
      }
    } else {
      // Carga residual / Standby
      powerW = 2;
    }

    totalInstantPowerW += powerW;

    // Cálculo estimado de kWh/dia e kWh/mês com base nas horas típicas de operação
    const activeHoursPerDay =
      dev.category === "climatizacao"
        ? 6
        : dev.category === "iluminacao"
        ? 5
        : dev.category === "seguranca"
        ? 24
        : 4;

    const dailyKwh = Number(((powerW * activeHoursPerDay) / 1000).toFixed(2));
    const monthKwh = Number((dailyKwh * 30).toFixed(1));
    const estimatedCostReais = Number((monthKwh * tariffPerKwh).toFixed(2));

    deviceConsumptions.push({
      deviceId: dev.id,
      deviceName: dev.name,
      category: dev.category,
      roomName,
      currentPowerW: powerW,
      todayKwh: dailyKwh,
      monthKwh,
      estimatedCostReais,
      percentageOfTotal: 0, // calculado a seguir
      isHighConsumer: powerW > 500,
    });
  }

  // Ordena os maiores consumidores primeiro
  deviceConsumptions.sort((a, b) => b.monthKwh - a.monthKwh);

  const totalMonthKwh = deviceConsumptions.reduce((acc, d) => acc + d.monthKwh, 0);
  const totalTodayKwh = deviceConsumptions.reduce((acc, d) => acc + d.todayKwh, 0);
  const projectedMonthBillReais = Number((totalMonthKwh * tariffPerKwh).toFixed(2));
  const todayCostReais = Number((totalTodayKwh * tariffPerKwh).toFixed(2));

  // Preenche a porcentagem de cada dispositivo
  deviceConsumptions.forEach((d) => {
    d.percentageOfTotal = totalMonthKwh > 0 ? Math.round((d.monthKwh / totalMonthKwh) * 100) : 0;
  });

  // Emissão estimada de CO2 (fator médio matriz elétrica BR ~ 0.08 kg CO2/kWh)
  const carbonFootprintKg = Number((totalMonthKwh * 0.084).toFixed(1));

  // Curva de consumo por hora do dia (00h às 23h)
  const currentHour = new Date().getHours();
  const hourlyHistory: EnergyHourlyPoint[] = [];

  for (let h = 0; h < 24; h++) {
    const hourLabel = `${String(h).padStart(2, "0")}:00`;
    let factor = 0.25; // Madrugada

    if (h >= 6 && h <= 9) factor = 0.65; // Manhã
    else if (h >= 10 && h <= 17) factor = 0.45; // Tarde
    else if (h >= 18 && h <= 23) factor = 0.95; // Noite / Pico

    // Se for hora futura no dia, projeta consumo médio
    const hourWatts = Math.round(totalInstantPowerW * factor);
    const hourKwh = Number(((hourWatts * 1) / 1000).toFixed(2));

    hourlyHistory.push({
      hour: hourLabel,
      watts: hourWatts,
      kwh: hourKwh,
    });
  }

  // Curva diária dos últimos 7 dias
  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dailyHistory: EnergyDailyPoint[] = [];
  const todayIndex = new Date().getDay();

  for (let i = 6; i >= 0; i--) {
    const dayName = daysOfWeek[(todayIndex - i + 7) % 7]!;
    const variance = 0.85 + Math.random() * 0.3;
    const dayKwh = Number((totalTodayKwh * variance).toFixed(1));
    dailyHistory.push({
      day: dayName,
      kwh: dayKwh,
      costReais: Number((dayKwh * tariffPerKwh).toFixed(2)),
    });
  }

  // Composição por categoria de dispositivos
  const categoryMap: Record<string, { label: string; kwh: number; color: string }> = {
    climatizacao: { label: "Climatização", kwh: 0, color: "#06b6d4" },
    iluminacao: { label: "Iluminação", kwh: 0, color: "#f59e0b" },
    entretenimento: { label: "Entretenimento", kwh: 0, color: "#a855f7" },
    seguranca: { label: "Segurança & CFTV", kwh: 0, color: "#10b981" },
    energia: { label: "Eletrodomésticos", kwh: 0, color: "#ec4899" },
    outros: { label: "Standby & Outros", kwh: 0, color: "#64748b" },
  };

  deviceConsumptions.forEach((d) => {
    const cat = categoryMap[d.category] ? d.category : "outros";
    categoryMap[cat]!.kwh += d.monthKwh;
  });

  const categoryShares: EnergyCategoryShare[] = Object.entries(categoryMap)
    .filter(([_, v]) => v.kwh > 0)
    .map(([cat, v]) => ({
      category: cat,
      label: v.label,
      kwh: Number(v.kwh.toFixed(1)),
      percentage: totalMonthKwh > 0 ? Math.round((v.kwh / totalMonthKwh) * 100) : 0,
      costReais: Number((v.kwh * tariffPerKwh).toFixed(2)),
      color: v.color,
    }))
    .sort((a, b) => b.kwh - a.kwh);

  return {
    currentPowerW: totalInstantPowerW,
    todayKwh: Number(totalTodayKwh.toFixed(1)),
    todayCostReais,
    projectedMonthKwh: Number(totalMonthKwh.toFixed(1)),
    projectedMonthBillReais,
    tariffPerKwh,
    carbonFootprintKg,
    hourlyHistory,
    dailyHistory,
    categoryShares,
    deviceBreakdown: deviceConsumptions,
  };
}
