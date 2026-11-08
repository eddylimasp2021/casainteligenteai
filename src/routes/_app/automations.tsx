import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Workflow,
  Sparkles,
  Plus,
  Play,
  Clock,
  Layers,
  Settings2,
  SlidersHorizontal,
  Star,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms } from "@/lib/queries";
import { LoadingState, EmptyState } from "@/components/home/ui-states";
import { ConfigurableAutomation } from "@/types/automations";
import { Scene } from "@/types/scenes";
import {
  getStoredAutomations,
  toggleAutomationEnabled,
  deleteStoredAutomation,
} from "@/lib/ai-automations";
import { getStoredScenes, deleteStoredScene } from "@/lib/scenes";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AiRoutineGeneratorDialog } from "@/components/automations/AiRoutineGeneratorDialog";
import { ManualAutomationDialog } from "@/components/automations/ManualAutomationDialog";
import { AIProviderConfigModal } from "@/components/ai/AIProviderConfigModal";
import { SceneCard } from "@/components/scenes/SceneCard";
import { SceneDialog } from "@/components/scenes/SceneDialog";
import { loadAIConfig, AI_PROVIDERS } from "@/lib/ai-provider";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({
    meta: [
      { title: "Cenas & Automações — Casa Inteligente AI" },
      { property: "og:title", content: "Cenas & Automações — Casa Inteligente AI" },
      {
        property: "og:description",
        content: "Crie e gerencie cenas rápidas e rotinas inteligentes com IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Crie cenas rápidas (Modo Cinema, Dormir, etc.) e rotinas residenciais em texto livre usando IA.",
      },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);

  // Tab principal: "cenas" ou "rotinas"
  const [mainTab, setMainTab] = useState<"cenas" | "rotinas">("cenas");

  // Estado de Cenas
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isSceneDialogOpen, setIsSceneDialogOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [sceneFilter, setSceneFilter] = useState<"todas" | "favoritas">("todas");

  // Estado de Automações
  const [automations, setAutomations] = useState<ConfigurableAutomation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ConfigurableAutomation | null>(null);
  const [heroPrompt, setHeroPrompt] = useState("");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const householdId = current?.id || "default";
  const aiConfig = loadAIConfig();
  const activeMeta = AI_PROVIDERS[aiConfig.activeProvider];

  const refreshScenes = () => {
    if (householdId) {
      setScenes(getStoredScenes(householdId));
    }
  };

  const refreshAutomations = () => {
    if (householdId) {
      setAutomations(getStoredAutomations(householdId));
    }
  };

  useEffect(() => {
    refreshScenes();
    refreshAutomations();

    const handleAutoUpdate = () => refreshAutomations();
    const handleSceneUpdate = () => refreshScenes();

    window.addEventListener("homepulse:automations-updated", handleAutoUpdate);
    window.addEventListener("homepulse:scenes-updated", handleSceneUpdate);

    return () => {
      window.removeEventListener("homepulse:automations-updated", handleAutoUpdate);
      window.removeEventListener("homepulse:scenes-updated", handleSceneUpdate);
    };
  }, [householdId]);

  if (devices.isLoading || rooms.isLoading) return <LoadingState />;

  const devList = devices.data || [];
  const roomList = rooms.data || [];

  // Filtros de Cenas
  const filteredScenes =
    sceneFilter === "favoritas" ? scenes.filter((s) => s.isFavorite) : scenes;

  // Filtros de Automações
  const filteredAutomations =
    selectedCategory === "todas"
      ? automations
      : automations.filter((a) => a.category === selectedCategory);

  const handleStartWithPrompt = (prompt: string) => {
    setHeroPrompt(prompt);
    setEditingAutomation(null);
    setIsGeneratorOpen(true);
  };

  const handleToggleAutomation = (id: string) => {
    toggleAutomationEnabled(householdId, id);
    refreshAutomations();
  };

  const handleDeleteAutomation = (id: string) => {
    deleteStoredAutomation(householdId, id);
    refreshAutomations();
  };

  const handleEditAutomation = (auto: ConfigurableAutomation) => {
    setEditingAutomation(auto);
    setIsGeneratorOpen(true);
  };

  const handleOpenNewScene = () => {
    setEditingScene(null);
    setIsSceneDialogOpen(true);
  };

  const handleEditScene = (scene: Scene) => {
    setEditingScene(scene);
    setIsSceneDialogOpen(true);
  };

  const handleDeleteScene = (id: string) => {
    deleteStoredScene(householdId, id);
    refreshScenes();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
              <Layers className="size-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Cenas & Automações
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ative modos pré-configurados com um toque ou crie rotinas automáticas com inteligência artificial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mainTab === "rotinas" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAiModalOpen(true)}
                className="text-xs gap-1.5 h-8 font-mono border-primary/30 bg-primary/5 hover:bg-primary/10"
                title="Configurar AI Gateway"
              >
                <Sparkles className="size-3.5 text-cyan-400" />
                <span>AI Gateway: {activeMeta.name}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsManualDialogOpen(true)}
                className="text-xs font-semibold gap-1.5 h-8 shadow-xs"
              >
                <Sliders className="size-3.5" />
                <span>Manual</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setHeroPrompt("");
                  setEditingAutomation(null);
                  setIsGeneratorOpen(true);
                }}
                className="text-xs font-semibold gap-1.5 h-8 shadow-sm"
              >
                <Plus className="size-4" />
                <span>Nova Rotina IA</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleOpenNewScene}
              className="text-xs font-semibold gap-1.5 h-8 shadow-sm"
            >
              <Plus className="size-4" />
              <span>Criar Nova Cena</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Mode Switcher: Cenas vs Automações */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border">
          <button
            onClick={() => setMainTab("cenas")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mainTab === "cenas"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5 text-amber-400" />
            <span>Cenas Rápidas ({scenes.length})</span>
          </button>

          <button
            onClick={() => setMainTab("rotinas")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mainTab === "rotinas"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Workflow className="size-3.5 text-cyan-400" />
            <span>Automações & Rotinas ({automations.length})</span>
          </button>
        </div>

        {mainTab === "cenas" && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSceneFilter("todas")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sceneFilter === "todas"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setSceneFilter("favoritas")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sceneFilter === "favoritas"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span>Favoritas ({scenes.filter((s) => s.isFavorite).length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* ABA DE CENAS RÁPIDAS */}
      {/* ============================================================ */}
      {mainTab === "cenas" && (
        <div className="space-y-5">
          {filteredScenes.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={
                sceneFilter === "favoritas"
                  ? "Nenhuma cena favoritada"
                  : "Nenhuma cena criada ainda"
              }
              description="Cenas permitem sincronizar vários dispositivos (luzes, TV, ar, fechaduras) para um objetivo em comum."
              action={
                <Button onClick={handleOpenNewScene} className="gap-2">
                  <Plus className="size-4" />
                  <span>Criar Minha Primeira Cena</span>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredScenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  devices={devList}
                  householdId={householdId}
                  onEdit={handleEditScene}
                  onDelete={handleDeleteScene}
                  onRefresh={refreshScenes}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA DE AUTOMAÇÕES E ROTINAS */}
      {/* ============================================================ */}
      {mainTab === "rotinas" && (
        <div className="space-y-6">
          {/* Hero Section: Entrada Rápida de Texto Livre */}
          <div className="rounded-2xl border bg-gradient-to-br from-card via-card/90 to-primary/5 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Gerador Inteligente por Voz ou Texto
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {devList.length} dispositivos disponíveis na residência
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <Input
                value={heroPrompt}
                onChange={(e) => setHeroPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && heroPrompt.trim()) {
                    handleStartWithPrompt(heroPrompt);
                  }
                }}
                placeholder="Descreva sua rotina em texto livre (ex: Às 23h, desligue a TV da sala e apague as luzes)..."
                className="h-11 text-sm bg-background/80 shadow-xs flex-1"
              />
              <Button
                size="lg"
                onClick={() => handleStartWithPrompt(heroPrompt)}
                className="w-full sm:w-auto h-11 px-6 font-bold gap-2 shadow-md shrink-0"
              >
                <Sparkles className="size-4 text-cyan-300" />
                <span>Gerar com IA</span>
              </Button>
            </div>

            {/* Sugestões Rápidas */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
              <span className="font-semibold text-foreground/80 text-[11px]">
                Sugestões rápidas:
              </span>
              <button
                onClick={() =>
                  handleStartWithPrompt(
                    "Às 23h desligue a TV da sala, apague todas as luzes e arme as câmeras."
                  )
                }
                className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                🌙 Hora de Dormir
              </button>
              <button
                onClick={() =>
                  handleStartWithPrompt(
                    "Modo cinema: reduza luzes para 20%, ligue a TV e climatize a sala."
                  )
                }
                className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                🎬 Modo Cinema
              </button>
              <button
                onClick={() =>
                  handleStartWithPrompt(
                    "Ao sair de casa, desligue todas as tomadas e luzes e ative o alarme."
                  )
                }
                className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                🚗 Saindo de Casa
              </button>
              <button
                onClick={() =>
                  handleStartWithPrompt(
                    "Às 07:00 nos dias de semana, acenda a luz da cozinha e ligue o som."
                  )
                }
                className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                🌅 Bom Dia
              </button>
            </div>
          </div>

          {/* Filtro por Categorias */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-auto">
              <TabsList className="bg-muted/40 border h-8 p-0.5">
                <TabsTrigger value="todas" className="text-xs px-3">
                  Todas ({automations.length})
                </TabsTrigger>
                <TabsTrigger value="noturno" className="text-xs px-3">
                  Noturno
                </TabsTrigger>
                <TabsTrigger value="conforto" className="text-xs px-3">
                  Conforto
                </TabsTrigger>
                <TabsTrigger value="seguranca" className="text-xs px-3">
                  Segurança
                </TabsTrigger>
                <TabsTrigger value="clima" className="text-xs px-3">
                  Clima
                </TabsTrigger>
                <TabsTrigger value="energia" className="text-xs px-3">
                  Energia
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <span className="text-xs text-muted-foreground font-medium">
              {automations.filter((a) => a.enabled).length} rotina(s) ativas
            </span>
          </div>

          {/* Grid de Automações */}
          {filteredAutomations.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title={
                selectedCategory === "todas"
                  ? "Nenhuma rotina criada ainda"
                  : `Nenhuma rotina na categoria "${selectedCategory}"`
              }
              description="Utilize a caixa de texto acima para descrever em linguagem livre ou configure manualmente pelo botão superior."
              action={
                <Button
                  onClick={() => {
                    setHeroPrompt("");
                    setEditingAutomation(null);
                    setIsGeneratorOpen(true);
                  }}
                  className="gap-2"
                >
                  <Sparkles className="size-4" />
                  <span>Criar Primeira Rotina</span>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAutomations.map((auto) => (
                <AutomationCard
                  key={auto.id}
                  automation={auto}
                  devices={devList}
                  onToggleEnabled={handleToggleAutomation}
                  onEdit={handleEditAutomation}
                  onDelete={handleDeleteAutomation}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diálogo de Criação/Edição de Cenas */}
      <SceneDialog
        open={isSceneDialogOpen}
        onOpenChange={setIsSceneDialogOpen}
        householdId={householdId}
        devices={devList}
        rooms={roomList}
        sceneToEdit={editingScene}
        onSaved={refreshScenes}
      />

      {/* Diálogo de Criação Manual de Automações */}
      <ManualAutomationDialog
        open={isManualDialogOpen}
        onOpenChange={setIsManualDialogOpen}
        householdId={householdId}
        devices={devList}
        rooms={roomList}
        onSaved={refreshAutomations}
      />

      {/* Modal do Gerador e Editor de Rotina com IA */}
      <AiRoutineGeneratorDialog
        open={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        devices={devList}
        rooms={roomList}
        householdId={householdId}
        initialPrompt={heroPrompt}
        editAutomation={editingAutomation}
        onSaved={refreshAutomations}
      />

      {/* Modal de Configuração do AI Gateway */}
      <AIProviderConfigModal open={isAiModalOpen} onOpenChange={setIsAiModalOpen} />
    </div>
  );
}
