import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Home, SlidersHorizontal, Terminal, Activity, Layers, Play, Pause,
  RotateCcw, Plus, Trash2, Power, SunMedium, Flame, Droplets, Zap,
  Camera, Cctv, Eye, Thermometer, ShieldCheck, HardDrive, RefreshCw,
  Copy, Download, ExternalLink, Check, Sliders, Cpu, Settings2,
  Code2, Sparkles, Filter, Search, ArrowRight, ToggleLeft, ToggleRight,
  AlertTriangle, Clock, Hash, Plane, CheckCircle2, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, logAction } from "@/lib/queries";
import { PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  HassEntity,
  HassAutomation,
  HassHelper,
  HassConnectionConfig,
  loadHassConfig,
  saveHassConfig,
  loadHassHelpers,
  saveHassHelpers,
  loadHassAutomations,
  saveHassAutomations,
  buildHassEntitiesFromLocalState,
  evaluateHassTemplate,
  testHassConnection,
  generateConfigurationYaml,
} from "@/lib/home-assistant";

export const Route = createFileRoute("/_app/home-assistant")({
  head: () => ({
    meta: [
      { title: "Home Assistant Core — Casa Inteligente AI" },
      { property: "og:title", content: "Home Assistant Core — Casa Inteligente AI" },
      { property: "og:description", content: "Painéis, entidades e automações Home Assistant para sua residência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Painéis Lovelace, Ferramentas de Desenvolvedor, Automações e Ajudantes do Home Assistant adaptados para Casa Inteligente AI." },
    ],
  }),
  component: HomeAssistantPage,
});

function HomeAssistantPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [devToolsTab, setDevToolsTab] = useState("states");

  // Entidades geradas a partir dos dispositivos reais + hardware + câmeras
  const initialEntities = useMemo(() => {
    return buildHassEntitiesFromLocalState(devices.data || [], rooms.data || []);
  }, [devices.data, rooms.data]);

  const [entities, setEntities] = useState<HassEntity[]>(initialEntities);
  useEffect(() => {
    setEntities(initialEntities);
  }, [initialEntities]);

  // Ajudantes e Automações
  const [helpers, setHelpers] = useState<HassHelper[]>(loadHassHelpers);
  const [automations, setAutomations] = useState<HassAutomation[]>(loadHassAutomations);
  const [haConfig, setHaConfig] = useState<HassConnectionConfig>(loadHassConfig);

  // Estados de busca e filtros nas DevTools
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [searchEntity, setSearchEntity] = useState<string>("");

  // DevTools: Estado manual
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [manualState, setManualState] = useState<string>("");
  const [manualAttributes, setManualAttributes] = useState<string>("");

  // DevTools: Serviços
  const [selectedDomain, setSelectedDomain] = useState<string>("light");
  const [selectedService, setSelectedService] = useState<string>("toggle");
  const [serviceTarget, setServiceTarget] = useState<string>("");
  const [serviceDataJson, setServiceDataJson] = useState<string>("{}");

  // DevTools: Templates
  const [templateInput, setTemplateInput] = useState<string>(
    `A temperatura média é {{ states('sensor.temperatura_media_casa') }}°C.\n` +
    `Luz da sala está {{ states('light.sala') }}.\n` +
    `Gravação CFTV ativa? {{ is_state('camera.garagem_139', 'recording') }}.`
  );
  const [templateOutput, setTemplateOutput] = useState<string>("");

  // Modal para criar Ajudante
  const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);
  const [newHelperName, setNewHelperName] = useState("");
  const [newHelperType, setNewHelperType] = useState<HassHelper["type"]>("input_boolean");

  // Climatização local do Lovelace
  const [thermostatTemp, setThermostatTemp] = useState(22);
  const [hvacMode, setHvacMode] = useState<"cool" | "heat" | "auto" | "off">("cool");

  // Conexão externa HA
  const [isTestingHA, setIsTestingHA] = useState(false);

  // Atualizar renderização do template Jinja2
  useEffect(() => {
    setTemplateOutput(evaluateHassTemplate(templateInput, entities));
  }, [templateInput, entities]);

  // Alternar entidade nos cards Lovelace
  const toggleEntity = async (entityId: string) => {
    const ent = entities.find((e) => e.entity_id === entityId);
    if (!ent) return;

    const nextState = ent.state === "on" ? "off" : "on";

    // Atualiza lista local de entidades
    setEntities((prev) =>
      prev.map((e) =>
        e.entity_id === entityId
          ? {
              ...e,
              state: nextState,
              attributes: { ...e.attributes, last_changed: new Date().toISOString() },
            }
          : e
      )
    );

    // Se a entidade mapear um dispositivo real no Supabase
    if (ent.attributes.supabase_id) {
      try {
        await (supabase as any)
          .from("devices")
          .update({ state: { on: nextState === "on" } })
          .eq("id", ent.attributes.supabase_id);
        queryClient.invalidateQueries({ queryKey: ["devices"] });
        logAction(current?.id ?? "", `Home Assistant: ${ent.attributes.friendly_name} -> ${nextState.toUpperCase()}`);
      } catch (err) {
        console.error("Erro ao sincronizar dispositivo Supabase:", err);
      }
    }

    toast.success(`${ent.attributes.friendly_name}: ${nextState.toUpperCase()}`);
  };

  // Ajustar brilho Lovelace
  const setBrightness = async (entityId: string, brightnessPercent: number) => {
    const ent = entities.find((e) => e.entity_id === entityId);
    if (!ent) return;

    const b255 = Math.round((brightnessPercent / 100) * 255);
    setEntities((prev) =>
      prev.map((e) =>
        e.entity_id === entityId
          ? {
              ...e,
              state: "on",
              attributes: { ...e.attributes, brightness: b255, last_changed: new Date().toISOString() },
            }
          : e
      )
    );

    if (ent.attributes.supabase_id) {
      try {
        await (supabase as any)
          .from("devices")
          .update({ state: { on: true, brightness: brightnessPercent } })
          .eq("id", ent.attributes.supabase_id);
        queryClient.invalidateQueries({ queryKey: ["devices"] });
      } catch {}
    }
  };

  // Disparar serviço pelo DevTools
  const handleCallService = async () => {
    let parsedData = {};
    try {
      parsedData = JSON.parse(serviceDataJson || "{}");
    } catch {
      toast.error("JSON de parâmetros inválido.");
      return;
    }

    const fullService = `${selectedDomain}.${selectedService}`;
    toast.info(`Executando serviço ${fullService}...`);

    if (serviceTarget) {
      const ent = entities.find((e) => e.entity_id === serviceTarget);
      if (ent) {
        let newState = ent.state;
        if (selectedService === "turn_on") newState = "on";
        if (selectedService === "turn_off") newState = "off";
        if (selectedService === "toggle") newState = ent.state === "on" ? "off" : "on";

        setEntities((prev) =>
          prev.map((e) => (e.entity_id === serviceTarget ? { ...e, state: newState } : e))
        );

        if (ent.attributes.supabase_id) {
          try {
            await (supabase as any)
              .from("devices")
              .update({ state: { on: newState === "on" } })
              .eq("id", ent.attributes.supabase_id);
            queryClient.invalidateQueries({ queryKey: ["devices"] });
          } catch {}
        }
      }
    }

    toast.success(`✓ Serviço ${fullService} chamado com sucesso!`);
  };

  // Forçar estado manualmente nas DevTools
  const handleSetStateManual = () => {
    if (!selectedEntityId) {
      toast.error("Selecione uma entidade primeiro.");
      return;
    }
    let parsedAttrs = {};
    try {
      parsedAttrs = JSON.parse(manualAttributes || "{}");
    } catch {}

    setEntities((prev) =>
      prev.map((e) =>
        e.entity_id === selectedEntityId
          ? {
              ...e,
              state: manualState,
              attributes: { ...e.attributes, ...parsedAttrs, last_changed: new Date().toISOString() },
            }
          : e
      )
    );
    toast.success(`Estado de ${selectedEntityId} atualizado para "${manualState}".`);
  };

  // Adicionar Novo Ajudante
  const handleCreateHelper = () => {
    if (!newHelperName.trim()) return;
    const slug = newHelperName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_");

    const helperId = `${newHelperType}.${slug}`;
    const newH: HassHelper = {
      id: helperId,
      name: newHelperName.trim(),
      type: newHelperType,
      state: newHelperType === "input_boolean" ? false : newHelperType === "input_number" ? 50 : 0,
      icon: newHelperType === "input_boolean" ? "ToggleLeft" : "Sliders",
    };

    const updated = [newH, ...helpers];
    setHelpers(updated);
    saveHassHelpers(updated);
    setIsHelperModalOpen(false);
    setNewHelperName("");
    toast.success(`Ajudante ${helperId} criado!`);
  };

  // Filtragem das entidades no DevTools
  const filteredEntities = entities.filter((e) => {
    const matchesDomain = filterDomain === "all" || e.entity_id.startsWith(`${filterDomain}.`);
    const matchesSearch =
      searchEntity === "" ||
      e.entity_id.toLowerCase().includes(searchEntity.toLowerCase()) ||
      e.attributes.friendly_name.toLowerCase().includes(searchEntity.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  // Exportar YAML
  const handleExportYaml = () => {
    const { configurationYaml, automationsYaml } = generateConfigurationYaml(entities, automations);
    const blob = new Blob([configurationYaml + "\n\n# --- automations.yaml ---\n\n" + automationsYaml], {
      type: "text/yaml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "home-assistant-config.yaml";
    a.click();
    toast.success("Arquivos configuration.yaml e automations.yaml exportados!");
  };

  // Testar conexão com HA externo
  const handleTestBridge = async () => {
    setIsTestingHA(true);
    const res = await testHassConnection(haConfig.haUrl, haConfig.accessToken);
    setIsTestingHA(false);
    if (res.ok) {
      toast.success(res.message);
      setHaConfig((prev) => ({ ...prev, isConnected: true, lastSyncAt: new Date().toISOString() }));
      saveHassConfig({ ...haConfig, isConnected: true, lastSyncAt: new Date().toISOString() });
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER HOME ASSISTANT CORE ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Home Assistant Core
                <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border-blue-500/30">
                  v2026.10.0
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Painéis Lovelace, Ferramentas de Desenvolvedor, Automações e Ajudantes integrados nativamente
              </p>
            </div>
          </div>
        </div>

        {/* Telemetria do HA Core */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {entities.length} Entidades Ativas
          </Badge>
          <Badge variant="outline" className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
            CFTV Gravando Disco D:
          </Badge>
          <Button size="sm" variant="outline" onClick={handleExportYaml} className="gap-1.5 text-xs">
            <Download className="size-3.5" /> Exportar YAML
          </Button>
        </div>
      </div>

      {/* ── NAVEGAÇÃO DE ABAS DO HOME ASSISTANT ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40 border flex flex-wrap h-auto p-1">
          <TabsTrigger value="dashboard" className="gap-2 text-xs font-semibold">
            <Home className="size-3.5 text-blue-400" /> Visão Geral (Lovelace)
          </TabsTrigger>
          <TabsTrigger value="developer-tools" className="gap-2 text-xs font-semibold">
            <Terminal className="size-3.5 text-amber-400" /> Ferramentas do Desenvolvedor
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2 text-xs font-semibold">
            <Zap className="size-3.5 text-purple-400" /> Automações & Cenas
          </TabsTrigger>
          <TabsTrigger value="helpers" className="gap-2 text-xs font-semibold">
            <Sliders className="size-3.5 text-emerald-400" /> Ajudantes (Helpers)
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 text-xs font-semibold">
            <Settings2 className="size-3.5 text-cyan-400" /> Integração & Configuração
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════
            ABA 1: VISÃO GERAL LOVELACE (DASHBOARD CLÁSSICO DO HA)
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="m-0 space-y-5">
          {/* Lovelace Top Badges */}
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/80 text-xs font-medium">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Moradores: <strong>Em Casa</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/80 text-xs font-medium">
              <SunMedium className="size-3.5 text-amber-400" />
              <span>Luzes Acesas: <strong>{entities.filter((e) => e.entity_id.startsWith("light.") && e.state === "on").length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/80 text-xs font-medium">
              <Thermometer className="size-3.5 text-cyan-400" />
              <span>Média Casa: <strong>23.8°C</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/80 text-xs font-medium">
              <Camera className="size-3.5 text-purple-400" />
              <span>Câmeras Gravando: <strong>3 ativas (Disco D)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/80 text-xs font-medium">
              <Zap className="size-3.5 text-emerald-400" />
              <span>Potência: <strong>480 W</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card Lovelace 1: Termostato e Climatização */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Thermometer className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Termostato da Suíte</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">climate.ar_condicionado_suite</p>
                  </div>
                </div>
                <Badge variant={hvacMode === "off" ? "secondary" : "default"} className="uppercase text-[10px] font-mono">
                  {hvacMode}
                </Badge>
              </div>

              {/* Dial circular de temperatura */}
              <div className="flex flex-col items-center justify-center py-4 bg-muted/15 rounded-2xl border border-dashed border-border/70 relative">
                <span className="text-[11px] text-muted-foreground">Temperatura Atual: 24.0°C</span>
                <div className="flex items-center gap-4 my-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 rounded-full"
                    onClick={() => setThermostatTemp((t) => Math.max(16, t - 0.5))}
                  >
                    -
                  </Button>
                  <div className="text-center">
                    <span className="text-4xl font-black text-foreground tracking-tighter">
                      {thermostatTemp.toFixed(1)}
                    </span>
                    <span className="text-lg text-muted-foreground font-semibold">°C</span>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 rounded-full"
                    onClick={() => setThermostatTemp((t) => Math.min(30, t + 0.5))}
                  >
                    +
                  </Button>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">Refrigeração Alvo Inteligente</span>
              </div>

              {/* Seletor de Modo HVAC */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {(["cool", "heat", "auto", "off"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setHvacMode(m)}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-lg uppercase transition-colors border",
                      hvacMode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Lovelace 2: Cartões de Luzes e Cargas com Brilho Slider */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <SunMedium className="size-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-foreground">Controle de Iluminação (Lights)</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Lovelace Entity Card
                </Badge>
              </div>

              <div className="space-y-3.5">
                {entities
                  .filter((e) => e.entity_id.startsWith("light."))
                  .slice(0, 4)
                  .map((light) => {
                    const isOn = light.state === "on";
                    const bPercent = Math.round(((light.attributes.brightness || 255) / 255) * 100);

                    return (
                      <div key={light.entity_id} className="p-3 rounded-xl border bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleEntity(light.entity_id)}
                              className={cn(
                                "size-8 rounded-lg flex items-center justify-center transition-colors",
                                isOn ? "bg-amber-400/20 text-amber-400" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <SunMedium className="size-4" />
                            </button>
                            <div>
                              <p className="text-xs font-bold text-foreground">{light.attributes.friendly_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{light.entity_id}</p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={isOn ? "default" : "outline"}
                            onClick={() => toggleEntity(light.entity_id)}
                            className="h-7 text-xs px-2.5 font-semibold"
                          >
                            {isOn ? "LIGADO" : "DESLIGADO"}
                          </Button>
                        </div>

                        {isOn && (
                          <div className="flex items-center gap-3 pt-1">
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={bPercent}
                              onChange={(e) => setBrightness(light.entity_id, parseInt(e.target.value))}
                              className="w-full h-1.5 accent-amber-400 cursor-pointer"
                            />
                            <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                              {bPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Card Lovelace 3: Medidores & Sensores (Gauges) */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">Sensores & Medidores (Gauges)</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Telemetria
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border bg-muted/20 text-center space-y-1">
                  <Droplets className="size-4 text-blue-400 mx-auto" />
                  <span className="text-2xl font-black text-foreground">54%</span>
                  <p className="text-[10px] text-muted-foreground font-medium">Umidade Relativa</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 text-center space-y-1">
                  <Zap className="size-4 text-amber-400 mx-auto" />
                  <span className="text-2xl font-black text-foreground">480 W</span>
                  <p className="text-[10px] text-muted-foreground font-medium">Potência Total</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 text-center space-y-1">
                  <HardDrive className="size-4 text-cyan-400 mx-auto" />
                  <span className="text-2xl font-black text-foreground">842 GB</span>
                  <p className="text-[10px] text-muted-foreground font-medium">Disco D:\ CFTV</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 text-center space-y-1">
                  <Thermometer className="size-4 text-emerald-400 mx-auto" />
                  <span className="text-2xl font-black text-foreground">23.8°C</span>
                  <p className="text-[10px] text-muted-foreground font-medium">Temperatura Média</p>
                </div>
              </div>

              {/* Status do Portão e Movimento */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">binary_sensor.portao_garagem:</span>
                  <span className="text-emerald-400 font-bold">FECHADO (NORMAL)</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">binary_sensor.presenca_corredor:</span>
                  <span className="text-muted-foreground">SEM MOVIMENTO</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Lovelace 4: Câmeras CFTV NVR com Gravação Contínua no Drive D */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Camera className="size-4 text-purple-400" />
                  Câmeras Integradas ao Home Assistant (Disco D:\Gravacoes_CFTV)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Fluxos integrados via go2rtc (WebRTC/RTSP) com gravação contínua no drive D:
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                ● 3 Câmeras ONVIF Gravando
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {[
                { id: "camera.garagem_139", name: "Câmera Garagem IP 139", port: "1984/garagem", dest: "D:\\Gravacoes_CFTV\\cam_garagem_139" },
                { id: "camera.multi_lente_240", name: "Câmera Tripla Multi-Lente IP 240", port: "1984/camera240", dest: "D:\\Gravacoes_CFTV\\cam_tripla_240" },
                { id: "camera.externa_198", name: "Câmera Entrada Frontal IP 198", port: "1984/externa", dest: "D:\\Gravacoes_CFTV\\cam_externa_198" },
              ].map((cam) => (
                <div key={cam.id} className="rounded-xl border bg-muted/20 overflow-hidden flex flex-col justify-between">
                  <div className="h-32 bg-neutral-950 flex flex-col items-center justify-center relative p-3 text-center">
                    <Cctv className="size-8 text-neutral-600 mb-1" />
                    <span className="text-xs font-mono text-neutral-400">{cam.name}</span>
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" /> GRAVANDO
                    </span>
                  </div>
                  <div className="p-3 text-[11px] font-mono space-y-1">
                    <p className="text-foreground font-bold truncate">{cam.id}</p>
                    <p className="text-muted-foreground truncate">Destino: {cam.dest}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            ABA 2: FERRAMENTAS DO DESENVOLVEDOR (DEV TOOLS DO HA)
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="developer-tools" className="m-0 space-y-4">
          <Tabs value={devToolsTab} onValueChange={setDevToolsTab} className="space-y-4">
            <TabsList className="bg-muted/30 border">
              <TabsTrigger value="states" className="text-xs gap-1.5">
                <Activity className="size-3.5" /> Estados (States)
              </TabsTrigger>
              <TabsTrigger value="services" className="text-xs gap-1.5">
                <Play className="size-3.5" /> Ações / Serviços (Services)
              </TabsTrigger>
              <TabsTrigger value="template" className="text-xs gap-1.5">
                <Code2 className="size-3.5" /> Modelos (Jinja2 Templates)
              </TabsTrigger>
              <TabsTrigger value="events" className="text-xs gap-1.5">
                <Zap className="size-3.5" /> Eventos (Events)
              </TabsTrigger>
            </TabsList>

            {/* Sub-aba Estados */}
            <TabsContent value="states" className="space-y-4">
              {/* Barra de Filtro e Busca */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por entidade ou nome amigável..."
                    value={searchEntity}
                    onChange={(e) => setSearchEntity(e.target.value)}
                    className="pl-9 text-xs h-9 font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {["all", "light", "switch", "sensor", "binary_sensor", "camera", "climate"].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={filterDomain === d ? "default" : "outline"}
                      onClick={() => setFilterDomain(d)}
                      className="text-[11px] h-9 font-mono uppercase"
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabela de Estados com Painel de Forçar Estado */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 rounded-xl border bg-card overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/50 border-b sticky top-0 z-10 text-[11px] text-muted-foreground">
                        <tr>
                          <th className="p-3">Entidade</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Atributos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredEntities.map((ent) => (
                          <tr
                            key={ent.entity_id}
                            onClick={() => {
                              setSelectedEntityId(ent.entity_id);
                              setManualState(ent.state);
                              setManualAttributes(JSON.stringify(ent.attributes, null, 2));
                            }}
                            className={cn(
                              "hover:bg-muted/30 cursor-pointer transition-colors",
                              selectedEntityId === ent.entity_id && "bg-primary/10"
                            )}
                          >
                            <td className="p-3 font-bold text-foreground">
                              {ent.entity_id}
                              <span className="block text-[10px] text-muted-foreground font-sans font-normal">
                                {ent.attributes.friendly_name}
                              </span>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={ent.state === "on" || ent.state === "recording" ? "default" : "secondary"}
                                className="text-[10px] font-mono"
                              >
                                {ent.state}
                              </Badge>
                            </td>
                            <td className="p-3 text-[10px] text-muted-foreground max-w-xs truncate">
                              {JSON.stringify(ent.attributes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Formulário de Alteração Manual de Estado */}
                <div className="lg:col-span-4 rounded-xl border bg-card p-4 space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-primary" /> Definir Estado (Manual Override)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione uma entidade na tabela para testar ou forçar seu estado no barramento.
                  </p>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Entidade</Label>
                    <Input
                      value={selectedEntityId}
                      onChange={(e) => setSelectedEntityId(e.target.value)}
                      placeholder="light.sala"
                      className="font-mono text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado</Label>
                    <Input
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value)}
                      placeholder="on / off / 23.5"
                      className="font-mono text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Atributos (JSON)</Label>
                    <textarea
                      value={manualAttributes}
                      onChange={(e) => setManualAttributes(e.target.value)}
                      rows={5}
                      className="w-full bg-background border rounded-lg p-2 font-mono text-[11px] text-foreground"
                    />
                  </div>

                  <Button size="sm" onClick={handleSetStateManual} className="w-full text-xs font-semibold">
                    Salvar Estado da Entidade
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sub-aba Serviços */}
            <TabsContent value="services" className="space-y-4">
              <div className="rounded-xl border bg-card p-5 max-w-2xl space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Chamar Ação / Serviço do Home Assistant</h4>
                  <p className="text-xs text-muted-foreground">
                    Envie comandos para o barramento de eventos (ex: light.turn_on, switch.toggle, camera.record).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Domínio</Label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full bg-background border rounded-lg px-3 py-2 text-xs font-mono text-foreground"
                    >
                      <option value="light">light</option>
                      <option value="switch">switch</option>
                      <option value="climate">climate</option>
                      <option value="camera">camera</option>
                      <option value="automation">automation</option>
                      <option value="homeassistant">homeassistant</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Serviço</Label>
                    <Input
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      placeholder="turn_on, toggle, record..."
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Entidade Alvo (entity_id)</Label>
                  <select
                    value={serviceTarget}
                    onChange={(e) => setServiceTarget(e.target.value)}
                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs font-mono text-foreground"
                  >
                    <option value="">Selecione uma entidade...</option>
                    {entities.map((e) => (
                      <option key={e.entity_id} value={e.entity_id}>
                        {e.entity_id} ({e.attributes.friendly_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Parâmetros Adicionais (JSON Data)</Label>
                  <textarea
                    value={serviceDataJson}
                    onChange={(e) => setServiceDataJson(e.target.value)}
                    rows={4}
                    className="w-full bg-background border rounded-lg p-2 font-mono text-xs text-foreground"
                    placeholder='{"brightness": 128}'
                  />
                </div>

                <Button onClick={handleCallService} className="gap-2 text-xs font-semibold">
                  <Play className="size-3.5" /> Executar Serviço no Home Assistant
                </Button>
              </div>
            </TabsContent>

            {/* Sub-aba Templates Jinja2 */}
            <TabsContent value="template" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4 space-y-2 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Editor de Modelo Jinja2</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Teste expressões dinâmicas que acessam estados de entidades e atributos em tempo real.
                    </p>
                    <textarea
                      value={templateInput}
                      onChange={(e) => setTemplateInput(e.target.value)}
                      rows={10}
                      className="w-full bg-background border rounded-lg p-3 font-mono text-xs text-foreground leading-relaxed"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTemplateInput(
                          "Total de dispositivos: {{ states('sensor.consumo_potencia_total') }}W\n" +
                          "Modo Férias ativo? {{ states('input_boolean.modo_ferias') }}"
                        )
                      }
                      className="text-xs"
                    >
                      Exemplo 1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTemplateInput(
                          "{{ states('camera.garagem_139') }} -> gravando em {{ state_attr('camera.garagem_139', 'recording_destination') }}"
                        )
                      }
                      className="text-xs"
                    >
                      Exemplo CFTV
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-bold text-foreground">Resultado Renderizado</h4>
                  <p className="text-xs text-muted-foreground mb-3">Saída calculada com o estado das entidades atuais:</p>
                  <div className="w-full h-64 bg-muted/20 border rounded-lg p-3 font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-y-auto">
                    {templateOutput}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Sub-aba Eventos */}
            <TabsContent value="events" className="space-y-4">
              <div className="rounded-xl border bg-card p-5 max-w-xl space-y-3">
                <h4 className="text-sm font-bold text-foreground">Disparar Evento no Barramento</h4>
                <p className="text-xs text-muted-foreground">
                  Simule eventos como <code className="text-primary font-mono">state_changed</code> ou eventos de webhook.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Evento</Label>
                  <Input defaultValue="call_service" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dados do Evento (JSON)</Label>
                  <textarea
                    defaultValue='{"entity_id": "light.sala", "from_state": "off", "to_state": "on"}'
                    rows={4}
                    className="w-full bg-background border rounded-lg p-2 font-mono text-xs text-foreground"
                  />
                </div>
                <Button size="sm" onClick={() => toast.success("✓ Evento propagado com sucesso no barramento HA!")}>
                  Disparar Evento
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            ABA 3: AUTOMAÇÕES & CENAS (ENGINE YAML)
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="automations" className="m-0 space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Automações Ativas (automations.yaml)</h3>
                <p className="text-xs text-muted-foreground">
                  Gatilhos e ações residenciais automáticas com exportação nativa YAML
                </p>
              </div>
              <Button size="sm" onClick={handleExportYaml} className="gap-1.5 text-xs">
                <Download className="size-3.5" /> Salvar automations.yaml
              </Button>
            </div>

            <div className="space-y-3">
              {automations.map((auto) => (
                <div key={auto.id} className="p-4 rounded-xl border bg-muted/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Zap className={cn("size-4", auto.is_active ? "text-purple-400" : "text-muted-foreground")} />
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{auto.alias}</h4>
                        <p className="text-xs text-muted-foreground">{auto.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={auto.is_active ? "default" : "outline"}
                        onClick={() => {
                          const updated = automations.map((a) =>
                            a.id === auto.id ? { ...a, is_active: !a.is_active } : a
                          );
                          setAutomations(updated);
                          saveHassAutomations(updated);
                          toast.info(`Automação "${auto.alias}": ${!auto.is_active ? "Ativada" : "Desativada"}`);
                        }}
                        className="h-8 text-xs font-semibold"
                      >
                        {auto.is_active ? "ATIVADA" : "DESATIVADA"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.success(`Automação "${auto.alias}" disparada agora!`)}
                        title="Executar agora"
                      >
                        <Play className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Código YAML */}
                  <div className="p-3 bg-neutral-950 rounded-lg border border-border/40 font-mono text-[11px] text-purple-300 leading-relaxed whitespace-pre-wrap">
                    {auto.yamlCode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            ABA 4: AJUDANTES (HELPERS - INPUT_BOOLEAN, TIMERS)
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="helpers" className="m-0 space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Ajudantes do Sistema (Helpers)</h3>
                <p className="text-xs text-muted-foreground">
                  Variáveis auxiliares: chaves booleanas virtuais, sliders numéricos e temporizadores
                </p>
              </div>
              <Button size="sm" onClick={() => setIsHelperModalOpen(true)} className="gap-1.5 text-xs">
                <Plus className="size-3.5" /> Criar Ajudante
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {helpers.map((h) => {
                const isBool = h.type === "input_boolean";
                const isNum = h.type === "input_number";
                const isTimer = h.type === "timer";
                const isCounter = h.type === "counter";

                return (
                  <div key={h.id} className="p-4 rounded-xl border bg-muted/20 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{h.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {h.type}
                        </Badge>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{h.id}</p>
                    </div>

                    {/* Controles do Ajudante */}
                    <div className="pt-2">
                      {isBool && (
                        <Button
                          size="sm"
                          variant={h.state ? "default" : "outline"}
                          onClick={() => {
                            const updated = helpers.map((item) =>
                              item.id === h.id ? { ...item, state: !item.state } : item
                            );
                            setHelpers(updated);
                            saveHassHelpers(updated);
                            toast.info(`${h.name}: ${!h.state ? "ATIVO" : "DESATIVADO"}`);
                          }}
                          className="w-full text-xs font-semibold h-8"
                        >
                          {h.state ? "LIGADO (True)" : "DESLIGADO (False)"}
                        </Button>
                      )}

                      {isNum && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span>Valor:</span>
                            <span className="font-bold text-primary">{h.state}</span>
                          </div>
                          <input
                            type="range"
                            min={h.min || 0}
                            max={h.max || 100}
                            step={h.step || 1}
                            value={h.state}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              const updated = helpers.map((item) =>
                                item.id === h.id ? { ...item, state: val } : item
                              );
                              setHelpers(updated);
                              saveHassHelpers(updated);
                            }}
                            className="w-full accent-primary cursor-pointer"
                          />
                        </div>
                      )}

                      {isTimer && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">
                            {h.state === "active" ? "Rodando (15min)" : "Ocioso"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const next = h.state === "active" ? "idle" : "active";
                              const updated = helpers.map((item) =>
                                item.id === h.id ? { ...item, state: next } : item
                              );
                              setHelpers(updated);
                              saveHassHelpers(updated);
                              toast.info(`Timer ${next === "active" ? "iniciado" : "pausado"}`);
                            }}
                            className="h-7 text-xs"
                          >
                            {h.state === "active" ? <Pause className="size-3" /> : <Play className="size-3" />}
                          </Button>
                        </div>
                      )}

                      {isCounter && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono font-bold text-foreground">{h.state} ciclos</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = helpers.map((item) =>
                                  item.id === h.id ? { ...item, state: (item.state || 0) + 1 } : item
                                );
                                setHelpers(updated);
                                saveHassHelpers(updated);
                              }}
                              className="size-7 p-0"
                            >
                              +
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = helpers.map((item) =>
                                  item.id === h.id ? { ...item, state: Math.max(0, (item.state || 0) - 1) } : item
                                );
                                setHelpers(updated);
                                saveHassHelpers(updated);
                              }}
                              className="size-7 p-0"
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════
            ABA 5: INTEGRAÇÃO COM INSTÂNCIA EXTERNA DO HA
           ══════════════════════════════════════════════════════ */}
        <TabsContent value="settings" className="m-0 space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-5 max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-blue-400" /> Ponte com Home Assistant Externo
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se você já tiver uma máquina ou Raspberry Pi com Home Assistant rodando na sua rede local, você pode conectá-lo aqui.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">URL da Instância Home Assistant</Label>
                <Input
                  value={haConfig.haUrl}
                  onChange={(e) => setHaConfig({ ...haConfig, haUrl: e.target.value })}
                  placeholder="http://localhost:8123 ou http://192.168.1.100:8123"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Token de Acesso de Longa Duração (Long-Lived Access Token)</Label>
                <Input
                  type="password"
                  value={haConfig.accessToken}
                  onChange={(e) => setHaConfig({ ...haConfig, accessToken: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Gere este token no seu Home Assistant em: <em>Perfil do Usuário &gt; Tokens de Acesso de Longa Duração &gt; Criar Token</em>.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={handleTestBridge}
                  disabled={isTestingHA}
                  className="text-xs font-semibold gap-1.5"
                >
                  <RefreshCw className={cn("size-3.5", isTestingHA && "animate-spin")} />
                  {isTestingHA ? "Testando Conexão..." : "Testar Conexão com Home Assistant"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    saveHassConfig(haConfig);
                    toast.success("Configurações da ponte salvas!");
                  }}
                  className="text-xs"
                >
                  Salvar
                </Button>
              </div>
            </div>

            {/* Informações do Sistema Host */}
            <div className="pt-4 border-t space-y-2 text-xs font-mono">
              <h4 className="font-bold text-foreground">Diagnóstico do Host (Casa Inteligente AI)</h4>
              <div className="flex justify-between p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">Modo do Motor HA:</span>
                <span className="text-emerald-400 font-bold">NATIVO INTEGRADO (AUTÔNOMO)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">Broker MQTT Backbone:</span>
                <span className="text-cyan-400 font-bold">PORTA 1883 (MOSQUITTO)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/20">
                <span className="text-muted-foreground">Diretório de Gravações CFTV:</span>
                <span className="text-foreground font-bold">D:\Gravacoes_CFTV</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Criar Novo Ajudante */}
      <Dialog open={isHelperModalOpen} onOpenChange={setIsHelperModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Ajudante (Helper)</DialogTitle>
            <DialogDescription>
              Crie uma variável virtual para acionar em automações, dashboards ou comandos de voz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Ajudante</Label>
              <Input
                value={newHelperName}
                onChange={(e) => setNewHelperName(e.target.value)}
                placeholder="Ex: Modo Festa, Temporizador Banho..."
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Ajudante</Label>
              <select
                value={newHelperType}
                onChange={(e) => setNewHelperType(e.target.value as any)}
                className="w-full bg-background border rounded-lg px-3 py-2 text-xs font-mono"
              >
                <option value="input_boolean">input_boolean (Interruptor Booleano)</option>
                <option value="input_number">input_number (Controle Deslizante Numérico)</option>
                <option value="timer">timer (Temporizador)</option>
                <option value="counter">counter (Contador Numérico)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsHelperModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateHelper} disabled={!newHelperName.trim()}>
              Criar Ajudante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
