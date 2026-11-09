export type NotificationType = "security" | "energy" | "cftv" | "automation" | "system";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface HomePulseNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = "homepulse_notifications_v1";

const INITIAL_NOTIFICATIONS: HomePulseNotification[] = [
  {
    id: "notif-1",
    type: "security",
    priority: "high",
    title: "Alarme Perimetral Ativo",
    message: "Modo Noturno ativado com sucesso em todas as 4 zonas perimetrais.",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    read: false,
    actionUrl: "/security",
  },
  {
    id: "notif-2",
    type: "cftv",
    priority: "medium",
    title: "Movimento Detectado na Garagem",
    message: "Câmera Garagem Rua detectou presença de veículo na entrada.",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    read: false,
    actionUrl: "/dvr-nvr",
  },
  {
    id: "notif-3",
    type: "energy",
    priority: "low",
    title: "Relatório de Eficiência Energética",
    message: "O consumo elétrico desta semana está 8% abaixo da média mensal.",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    read: true,
    actionUrl: "/energy",
  },
];

export function getNotifications(): HomePulseNotification[] {
  if (typeof window === "undefined") return INITIAL_NOTIFICATIONS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_NOTIFICATIONS;
}

export function saveNotifications(list: HomePulseNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("homepulse-notifications-changed"));
  } catch {}
}

export function addNotification(notif: Omit<HomePulseNotification, "id" | "timestamp" | "read">): HomePulseNotification {
  const current = getNotifications();
  const created: HomePulseNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [created, ...current].slice(0, 50); // Keep max 50 items
  saveNotifications(updated);
  return created;
}

export function markNotificationAsRead(id: string) {
  const current = getNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
}

export function markAllNotificationsAsRead() {
  const current = getNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
}

export function clearAllNotifications() {
  saveNotifications([]);
}
