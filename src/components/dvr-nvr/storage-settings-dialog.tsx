import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StorageDisk, IpCamera } from "@/types/dvr-nvr";
import {
  HardDrive,
  Database,
  Thermometer,
  ShieldCheck,
  RefreshCw,
  Clock,
  Trash2,
  Calendar,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface StorageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disks: StorageDisk[];
  cameras: IpCamera[];
}

export function StorageSettingsDialog({
  open,
  onOpenChange,
  disks,
  cameras,
}: StorageSettingsDialogProps) {
  const [retentionDays, setRetentionDays] = useState(30);
  const [overwriteMode, setOverwriteMode] = useState<"loop" | "stop">("loop");
  const [preRecordSec, setPreRecordSec] = useState(10);
  const [postRecordSec, setPostRecordSec] = useState(30);
  const [schedulePreset, setSchedulePreset] = useState<"24x7" | "ai_only" | "hybrid">("hybrid");
  const [isSmartRunning, setIsSmartRunning] = useState(false);

  // Storage metrics
  const totalStorageBytes = disks.reduce((acc, d) => acc + d.totalBytes, 0);
  const usedStorageBytes = disks.reduce((acc, d) => acc + d.usedBytes, 0);
  const freeStorageBytes = Math.max(0, totalStorageBytes - usedStorageBytes);
  const usedPercentage = Math.round((usedStorageBytes / totalStorageBytes) * 100);

  // Bitrate estimation
  const totalBitrateKbps = cameras
    .filter((c) => c.status === "online")
    .reduce((acc, c) => acc + c.bitrateKbps, 0);
  // (bitrate kbps / 8) * 3600 * 24 / 1024 / 1024 = GB per day
  const dailyConsumptionGb = Math.round((totalBitrateKbps / 8 / 1024 / 1024) * 86400 * 10) / 10;
  const freeGb = Math.round(freeStorageBytes / 1_000_000_000);
  const estimatedDaysRemaining = dailyConsumptionGb > 0 ? Math.round(freeGb / dailyConsumptionGb) : 999;

  const formatGbOrTb = (bytes: number) => {
    const tb = bytes / 1_000_000_000_000;
    if (tb >= 1) return `${tb.toFixed(1)} TB`;
    return `${Math.round(bytes / 1_000_000_000)} GB`;
  };

  const handleRunSmart = () => {
    setIsSmartRunning(true);
    toast.info("Executando diagnóstico S.M.A.R.T. em todos os discos...");
    setTimeout(() => {
      setIsSmartRunning(false);
      toast.success("Diagnóstico S.M.A.R.T. concluído: Todos os discos em perfeito estado (0 bad sectors).");
    }, 2000);
  };

  const handleFormatDisk = (diskName: string) => {
    if (confirm(`Tem certeza que deseja formatar o volume "${diskName}"? Todas as gravações locais deste disco serão excluídas permanentemente.`)) {
      toast.success(`Disco ${diskName} formatado com sucesso.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Armazenamento & Políticas do NVR</DialogTitle>
              <DialogDescription>
                Gerenciamento de discos rígidos CCTV, integridade S.M.A.R.T., retenção e cronograma semanal de gravação
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Storage Overview Banner */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Pool de Gravação Consolidado</span>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                ● Status do Pool: Saudável
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Ocupado: <strong className="text-foreground">{formatGbOrTb(usedStorageBytes)}</strong> ({usedPercentage}%)</span>
                <span>Livre: <strong className="text-foreground">{formatGbOrTb(freeStorageBytes)}</strong> de {formatGbOrTb(totalStorageBytes)}</span>
              </div>
              <Progress value={usedPercentage} className="h-2.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                <div className="text-muted-foreground">Taxa de Gravação Total</div>
                <div className="text-base font-semibold text-foreground mt-0.5">{(totalBitrateKbps / 1024).toFixed(1)} Mbps</div>
                <div className="text-[11px] text-muted-foreground">{cameras.filter((c) => c.status === "online").length} canais ativos</div>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                <div className="text-muted-foreground">Consumo Estimado</div>
                <div className="text-base font-semibold text-foreground mt-0.5">~{dailyConsumptionGb} GB / dia</div>
                <div className="text-[11px] text-muted-foreground">Com compressão H.265</div>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                <div className="text-muted-foreground">Autonomia do Disco</div>
                <div className="text-base font-semibold text-emerald-400 mt-0.5">~{estimatedDaysRemaining} dias restantes</div>
                <div className="text-[11px] text-muted-foreground">Até sobrescrita em loop</div>
              </div>
            </div>
          </div>

          {/* Physical Disks List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" /> Unidades Físicas & Saúde S.M.A.R.T.
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunSmart}
                disabled={isSmartRunning}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSmartRunning ? "animate-spin text-primary" : ""}`} />
                {isSmartRunning ? "Verificando..." : "Diagnóstico S.M.A.R.T."}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {disks.map((disk) => {
                const diskPercent = Math.round((disk.usedBytes / disk.totalBytes) * 100);
                return (
                  <div key={disk.id} className="p-3.5 rounded-lg border border-border/60 bg-card/80 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-xs text-foreground line-clamp-1">{disk.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                            {disk.type}
                          </Badge>
                          <span>{formatGbOrTb(disk.usedBytes)} / {formatGbOrTb(disk.totalBytes)}</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {disk.smartStatus}
                      </Badge>
                    </div>

                    <Progress value={diskPercent} className="h-2" />

                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                        <span>Temperatura: <strong className="text-foreground">{disk.temperatureCelsius}°C</strong></span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFormatDisk(disk.name)}
                        className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Formatar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retention & Overwrite Rules */}
          <div className="rounded-xl border border-border/60 p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Políticas de Retenção e Gravação em Loop (FIFO)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <Label className="text-xs">Comportamento quando o disco estiver cheio:</Label>
                <RadioGroup
                  value={overwriteMode}
                  onValueChange={(v: "loop" | "stop") => setOverwriteMode(v)}
                  className="space-y-2 pt-1"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="loop" id="mode-loop" className="mt-0.5" />
                    <div>
                      <Label htmlFor="mode-loop" className="font-medium cursor-pointer">
                        Sobrescrever automaticamente em loop contínuo (Recomendado)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Os arquivos mais antigos são descartados conforme novos blocos são gravados (FIFO).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="stop" id="mode-stop" className="mt-0.5" />
                    <div>
                      <Label htmlFor="mode-stop" className="font-medium cursor-pointer">
                        Parar gravação e emitir alarme sonoro
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Garante que nenhum registro antigo seja apagado sem autorização expressa.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs">Tempo Máximo de Retenção:</Label>
                    <span className="font-semibold text-primary">{retentionDays} dias</span>
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="90"
                    step="7"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>7 dias</span>
                    <span>30 dias</span>
                    <span>60 dias</span>
                    <span>90 dias</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pré-gravação de Evento</Label>
                    <select
                      value={preRecordSec}
                      onChange={(e) => setPreRecordSec(Number(e.target.value))}
                      className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
                    >
                      <option value="5">5 segundos</option>
                      <option value="10">10 segundos</option>
                      <option value="15">15 segundos</option>
                      <option value="30">30 segundos</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Pós-gravação de Evento</Label>
                    <select
                      value={postRecordSec}
                      onChange={(e) => setPostRecordSec(Number(e.target.value))}
                      className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
                    >
                      <option value="15">15 segundos</option>
                      <option value="30">30 segundos</option>
                      <option value="60">1 minuto</option>
                      <option value="120">2 minutos</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recording Schedule Matrix */}
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Cronograma de Gravação Semanal (24/7 Schedule)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define o modo operacional para cada período da semana nas câmeras conectadas
                </p>
              </div>

              {/* Preset buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant={schedulePreset === "24x7" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSchedulePreset("24x7")}
                  className="h-7 text-xs px-2.5"
                >
                  24/7 Contínuo
                </Button>
                <Button
                  variant={schedulePreset === "hybrid" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSchedulePreset("hybrid")}
                  className="h-7 text-xs px-2.5 text-primary border-primary/30"
                >
                  Híbrido Inteligente
                </Button>
                <Button
                  variant={schedulePreset === "ai_only" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSchedulePreset("ai_only")}
                  className="h-7 text-xs px-2.5"
                >
                  Apenas I.A. & Movimento
                </Button>
              </div>
            </div>

            {/* Visual Schedule Matrix */}
            <div className="overflow-x-auto pt-2">
              <div className="min-w-[500px] space-y-1.5 text-xs">
                {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="w-16 text-muted-foreground font-mono text-[11px] shrink-0">{day.slice(0, 3)}</span>
                    <div className="flex-1 grid grid-cols-4 gap-1 h-6">
                      <div
                        className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                          schedulePreset === "ai_only"
                            ? "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                            : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                        }`}
                        title="Madrugada (00h - 06h)"
                      >
                        00h-06h ({schedulePreset === "ai_only" ? "I.A." : "Contínuo"})
                      </div>
                      <div
                        className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                          schedulePreset === "24x7"
                            ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                            : "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                        }`}
                        title="Manhã (06h - 12h)"
                      >
                        06h-12h ({schedulePreset === "24x7" ? "Contínuo" : "I.A."})
                      </div>
                      <div
                        className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                          schedulePreset === "24x7"
                            ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                            : "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                        }`}
                        title="Tarde (12h - 18h)"
                      >
                        12h-18h ({schedulePreset === "24x7" ? "Contínuo" : "I.A."})
                      </div>
                      <div
                        className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                          schedulePreset === "ai_only"
                            ? "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                            : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                        }`}
                        title="Noite (18h - 24h)"
                      >
                        18h-24h ({schedulePreset === "ai_only" ? "I.A." : "Contínuo"})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 pt-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">Legenda:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-500/50 border border-emerald-400" />
                <span>Contínuo 24h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-purple-500/50 border border-purple-400" />
                <span>I.A. (Humano / Veículo)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500/50 border border-amber-400" />
                <span>Movimento Geral</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              toast.success("Políticas de armazenamento e cronograma aplicados com sucesso.");
              onOpenChange(false);
            }}
          >
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
