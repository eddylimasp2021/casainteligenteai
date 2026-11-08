/**
 * Tipos para Monitoramento e Gestão de Energia Elétrica
 * Casa Inteligente AI — HomePulse
 */

export interface EnergyDeviceConsumption {
  deviceId: string;
  deviceName: string;
  category: string;
  roomName: string;
  currentPowerW: number;
  todayKwh: number;
  monthKwh: number;
  estimatedCostReais: number;
  percentageOfTotal: number;
  isHighConsumer: boolean;
}

export interface EnergyHourlyPoint {
  hour: string;
  watts: number;
  kwh: number;
}

export interface EnergyDailyPoint {
  day: string;
  kwh: number;
  costReais: number;
}

export interface EnergyCategoryShare {
  category: string;
  label: string;
  kwh: number;
  percentage: number;
  costReais: number;
  color: string;
}

export interface EnergyOverview {
  currentPowerW: number;
  todayKwh: number;
  todayCostReais: number;
  projectedMonthKwh: number;
  projectedMonthBillReais: number;
  tariffPerKwh: number;
  carbonFootprintKg: number;
  hourlyHistory: EnergyHourlyPoint[];
  dailyHistory: EnergyDailyPoint[];
  categoryShares: EnergyCategoryShare[];
  deviceBreakdown: EnergyDeviceConsumption[];
}
