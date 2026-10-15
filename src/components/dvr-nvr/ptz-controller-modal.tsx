import { useState } from "react";
import { 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  ZoomIn, ZoomOut, Eye, Sun, RotateCw, Compass, Bookmark, Plus
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface PtzControllerModalProps {
  camera: IpCamera | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PtzControllerModal({ camera, open, onOpenChange }: PtzControllerModalProps) {
  const [speed, setSpeed] = useState<number>(5);
  const [isPatrolling, setIsPatrolling] = useState(false);
  const [presets, setPresets] = useState<Array<{ id: number; name: string }>>(
    camera?.presets || [
      { id: 1, name: "Posição Inicial / Entrada" },
      { id: 2, name: "Portão Veicular" },
      { id: 3, name: "Calçada & Muro" },
    ]
  );

  if (!camera) return null;

  const handlePtzAction = (action: string) => {
    toast.info(`Comando PTZ [${action}] enviado com velocidade ${speed}`, {
      description: `${camera.name} (${camera.protocol})`,
      duration: 1500,
    });
  };

  const handleGoToPreset = (preset: { id: number; name: string }) => {
    toast.success(`Movendo câmera para Preset ${preset.id}: ${preset.name}`, {
      description: "Posição absoluta acionada via protocolo ONVIF/RTSP.",
    });
  };

  const handleAddPreset = () => {
    const name = window.prompt("Nome do novo preset de posição:");
    if (!name) return;
    const newPreset = { id: presets.length + 1, name };
    setPresets([...presets, newPreset]);
    toast.success(`Preset '${name}' salvo na posição atual!`);
  };

  const togglePatrol = () => {
    const next = !isPatrolling;
    setIsPatrolling(next);
    if (next) {
      toast.info("Ronda automática (Tour/Patrol) iniciada nos presets configurados.");
    } else {
      toast.info("Ronda automática interrompida.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Compass className="size-5 text-amber-500" />
              Controle PTZ: {camera.name}
            </DialogTitle>
          </div>
          <DialogDescription>
            Controle remoto de movimentação Pan/Tilt/Zoom e chamada de posições pré-definidas (Presets).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Virtual 8-way Joystick */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative grid size-48 grid-cols-3 grid-rows-3 gap-2 rounded-full border border-border/80 bg-neutral-950/80 p-3 shadow-inner">
              {/* Up-Left */}
              <Button
                variant="outline"
                size="sm"
                className="size-full rounded-tl-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Noroeste (Up-Left)")}
              >
                <ChevronUp className="size-4 -rotate-45" />
              </Button>

              {/* Up */}
              <Button
                variant="outline"
                size="sm"
                className="size-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Cima (Tilt Up)")}
              >
                <ChevronUp className="size-5" />
              </Button>

              {/* Up-Right */}
              <Button
                variant="outline"
                size="sm"
                className="size-full rounded-tr-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Nordeste (Up-Right)")}
              >
                <ChevronUp className="size-4 rotate-45" />
              </Button>

              {/* Left */}
              <Button
                variant="outline"
                size="sm"
                className="size-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Esquerda (Pan Left)")}
              >
                <ChevronLeft className="size-5" />
              </Button>

              {/* Center / Home */}
              <Button
                variant="secondary"
                size="sm"
                className="size-full rounded-full border border-amber-500/30 bg-amber-500/10 font-bold text-amber-400 hover:bg-amber-500/30"
                onClick={() => handlePtzAction("Centralizar (Home)")}
                title="Posição Central (Home)"
              >
                HOME
              </Button>

              {/* Right */}
              <Button
                variant="outline"
                size="sm"
                className="size-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Direita (Pan Right)")}
              >
                <ChevronRight className="size-5" />
              </Button>

              {/* Down-Left */}
              <Button
                variant="outline"
                size="sm"
                className="size-full rounded-bl-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Sudoeste (Down-Left)")}
              >
                <ChevronDown className="size-4 rotate-45" />
              </Button>

              {/* Down */}
              <Button
                variant="outline"
                size="sm"
                className="size-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Baixo (Tilt Down)")}
              >
                <ChevronDown className="size-5" />
              </Button>

              {/* Down-Right */}
              <Button
                variant="outline"
                size="sm"
                className="size-full rounded-br-full border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-400"
                onClick={() => handlePtzAction("Sudeste (Down-Right)")}
              >
                <ChevronDown className="size-4 -rotate-45" />
              </Button>
            </div>

            {/* Speed Slider */}
            <div className="w-full max-w-xs space-y-1.5 px-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Velocidade de Movimento</span>
                <span className="font-mono font-semibold text-foreground">{speed} / 8</span>
              </div>
              <Slider
                value={[speed]}
                min={1}
                max={8}
                step={1}
                onValueChange={(val) => setSpeed(val[0] ?? 1)}
              />
            </div>
          </div>

          {/* Zoom, Focus, Iris controls */}
          <div className="grid grid-cols-3 gap-2.5 rounded-xl border bg-muted/30 p-3">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">ZOOM ÓPTICO</span>
              <div className="flex gap-1 w-full">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Zoom In (+)")}>
                  <ZoomIn className="size-3.5 mr-1 text-primary" /> +
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Zoom Out (-)")}>
                  <ZoomOut className="size-3.5 mr-1" /> -
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">FOCO</span>
              <div className="flex gap-1 w-full">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Foco Próximo (+)")}>
                  <Eye className="size-3.5 mr-1" /> +
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Foco Infinito (-)")}>
                  -
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">ÍRIS / EXPOSIÇÃO</span>
              <div className="flex gap-1 w-full">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Abrir Íris (+)")}>
                  <Sun className="size-3.5 mr-1 text-amber-400" /> +
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePtzAction("Fechar Íris (-)")}>
                  -
                </Button>
              </div>
            </div>
          </div>

          {/* Presets Management */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bookmark className="size-3.5 text-primary" /> Posições Salvas (Presets)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isPatrolling ? "default" : "outline"}
                  className="h-7 text-xs gap-1"
                  onClick={togglePatrol}
                >
                  <RotateCw className={`size-3 ${isPatrolling ? "animate-spin" : ""}`} />
                  {isPatrolling ? "Ronda Ativa" : "Ronda / Tour"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleAddPreset}
                >
                  <Plus className="size-3" /> Novo
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  className="h-9 justify-start gap-2 text-xs truncate border hover:border-amber-500/50"
                  onClick={() => handleGoToPreset(p)}
                >
                  <Badge variant="outline" className="size-5 p-0 justify-center font-mono">
                    {p.id}
                  </Badge>
                  <span className="truncate">{p.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
