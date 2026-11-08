import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Scene,
  SceneAction,
  SceneIconName,
  SceneColorTheme,
} from "@/types/scenes";
import { Device, Room } from "@/lib/queries";
import { SceneIcon, SCENE_ICONS_MAP, SCENE_COLOR_THEMES } from "./SceneIcons";
import { saveSingleScene } from "@/lib/scenes";
import { toast } from "sonner";
import { Plus, Trash2, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  devices: Device[];
  rooms: Room[];
  sceneToEdit?: Scene | null;
  onSaved: () => void;
}

const AVAILABLE_ICONS: SceneIconName[] = [
  "film",
  "moon",
  "sun",
  "home",
  "log-out",
  "party-popper",
  "coffee",
  "briefcase",
  "sparkles",
  "heart",
  "shield",
  "zap",
];

const AVAILABLE_COLORS: SceneColorTheme[] = [
  "purple",
  "indigo",
  "amber",
  "rose",
  "cyan",
  "emerald",
  "orange",
  "blue",
];

export function SceneDialog({
  open,
  onOpenChange,
  householdId,
  devices,
  rooms,
  sceneToEdit,
  onSaved,
}: SceneDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<SceneIconName>("sparkles");
  const [color, setColor] = useState<SceneColorTheme>("purple");
  const [actions, setActions] = useState<SceneAction[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (sceneToEdit) {
      setName(sceneToEdit.name);
      setDescription(sceneToEdit.description || "");
      setIcon(sceneToEdit.icon);
      setColor(sceneToEdit.color);
      setActions(sceneToEdit.actions || []);
      setIsFavorite(sceneToEdit.isFavorite || false);
    } else {
      setName("");
      setDescription("");
      setIcon("sparkles");
      setColor("purple");
      setActions([]);
      setIsFavorite(false);
    }
  }, [sceneToEdit, open]);

  const handleToggleDeviceAction = (device: Device) => {
    const existingIndex = actions.findIndex((a) => a.deviceId === device.id);
    const room = rooms.find((r) => r.id === device.room_id);

    if (existingIndex >= 0) {
      setActions(actions.filter((a) => a.deviceId !== device.id));
    } else {
      // Cria uma ação default para o dispositivo
      const isLock = device.capabilities.includes("lock");
      const isTemp = device.capabilities.includes("temperature");
      const isBrightness = device.capabilities.includes("brightness");

      const newAction: SceneAction = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        deviceId: device.id,
        deviceName: device.name,
        roomName: room?.name,
        actionType: isLock ? "lock" : "turn_on",
        params: {
          on: isLock ? undefined : true,
          locked: isLock ? true : undefined,
          brightness: isBrightness ? 80 : undefined,
          temperature: isTemp ? 22 : undefined,
        },
      };

      setActions([...actions, newAction]);
    }
  };

  const updateActionParam = (deviceId: string, key: string, value: any) => {
    setActions(
      actions.map((act) => {
        if (act.deviceId === deviceId) {
          const updatedParams = { ...act.params, [key]: value };
          let actionType = act.actionType;
          if (key === "on") {
            actionType = value ? "turn_on" : "turn_off";
          } else if (key === "locked") {
            actionType = value ? "lock" : "unlock";
          }
          return { ...act, actionType, params: updatedParams };
        }
        return act;
      })
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe um nome para a cena.");
      return;
    }

    const scene: Scene = {
      id: sceneToEdit?.id || `scene-${Date.now()}`,
      householdId,
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      actions,
      isFavorite,
      createdAt: sceneToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveSingleScene(householdId, scene);
    toast.success(
      sceneToEdit ? `Cena "${scene.name}" atualizada!` : `Cena "${scene.name}" criada com sucesso!`
    );
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-10 rounded-xl flex items-center justify-center border",
                SCENE_COLOR_THEMES[color].bg,
                SCENE_COLOR_THEMES[color].border,
                SCENE_COLOR_THEMES[color].text
              )}
            >
              <SceneIcon name={icon} className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {sceneToEdit ? "Editar Cena" : "Nova Cena Inteligente"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o estado desejado de múltiplos dispositivos acionáveis com apenas um clique.
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 space-y-6">
          <div className="space-y-4">
            {/* Nome e Descrição */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scene-name" className="text-xs font-semibold">
                  Nome da Cena *
                </Label>
                <Input
                  id="scene-name"
                  placeholder="Ex: Modo Cinema, Jantar, Dormir..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scene-desc" className="text-xs font-semibold">
                  Descrição Rápida
                </Label>
                <Input
                  id="scene-desc"
                  placeholder="Ex: Ajusta luzes e TV para relaxar"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            {/* Escolha do Ícone */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Escolha o Ícone</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVAILABLE_ICONS.map((ic) => {
                  const IconComp = SCENE_ICONS_MAP[ic];
                  const isSelected = icon === ic;
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={cn(
                        "size-9 rounded-xl flex items-center justify-center border transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconComp className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escolha da Cor de Destaque */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Cor de Destaque
              </Label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {AVAILABLE_COLORS.map((col) => {
                  const t = SCENE_COLOR_THEMES[col];
                  const isSelected = color === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColor(col)}
                      className={cn(
                        "size-8 rounded-full border-2 transition-all flex items-center justify-center",
                        t.bg,
                        t.border,
                        isSelected ? "ring-2 ring-primary scale-110" : "opacity-70 hover:opacity-100"
                      )}
                    >
                      {isSelected && <Check className={cn("size-3.5", t.text)} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dispositivos Participantes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Dispositivos na Cena ({actions.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Marque os aparelhos que devem mudar de estado ao ativar esta cena.
                  </p>
                </div>
              </div>

              {devices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum dispositivo encontrado na residência.
                </p>
              ) : (
                <div className="space-y-3">
                  {devices.map((dev) => {
                    const action = actions.find((a) => a.deviceId === dev.id);
                    const isSelected = !!action;
                    const room = rooms.find((r) => r.id === dev.room_id);
                    const hasBrightness = dev.capabilities.includes("brightness");
                    const hasTemp = dev.capabilities.includes("temperature");
                    const hasLock = dev.capabilities.includes("lock");

                    return (
                      <div
                        key={dev.id}
                        className={cn(
                          "rounded-xl border p-3.5 transition-all space-y-3",
                          isSelected
                            ? "bg-primary/5 border-primary/40 shadow-xs"
                            : "bg-muted/15 border-border/60 hover:border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleDeviceAction(dev)}
                              className="size-4 rounded border-primary/50 text-primary focus:ring-primary accent-primary cursor-pointer"
                              id={`dev-check-${dev.id}`}
                            />
                            <label
                              htmlFor={`dev-check-${dev.id}`}
                              className="cursor-pointer select-none"
                            >
                              <div className="text-xs font-bold text-foreground">{dev.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {room?.name || "Sem cômodo"} • {dev.category}
                              </div>
                            </label>
                          </div>

                          {isSelected && (
                            <Badge variant="outline" className="text-[10px] font-mono border-primary/30">
                              Configurado
                            </Badge>
                          )}
                        </div>

                        {/* Parâmetros do dispositivo quando selecionado */}
                        {isSelected && action && (
                          <div className="pl-7 pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Toggle Ligar/Desligar ou Trancar */}
                            {hasLock ? (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Estado da Fechadura:</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={action.params.locked ? "default" : "secondary"}
                                  onClick={() =>
                                    updateActionParam(dev.id, "locked", !action.params.locked)
                                  }
                                  className="h-7 text-xs px-3 font-semibold"
                                >
                                  {action.params.locked ? "🔒 Trancar" : "🔓 Destrancar"}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Energia:</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">
                                    {action.params.on ? "Ligado" : "Desligado"}
                                  </span>
                                  <Switch
                                    checked={!!action.params.on}
                                    onCheckedChange={(val) => updateActionParam(dev.id, "on", val)}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Brilho */}
                            {hasBrightness && action.params.on && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Brilho:</span>
                                  <span className="font-mono font-bold text-foreground">
                                    {action.params.brightness ?? 100}%
                                  </span>
                                </div>
                                <Slider
                                  value={[action.params.brightness ?? 100]}
                                  min={1}
                                  max={100}
                                  step={5}
                                  onValueChange={([val]) =>
                                    updateActionParam(dev.id, "brightness", val)
                                  }
                                />
                              </div>
                            )}

                            {/* Temperatura */}
                            {hasTemp && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Temperatura Alvo:</span>
                                  <span className="font-mono font-bold text-foreground">
                                    {action.params.temperature ?? 22}°C
                                  </span>
                                </div>
                                <Slider
                                  value={[action.params.temperature ?? 22]}
                                  min={16}
                                  max={30}
                                  step={1}
                                  onValueChange={([val]) =>
                                    updateActionParam(dev.id, "temperature", val)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
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
            <span>Salvar Cena</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
