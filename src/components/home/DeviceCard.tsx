import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lock, LockOpen, Minus, Plus, Clock, Wifi, Tv, Volume2, VolumeX,
  Power, Sparkles, CheckCircle2, ChevronUp, ChevronDown, Radio, Play, Pause,
  CornerDownLeft, Home, Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { categoryIcon, friendlyError, typeLabel } from "@/lib/catalog";
import { stateOf, type Device } from "@/lib/queries";
import { StatusBadge } from "./ui-states";
import { cn } from "@/lib/utils";
import { LG_COMMANDS, sendLgWebOsCommand, testTvConnection } from "@/lib/smart-tv";

export function DeviceCard({ device, roomName, canControl, compact }: { device: Device; roomName?: string; canControl: boolean; compact?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const [testingPing, setTestingPing] = useState(false);

  const s = stateOf(device);
  const caps = device.capabilities ?? [];
  const Icon = categoryIcon(device.category);
  const offline = device.status !== "online";
  const disabled = !canControl || offline || busy;
  const isOn = caps.includes("lock") ? !s.locked : !!s.on;
  const isTv = device.category === "entretenimento" || device.device_type === "televisao";
  const tvIp = device.ip_address || (isTv ? "192.168.0.168" : "");

  async function forceOnline() {
    setBusy(true);
    const { error } = await supabase.from("devices").update({
      status: "online",
      simulated: true,
      last_seen_at: new Date().toISOString(),
      ip_address: tvIp || device.ip_address,
      manufacturer: device.manufacturer || (isTv ? "LG" : null),
      model: device.model || (isTv ? "webOS Smart TV" : null),
    }).eq("id", device.id);
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["devices", device.household_id] });
    if (error) {
      toast.error(friendlyError(error));
    } else {
      toast.success(`✓ ${device.name} conectado e online com sucesso!`);
    }
  }

  async function handleTestPing() {
    if (!tvIp) return toast.warning("Nenhum endereço IP configurado neste dispositivo.");
    setTestingPing(true);
    try {
      const res = await testTvConnection(tvIp, 3000);
      if (res.ok) {
        toast.success(`✓ TV respondendo em ${tvIp} (${res.latencyMs}ms)! Marcando como online.`);
        await forceOnline();
      } else {
        toast.warning(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao testar conexão.");
    } finally {
      setTestingPing(false);
    }
  }

  async function send(patch: Record<string, unknown>, confirmed = false, label?: string) {
    if (device.is_critical && !confirmed) { setConfirm(patch); return; }
    setBusy(true);

    // Se for Smart TV LG e tiver IP, envia comando direto via WebSocket
    if (isTv && tvIp) {
      if (patch.on === false) {
        LG_COMMANDS.powerOff(tvIp).catch(() => {});
      } else if (typeof patch.volume === "number") {
        LG_COMMANDS.setVolume(tvIp, patch.volume).catch(() => {});
      }
    }

    const { data, error } = await supabase.rpc("set_device_state", { _device: device.id, _patch: patch as never, _confirmed: confirmed });
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["devices", device.household_id] });
    if (error) {
      toast.error(friendlyError(error), { action: { label: "Tentar novamente", onClick: () => send(patch, confirmed, label) } });
      return;
    }
    const result = (data as { result?: string } | null)?.result;
    if (result === "pending_gateway") toast.warning(`Comando enviado para ${device.name}. Aguardando gateway.`);
    else if (label) toast.success(label);
  }

  async function triggerTvAction(action: string, payload?: any) {
    if (!tvIp) {
      toast.warning("Configure o IP da TV para controle direto.");
      return;
    }

    switch (action) {
      case "power":
        if (s.on) {
          await LG_COMMANDS.powerOff(tvIp);
          await send({ on: false }, false, "✓ TV desligada.");
        } else {
          await send({ on: true }, false, "✓ TV ligada.");
        }
        break;
      case "vol_up":
        await LG_COMMANDS.volumeUp(tvIp);
        await send({ volume: Math.min(100, (s.volume ?? 20) + 1) });
        break;
      case "vol_down":
        await LG_COMMANDS.volumeDown(tvIp);
        await send({ volume: Math.max(0, (s.volume ?? 20) - 1) });
        break;
      case "mute":
        await LG_COMMANDS.setMute(tvIp, true);
        toast.success("✓ Áudio mutado.");
        break;
      case "youtube":
        await LG_COMMANDS.openYoutube(tvIp);
        toast.success("✓ YouTube aberto na TV.");
        break;
      case "netflix":
        await LG_COMMANDS.openNetflix(tvIp);
        toast.success("✓ Netflix aberto na TV.");
        break;
      case "toast":
        const msg = prompt("Mensagem para exibir na TV:", "Atenção: Sistema Casa Inteligente AI ativo");
        if (msg) {
          await LG_COMMANDS.showToast(tvIp, msg);
          toast.success("✓ Notificação enviada para a tela da TV.");
        }
        break;
      default:
        break;
    }
  }

  const lockLabel = s.locked ? "destravar" : "travar";

  return (
    <article className={cn("glass group rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5", isOn && !offline && "ring-1 ring-primary/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("rounded-xl p-2.5 transition-colors", isOn && !offline ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{device.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{typeLabel(device.category, device.device_type)}{roomName ? ` · ${roomName}` : ""}</p>
          </div>
        </div>
        {caps.includes("onoff") && (
          <Switch
            aria-label={`Ligar ou desligar ${device.name}`}
            checked={!!s.on}
            disabled={disabled}
            onCheckedChange={(v) => send({ on: v }, false, `✓ ${device.name} ${v ? "ligado(a)" : "desligado(a)"}.`)}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={device.status} />
        {device.simulated && <span className="rounded-full bg-violet/15 px-2 py-0.5 text-xs text-violet">Demonstração</span>}
        {s.pending && <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning"><Clock className="size-3" />Aguardando gateway</span>}
        {isTv && tvIp && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary">
            {tvIp}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-4 space-y-4">
          {caps.includes("brightness") && (
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Brilho</span><span>{s.brightness ?? 0}%</span></div>
              <Slider aria-label="Brilho" disabled={disabled || !s.on} defaultValue={[s.brightness ?? 0]} key={s.brightness} max={100} step={5}
                onValueCommit={(v) => send({ brightness: v[0] }, false, `✓ Brilho ajustado para ${v[0]}%.`)} />
            </div>
          )}
          {caps.includes("volume") && (
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Volume</span><span>{s.volume ?? 0}</span></div>
              <Slider aria-label="Volume" disabled={disabled || !s.on} defaultValue={[s.volume ?? 0]} key={s.volume} max={100}
                onValueCommit={(v) => send({ volume: v[0] }, false, `✓ Volume ajustado para ${v[0]}.`)} />
            </div>
          )}
          {caps.includes("position") && (
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Abertura</span><span>{s.position ?? 0}%</span></div>
              <Slider aria-label="Abertura" disabled={disabled} defaultValue={[s.position ?? 0]} key={s.position} max={100} step={10}
                onValueCommit={(v) => send({ position: v[0] }, false, `✓ Posição ajustada.`)} />
            </div>
          )}
          {caps.includes("temperature") && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Temperatura</span>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="secondary" className="size-8" aria-label="Diminuir temperatura" disabled={disabled} onClick={() => send({ temperature: (s.temperature ?? 22) - 1 }, false, `✓ ${(s.temperature ?? 22) - 1}°C`)}><Minus className="size-4" /></Button>
                <span className="w-14 text-center font-display text-lg font-semibold tabular-nums">{s.temperature ?? "--"}°</span>
                <Button size="icon" variant="secondary" className="size-8" aria-label="Aumentar temperatura" disabled={disabled} onClick={() => send({ temperature: (s.temperature ?? 22) + 1 }, false, `✓ ${(s.temperature ?? 22) + 1}°C`)}><Plus className="size-4" /></Button>
              </div>
            </div>
          )}
          {caps.includes("mode") && (
            <div className="flex gap-1" role="group" aria-label="Modo">
              {[["cool", "Frio"], ["heat", "Quente"], ["fan", "Ventilar"], ["auto", "Auto"]].map(([m, l]) => (
                <Button key={m} size="sm" variant={s.mode === m ? "default" : "secondary"} className="flex-1 text-xs" disabled={disabled} aria-pressed={s.mode === m}
                  onClick={() => send({ mode: m }, false, `✓ Modo ${l}.`)}>{l}</Button>
              ))}
            </div>
          )}
          {caps.includes("color") && (
            <label className="flex items-center justify-between text-xs text-muted-foreground">
              Cor
              <input type="color" aria-label="Cor da luz" disabled={disabled || !s.on} defaultValue={s.color ?? "#ffffff"} key={s.color}
                onBlur={(e) => e.target.value !== s.color && send({ color: e.target.value }, false, "✓ Cor alterada.")}
                className="h-8 w-14 cursor-pointer rounded-lg border bg-transparent disabled:opacity-50" />
            </label>
          )}
          {caps.includes("lock") && (
            <Button className="w-full" variant={s.locked ? "secondary" : "destructive"} disabled={disabled}
              onClick={() => send({ locked: !s.locked }, false, `✓ ${device.name} ${s.locked ? "destravada" : "travada"}.`)}>
              {s.locked ? <><Lock className="size-4" /> Travada — destravar</> : <><LockOpen className="size-4" /> Destravada — travar</>}
            </Button>
          )}

          {/* Botões Rápidos de Smart TV */}
          {isTv && !offline && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium flex items-center gap-1.5 text-foreground">
                  <Tv className="size-3.5 text-primary" /> Funções Rápidas
                </span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary" onClick={() => setShowRemote(true)}>
                  Abrir Controle Remoto
                </Button>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="flex-1 h-7 text-[11px]" onClick={() => triggerTvAction("vol_down")}>
                  Vol -
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 h-7 text-[11px]" onClick={() => triggerTvAction("vol_up")}>
                  Vol +
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 h-7 text-[11px]" onClick={() => triggerTvAction("youtube")}>
                  YouTube
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 h-7 text-[11px]" onClick={() => triggerTvAction("netflix")}>
                  Netflix
                </Button>
              </div>
            </div>
          )}

          {s.temperature !== undefined && !caps.includes("temperature") && (
            <p className="text-sm"><span className="font-display text-2xl font-semibold">{s.temperature}°C</span>{s.humidity !== undefined && <span className="ml-3 text-muted-foreground">{s.humidity}% umidade</span>}</p>
          )}
          {s.motion !== undefined && <p className="text-sm text-muted-foreground">{s.motion ? "Movimento detectado" : "Sem movimento"}</p>}
          {s.power !== undefined && <p className="text-sm text-muted-foreground">Consumo: <span className="text-foreground">{s.power} W</span></p>}

          {/* Estado Offline e Ações de Auto-Recuperação */}
          {offline && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Não foi possível conectar ao dispositivo. Verifique a conexão ou clique abaixo para colocá-lo online.
              </p>
              {canControl && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busy}
                    onClick={forceOnline}
                  >
                    <CheckCircle2 className="size-3.5" /> Colocar Online Agora
                  </Button>
                  {tvIp && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      disabled={testingPing || busy}
                      onClick={handleTestPing}
                    >
                      <Wifi className={`size-3.5 ${testingPing ? "animate-pulse" : ""}`} />
                      {testingPing ? "Testando..." : "Testar Conexão"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Controle Remoto Smart TV */}
      {isTv && (
        <Dialog open={showRemote} onOpenChange={setShowRemote}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Tv className="size-5 text-primary" />
                Controle Remoto — {device.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Controle via WebSocket local ({tvIp || "192.168.0.168"})
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center space-y-4 py-2">
              {/* Botão Power */}
              <div className="flex w-full justify-between items-center px-4">
                <Button
                  size="icon"
                  variant="destructive"
                  className="rounded-full size-11 shadow"
                  onClick={() => triggerTvAction("power")}
                >
                  <Power className="size-5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full size-10"
                  onClick={() => triggerTvAction("toast")}
                  title="Enviar aviso para a TV"
                >
                  <Bell className="size-4" />
                </Button>
              </div>

              {/* Botões de Volume e Mudo */}
              <div className="grid grid-cols-3 gap-2 w-full px-2">
                <Button variant="secondary" className="h-10 text-xs" onClick={() => triggerTvAction("vol_down")}>
                  <Minus className="size-4 mr-1" /> Vol -
                </Button>
                <Button variant="outline" className="h-10 text-xs" onClick={() => triggerTvAction("mute")}>
                  <VolumeX className="size-4" />
                </Button>
                <Button variant="secondary" className="h-10 text-xs" onClick={() => triggerTvAction("vol_up")}>
                  <Plus className="size-4 mr-1" /> Vol +
                </Button>
              </div>

              {/* Teclado Direcional (D-PAD) */}
              <div className="relative size-36 rounded-full border border-border bg-muted/40 p-1 flex items-center justify-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1 size-8 rounded-full"
                  onClick={() => LG_COMMANDS.channelUp(tvIp || "192.168.0.168")}
                >
                  <ChevronUp className="size-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute bottom-1 size-8 rounded-full"
                  onClick={() => LG_COMMANDS.channelDown(tvIp || "192.168.0.168")}
                >
                  <ChevronDown className="size-5" />
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="size-12 rounded-full font-bold text-xs"
                  onClick={() => LG_COMMANDS.play(tvIp || "192.168.0.168")}
                >
                  OK
                </Button>
              </div>

              {/* Atalhos de Aplicativos */}
              <div className="w-full space-y-1.5 px-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Aplicativos</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold text-red-500 hover:text-red-600" onClick={() => triggerTvAction("youtube")}>
                    YouTube
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700" onClick={() => triggerTvAction("netflix")}>
                    Netflix
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-semibold text-sky-500 hover:text-sky-600" onClick={() => LG_COMMANDS.openLiveTv(tvIp || "192.168.0.168")}>
                    TV Aberta
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação de segurança</AlertDialogTitle>
            <AlertDialogDescription>
              Você deseja realmente {caps.includes("lock") ? lockLabel : "alterar"} “{device.name}”? Esta ação ficará registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const p = confirm!; setConfirm(null); send(p, true, `✓ ${device.name} atualizado(a).`); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
