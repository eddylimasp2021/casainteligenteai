import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Minus, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { categoryIcon, friendlyError, typeLabel } from "@/lib/catalog";
import { stateOf, type Device } from "@/lib/queries";
import { StatusBadge } from "./ui-states";
import { cn } from "@/lib/utils";

export function DeviceCard({ device, roomName, canControl, compact }: { device: Device; roomName?: string; canControl: boolean; compact?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const s = stateOf(device);
  const caps = device.capabilities ?? [];
  const Icon = categoryIcon(device.category);
  const offline = device.status !== "online";
  const disabled = !canControl || offline || busy;
  const isOn = caps.includes("lock") ? !s.locked : !!s.on;

  async function send(patch: Record<string, unknown>, confirmed = false, label?: string) {
    if (device.is_critical && !confirmed) { setConfirm(patch); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("set_device_state", { _device: device.id, _patch: patch as never, _confirmed: confirmed });
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["devices", device.household_id] });
    if (error) {
      toast.error(friendlyError(error), { action: { label: "Tentar novamente", onClick: () => send(patch, confirmed, label) } });
      return;
    }
    const result = (data as { result?: string } | null)?.result;
    if (result === "pending_gateway") toast.warning(`Comando enviado para ${device.name}. Não consegui confirmar a execução: aguardando o gateway.`);
    else if (label) toast.success(label);
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
                onValueCommit={(v) => send({ volume: v[0] }, false, `✓ Volume ajustado.`)} />
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
          {s.temperature !== undefined && !caps.includes("temperature") && (
            <p className="text-sm"><span className="font-display text-2xl font-semibold">{s.temperature}°C</span>{s.humidity !== undefined && <span className="ml-3 text-muted-foreground">{s.humidity}% umidade</span>}</p>
          )}
          {s.motion !== undefined && <p className="text-sm text-muted-foreground">{s.motion ? "Movimento detectado" : "Sem movimento"}</p>}
          {s.power !== undefined && <p className="text-sm text-muted-foreground">Consumo: <span className="text-foreground">{s.power} W</span></p>}
          {offline && <p className="text-xs text-muted-foreground">Não foi possível conectar ao dispositivo. Verifique a conexão.</p>}
        </div>
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
