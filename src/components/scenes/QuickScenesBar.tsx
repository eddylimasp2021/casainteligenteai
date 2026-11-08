import React, { useState, useEffect } from "react";
import { Scene } from "@/types/scenes";
import { Device } from "@/lib/queries";
import { SceneIcon, SCENE_COLOR_THEMES } from "./SceneIcons";
import { getStoredScenes, activateScene } from "@/lib/scenes";
import { toast } from "sonner";
import { Play, Sparkles, Loader2, Plus, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface QuickScenesBarProps {
  householdId: string;
  devices: Device[];
  onOpenCreateDialog?: () => void;
}

export function QuickScenesBar({
  householdId,
  devices,
  onOpenCreateDialog,
}: QuickScenesBarProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadScenes = () => {
    if (householdId) {
      const all = getStoredScenes(householdId);
      // Pega as favoritas ou as primeiras 6
      const favs = all.filter((s) => s.isFavorite);
      setScenes(favs.length > 0 ? favs.slice(0, 6) : all.slice(0, 6));
    }
  };

  useEffect(() => {
    loadScenes();

    const handleUpdate = () => loadScenes();
    window.addEventListener("homepulse:scenes-updated", handleUpdate);
    return () => window.removeEventListener("homepulse:scenes-updated", handleUpdate);
  }, [householdId]);

  const handleActivate = async (scene: Scene) => {
    if (activatingId) return;
    setActivatingId(scene.id);
    try {
      const res = await activateScene(scene, devices);
      if (res.success || res.executedCount > 0) {
        toast.success(`Cena "${scene.name}" ativada!`);
        setActiveId(scene.id);
        setTimeout(() => setActiveId(null), 3500);
      } else {
        toast.error(`Falha ao ativar "${scene.name}"`);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e.message || "Falha na execução"}`);
    } finally {
      setActivatingId(null);
    }
  };

  if (scenes.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
            Cenas Rápidas
          </h2>
        </div>
        <Link
          to="/automations"
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          <span>Ver todas as cenas</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {scenes.map((scene) => {
          const theme = SCENE_COLOR_THEMES[scene.color] || SCENE_COLOR_THEMES.blue;
          const isActivating = activatingId === scene.id;
          const isJustActive = activeId === scene.id;

          return (
            <button
              key={scene.id}
              onClick={() => handleActivate(scene)}
              disabled={isActivating}
              className={cn(
                "group relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-200 select-none",
                theme.bg,
                theme.border,
                theme.hover,
                isJustActive
                  ? "ring-2 ring-primary scale-[0.98] shadow-md " + theme.glow
                  : "hover:scale-[1.02] shadow-xs active:scale-[0.97]"
              )}
            >
              <div
                className={cn(
                  "size-10 rounded-xl flex items-center justify-center border mb-2 transition-transform group-hover:scale-110",
                  theme.bg,
                  theme.border,
                  theme.text
                )}
              >
                {isActivating ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <SceneIcon name={scene.icon} className="size-5" />
                )}
              </div>

              <span className="text-xs font-bold text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                {scene.name}
              </span>

              <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {isActivating
                  ? "Aplicando..."
                  : isJustActive
                  ? "Ativada! ✓"
                  : scene.actions.length > 0
                  ? `${scene.actions.length} dispositivos`
                  : "1 toque"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
