import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ShieldAlert,
  Zap,
  Cctv,
  Workflow,
  Info,
  CheckCheck,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  type HomePulseNotification,
} from "@/lib/notifications";

function getNotificationIcon(type: HomePulseNotification["type"]) {
  switch (type) {
    case "security":
      return <ShieldAlert className="size-4 text-rose-400 shrink-0" />;
    case "energy":
      return <Zap className="size-4 text-amber-400 shrink-0" />;
    case "cftv":
      return <Cctv className="size-4 text-blue-400 shrink-0" />;
    case "automation":
      return <Workflow className="size-4 text-cyan-400 shrink-0" />;
    default:
      return <Info className="size-4 text-muted-foreground shrink-0" />;
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "agora";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays}d`;
  } catch {
    return "";
  }
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<HomePulseNotification[]>(getNotifications);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const sync = () => setNotifications(getNotifications());
    window.addEventListener("homepulse-notifications-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("homepulse-notifications-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Notificações e Alertas"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-2xl border-border/80">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Alertas & Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                {unreadCount} novos
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllNotificationsAsRead}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Lidas</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllNotifications}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1"
                title="Limpar todas as notificações"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
              <Bell className="size-8 mx-auto text-muted-foreground/40" />
              <p>Nenhuma notificação no momento.</p>
              <p className="text-[10px] text-muted-foreground/70">Você será avisado sobre qualquer evento crítico.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => markNotificationAsRead(notif.id)}
                className={`p-3 transition-colors hover:bg-muted/50 cursor-pointer flex gap-3 items-start ${
                  !notif.read ? "bg-primary/5" : "opacity-80"
                }`}
              >
                <div className="p-2 rounded-xl bg-muted/80 border border-border/40 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-foreground truncate">{notif.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(notif.timestamp)}</span>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{notif.message}</p>

                  {notif.actionUrl && (
                    <div className="pt-0.5">
                      <Link
                        to={notif.actionUrl}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        <span>Acessar painel</span>
                        <ExternalLink className="size-2.5" />
                      </Link>
                    </div>
                  )}
                </div>

                {!notif.read && (
                  <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" title="Não lida" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
