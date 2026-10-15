import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Cctv,
  Video,
  Plus,
  HardDrive,
  Cpu,
  ShieldAlert,
  Play,
  Grid2X2,
  Square,
  Grid3X3,
  Maximize2,
  Radio,
  SlidersHorizontal,
  Volume2,
  RefreshCw,
  Bell,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IpCamera,
  NvrRecording,
  AiSecurityEvent,
  StorageDisk,
  INITIAL_CAMERAS,
  INITIAL_DISKS,
  INITIAL_AI_EVENTS,
} from "@/types/dvr-nvr";
import { LiveCameraView } from "@/components/dvr-nvr/live-camera-view";
import { PtzControllerModal } from "@/components/dvr-nvr/ptz-controller-modal";
import { TimelinePlayback } from "@/components/dvr-nvr/timeline-playback";
import { AiAnalyticsPanel } from "@/components/dvr-nvr/ai-analytics-panel";
import { CameraManagerDialog } from "@/components/dvr-nvr/camera-manager-dialog";
import { StorageSettingsDialog } from "@/components/dvr-nvr/storage-settings-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dvr-nvr")({
  head: () => ({
    meta: [
      { title: "DVR / NVR — Videomonitoramento IP & CFTV | Casa Inteligente AI" },
      {
        name: "description",
        content:
          "Central profissional de vigilância IP com mosaico ao vivo, controle PTZ, reprodução 24h, analíticos de inteligência artificial e gerenciamento de armazenamento NVR.",
      },
    ],
  }),
  component: DvrNvrPage,
});

type GridMode = "1x1" | "2x2" | "3x3" | "1+5";

const CAMERAS_STORAGE_KEY = "homepulse_dvr_cameras_v1";
const DISKS_STORAGE_KEY = "homepulse_dvr_disks_v1";
const AI_EVENTS_STORAGE_KEY = "homepulse_dvr_events_v1";

function DvrNvrPage() {
  // Cameras state
  const [cameras, setCameras] = useState<IpCamera[]>(() => {
    try {
      const saved = localStorage.getItem(CAMERAS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved cameras", e);
    }
    return INITIAL_CAMERAS;
  });

  // Storage Disks state
  const [disks, setDisks] = useState<StorageDisk[]>(() => {
    try {
      const saved = localStorage.getItem(DISKS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved disks", e);
    }
    return INITIAL_DISKS;
  });

  // AI Security Events
  const [aiEvents, setAiEvents] = useState<AiSecurityEvent[]>(() => {
    try {
      const saved = localStorage.getItem(AI_EVENTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved AI events", e);
    }
    return INITIAL_AI_EVENTS;
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState("live");

  // Grid layout
  const [gridMode, setGridMode] = useState<GridMode>("2x2");
  const [focusedCameraId, setFocusedCameraId] = useState<string>(cameras[0]?.id || "cam-01");

  // Stream Quality
  const [streamQuality, setStreamQuality] = useState<"main" | "sub">("main");

  // Dialog states
  const [isCameraManagerOpen, setIsCameraManagerOpen] = useState(false);
  const [cameraToEdit, setCameraToEdit] = useState<IpCamera | null>(null);
  const [ptzCamera, setPtzCamera] = useState<IpCamera | null>(null);
  const [isStorageSettingsOpen, setIsStorageSettingsOpen] = useState(false);

  // General Alarm state
  const [isSirenActive, setIsSirenActive] = useState(false);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(CAMERAS_STORAGE_KEY, JSON.stringify(cameras));
    } catch (e) {
      console.warn("Failed to save cameras", e);
    }
  }, [cameras]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_EVENTS_STORAGE_KEY, JSON.stringify(aiEvents));
    } catch (e) {
      console.warn("Failed to save AI events", e);
    }
  }, [aiEvents]);

  // Calculations
  const onlineCamerasCount = cameras.filter((c) => c.status === "online").length;
  const totalBitrateMbps = (
    cameras.filter((c) => c.status === "online").reduce((acc, c) => acc + c.bitrateKbps, 0) / 1024
  ).toFixed(1);
  const totalStorageBytes = disks.reduce((acc, d) => acc + d.totalBytes, 0);
  const usedStorageBytes = disks.reduce((acc, d) => acc + d.usedBytes, 0);
  const usedPercent = Math.round((usedStorageBytes / totalStorageBytes) * 100);

  // Camera Handlers
  const handleSaveCamera = (cameraData: Partial<IpCamera>) => {
    if (cameraToEdit) {
      setCameras((prev) =>
        prev.map((c) => (c.id === cameraToEdit.id ? ({ ...c, ...cameraData } as IpCamera) : c))
      );
      toast.success(`Câmera "${cameraData.name}" atualizada com sucesso.`);
    } else {
      const newCamera: IpCamera = {
        id: `cam-${Date.now().toString(36)}`,
        name: cameraData.name || "Nova Câmera IP",
        roomName: cameraData.roomName || "Geral",
        ip: cameraData.ip || "192.168.1.150",
        port: cameraData.port || 554,
        onvifPort: cameraData.onvifPort || 80,
        manufacturer: cameraData.manufacturer || "Generic",
        model: cameraData.model || "Câmera IP Full HD",
        protocol: cameraData.protocol || "RTSP",
        rtspPath: cameraData.rtspPath || "/live/ch0",
        subStreamPath: cameraData.subStreamPath || "/live/ch1",
        username: cameraData.username || "admin",
        password: cameraData.password || "",
        resolution: cameraData.resolution || "1080p (1920x1080)",
        fps: cameraData.fps || 30,
        bitrateKbps: cameraData.bitrateKbps || 4096,
        codec: cameraData.codec || "H.265",
        status: "online",
        hasPtz: cameraData.hasPtz ?? false,
        hasTwoWayAudio: cameraData.hasTwoWayAudio ?? true,
        hasNightVision: cameraData.hasNightVision ?? true,
        nightVisionActive: false,
        recordingMode: cameraData.recordingMode || "continuous",
        streamUrl: cameraData.streamUrl,
        snapshotUrl: cameraData.snapshotUrl,
        viewMode: cameraData.viewMode || "auto",
        aiFeatures: cameraData.aiFeatures || {
          motionDetection: true,
          humanDetection: true,
          vehicleDetection: false,
          lineCrossing: false,
          facialRecognition: false,
        },
        presets: cameraData.presets || [
          { id: 1, name: "Posição Central" },
          { id: 2, name: "Entrada" },
        ],
      };
      setCameras((prev) => [...prev, newCamera]);
      toast.success(`Câmera "${newCamera.name}" adicionada ao NVR com sucesso.`);
    }
    setCameraToEdit(null);
  };

  const handleDeleteCamera = (id: string) => {
    const cam = cameras.find((c) => c.id === id);
    if (confirm(`Remover permanentemente a câmera "${cam?.name || id}" do NVR?`)) {
      setCameras((prev) => prev.filter((c) => c.id !== id));
      toast.success("Câmera removida do NVR.");
    }
  };

  const handleToggleSiren = () => {
    if (isSirenActive) {
      setIsSirenActive(false);
      toast.info("Sirene de alarme silenciada.");
    } else {
      if (confirm("ATENÇÃO: Acionar a Sirene Geral de Pânico em todas as câmeras e gateways do sistema?")) {
        setIsSirenActive(true);
        toast.error("SIRENE GERAL DE PÂNICO ACIONADA! Notificações emitidas.", {
          duration: 6000,
        });
      }
    }
  };

  const handleRecordAll = () => {
    toast.success("Gravação Manual Emergencial ativada em todos os canais simultaneamente.");
  };

  // Determine cameras to render in grid
  let displayedCameras = cameras;
  if (gridMode === "1x1") {
    const found = cameras.find((c) => c.id === focusedCameraId);
    displayedCameras = found ? [found] : cameras.slice(0, 1);
  } else if (gridMode === "2x2") {
    displayedCameras = cameras.slice(0, 4);
  } else if (gridMode === "3x3") {
    displayedCameras = cameras.slice(0, 9);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Status Metrics */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cctv className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  DVR / NVR — Central de Vigilância IP
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Sistema Operacional
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                CFTV profissional, mosaico multiview, detecção por Inteligência Artificial e linha do tempo 24h
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isSirenActive ? "destructive" : "outline"}
            size="sm"
            onClick={handleToggleSiren}
            className={`gap-1.5 ${isSirenActive ? "animate-pulse font-bold" : "text-red-400 border-red-500/30 hover:bg-red-500/10"}`}
          >
            <ShieldAlert className="size-4" />
            {isSirenActive ? "DESATIVAR SIRENE" : "Sirene Pânico"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecordAll}
            className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
          >
            <Video className="size-4" />
            REC Todos
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStorageSettingsOpen(true)}
            className="gap-1.5 text-xs"
          >
            <HardDrive className="size-4" />
            Discos ({usedPercent}%)
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCameraToEdit(null);
              setIsCameraManagerOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-4" />
            Adicionar Câmera
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Canais Operacionais</span>
            <Cctv className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {onlineCamerasCount} / {cameras.length}
          </div>
          <p className="text-[11px] text-emerald-400">100% dos streams estáveis</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Taxa de Dados / Bitrate</span>
            <Radio className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">{totalBitrateMbps} Mbps</div>
          <p className="text-[11px] text-muted-foreground">Compressão Smart H.265+</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Retenção NVR</span>
            <HardDrive className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">30 Dias</div>
          <p className="text-[11px] text-muted-foreground">Loop FIFO • S.M.A.R.T. OK</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Eventos I.A. Recentes</span>
            <Cpu className="size-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-foreground">{aiEvents.length}</div>
          <p className="text-[11px] text-purple-400">Pessoas & Veículos detectados</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-2">
          <TabsList className="bg-muted/40 p-1">
            <TabsTrigger value="live" className="gap-1.5 text-xs sm:text-sm">
              <Video className="size-4" />
              Mosaico ao Vivo
            </TabsTrigger>
            <TabsTrigger value="playback" className="gap-1.5 text-xs sm:text-sm">
              <Play className="size-4" />
              Reprodução 24h
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs sm:text-sm">
              <Sparkles className="size-4" />
              Analíticos & I.A.
            </TabsTrigger>
            <TabsTrigger value="cameras" className="gap-1.5 text-xs sm:text-sm">
              <Cctv className="size-4" />
              Câmeras ({cameras.length})
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-1.5 text-xs sm:text-sm">
              <HardDrive className="size-4" />
              Armazenamento
            </TabsTrigger>
          </TabsList>

          {/* Controls specific to live tab */}
          {activeTab === "live" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5">
                <Button
                  variant={gridMode === "1x1" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGridMode("1x1")}
                  className="h-7 w-8 p-0"
                  title="Câmera única em destaque (1x1)"
                >
                  <Square className="size-3.5" />
                </Button>
                <Button
                  variant={gridMode === "2x2" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGridMode("2x2")}
                  className="h-7 w-8 p-0"
                  title="Mosaico 4 canais (2x2)"
                >
                  <Grid2X2 className="size-3.5" />
                </Button>
                <Button
                  variant={gridMode === "3x3" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGridMode("3x3")}
                  className="h-7 w-8 p-0"
                  title="Mosaico 9 canais (3x3)"
                >
                  <Grid3X3 className="size-3.5" />
                </Button>
                <Button
                  variant={gridMode === "1+5" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGridMode("1+5")}
                  className="h-7 px-2 text-xs font-mono"
                  title="1 Principal + 5 Menores"
                >
                  1+5
                </Button>
              </div>

              {/* Stream Quality Selector */}
              <div className="flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5 text-xs">
                <Button
                  variant={streamQuality === "main" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setStreamQuality("main")}
                  className="h-7 px-2 text-xs font-medium"
                  title="Main Stream (Alta definição)"
                >
                  Main (HD)
                </Button>
                <Button
                  variant={streamQuality === "sub" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setStreamQuality("sub")}
                  className="h-7 px-2 text-xs font-medium text-muted-foreground"
                  title="Sub Stream (Fluidez / Menor tráfego)"
                >
                  Sub (Fluido)
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: Live Mosaic View */}
        <TabsContent value="live" className="m-0 space-y-4">
          {displayedCameras.length === 0 ? (
            <div className="text-center py-16 border rounded-xl border-dashed">
              <Cctv className="size-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold">Nenhuma câmera cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione suas câmeras IP via RTSP ou varredura de rede ONVIF
              </p>
              <Button onClick={() => setIsCameraManagerOpen(true)}>
                <Plus className="size-4 mr-2" /> Adicionar Câmera
              </Button>
            </div>
          ) : gridMode === "1+5" ? (
            /* 1+5 Layout (1 large on left, up to 5 smaller stacked on right) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <LiveCameraView
                  camera={cameras.find((c) => c.id === focusedCameraId) || cameras[0]}
                  isSubStream={streamQuality === "sub"}
                  onOpenPtz={(cam) => setPtzCamera(cam)}
                />
              </div>
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {cameras
                  .filter((c) => c.id !== (focusedCameraId || cameras[0].id))
                  .slice(0, 5)
                  .map((cam) => (
                    <div
                      key={cam.id}
                      onClick={() => setFocusedCameraId(cam.id)}
                      className="cursor-pointer transition-transform hover:scale-[1.01] rounded-lg overflow-hidden border border-border/60 hover:border-primary/60"
                      title="Clique para destacar como câmera principal"
                    >
                      <LiveCameraView
                        camera={cam}
                        isSubStream={true}
                        onOpenPtz={(c) => setPtzCamera(c)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Standard Grid Layout (1x1, 2x2, 3x3) */
            <div
              className={`grid gap-4 ${
                gridMode === "1x1"
                  ? "grid-cols-1 max-w-5xl mx-auto"
                  : gridMode === "2x2"
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {displayedCameras.map((camera) => (
                <div key={camera.id} className="relative">
                  <LiveCameraView
                    camera={camera}
                    isSubStream={streamQuality === "sub"}
                    onOpenPtz={(cam) => setPtzCamera(cam)}
                  />
                  {gridMode !== "1x1" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFocusedCameraId(camera.id);
                        setGridMode("1x1");
                      }}
                      className="absolute top-2 right-2 z-20 h-7 w-7 p-0 bg-black/60 hover:bg-black/80 text-white rounded opacity-0 hover:opacity-100 transition-opacity"
                      title="Focar nesta câmera (1x1)"
                    >
                      <Maximize2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick Camera Switcher Bar for 1x1 mode */}
          {gridMode === "1x1" && (
            <div className="flex items-center gap-2 overflow-x-auto p-2 bg-muted/20 border border-border/40 rounded-xl">
              <span className="text-xs text-muted-foreground whitespace-nowrap pl-2">Trocar Câmera:</span>
              {cameras.map((c) => (
                <Button
                  key={c.id}
                  variant={focusedCameraId === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFocusedCameraId(c.id)}
                  className="h-7 text-xs whitespace-nowrap gap-1.5"
                >
                  <Cctv className="size-3.5" />
                  {c.name}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Playback & 24h Timeline */}
        <TabsContent value="playback" className="m-0">
          <TimelinePlayback cameras={cameras} />
        </TabsContent>

        {/* TAB 3: AI Analytics & Smart Detection */}
        <TabsContent value="ai" className="m-0">
          <AiAnalyticsPanel
            cameras={cameras}
            events={aiEvents}
            onAcknowledgeEvent={(eventId) => {
              setAiEvents((prev) =>
                prev.map((e) => (e.id === eventId ? { ...e, acknowledged: true } : e))
              );
              toast.success("Alerta reconhecido pelo operador.");
            }}
          />
        </TabsContent>

        {/* TAB 4: IP Cameras Manager */}
        <TabsContent value="cameras" className="m-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Câmeras IP Cadastradas</h2>
              <p className="text-xs text-muted-foreground">
                Gerencie canais de vídeo, credenciais RTSP, portas ONVIF e resoluções
              </p>
            </div>
            <Button
              onClick={() => {
                setCameraToEdit(null);
                setIsCameraManagerOpen(true);
              }}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="size-4" /> Adicionar Câmera
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Canal / Nome</th>
                    <th className="py-3 px-4 font-semibold">Fabricante / Modelo</th>
                    <th className="py-3 px-4 font-semibold">Endereço IP & Porta</th>
                    <th className="py-3 px-4 font-semibold">Resolução & Codec</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {cameras.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.roomName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{c.manufacturer}</div>
                        <div className="text-[11px] text-muted-foreground">{c.model}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div>{c.ip}:{c.port}</div>
                        <div className="text-muted-foreground">ONVIF: {c.onvifPort || "N/A"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                          {c.codec}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{c.resolution} @ {c.fps}fps</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            c.status === "online"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }
                        >
                          ● {c.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {c.hasPtz && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPtzCamera(c)}
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                            title="Controle PTZ"
                          >
                            PTZ
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCameraToEdit(c);
                            setIsCameraManagerOpen(true);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCamera(c.id)}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: Storage & Disks */}
        <TabsContent value="storage" className="m-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Armazenamento & Discos NVR</h2>
              <p className="text-xs text-muted-foreground">
                Capacidade de armazenamento, integridade S.M.A.R.T. e políticas de retenção
              </p>
            </div>
            <Button
              onClick={() => setIsStorageSettingsOpen(true)}
              size="sm"
              className="gap-1.5"
            >
              <SlidersHorizontal className="size-4" /> Configurar Retenção
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disks.map((disk) => {
              const diskPercent = Math.round((disk.usedBytes / disk.totalBytes) * 100);
              const formatGbOrTb = (bytes: number) => {
                const tb = bytes / 1_000_000_000_000;
                return `${tb.toFixed(1)} TB`;
              };
              return (
                <div key={disk.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-foreground">{disk.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {disk.type} • Retenção {disk.retentionDays} dias
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      S.M.A.R.T. {disk.smartStatus}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Usado: {formatGbOrTb(disk.usedBytes)}</span>
                      <span>Total: {formatGbOrTb(disk.totalBytes)} ({diskPercent}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${diskPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Temperatura: <strong className="text-foreground">{disk.temperatureCelsius}°C</strong></span>
                    <span className="text-emerald-400">● Gravação em Loop Ativa</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs and Modals */}
      <CameraManagerDialog
        open={isCameraManagerOpen}
        onOpenChange={setIsCameraManagerOpen}
        onSaveCamera={handleSaveCamera}
        existingCamera={cameraToEdit}
      />

      {ptzCamera && (
        <PtzControllerModal
          camera={ptzCamera}
          open={!!ptzCamera}
          onOpenChange={(open) => {
            if (!open) setPtzCamera(null);
          }}
        />
      )}

      <StorageSettingsDialog
        open={isStorageSettingsOpen}
        onOpenChange={setIsStorageSettingsOpen}
        disks={disks}
        cameras={cameras}
      />
    </div>
  );
}
