import {
  Lightbulb, Thermometer, Tv, Shield, Zap, Leaf, Box, Sofa, CookingPot, BedDouble, Bath,
  Briefcase, Car, Shirt, Trees, Sun, Home, DoorOpen, type LucideIcon,
} from "lucide-react";

export type Capability = "onoff" | "brightness" | "color" | "temperature" | "mode" | "volume" | "speed" | "position" | "lock";

export const CATEGORIES: Record<string, { label: string; icon: LucideIcon; types: Record<string, { label: string; caps: Capability[]; critical?: boolean }> }> = {
  iluminacao: {
    label: "Iluminação", icon: Lightbulb,
    types: {
      lampada: { label: "Lâmpada", caps: ["onoff", "brightness", "color"] },
      plafon: { label: "Plafon", caps: ["onoff", "brightness"] },
      fita_led: { label: "Fita LED", caps: ["onoff", "brightness", "color"] },
      luminaria: { label: "Luminária", caps: ["onoff", "brightness"] },
      dimmer: { label: "Dimmer", caps: ["onoff", "brightness"] },
    },
  },
  climatizacao: {
    label: "Climatização", icon: Thermometer,
    types: {
      ar_condicionado: { label: "Ar-condicionado", caps: ["onoff", "temperature", "mode"] },
      ventilador: { label: "Ventilador", caps: ["onoff", "speed"] },
      aquecedor: { label: "Aquecedor", caps: ["onoff", "temperature"] },
      umidificador: { label: "Umidificador", caps: ["onoff"] },
      desumidificador: { label: "Desumidificador", caps: ["onoff"] },
      persiana: { label: "Persiana", caps: ["position"] },
    },
  },
  entretenimento: {
    label: "Entretenimento", icon: Tv,
    types: {
      televisao: { label: "Televisão", caps: ["onoff", "volume"] },
      soundbar: { label: "Soundbar", caps: ["onoff", "volume"] },
      receiver: { label: "Receiver", caps: ["onoff", "volume"] },
      projetor: { label: "Projetor", caps: ["onoff"] },
    },
  },
  seguranca: {
    label: "Segurança", icon: Shield,
    types: {
      camera: { label: "Câmera", caps: [] },
      sensor_movimento: { label: "Sensor de movimento", caps: [] },
      sensor_porta: { label: "Sensor de porta", caps: [] },
      sensor_janela: { label: "Sensor de janela", caps: [] },
      fechadura: { label: "Fechadura", caps: ["lock"], critical: true },
      sirene: { label: "Sirene", caps: ["onoff"], critical: true },
      alarme: { label: "Alarme", caps: ["onoff"], critical: true },
    },
  },
  energia: {
    label: "Energia", icon: Zap,
    types: {
      tomada: { label: "Tomada inteligente", caps: ["onoff"] },
      medidor: { label: "Medidor", caps: [] },
      disjuntor: { label: "Disjuntor inteligente", caps: ["onoff"], critical: true },
    },
  },
  ambiente: {
    label: "Ambiente", icon: Leaf,
    types: {
      temperatura: { label: "Sensor de temperatura", caps: [] },
      umidade: { label: "Sensor de umidade", caps: [] },
      luminosidade: { label: "Sensor de luminosidade", caps: [] },
      qualidade_ar: { label: "Qualidade do ar", caps: [] },
    },
  },
  outros: { label: "Outros", icon: Box, types: { personalizado: { label: "Personalizado", caps: ["onoff"] } } },
};

export const PROTOCOLS = ["wifi", "mqtt", "matter", "zigbee", "zwave", "bluetooth", "http", "websocket", "home_assistant"] as const;
export const PROTOCOL_LABEL: Record<string, string> = {
  wifi: "Wi-Fi", mqtt: "MQTT", matter: "Matter", zigbee: "Zigbee", zwave: "Z-Wave",
  bluetooth: "Bluetooth", http: "HTTP/REST", websocket: "WebSocket", home_assistant: "Home Assistant",
};

export const ROOM_SUGGESTIONS = ["Sala", "Cozinha", "Quarto", "Suíte", "Banheiro", "Escritório", "Garagem", "Lavanderia", "Jardim", "Varanda", "Área externa"];

const ROOM_ICONS: Record<string, LucideIcon> = {
  sala: Sofa, cozinha: CookingPot, quarto: BedDouble, "suíte": BedDouble, suite: BedDouble, banheiro: Bath,
  "escritório": Briefcase, escritorio: Briefcase, garagem: Car, lavanderia: Shirt, jardim: Trees,
  varanda: Sun, "área externa": DoorOpen,
};
export const roomIcon = (key: string): LucideIcon => ROOM_ICONS[key.toLowerCase()] ?? Home;

export const categoryIcon = (c: string) => CATEGORIES[c]?.icon ?? Box;
export const typeLabel = (c: string, t: string) => CATEGORIES[c]?.types[t]?.label ?? t;

/** Map backend errors to friendly, non-technical messages. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (msg.includes("device_offline")) return "O dispositivo está offline. Verifique a conexão.";
  if (msg.includes("confirmation_required")) return "Esta ação precisa de confirmação.";
  if (msg.includes("forbidden") || msg.includes("permission") || msg.includes("row-level")) return "Você não tem permissão para esta ação.";
  if (msg.includes("not_found")) return "Item não encontrado.";
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("already registered")) return "Este e-mail já possui conta.";
  return "Não foi possível concluir a ação. Tente novamente.";
}
