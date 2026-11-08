import React, { useState } from "react";
import { Play, Star, MoreVertical, Edit2, Trash2, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Scene } from "@/types/scenes";
import { Device } from "@/lib/queries";
import { SceneIcon, SCENE_COLOR_THEMES } from "./SceneIcons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { activateScene, toggleSceneFavorite } from "@/lib/scenes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SceneCardProps {
  scene: Scene;
  devices: Device[];
  householdId: string;
  onEdit: (scene: Scene) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function SceneCard({
  scene,
  devices,
  householdId,
  onEdit,
  onDelete,
  onRefresh,
}: SceneCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  const theme = SCENE_COLOR_THEMES[scene.color] || SCENE_COLOR_THEMES.blue;

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const result = await activateScene(scene, devices);
      if (result.success || result.executedCount > 0) {
        toast.success(`Cena "${scene.name}" ativada!`, {
          description: `${result.executedCount} ação(ões) executada(s) nos dispositivos.`,
        });
        setJustActivated(true);
        setTimeout(() => setJustActivated(false), 4000);
      } else {
        toast.error(`Falha ao ativar "${scene.name}"`, {
          description: result.logs[0] || "Nenhum dispositivo respondeu.",
        });
      }
      onRefresh();
    } catch (err: any) {
      toast.error(`Erro ao ativar cena: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsActivating(false);
    }
  };

  const handleToggleFavorite = () => {
    toggleSceneFavorite(householdId, scene.id);
    onRefresh();
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all duration-300",
        theme.border,
        justActivated
          ? "ring-2 ring-primary shadow-lg " + theme.glow
          : "hover:shadow-md hover:border-foreground/20",
        theme.hover
      )}
    >
      <div>
        {/* Top Header: Icon, Badges, Favorite & Menu */}
        <div className="flex items-start justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-12 rounded-2xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105",
                theme.bg,
                theme.border,
                theme.text
              )}
            >
              <SceneIcon name={scene.icon} className="size-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                  {scene.name}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {scene.description || "Sem descrição"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleToggleFavorite}
              title={scene.isFavorite ? "Remover dos favoritos" : "Marcar como favorita"}
              className={cn(
                "p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground",
                scene.isFavorite && "text-amber-400 hover:text-amber-300"
              )}
            >
              <Star className={cn("size-4", scene.isFavorite && "fill-amber-400")} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onEdit(scene)} className="text-xs gap-2">
                  <Edit2 className="size-3.5" />
                  <span>Editar Cena</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(scene.id)}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  <span>Excluir</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Action Details or Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs mb-4">
          <Badge variant="outline" className={cn("text-[11px] font-mono", theme.badge)}>
            {scene.actions.length > 0
              ? `${scene.actions.length} ${scene.actions.length === 1 ? "dispositivo" : "dispositivos"}`
              : "Predefinição Inteligente"}
          </Badge>

          {scene.lastActivatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Ativada em{" "}
              {new Date(scene.lastActivatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Activate Button */}
      <Button
        onClick={handleActivate}
        disabled={isActivating}
        className={cn(
          "w-full h-10 font-semibold text-xs gap-2 transition-all shadow-xs",
          justActivated
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : ""
        )}
      >
        {isActivating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Aplicando comandos...</span>
          </>
        ) : justActivated ? (
          <>
            <CheckCircle2 className="size-4 text-white" />
            <span>Cena Ativada!</span>
          </>
        ) : (
          <>
            <Play className="size-4 fill-current" />
            <span>Ativar Cena</span>
          </>
        )}
      </Button>
    </div>
  );
}
