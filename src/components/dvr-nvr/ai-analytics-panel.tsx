import { useState } from "react";
import { 
  ShieldAlert, ShieldCheck, User, Car, Bell, BellOff, 
  Settings2, Sliders, CheckCircle2, Eye, Zap, Volume2, Shield
} from "lucide-react";
import type { AiSecurityEvent, IpCamera } from "@/types/dvr-nvr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface AiAnalyticsPanelProps {
  events: AiSecurityEvent[];
  cameras: IpCamera[];
  onAcknowledgeEvent: (id: string) => void;
}

export function AiAnalyticsPanel({ events, cameras, onAcknowledgeEvent }: AiAnalyticsPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [sensitivity, setSensitivity] = useState<number>(85);
  const [tripwireActive, setTripwireActive] = useState<boolean>(true);
  const [humanDetectionActive, setHumanDetectionActive] = useState<boolean>(true);
  const [vehicleDetectionActive, setVehicleDetectionActive] = useState<boolean>(true);
  const [automationTrigger, setAutomationTrigger] = useState<boolean>(true);

  // Motion grid mask (8x6 cells, false = active detection, true = masked/ignored)
  const [maskGrid, setMaskGrid] = useState<boolean[]>(Array(48).fill(false));

  const toggleMaskCell = (index: number) => {
    const updated = [...maskGrid];
    updated[index] = !updated[index];
    setMaskGrid(updated);
  };

  const clearMask = () => {
    setMaskGrid(Array(48).fill(false));
    toast.info("Máscara de movimento limpa. Detecção ativa em todo o quadro.");
  };

  const filteredEvents = events.filter((e) => {
    if (filterType === "all") return true;
    return e.type === filterType;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Live Security Feed */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            <h3 className="font-bold text-base">Ocorrências & Detecções em Tempo Real (I.A.)</h3>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "Todos" },
              { id: "human", label: "Pessoas" },
              { id: "vehicle", label: "Veículos" },
              { id: "tripwire", label: "Linha Virtual" },
            ].map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filterType === f.id ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFilterType(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-dashed">
              <ShieldCheck className="mx-auto size-10 text-emerald-500 mb-2 opacity-80" />
              <p className="font-semibold">Nenhuma ocorrência suspeita no filtro selecionado.</p>
              <p className="text-xs">O sistema de vigilância está monitorando todas as câmeras ativas.</p>
            </Card>
          ) : (
            filteredEvents.map((evt) => (
              <Card
                key={evt.id}
                className={`transition-all border-l-4 ${
                  !evt.acknowledged
                    ? "border-l-amber-500 bg-amber-500/5 shadow-md"
                    : "border-l-muted-foreground/30 opacity-80"
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl p-2.5 bg-background border shadow-sm shrink-0 mt-0.5 sm:mt-0">
                      {evt.type === "human" && <User className="size-5 text-emerald-500" />}
                      {evt.type === "vehicle" && <Car className="size-5 text-blue-500" />}
                      {evt.type === "tripwire" && <ShieldAlert className="size-5 text-rose-500" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{evt.cameraName}</span>
                        <Badge
                          variant="outline"
                          className={
                            evt.type === "human"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : evt.type === "vehicle"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                          }
                        >
                          Confiança: {Math.round(evt.confidence * 100)}%
                        </Badge>
                        {!evt.acknowledged && (
                          <Badge className="bg-amber-500 text-black font-bold text-[10px]">NOVO</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{evt.description}</p>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleTimeString()} ({new Date(evt.timestamp).toLocaleDateString()})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!evt.acknowledged ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs border-amber-500/50 hover:bg-amber-500/10 text-amber-500"
                        onClick={() => {
                          onAcknowledgeEvent(evt.id);
                          toast.success("Alerta verificado e reconhecido!");
                        }}
                      >
                        <CheckCircle2 className="size-3.5" /> Reconhecer
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="size-4" /> Verificado
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Right Column: AI Rules & Mask Settings */}
      <div className="space-y-6">
        {/* Detection Rules Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="size-4 text-primary" /> Parâmetros de I.A. & Analíticos
            </CardTitle>
            <CardDescription className="text-xs">
              Ajuste fino de sensibilidade dos algoritmos de visão computacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Detecção de Pessoas (Human)</p>
                <p className="text-xs text-muted-foreground">Filtro anti-falsos alarmes para pedestres</p>
              </div>
              <Switch checked={humanDetectionActive} onCheckedChange={setHumanDetectionActive} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Detecção de Veículos</p>
                <p className="text-xs text-muted-foreground">Identifica carros, motos e caminhões</p>
              </div>
              <Switch checked={vehicleDetectionActive} onCheckedChange={setVehicleDetectionActive} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Cruzamento de Linha (Tripwire)</p>
                <p className="text-xs text-muted-foreground">Alerta em invasão de muros e perímetros</p>
              </div>
              <Switch checked={tripwireActive} onCheckedChange={setTripwireActive} />
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Sensibilidade da I.A.</span>
                <span className="font-mono font-bold text-foreground">{sensitivity}%</span>
              </div>
              <Slider
                value={[sensitivity]}
                min={50}
                max={99}
                step={1}
                onValueChange={(val) => setSensitivity(val[0])}
              />
            </div>

            <div className="pt-2 border-t flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Zap className="size-4 text-amber-500" /> Automação Residencial
                </p>
                <p className="text-xs text-muted-foreground">
                  Ligar holofotes se detectar pessoa após as 22h
                </p>
              </div>
              <Switch checked={automationTrigger} onCheckedChange={setAutomationTrigger} />
            </div>
          </CardContent>
        </Card>

        {/* Motion Grid Masking Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="size-4 text-primary" /> Máscara de Movimento
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clearMask}>
                Limpar
              </Button>
            </div>
            <CardDescription className="text-xs">
              Clique nos blocos vermelhos para excluir áreas com árvores em movimento, varais ou vias públicas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-8 gap-1 aspect-video w-full rounded-lg bg-neutral-950 p-1.5 border">
              {maskGrid.map((isMasked, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleMaskCell(i)}
                  className={`rounded-sm transition-colors border ${
                    isMasked
                      ? "bg-rose-500/60 border-rose-500"
                      : "bg-white/5 border-white/10 hover:bg-white/20"
                  }`}
                  title={isMasked ? "Área Ignorada (Máscara Ativa)" : "Área Monitorada"}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-white/20" /> Monitorado
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-rose-500" /> Ignorado (Máscara)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
