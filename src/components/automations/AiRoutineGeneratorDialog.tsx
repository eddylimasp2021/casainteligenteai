import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Mic,
  MicOff,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Sliders,
  Tv,
  Lightbulb,
  Lock,
  Thermometer,
  Shield,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Device, Room } from "@/lib/queries";
import {
  ConfigurableAutomation,
  AutomationAction,
  AutomationCategory,
  AutomationTriggerType,
  AutomationActionType,
} from "@/types/automations";
import {
  generateAutomationWithAI,
  saveSingleAutomation,
  executeAutomation,
} from "@/lib/ai-automations";
import { loadAIConfig, AI_PROVIDERS } from "@/lib/ai-provider";

interface AiRoutineGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: Device[];
  rooms: Room[];
  householdId: string;
  initialPrompt?: string;
  editAutomation?: ConfigurableAutomation | null;
  onSaved?: (automation: ConfigurableAutomation) => void;
}

const INSPIRATION_PROMPTS = [
  {
    title: "🌙 Hora de Dormir",
    prompt: "Às 23h desligue a TV da sala, apague todas as luzes e verifique as câmeras.",
  },
  {
    title: "🎬 Modo Cinema",
    prompt: "Modo cinema: reduza as luzes da sala para 20%, ligue a TV e coloque o som em 25%.",
  },
  {
    title: "🌅 Bom Dia Produtivo",
    prompt: "Às 07:00 nos dias de semana, acenda a luz da cozinha em 80% e ligue a TV.",
  },
  {
    title: "🚗 Chegando em Casa",
    prompt: "Quando eu chegar em casa depois das 18h, acenda as luzes da garagem e da sala.",
  },
  {
    title: "🛡️ Proteção Máxima",
    prompt: "Ativar segurança total à meia-noite com foco nas câmeras externas e portão.",
  },
];

const DAYS_OF_WEEK = [
  { day: 0, label: "Dom" },
  { day: 1, label: "Seg" },
  { day: 2, label: "Ter" },
  { day: 3, label: "Qua" },
  { day: 4, label: "Qui" },
  { day: 5, label: "Sex" },
  { day: 6, label: "Sáb" },
];

export function AiRoutineGeneratorDialog({
  open,
  onOpenChange,
  devices,
  rooms,
  householdId,
  initialPrompt = "",
  editAutomation = null,
  onSaved,
}: AiRoutineGeneratorDialogProps) {
  const [promptText, setPromptText] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [automation, setAutomation] = useState<ConfigurableAutomation | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ executed: number; failed: number } | null>(null);

  const recognitionRef = useRef<any>(null);
  const aiConfig = loadAIConfig();
  const activeMeta = AI_PROVIDERS[aiConfig.activeProvider];

  useEffect(() => {
    if (editAutomation) {
      setAutomation(editAutomation);
      setPromptText(editAutomation.createdFromPrompt || "");
    } else {
      setAutomation(null);
      if (initialPrompt) setPromptText(initialPrompt);
    }
    setTestResult(null);
  }, [editAutomation, initialPrompt, open]);

  // Inicializa reconhecimento de voz
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.lang = "pt-BR";
        recog.continuous = false;
        recog.interimResults = false;

        recog.onresult = (e: any) => {
          const transcript = e.results[0]?.[0]?.transcript || "";
          setPromptText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };
        recog.onerror = () => setIsListening(false);
        recog.onend = () => setIsListening(false);
        recognitionRef.current = recog;
      }
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      toast.warning("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      toast.warning("Digite ou dite como deseja a sua rotina.");
      return;
    }

    setIsGenerating(true);
    setTestResult(null);
    try {
      const result = await generateAutomationWithAI(promptText.trim(), devices, rooms, householdId);
      setAutomation(result.automation);
      toast.success(`✓ Automação gerada com sucesso via ${result.modelUsed}!`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar rotina com IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!automation) return;
    saveSingleAutomation(householdId, automation);
    toast.success(`✓ Rotina "${automation.name}" salva e ativada!`);
    onSaved?.(automation);
    onOpenChange(false);
  };

  const handleTestNow = async () => {
    if (!automation) return;
    setIsTesting(true);
    toast.info("Enviando comandos reais para os dispositivos da rotina...");
    try {
      const res = await executeAutomation(automation, devices);
      setTestResult(res);
      if (res.failed === 0) {
        toast.success(`✓ ${res.executed} dispositivo(s) responderam com sucesso!`);
      } else {
        toast.warning(`${res.executed} dispositivo(s) atualizados, ${res.failed} falha(s).`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao executar teste.");
    } finally {
      setIsTesting(false);
    }
  };

  // Funções de Edição do Modelo Gerado
  const updateTriggerType = (type: AutomationTriggerType) => {
    if (!automation) return;
    setAutomation({
      ...automation,
      trigger: {
        ...automation.trigger,
        type,
        time: type === "time" ? automation.trigger.time || "22:00" : undefined,
      },
    });
  };

  const toggleDayOfWeek = (day: number) => {
    if (!automation) return;
    const current = automation.trigger.daysOfWeek || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setAutomation({
      ...automation,
      trigger: {
        ...automation.trigger,
        daysOfWeek: updated,
      },
    });
  };

  const updateAction = (index: number, patch: Partial<AutomationAction>) => {
    if (!automation) return;
    const updated = [...automation.actions];
    updated[index] = { ...updated[index]!, ...patch };
    setAutomation({ ...automation, actions: updated });
  };

  const removeAction = (index: number) => {
    if (!automation) return;
    const updated = automation.actions.filter((_, i) => i !== index);
    setAutomation({ ...automation, actions: updated });
  };

  const addAction = () => {
    if (!automation || devices.length === 0) return;
    const first = devices[0]!;
    const room = rooms.find((r) => r.id === first.room_id)?.name || "Geral";
    const newAct: AutomationAction = {
      id: `act-${Date.now()}`,
      deviceId: first.id,
      deviceName: first.name,
      roomName: room,
      actionType: "turn_on",
      params: { on: true },
    };
    setAutomation({ ...automation, actions: [...automation.actions, newAct] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/15 text-primary grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Criador de Rotinas com IA
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
                  {activeMeta.name} Gateway
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Descreva a rotina desejada em linguagem natural. A IA mapeará os dispositivos e condições automaticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── ETAPA 1: ENTRADA DE TEXTO LIVRE & INSPIRAÇÕES ── */}
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ex: Quando for 23h de segunda a sexta, desligue a TV da sala, apague todas as luzes e arme as câmeras..."
              rows={3}
              className="resize-none pr-12 text-sm bg-muted/30 focus-visible:ring-primary"
            />
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "ghost"}
              onClick={toggleMic}
              className={cn(
                "absolute right-2 bottom-2 size-8 rounded-full",
                isListening ? "animate-pulse" : "text-muted-foreground hover:text-foreground"
              )}
              title={isListening ? "Ouvindo... clique para parar" : "Falar por microfone"}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
          </div>

          {/* Quick Inspiration Pills */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="size-3 text-amber-400" /> Inspirações rápidas (clique para preencher):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {INSPIRATION_PROMPTS.map((insp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPromptText(insp.prompt)}
                  className="text-xs px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                >
                  {insp.title}
                </button>
              ))}
            </div>
          </div>

          {/* Botão de Geração */}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !promptText.trim()}
              className="gap-2 font-semibold shadow-md"
            >
              {isGenerating ? (
                <>
                  <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>Interpretando com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>{automation ? "Regerar com IA" : "Gerar Automação"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── ETAPA 2: EDITOR VISUAL DA AUTOMAÇÃO GERADA ── */}
        {automation && (
          <div className="space-y-4 pt-4 border-t mt-3 animate-in fade-in duration-300">
            {/* Header com Nome, Descrição e Categoria */}
            <div className="rounded-xl border bg-card p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Nome da Rotina</Label>
                  <Input
                    value={automation.name}
                    onChange={(e) => setAutomation({ ...automation, name: e.target.value })}
                    className="font-bold text-sm h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select
                    value={automation.category}
                    onValueChange={(val: AutomationCategory) =>
                      setAutomation({ ...automation, category: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-32 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conforto">Conforto</SelectItem>
                      <SelectItem value="seguranca">Segurança</SelectItem>
                      <SelectItem value="noturno">Noturno</SelectItem>
                      <SelectItem value="clima">Clima</SelectItem>
                      <SelectItem value="energia">Energia</SelectItem>
                      <SelectItem value="geral">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input
                  value={automation.description}
                  onChange={(e) => setAutomation({ ...automation, description: e.target.value })}
                  className="text-xs h-7 mt-0.5"
                />
              </div>

              {automation.modelUsed && (
                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="size-3 text-emerald-400" />
                  <span>Gerado via {automation.modelUsed}</span>
                </div>
              )}
            </div>

            {/* 1. GATILHO (QUANDO...) */}
            <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Gatilho (Quando deve executar)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de Gatilho</Label>
                  <Select
                    value={automation.trigger.type}
                    onValueChange={(val: AutomationTriggerType) => updateTriggerType(val)}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">Horário Programado</SelectItem>
                      <SelectItem value="sensor">Sensor de Presença / Movimento</SelectItem>
                      <SelectItem value="door_window">Porta ou Janela</SelectItem>
                      <SelectItem value="manual">Acionamento Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {automation.trigger.type === "time" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Horário</Label>
                    <Input
                      type="time"
                      value={automation.trigger.time || "22:00"}
                      onChange={(e) =>
                        setAutomation({
                          ...automation,
                          trigger: { ...automation.trigger, time: e.target.value },
                        })
                      }
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Dias da Semana (se gatilho for horário) */}
              {automation.trigger.type === "time" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Dias de Ativação</Label>
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((d) => {
                      const active = automation.trigger.daysOfWeek?.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.day)}
                          className={cn(
                            "size-7 rounded-md text-xs font-bold transition-all border",
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. CONDIÇÕES (E APENAS SE...) */}
            {automation.conditions.length > 0 && (
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    2. Condições Restritivas
                  </span>
                </div>
                <div className="space-y-1.5">
                  {automation.conditions.map((cond, i) => (
                    <div
                      key={cond.id || i}
                      className="flex items-center justify-between text-xs rounded-lg border bg-card px-3 py-1.5"
                    >
                      <span>{cond.description}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setAutomation({
                            ...automation,
                            conditions: automation.conditions.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. AÇÕES NOS DISPOSITIVOS (ENTÃO FAÇA...) */}
            <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    3. Ações nos Dispositivos ({automation.actions.length})
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={addAction} className="h-7 text-xs gap-1">
                  <Plus className="size-3" /> Adicionar Dispositivo
                </Button>
              </div>

              <div className="space-y-2.5">
                {automation.actions.map((act, index) => {
                  const targetDev = devices.find((d) => d.id === act.deviceId);
                  const isTv =
                    targetDev?.category === "entretenimento" ||
                    targetDev?.device_type === "televisao";
                  const isLight = targetDev?.category === "iluminacao";
                  const isLock = targetDev?.capabilities.includes("lock");
                  const isClimate = targetDev?.category === "clima";

                  return (
                    <div
                      key={act.id || index}
                      className="rounded-lg border bg-card p-3 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Seletor de Dispositivo */}
                        <div className="flex-1">
                          <Select
                            value={act.deviceId}
                            onValueChange={(val) => {
                              const dev = devices.find((d) => d.id === val);
                              const room = rooms.find((r) => r.id === dev?.room_id)?.name || "Geral";
                              updateAction(index, {
                                deviceId: val,
                                deviceName: dev ? dev.name : "Dispositivo",
                                roomName: room,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold">
                              <SelectValue placeholder="Selecione o dispositivo" />
                            </SelectTrigger>
                            <SelectContent>
                              {devices.map((d) => {
                                const room = rooms.find((r) => r.id === d.room_id)?.name || "Geral";
                                return (
                                  <SelectItem key={d.id} value={d.id} className="text-xs">
                                    {d.name} ({room})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Tipo de Ação */}
                        <div className="w-36">
                          <Select
                            value={act.actionType}
                            onValueChange={(val: AutomationActionType) => {
                              const newParams: Record<string, any> = {};
                              if (val === "turn_on") newParams.on = true;
                              if (val === "turn_off") newParams.on = false;
                              if (val === "lock") newParams.locked = true;
                              if (val === "unlock") newParams.locked = false;
                              if (val === "set_brightness") {
                                newParams.on = true;
                                newParams.brightness = 50;
                              }
                              if (val === "set_volume") newParams.volume = 20;
                              if (val === "set_temperature") newParams.temperature = 22;
                              updateAction(index, { actionType: val, params: newParams });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="turn_on">Ligar</SelectItem>
                              <SelectItem value="turn_off">Desligar</SelectItem>
                              {isLight && <SelectItem value="set_brightness">Ajustar Brilho</SelectItem>}
                              {isTv && <SelectItem value="set_volume">Ajustar Volume</SelectItem>}
                              {isClimate && <SelectItem value="set_temperature">Ajustar Temperatura</SelectItem>}
                              {isLock && <SelectItem value="lock">Trancar</SelectItem>}
                              {isLock && <SelectItem value="unlock">Destrancar</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Botão Remover */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeAction(index)}
                          className="size-8 text-muted-foreground hover:text-destructive"
                          title="Remover esta ação"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      {/* Parâmetros Específicos da Ação */}
                      {act.actionType === "set_brightness" && (
                        <div className="flex items-center gap-3 pt-1">
                          <Label className="text-xs text-muted-foreground min-w-[70px]">
                            Brilho: {act.params.brightness ?? 50}%
                          </Label>
                          <Slider
                            value={[act.params.brightness ?? 50]}
                            min={1}
                            max={100}
                            step={1}
                            onValueChange={([val]) =>
                              updateAction(index, {
                                params: { ...act.params, brightness: val, on: true },
                              })
                            }
                            className="flex-1"
                          />
                        </div>
                      )}

                      {act.actionType === "set_volume" && (
                        <div className="flex items-center gap-3 pt-1">
                          <Label className="text-xs text-muted-foreground min-w-[70px]">
                            Volume: {act.params.volume ?? 15}
                          </Label>
                          <Slider
                            value={[act.params.volume ?? 15]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={([val]) =>
                              updateAction(index, {
                                params: { ...act.params, volume: val },
                              })
                            }
                            className="flex-1"
                          />
                        </div>
                      )}

                      {act.actionType === "set_temperature" && (
                        <div className="flex items-center gap-3 pt-1">
                          <Label className="text-xs text-muted-foreground min-w-[70px]">
                            Temp: {act.params.temperature ?? 22}°C
                          </Label>
                          <Slider
                            value={[act.params.temperature ?? 22]}
                            min={16}
                            max={30}
                            step={1}
                            onValueChange={([val]) =>
                              updateAction(index, {
                                params: { ...act.params, temperature: val },
                              })
                            }
                            className="flex-1"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test Feedback Notice */}
            {testResult && (
              <div
                className={cn(
                  "p-3 rounded-lg border text-xs flex items-center justify-between",
                  testResult.failed === 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}
              >
                <span>
                  ✓ Teste concluído: {testResult.executed} executados com sucesso
                  {testResult.failed > 0 && `, ${testResult.failed} falha(s)`}.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            {automation && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestNow}
                disabled={isTesting || automation.actions.length === 0}
                className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                {isTesting ? (
                  <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Play className="size-3" />
                )}
                <span>Testar nos Dispositivos</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            {automation && (
              <Button type="button" size="sm" onClick={handleSave} className="text-xs gap-1.5 font-bold">
                <CheckCircle2 className="size-4" />
                <span>Salvar e Ativar Rotina</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
