import { useState } from "react";
import {
  Play,
  Clock,
  Zap,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tv,
  Lightbulb,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ConfigurableAutomation } from "@/types/automations";
import { Device } from "@/lib/queries";
import { executeAutomation } from "@/lib/ai-automations";

interface AutomationCardProps {
  automation: ConfigurableAutomation;
  devices: Device[];
  onToggleEnabled: (id: string) => void;
  onEdit: (automation: ConfigurableAutomation) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_STYLES: Record<string, { label: string; badge: string }> = {
  noturno: { label: "Noturno", badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
  conforto: { label: "Conforto", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  seguranca: { label: "Segurança", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  clima: { label: "Clima", badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  energia: { label: "Energia", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  geral: { label: "Geral", badge: "bg-muted text-muted-foreground border-border" },
};

const ACTION_LABELS: Record<string, string> = {
  turn_on: "Ligar",
  turn_off: "Desligar",
  set_brightness: "Ajustar Brilho",
  set_volume: "Ajustar Volume",
  set_temperature: "Climatizar",
  lock: "Trancar",
  unlock: "Destrancar",
};

export function AutomationCard({
  automation,
  devices,
  onToggleEnabled,
  onEdit,
  onDelete,
}: AutomationCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const cat = CATEGORY_STYLES[automation.category] || CATEGORY_STYLES.geral;

  const handleRun = async () => {
    setIsRunning(true);
    toast.info(`Executando rotina "${automation.name}"...`);
    try {
      const res = await executeAutomation(automation, devices);
      if (res.failed === 0) {
        toast.success(`✓ Rotina executada com sucesso em ${res.executed} dispositivo(s)!`);
      } else {
        toast.warning(`Rotina executada: ${res.executed} sucesso(s), ${res.failed} falha(s).`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao executar rotina.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col justify-between transition-all duration-200 border shadow-sm hover:shadow-md",
        !automation.enabled && "opacity-60 bg-muted/20"
      )}
    >
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", cat?.badge)}>
                {cat?.label}
              </Badge>
              {automation.modelUsed && (
                <Badge variant="secondary" className="text-[10px] font-mono gap-1 py-0 h-4 bg-muted/60">
                  <Sparkles className="size-2.5 text-cyan-400" />
                  <span className="truncate max-w-[120px]">{automation.modelUsed}</span>
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold leading-tight line-clamp-1">
              {automation.name}
            </CardTitle>
          </div>

          <Switch
            checked={automation.enabled}
            onCheckedChange={() => onToggleEnabled(automation.id)}
            title={automation.enabled ? "Desativar rotina" : "Ativar rotina"}
          />
        </div>

        <CardDescription className="text-xs line-clamp-2">
          {automation.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-3 flex-1">
        {/* Trigger Badge */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-2.5 py-1.5">
          <Clock className="size-3.5 text-cyan-400 shrink-0" />
          <span className="truncate font-medium">
            {automation.trigger.type === "time" && automation.trigger.time
              ? `Horário: Diariamente às ${automation.trigger.time}`
              : automation.trigger.description || "Gatilho configurado"}
          </span>
        </div>

        {/* Action Pills */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">
            Ações ({automation.actions.length} dispositivos):
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {automation.actions.map((act, i) => {
              const label = ACTION_LABELS[act.actionType] || act.actionType;
              const paramText =
                act.params.brightness !== undefined
                  ? `${act.params.brightness}%`
                  : act.params.volume !== undefined
                  ? `Vol ${act.params.volume}`
                  : act.params.temperature !== undefined
                  ? `${act.params.temperature}°C`
                  : "";

              return (
                <span
                  key={act.id || i}
                  className="text-[11px] px-2 py-0.5 rounded-md border bg-card text-foreground font-medium flex items-center gap-1 shadow-2xs"
                >
                  <Zap className="size-2.5 text-amber-400" />
                  <span className="truncate max-w-[110px]">{act.deviceName}</span>
                  <span className="text-muted-foreground text-[10px]">
                    ({label} {paramText})
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-2 border-t flex items-center justify-between gap-2 bg-muted/10">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(automation)}
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            title="Editar configurações"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(automation.id)}
            className="size-7 p-0 text-muted-foreground hover:text-destructive"
            title="Excluir rotina"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <Button
          size="sm"
          onClick={handleRun}
          disabled={isRunning || automation.actions.length === 0}
          className="h-7 text-xs font-semibold gap-1.5 bg-primary/90 hover:bg-primary"
        >
          {isRunning ? (
            <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
          <span>Executar Agora</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
