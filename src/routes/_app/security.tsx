import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,
  AlertTriangle,
  Bell,
  Eye,
  Key,
  Flame,
  Radio,
  CheckCircle2,
  Clock,
  Trash2,
  Cctv,
  DoorClosed,
  Activity,
  Sliders,
} from "lucide-react";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, stateOf } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/home/ui-states";
import { AlarmMode, SecurityZone, SecurityAlert } from "@/types/security";
import {
  getSecurityState,
  setAlarmMode,
  acknowledgeAlert,
  clearAlerts,
  buildSecurityZones,
  updateSecurityPin,
} from "@/lib/security";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/security")({
  head: () => ({
    meta: [
      { title: "Segurança & Alarme — Casa Inteligente AI" },
      { property: "og:title", content: "Segurança & Alarme — Casa Inteligente AI" },
      {
        property: "og:description",
        content: "Painel de controle de alarme, sensores perimetrais e fechaduras inteligentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Monitore o perímetro residencial em tempo real: status de fechaduras, zonas de alarme, sensores de presença e alertas de emergência.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);

  const householdId = current?.id || "default";
  const [securityState, setSecurityState] = useState(() => getSecurityState(householdId));
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [targetMode, setTargetMode] = useState<AlarmMode | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [isArmingModalOpen, setIsArmingModalOpen] = useState(false);

  const refreshState = () => {
    if (householdId) {
      setSecurityState(getSecurityState(householdId));
    }
  };

  useEffect(() => {
    refreshState();

    const handleUpdate = () => refreshState();
    window.addEventListener("homepulse:security-state-changed", handleUpdate);
    return () => window.removeEventListener("homepulse:security-state-changed", handleUpdate);
  }, [householdId]);

  if (devices.isLoading || rooms.isLoading) return <LoadingState />;

  const devList = devices.data || [];
  const roomList = rooms.data || [];
  const zones = buildSecurityZones(devList, roomList);

  const mode = securityState.mode;

  const handleRequestModeChange = (newMode: AlarmMode) => {
    if (newMode === "panic") {
      setAlarmMode(householdId, "panic", "Morador");
      toast.error("🚨 MODO PÂNICO ATIVADO! Sirene e notificações acionadas!");
      return;
    }

    if (securityState.pinRequired) {
      setTargetMode(newMode);
      setEnteredPin("");
      setIsArmingModalOpen(true);
    } else {
      setAlarmMode(householdId, newMode, "Morador");
      toast.success(`Alarme alterado para ${newMode.toUpperCase()}`);
    }
  };

  const handleConfirmPinModeChange = () => {
    if (securityState.pinRequired && enteredPin !== (securityState.pinCode || "1234")) {
      toast.error("PIN de segurança incorreto. Tente novamente.");
      return;
    }

    if (targetMode) {
      setAlarmMode(householdId, targetMode, "Morador");
      toast.success(
        targetMode === "disarmed"
          ? "Alarme Desarmado com sucesso."
          : `Alarme Armado no modo ${targetMode.toUpperCase()}!`
      );
    }
    setIsArmingModalOpen(false);
    setTargetMode(null);
  };

  const handleToggleLock = async (deviceId: string, currentLocked: boolean) => {
    try {
      const { error } = await supabase.rpc("set_device_state", {
        _device: deviceId,
        _patch: { locked: !currentLocked } as never,
        _confirmed: true,
      });

      if (error) {
        toast.error(`Falha ao acionar fechadura: ${error.message}`);
      } else {
        toast.success(currentLocked ? "Fechadura Destrancada" : "Fechadura Trancada com segurança");
        devices.refetch();
      }
    } catch (e: any) {
      toast.error("Erro na comunicação com a fechadura.");
    }
  };

  const handleSavePin = () => {
    if (newPin.length < 4) {
      toast.error("O PIN deve conter pelo menos 4 dígitos numéricos.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("A confirmação do PIN não confere.");
      return;
    }
    updateSecurityPin(householdId, newPin);
    toast.success("PIN de segurança atualizado!");
    setIsPinModalOpen(false);
    setNewPin("");
    setConfirmPin("");
  };

  const unacknowledgedAlerts = securityState.alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
              <ShieldCheck className="size-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Segurança & Alarme Perimetral
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Painel unificado de controle de alarme, fechaduras inteligentes e integridade de zonas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPinModalOpen(true)}
            className="text-xs gap-1.5 h-8"
          >
            <Key className="size-3.5 text-muted-foreground" />
            <span>Alterar PIN</span>
          </Button>

          <Button asChild size="sm" variant="outline" className="text-xs gap-1.5 h-8">
            <Link to="/dvr-nvr">
              <Cctv className="size-3.5 text-primary" />
              <span>Ver Câmeras CFTV</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero Alarm Control Panel */}
      <div
        className={cn(
          "rounded-3xl border p-6 transition-all duration-300 relative overflow-hidden",
          mode === "disarmed" && "bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/30",
          mode === "armed_home" && "bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/30",
          mode === "armed_away" && "bg-gradient-to-br from-blue-500/15 via-card to-card border-blue-500/40",
          mode === "panic" && "bg-gradient-to-br from-rose-600/25 via-card to-card border-rose-500/60 animate-pulse"
        )}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "size-16 rounded-2xl flex items-center justify-center border shadow-md shrink-0",
                mode === "disarmed" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                mode === "armed_home" && "bg-amber-500/20 text-amber-400 border-amber-500/40",
                mode === "armed_away" && "bg-blue-500/20 text-blue-400 border-blue-500/40",
                mode === "panic" && "bg-rose-500/30 text-rose-300 border-rose-500/60"
              )}
            >
              {mode === "disarmed" && <ShieldCheck className="size-8" />}
              {mode === "armed_home" && <ShieldAlert className="size-8" />}
              {mode === "armed_away" && <Lock className="size-8" />}
              {mode === "panic" && <Flame className="size-8 text-rose-400 animate-bounce" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                  Status do Sistema
                </span>
                {unacknowledgedAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] animate-pulse">
                    {unacknowledgedAlerts.length} alerta(s)
                  </Badge>
                )}
              </div>

              <h2 className="text-2xl font-black tracking-tight text-foreground mt-0.5">
                {mode === "disarmed" && "Alarme Desarmado"}
                {mode === "armed_home" && "Armado (Modo Casa)"}
                {mode === "armed_away" && "Armado (Modo Ausente / Total)"}
                {mode === "panic" && "🚨 ALERTA DE PÂNICO EM ANDAMENTO"}
              </h2>

              <p className="text-xs text-muted-foreground mt-1">
                {mode === "disarmed" && "Portas e janelas livres. Nenhum sensor disparará sirene."}
                {mode === "armed_home" && "Sensores de perímetro ativos. Circulação interna permitida."}
                {mode === "armed_away" && "Todas as zonas e sensores ativos. Qualquer intrusão soará alarme."}
                {mode === "panic" && "Alarme em disparo sonoro e envio de mensagens para emergência."}
              </p>
            </div>
          </div>

          {/* Quick Mode Switches */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <Button
              variant={mode === "disarmed" ? "default" : "outline"}
              onClick={() => handleRequestModeChange("disarmed")}
              className={cn(
                "h-11 px-4 text-xs font-bold gap-2 flex-1 md:flex-initial",
                mode === "disarmed" && "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              <ShieldCheck className="size-4" />
              <span>Desarmar</span>
            </Button>

            <Button
              variant={mode === "armed_home" ? "default" : "outline"}
              onClick={() => handleRequestModeChange("armed_home")}
              className={cn(
                "h-11 px-4 text-xs font-bold gap-2 flex-1 md:flex-initial",
                mode === "armed_home" && "bg-amber-600 hover:bg-amber-700 text-white"
              )}
            >
              <ShieldAlert className="size-4" />
              <span>Armar Casa</span>
            </Button>

            <Button
              variant={mode === "armed_away" ? "default" : "outline"}
              onClick={() => handleRequestModeChange("armed_away")}
              className={cn(
                "h-11 px-4 text-xs font-bold gap-2 flex-1 md:flex-initial",
                mode === "armed_away" && "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              <Lock className="size-4" />
              <span>Armar Total</span>
            </Button>

            <Button
              variant="destructive"
              onClick={() => handleRequestModeChange("panic")}
              className="h-11 px-4 text-xs font-black gap-2 shadow-md w-full sm:w-auto"
            >
              <Flame className="size-4" />
              <span>PÂNICO</span>
            </Button>
          </div>
        </div>

        {/* Telemetry metadata footer */}
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
          <span>
            Última alteração:{" "}
            <strong className="text-foreground">
              {new Date(securityState.lastChangedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </strong>{" "}
            por {securityState.changedBy || "Morador"}
          </span>

          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Central local operacional com barramento MQTT</span>
          </span>
        </div>
      </div>

      {/* Grid: Zonas de Segurança & Fechaduras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zonas Monitoradas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Zonas e Sensores Perimetrais ({zones.length})
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">Monitoramento 24h</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {zones.map((zone) => {
              const isOk = zone.status === "secure";
              const isTriggered = zone.status === "triggered";
              const dev = zone.deviceId ? devList.find((d) => d.id === zone.deviceId) : null;
              const isLock = zone.type === "lock";
              const isLocked = dev ? stateOf(dev).locked !== false : true;

              return (
                <div
                  key={zone.id}
                  className={cn(
                    "rounded-2xl border p-4 transition-all flex flex-col justify-between space-y-3",
                    isTriggered
                      ? "bg-rose-500/10 border-rose-500/40 shadow-xs"
                      : "bg-card border-border/70 hover:border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "size-10 rounded-xl flex items-center justify-center border shrink-0",
                          isTriggered
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-muted/40 text-foreground border-border"
                        )}
                      >
                        {zone.type === "lock" && (isLocked ? <Lock className="size-5" /> : <Unlock className="size-5 text-amber-400" />)}
                        {zone.type === "door" && <DoorClosed className="size-5" />}
                        {zone.type === "motion" && <Activity className="size-5" />}
                        {zone.type === "window" && <ShieldCheck className="size-5" />}
                        {zone.type === "camera" && <Cctv className="size-5 text-primary" />}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-foreground line-clamp-1">
                          {zone.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">{zone.roomName}</p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono",
                        isTriggered
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      )}
                    >
                      {isTriggered ? "DISPARADO / ABERTO" : "SEGURO"}
                    </Badge>
                  </div>

                  {/* Ação rápida se for fechadura ou câmera */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {zone.lastTriggeredAt || "Sem eventos recentes"}
                    </span>

                    {isLock && dev && (
                      <Button
                        size="sm"
                        variant={isLocked ? "secondary" : "default"}
                        onClick={() => handleToggleLock(dev.id, isLocked)}
                        className="h-7 text-xs px-3 font-semibold gap-1.5"
                      >
                        {isLocked ? (
                          <>
                            <Unlock className="size-3" />
                            <span>Destrancar</span>
                          </>
                        ) : (
                          <>
                            <Lock className="size-3" />
                            <span>Trancar</span>
                          </>
                        )}
                      </Button>
                    )}

                    {zone.type === "camera" && (
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2 text-primary">
                        <Link to="/dvr-nvr">
                          <span>Ao Vivo</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Central de Alertas e Notificações */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <h3 className="text-base font-bold text-foreground">Central de Alertas</h3>
            </div>

            {securityState.alerts.length > 0 && (
              <button
                onClick={() => {
                  clearAlerts(householdId);
                  toast.info("Histórico de alertas limpo.");
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Trash2 className="size-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-3 max-h-[480px] overflow-y-auto">
            {securityState.alerts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto text-emerald-400 mb-2" />
                <p className="text-xs font-semibold">Nenhum alerta recente</p>
                <p className="text-[11px] text-muted-foreground/70">
                  O sistema de alarme e sensores está operando normalmente.
                </p>
              </div>
            ) : (
              securityState.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-xl border p-3 transition-all space-y-1.5",
                    alert.severity === "critical" && "bg-rose-500/10 border-rose-500/30",
                    alert.severity === "warning" && "bg-amber-500/10 border-amber-500/30",
                    alert.severity === "info" && "bg-muted/30 border-border/60",
                    !alert.acknowledged && "ring-1 ring-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        alert.severity === "critical" && "text-rose-400",
                        alert.severity === "warning" && "text-amber-400",
                        alert.severity === "info" && "text-foreground"
                      )}
                    >
                      {alert.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>

                  {!alert.acknowledged && (
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => acknowledgeAlert(householdId, alert.id)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Reconhecer ✓
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Solicitação de PIN para Armar/Desarmar */}
      <Dialog open={isArmingModalOpen} onOpenChange={setIsArmingModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-2">
              <Key className="size-5" />
            </div>
            <DialogTitle className="text-center font-bold">Autenticação de Segurança</DialogTitle>
            <p className="text-xs text-muted-foreground text-center">
              Digite o PIN de 4 dígitos para confirmar a alteração do modo de alarme.
            </p>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Input
              type="password"
              maxLength={6}
              autoFocus
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPinModeChange();
              }}
              placeholder="••••"
              className="text-center font-mono text-2xl tracking-widest h-12"
            />
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsArmingModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPinModeChange}
              className="text-xs font-semibold px-5"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Alterar PIN */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold">Alterar PIN de Segurança</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Configure o novo código numérico para armar e desarmar o alarme residencial.
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold">Novo PIN (mínimo 4 dígitos)</span>
              <Input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Ex: 1234"
                className="font-mono text-center text-lg"
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold">Confirme o Novo PIN</span>
              <Input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Repita o PIN"
                className="font-mono text-center text-lg"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPinModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSavePin} className="text-xs font-semibold px-5">
              Salvar PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
