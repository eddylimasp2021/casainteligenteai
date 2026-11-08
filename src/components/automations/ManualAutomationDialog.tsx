import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Device, Room } from "@/lib/queries";
import {
  ConfigurableAutomation,
  AutomationCategory,
  AutomationTrigger,
  AutomationAction,
} from "@/types/automations";
import { saveSingleAutomation } from "@/lib/ai-automations";
import { getStoredScenes } from "@/lib/scenes";
import { toast } from "sonner";
import { Clock, Radio, Check, Plus, Trash2, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManualAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  devices: Device[];
  rooms: Room[];
  onSaved: () => void;
}

const DAYS_OF_WEEK = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

export function ManualAutomationDialog({
  open,
  onOpenChange,
  householdId,
  devices,
  rooms,
  onSaved,
}: ManualAutomationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AutomationCategory>("conforto");
  const [triggerType, setTriggerType] = useState<"time" | "sensor">("time");

  // Gatilho de Horário
  const [triggerTime, setTriggerTime] = useState("22:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Gatilho de Sensor
  const [sensorId, setSensorId] = useState("");
  const [sensorCondition, setSensorCondition] = useState<
    "motion_detected" | "presence_detected" | "opened" | "closed" | "temp_above"
  >("motion_detected");
  const [thresholdTemp, setThresholdTemp] = useState(25);

  // Ações nos dispositivos
  const [actions, setActions] = useState<AutomationAction[]>([]);

  const scenes = getStoredScenes(householdId);

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleAddDeviceAction = (deviceId: string) => {
    const dev = devices.find((d) => d.id === deviceId);
    if (!dev) return;
    if (actions.some((a) => a.deviceId === deviceId)) return;

    const room = rooms.find((r) => r.id === dev.room_id);
    const isLock = dev.capabilities.includes("lock");
    const isTemp = dev.capabilities.includes("temperature");
    const isBrightness = dev.capabilities.includes("brightness");

    const newAct: AutomationAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deviceId: dev.id,
      deviceName: dev.name,
      roomName: room?.name,
      actionType: isLock ? "lock" : "turn_on",
      params: {
        on: isLock ? undefined : true,
        locked: isLock ? true : undefined,
        brightness: isBrightness ? 80 : undefined,
        temperature: isTemp ? 22 : undefined,
      },
    };

    setActions([...actions, newAct]);
  };

  const removeAction = (actionId: string) => {
    setActions(actions.filter((a) => a.id !== actionId));
  };

  const updateActionParam = (actionId: string, key: string, value: any) => {
    setActions(
      actions.map((act) => {
        if (act.id === actionId) {
          const updatedParams = { ...act.params, [key]: value };
          let actionType = act.actionType;
          if (key === "on") actionType = value ? "turn_on" : "turn_off";
          if (key === "locked") actionType = value ? "lock" : "unlock";
          return { ...act, actionType, params: updatedParams };
        }
        return act;
      })
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe um título para a automação.");
      return;
    }

    if (actions.length === 0) {
      toast.error("Adicione pelo menos 1 ação a ser executada.");
      return;
    }

    let trigger: AutomationTrigger;
    if (triggerType === "time") {
      trigger = {
        type: "time",
        time: triggerTime,
        daysOfWeek: selectedDays.length === 7 ? [] : selectedDays,
        description: `Todos os dias às ${triggerTime}`,
      };
    } else {
      const dev = devices.find((d) => d.id === sensorId);
      trigger = {
        type: "sensor",
        sensorDeviceId: sensorId,
        sensorDeviceName: dev?.name || "Sensor",
        sensorCondition,
        thresholdValue: sensorCondition === "temp_above" ? thresholdTemp : undefined,
        description: `Quando ${dev?.name || "sensor"} detectar evento`,
      };
    }

    const auto: ConfigurableAutomation = {
      id: `auto-manual-${Date.now()}`,
      householdId,
      name: name.trim(),
      description: description.trim() || `Automação agendada para ${trigger.description}`,
      category,
      enabled: true,
      trigger,
      conditions: [],
      actions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
    };

    saveSingleAutomation(householdId, auto);
    toast.success(`Automação "${auto.name}" criada com sucesso!`);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
              <Sliders className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Criar Automação Passo a Passo
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure regras lógicas: escolha quando executar e quais ações aplicar nos dispositivos.
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 space-y-6">
          <div className="space-y-5">
            {/* Nome e Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Nome da Automação *</Label>
                <Input
                  placeholder="Ex: Desligar tudo ao dormir, Ar condicionado à noite..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={category} onValueChange={(v: AutomationCategory) => setCategory(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conforto">Conforto</SelectItem>
                    <SelectItem value="noturno">Noturno</SelectItem>
                    <SelectItem value="seguranca">Segurança</SelectItem>
                    <SelectItem value="energia">Energia</SelectItem>
                    <SelectItem value="clima">Clima</SelectItem>
                    <SelectItem value="geral">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SEÇÃO DE GATILHO (QUANDO) */}
            <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>1. Quando Isso Acontecer (Gatilho)</span>
                </Label>

                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => setTriggerType("time")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                      triggerType === "time"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Horário Agendado
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriggerType("sensor")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                      triggerType === "sensor"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sensor / Evento
                  </button>
                </div>
              </div>

              {triggerType === "time" ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Horário de Execução:</span>
                      <Input
                        type="time"
                        value={triggerTime}
                        onChange={(e) => setTriggerTime(e.target.value)}
                        className="h-9 w-32 font-mono text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">Repetir nos dias:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Dispositivo Sensor:</span>
                    <Select value={sensorId} onValueChange={setSensorId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione um sensor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Condição Detectada:</span>
                    <Select
                      value={sensorCondition}
                      onValueChange={(v: any) => setSensorCondition(v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motion_detected">Movimento detectado</SelectItem>
                        <SelectItem value="presence_detected">Presença detectada</SelectItem>
                        <SelectItem value="opened">Abertura de porta/janela</SelectItem>
                        <SelectItem value="closed">Fechamento de porta/janela</SelectItem>
                        <SelectItem value="temp_above">Temperatura acima do limite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO DE AÇÕES (ENTÃO FAÇA) */}
            <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Check className="size-3.5" />
                  <span>2. Então Faça (Ações nos Dispositivos)</span>
                </Label>

                <Select onValueChange={(val) => handleAddDeviceAction(val)}>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <Plus className="size-3.5 mr-1" />
                    <span>Adicionar Dispositivo</span>
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {actions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                  Nenhuma ação adicionada ainda. Clique em "Adicionar Dispositivo" acima para escolher o que será controlado.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {actions.map((act) => {
                    const dev = devices.find((d) => d.id === act.deviceId);
                    const hasBrightness = dev?.capabilities.includes("brightness");
                    const hasTemp = dev?.capabilities.includes("temperature");
                    const hasLock = dev?.capabilities.includes("lock");

                    return (
                      <div
                        key={act.id}
                        className="rounded-xl border bg-background p-3 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">
                              {act.deviceName}
                            </span>
                            {act.roomName && (
                              <Badge variant="outline" className="text-[10px]">
                                {act.roomName}
                              </Badge>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAction(act.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                          {hasLock ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Ação da Fechadura:</span>
                              <Button
                                type="button"
                                size="sm"
                                variant={act.params.locked ? "default" : "secondary"}
                                onClick={() =>
                                  updateActionParam(act.id, "locked", !act.params.locked)
                                }
                                className="h-7 text-xs px-3 font-semibold"
                              >
                                {act.params.locked ? "🔒 Trancar" : "🔓 Destrancar"}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Estado de Energia:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">
                                  {act.params.on ? "Ligar" : "Desligar"}
                                </span>
                                <Switch
                                  checked={!!act.params.on}
                                  onCheckedChange={(val) => updateActionParam(act.id, "on", val)}
                                />
                              </div>
                            </div>
                          )}

                          {hasBrightness && act.params.on && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Brilho Alvo:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {act.params.brightness ?? 80}%
                                </span>
                              </div>
                              <Slider
                                value={[act.params.brightness ?? 80]}
                                min={1}
                                max={100}
                                step={5}
                                onValueChange={([val]) =>
                                  updateActionParam(act.id, "brightness", val)
                                }
                              />
                            </div>
                          )}

                          {hasTemp && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Temperatura Alvo:</span>
                                <span className="font-mono font-bold text-foreground">
                                  {act.params.temperature ?? 22}°C
                                </span>
                              </div>
                              <Slider
                                value={[act.params.temperature ?? 22]}
                                min={16}
                                max={30}
                                step={1}
                                onValueChange={([val]) =>
                                  updateActionParam(act.id, "temperature", val)
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t flex flex-row items-center justify-between sm:justify-between bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            size="sm"
            className="text-xs font-semibold gap-1.5 px-5 shadow-xs"
          >
            <Check className="size-4" />
            <span>Salvar Automação</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
