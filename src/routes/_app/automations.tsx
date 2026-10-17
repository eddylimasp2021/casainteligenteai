import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Workflow,
  Sparkles,
  Plus,
  Play,
  Clock,
  Mic,
  Zap,
  Layers,
  Settings2,
  SlidersHorizontal,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms } from "@/lib/queries";
import { PageHeader, LoadingState, EmptyState } from "@/components/home/ui-states";
import { ConfigurableAutomation, AutomationCategory } from "@/types/automations";
import {
  getStoredAutomations,
  toggleAutomationEnabled,
  deleteStoredAutomation,
} from "@/lib/ai-automations";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AiRoutineGeneratorDialog } from "@/components/automations/AiRoutineGeneratorDialog";
import { AIProviderConfigModal } from "@/components/ai/AIProviderConfigModal";
import { loadAIConfig, AI_PROVIDERS } from "@/lib/ai-provider";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({
    meta: [
      { title: "Automações & Rotinas IA — Casa Inteligente AI" },
      {
        name: "description",
        content:
          "Crie rotinas residenciais em texto livre usando IA. Automações configuráveis para iluminação, climatização, TV e segurança.",
      },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);

  const [automations, setAutomations] = useState<ConfigurableAutomation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<ConfigurableAutomation | null>(null);
  const [heroPrompt, setHeroPrompt] = useState("");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const householdId = current?.id || "default";
  const aiConfig = loadAIConfig();
  const activeMeta = AI_PROVIDERS[aiConfig.activeProvider];

  const refreshAutomations = () => {
    if (householdId) {
      setAutomations(getStoredAutomations(householdId));
    }
  };

  useEffect(() => {
    refreshAutomations();

    const handleUpdate = () => refreshAutomations();
    window.addEventListener("homepulse:automations-updated", handleUpdate);
    return () => window.removeEventListener("homepulse:automations-updated", handleUpdate);
  }, [householdId]);

  if (devices.isLoading || rooms.isLoading) return <LoadingState />;

  const devList = devices.data || [];
  const roomList = rooms.data || [];

  const filteredAutomations =
    selectedCategory === "todas"
      ? automations
      : automations.filter((a) => a.category === selectedCategory);

  const handleStartWithPrompt = (prompt: string) => {
    setHeroPrompt(prompt);
    setEditingAutomation(null);
    setIsGeneratorOpen(true);
  };

  const handleToggle = (id: string) => {
    toggleAutomationEnabled(householdId, id);
    refreshAutomations();
  };

  const handleDelete = (id: string) => {
    deleteStoredAutomation(householdId, id);
    refreshAutomations();
  };

  const handleEdit = (auto: ConfigurableAutomation) => {
    setEditingAutomation(auto);
    setIsGeneratorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/15 text-primary grid place-items-center">
              <Workflow className="size-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Rotinas & Automações com IA
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Descreva uma rotina doméstica em linguagem livre e nossa IA criará regras configuráveis para os seus dispositivos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Gateway Status Pill */}
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
            onClick={() => {
              setHeroPrompt("");
              setEditingAutomation(null);
              setIsGeneratorOpen(true);
            }}
            className="text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="size-4" />
            <span>Criar Nova Rotina</span>
          </Button>
        </div>
      </div>

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

        {/* Quick Inspiration Templates */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1">
          <span className="font-semibold text-foreground/80 text-[11px]">Sugestões rápidas:</span>
          <button
            onClick={() =>
              handleStartWithPrompt("Às 23h desligue a TV da sala, apague todas as luzes e arme as câmeras.")
            }
            className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            🌙 Hora de Dormir
          </button>
          <button
            onClick={() =>
              handleStartWithPrompt("Modo cinema: reduza luzes para 20%, ligue a TV e climatize a sala.")
            }
            className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            🎬 Modo Cinema
          </button>
          <button
            onClick={() =>
              handleStartWithPrompt("Ao sair de casa, desligue todas as tomadas e luzes e ative o alarme.")
            }
            className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            🚗 Saindo de Casa
          </button>
          <button
            onClick={() =>
              handleStartWithPrompt("Às 07:00 nos dias de semana, acenda a luz da cozinha e ligue o som.")
            }
            className="px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            🌅 Bom Dia
          </button>
        </div>
      </div>

      {/* Tabs de Filtro por Categoria */}
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

      {/* Grid de Automações Salvas */}
      {filteredAutomations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={
            selectedCategory === "todas"
              ? "Nenhuma rotina criada ainda"
              : `Nenhuma rotina na categoria "${selectedCategory}"`
          }
          description="Utilize a caixa de texto acima para descrever em linguagem livre como você quer que sua casa funcione."
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
              onToggleEnabled={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

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
