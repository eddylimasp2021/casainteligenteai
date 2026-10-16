import { useState, useEffect } from "react";
import {
  Layers,
  Cctv,
  CheckCircle2,
  Sparkles,
  Info,
  Grid2X2,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface MultiLensConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cameras: IpCamera[];
  onUpdateCameras: (updated: IpCamera[]) => void;
}

export function MultiLensConfigDialog({
  open,
  onOpenChange,
  cameras,
  onUpdateCameras,
}: MultiLensConfigDialogProps) {
  // Local state copy of camera configurations
  const [cameraConfigs, setCameraConfigs] = useState<
    Array<{
      id: string;
      lensCount: number;
      splitLensesIntoGrid: boolean;
    }>
  >([]);

  useEffect(() => {
    if (open) {
      setCameraConfigs(
        cameras.map((c) => ({
          id: c.id,
          lensCount:
            c.lensCount ??
            (c.ip === "192.168.0.240" || c.name.toLowerCase().includes("240") ? 3 : 1),
          splitLensesIntoGrid:
            c.splitLensesIntoGrid ??
            (c.ip === "192.168.0.240" || (c.lensCount && c.lensCount > 1) ? true : false),
        }))
      );
    }
  }, [open, cameras]);

  const handleSetLensCount = (cameraId: string, count: number) => {
    setCameraConfigs((prev) =>
      prev.map((item) =>
        item.id === cameraId
          ? {
              ...item,
              lensCount: count,
              splitLensesIntoGrid: count > 1 ? item.splitLensesIntoGrid : false,
            }
          : item
      )
    );
  };

  const handleToggleSplit = (cameraId: string, checked: boolean) => {
    setCameraConfigs((prev) =>
      prev.map((item) =>
        item.id === cameraId ? { ...item, splitLensesIntoGrid: checked } : item
      )
    );
  };

  const handleApplyPreset240 = () => {
    setCameraConfigs((prev) =>
      prev.map((item) => {
        const cam = cameras.find((c) => c.id === item.id);
        if (cam && (cam.ip === "192.168.0.240" || cam.name.includes("240"))) {
          return {
            ...item,
            lensCount: 3,
            splitLensesIntoGrid: true,
          };
        }
        return item;
      })
    );
    toast.success("Predefinição aplicada para Câmera 192.168.0.240 (3 Telas 16:9 ativadas)!");
  };

  const handleSave = () => {
    const updated = cameras.map((cam) => {
      const cfg = cameraConfigs.find((c) => c.id === cam.id);
      if (cfg) {
        return {
          ...cam,
          lensCount: cfg.lensCount,
          splitLensesIntoGrid: cfg.splitLensesIntoGrid,
        };
      }
      return cam;
    });

    onUpdateCameras(updated);
    toast.success("Configuração de Múltiplas Visões atualizada com sucesso!", {
      description: "O mosaico do NVR exibirá as telas individuais conforme configurado.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Layers className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Câmeras Multi-Lente & Múltiplas Visões
              </DialogTitle>
              <DialogDescription>
                Configure quantas visões / lentes cada câmera possui e habilite telas separadas no mosaico do NVR.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Informative Explanation Banner */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">
                Como funciona a tecnologia Multi-Sensor / Multi-Lente?
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Câmeras com múltiplos sensores (como o modelo com IP <strong className="text-foreground">192.168.0.240</strong> que possui 3 lentes físicas Full HD) geram um fluxo com múltiplas visões. Ao habilitar o modo multi-tela, o HomePulse AI divide o vídeo em <strong className="text-foreground">telas 16:9 individuais</strong> para cada lente, sem recompressão e sem gastar banda de rede extra.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyPreset240}
              className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <CheckCircle2 className="size-3.5" /> Aplicar Configuração para Câmera 192.168.0.240 (3 Lentes)
            </Button>
          </div>
        </div>

        {/* List of Cameras */}
        <div className="space-y-4 py-2">
          {cameras.map((cam) => {
            const cfg = cameraConfigs.find((c) => c.id === cam.id) || {
              id: cam.id,
              lensCount: cam.lensCount || 1,
              splitLensesIntoGrid: cam.splitLensesIntoGrid || false,
            };

            const is240 = cam.ip === "192.168.0.240" || cam.name.includes("240");

            return (
              <div
                key={cam.id}
                className={`rounded-xl border p-4 transition-all duration-200 ${
                  cfg.lensCount > 1
                    ? "border-primary/50 bg-primary/[0.03] shadow-sm"
                    : "border-border/60 bg-card/60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        cfg.lensCount > 1
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Cctv className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{cam.name}</h4>
                        {is240 && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/20 text-primary text-[10px] font-mono border-primary/30"
                          >
                            3 Lentes Físicas Detectadas
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        IP: {cam.ip} • Sala: {cam.roomName} • Protocolo: {cam.protocol}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={cfg.lensCount > 1 ? "default" : "outline"}
                    className="self-start sm:self-center text-xs"
                  >
                    {cfg.lensCount === 1
                      ? "1 Visão (Lente Única)"
                      : `${cfg.lensCount} Visões Independentes`}
                  </Badge>
                </div>

                {/* Controls for this camera */}
                <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Number of Lenses */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <SlidersHorizontal className="size-3.5 text-primary" /> Quantidade de Lentes / Visões
                    </Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((count) => (
                        <Button
                          key={count}
                          type="button"
                          variant={cfg.lensCount === count ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSetLensCount(cam.id, count)}
                          className={`h-9 text-xs font-bold transition-all ${
                            cfg.lensCount === count
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {count === 1 ? "1 (Padrão)" : `${count} Telas`}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {cfg.lensCount === 1
                        ? "Sensor único tradicional em proporção 16:9."
                        : cfg.lensCount === 3
                        ? "Tripla visão: Lente 1 (Superior), Lente 2 (Central), Lente 3 (Inferior)."
                        : `${cfg.lensCount} sensores empilhados no mesmo dispositivo.`}
                    </p>
                  </div>

                  {/* Toggle Split into Grid */}
                  <div className="flex flex-col justify-between rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Grid2X2 className="size-3.5 text-primary" /> Dividir em Telas Separadas na Grade
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Cria {cfg.lensCount} canais independentes no mosaico ao vivo
                        </p>
                      </div>
                      <Switch
                        checked={cfg.splitLensesIntoGrid}
                        onCheckedChange={(checked) => handleToggleSplit(cam.id, checked)}
                        disabled={cfg.lensCount <= 1}
                      />
                    </div>

                    {cfg.lensCount > 1 && cfg.splitLensesIntoGrid && (
                      <div className="rounded bg-primary/10 border border-primary/20 p-2 text-[11px] text-primary space-y-1">
                        <div className="font-semibold flex items-center gap-1">
                          <Eye className="size-3" /> Canais gerados para esta câmera:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] text-primary/90 pl-1 font-mono">
                          <li>Tela 1: Lente 1 (Superior / Rua & Trânsito)</li>
                          <li>Tela 2: Lente 2 (Central / Portão & Entrada)</li>
                          {cfg.lensCount >= 3 && <li>Tela 3: Lente 3 (Inferior / Calçada & Poste)</li>}
                          {cfg.lensCount >= 4 && <li>Tela 4: Lente 4 (Visão Panorâmica)</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/40">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            Salvar e Aplicar Visões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
