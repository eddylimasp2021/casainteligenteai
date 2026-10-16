import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
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
  FolderOpen,
  Film,
  Camera as CameraIcon,
  Copy,
  Check,
  Server,
  Globe,
  Lock,
  Bot,
  Wifi,
  ShieldCheck,
  ClipboardPaste,
  ExternalLink,
  Zap,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IpCamera,
  NvrRecording,
  AiSecurityEvent,
  StorageDisk,
  StorageConfig,
  INITIAL_STORAGE_CONFIG,
  INITIAL_CAMERAS,
  INITIAL_DISKS,
  INITIAL_AI_EVENTS,
} from "@/types/dvr-nvr";
import { LiveCameraView } from "@/components/dvr-nvr/live-camera-view";
import { RealCameraPlayer } from "@/components/dvr-nvr/real-camera-player";
import { PtzControllerModal } from "@/components/dvr-nvr/ptz-controller-modal";
import { TimelinePlayback } from "@/components/dvr-nvr/timeline-playback";
import { AiAnalyticsPanel } from "@/components/dvr-nvr/ai-analytics-panel";
import { CameraManagerDialog } from "@/components/dvr-nvr/camera-manager-dialog";
import { StorageSettingsDialog } from "@/components/dvr-nvr/storage-settings-dialog";
import { MultiLensConfigDialog } from "@/components/dvr-nvr/multi-lens-config-dialog";
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
const STORAGE_CONFIG_KEY = "homepulse_dvr_storage_config_v1";

function DvrNvrPage() {
  // Storage Configuration state (Where to save recordings and snapshots - strictly Drive D:)
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed: StorageConfig = JSON.parse(saved);
        let changed = false;
        // Strict guard: drive C has critical low space (3.6 GB), enforce Drive D:
        if (!parsed.recordingsDirectory || /^c:/i.test(parsed.recordingsDirectory)) {
          parsed.recordingsDirectory = "D:\\Gravacoes_CFTV";
          changed = true;
        }
        if (!parsed.snapshotsDirectory || /^c:/i.test(parsed.snapshotsDirectory)) {
          parsed.snapshotsDirectory = "D:\\Gravacoes_CFTV\\Snapshots";
          changed = true;
        }
        if (changed) {
          localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse saved storage config", e);
    }
    return INITIAL_STORAGE_CONFIG;
  });

  // Cameras state
  const [cameras, setCameras] = useState<IpCamera[]>(() => {
    try {
      const saved = localStorage.getItem(CAMERAS_STORAGE_KEY);
      if (saved) {
        let parsed = JSON.parse(saved) as IpCamera[];
        const hasRealCam = parsed.some(
          (c) => c.ip === "192.168.0.139" || c.streamName === "garagem_rua"
        );
        if (!hasRealCam && INITIAL_CAMERAS.length > 0) {
          parsed = [INITIAL_CAMERAS[0]!, ...parsed];
        }

        // Ensure 192.168.0.240 triple camera is present
        const hasCam240 = parsed.some(
          (c) => c.ip === "192.168.0.240" || c.streamName === "cam_192_168_0_240" || c.id === "cam-real-240"
        );
        if (!hasCam240 && INITIAL_CAMERAS.length > 1) {
          parsed = [parsed[0]!, INITIAL_CAMERAS[1]!, ...parsed.slice(1)];
        }

        // Ensure 192.168.0.198 camera is present
        const hasCam198 = parsed.some(
          (c) => c.ip === "192.168.0.198" || c.streamName === "cam_192_168_0_198" || c.id === "cam-real-198"
        );
        if (!hasCam198 && INITIAL_CAMERAS.some((c) => c.ip === "192.168.0.198")) {
          const initial198 = INITIAL_CAMERAS.find((c) => c.ip === "192.168.0.198")!;
          parsed = [...parsed, initial198];
        }

        return parsed.map((c) => {
          if (
            (c.ip === "192.168.0.139" || (c.name && c.name.toLowerCase().includes("garagem"))) &&
            (!c.streamName || c.streamName === "cam-garagem")
          ) {
            return {
              ...c,
              streamName: "garagem_rua",
              activeProtocol: "WebRTC",
            };
          }
          if (c.ip === "192.168.0.240" || (c.name && c.name.toLowerCase().includes("240"))) {
            return {
              ...c,
              streamName: "cam_192_168_0_240",
              activeProtocol: "WebRTC",
              lensCount: c.lensCount ?? 3,
              splitLensesIntoGrid: c.splitLensesIntoGrid ?? true,
            };
          }
          if (c.ip === "192.168.0.198" || (c.name && c.name.toLowerCase().includes("198"))) {
            return {
              ...c,
              streamName: "cam_192_168_0_198",
              activeProtocol: "WebRTC",
            };
          }
          return c;
        });
      }
    } catch (e) {
      console.warn("Failed to parse saved cameras", e);
    }
    return INITIAL_CAMERAS;
  });

  // Storage Disks state (Strictly enforce Drive D: - eliminate any disk referencing C:)
  const [disks, setDisks] = useState<StorageDisk[]>(() => {
    try {
      const saved = localStorage.getItem(DISKS_STORAGE_KEY);
      if (saved) {
        let parsed = JSON.parse(saved) as StorageDisk[];
        let changed = false;
        parsed = parsed.map((disk) => {
          // If disk references drive C or has a C: mount path or is named Disco C:, migrate it to Drive D:
          if (/^c:/i.test(disk.mountPath ?? "") || disk.name.toLowerCase().includes("disco c")) {
            changed = true;
            return {
              ...disk,
              name: "Disco D:\\ (Armazenamento Secundário D: / Snapshots & I.A. 4TB)",
              mountPath: "D:\\Gravacoes_CFTV\\Snapshots",
              status: "healthy",
              isSystemDisk: false,
              totalBytes: 4000000000000,
              usedBytes: 1220000000000,
            };
          }
          return disk;
        });
        if (changed) {
          localStorage.setItem(DISKS_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
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

  // View Engine: "real" (WebRTC via Docker Media Gateway go2rtc) vs "simulation" (AI Canvas)
  const [viewEngine, setViewEngine] = useState<"real" | "simulation">("real");
  const CURRENT_CLOUDFLARE_TUNNEL = "https://usb-recommendations-harvey-ram.trycloudflare.com";
  
  // Connection Mode: "robot" (Auto-Sync) | "lan" (Rede Local Direta) | "permanent" (Túnel Fixo Zero Trust)
  const [connectionMode, setConnectionMode] = useState<"robot" | "lan" | "permanent">(() => {
    try {
      const savedMode = localStorage.getItem("homepulse_dvr_connection_mode_v1");
      if (savedMode === "lan" || savedMode === "permanent" || savedMode === "robot") {
        return savedMode;
      }
    } catch {}
    return "robot"; // Padrão: Modo 2 (Robô Auto-Sync para a casa teste)
  });

  const [permanentUrl, setPermanentUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("homepulse_dvr_permanent_url_v1") || "";
    } catch {}
    return "";
  });
  const [permanentToken, setPermanentToken] = useState<string>(() => {
    try {
      return localStorage.getItem("homepulse_dvr_permanent_token_v1") || "";
    } catch {}
    return "";
  });

  const [gatewayUrl, setGatewayUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("homepulse_dvr_gateway_url_v1");
      if (saved && saved.trim()) {
        if (saved.includes("trycloudflare.com") && saved.trim() !== CURRENT_CLOUDFLARE_TUNNEL) {
          localStorage.setItem("homepulse_dvr_gateway_url_v1", CURRENT_CLOUDFLARE_TUNNEL);
          return CURRENT_CLOUDFLARE_TUNNEL;
        }
        return saved.trim();
      }
    } catch {}
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    return isHttps ? CURRENT_CLOUDFLARE_TUNNEL : "http://127.0.0.1:1985";
  });
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [tempGatewayUrl, setTempGatewayUrl] = useState(gatewayUrl);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: "ok" | "error"; latency?: number; streamsCount?: number; message?: string } | null>(null);

  // Ping test helper
  const handleTestPing = async (urlToTest?: string) => {
    const target = (urlToTest || tempGatewayUrl || gatewayUrl).trim().replace(/\/$/, "");
    if (!target) return;
    setIsTestingPing(true);
    setPingResult(null);

    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${target}/api/streams`, { signal: ctrl.signal });
      clearTimeout(tid);
      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        const data = await res.json();
        const count = Object.keys(data || {}).length;
        setPingResult({ status: "ok", latency, streamsCount: count });
      } else {
        setPingResult({ status: "error", message: `HTTP ${res.status}: ${res.statusText}` });
      }
    } catch (e: any) {
      setPingResult({ status: "error", message: e?.message || "Falha ao conectar no Gateway" });
    } finally {
      setIsTestingPing(false);
    }
  };

  // Clipboard paste helper for Auto-Sync
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes("trycloudflare.com") || text.includes("http://") || text.includes("https://"))) {
        const clean = text.trim();
        setTempGatewayUrl(clean);
        toast.success("URL capturada da Área de Transferência com sucesso!", {
          description: clean,
        });
        handleTestPing(clean);
      } else {
        toast.info("Nenhuma URL de túnel válida foi encontrada na sua Área de Transferência.", {
          description: "Execute o INICIAR_CFTV_HOMEPULSE.bat para copiar o link atual.",
        });
      }
    } catch {
      toast.error("Não foi possível acessar a Área de Transferência do navegador.");
    }
  };

  // Auto-healing: Test active gateway URL and recover to CURRENT_CLOUDFLARE_TUNNEL if unreachable
  useEffect(() => {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    if (isHttps && gatewayUrl.includes("trycloudflare.com") && gatewayUrl !== CURRENT_CLOUDFLARE_TUNNEL) {
      setGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
      setTempGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
      try {
        localStorage.setItem("homepulse_dvr_gateway_url_v1", CURRENT_CLOUDFLARE_TUNNEL);
      } catch {}
      return;
    }

    const testController = new AbortController();
    const timeoutId = setTimeout(() => testController.abort(), 4000);
    fetch(`${gatewayUrl}/api/streams`, { signal: testController.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok && gatewayUrl !== CURRENT_CLOUDFLARE_TUNNEL && isHttps) {
          console.warn("[DVR] Gateway inacessível, recuperando para o túnel ativo:", CURRENT_CLOUDFLARE_TUNNEL);
          setGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
          setTempGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
          try {
            localStorage.setItem("homepulse_dvr_gateway_url_v1", CURRENT_CLOUDFLARE_TUNNEL);
          } catch {}
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (gatewayUrl !== CURRENT_CLOUDFLARE_TUNNEL && isHttps) {
          console.warn("[DVR] Falha de conexão com gateway salvo. Restaurando túnel oficial:", CURRENT_CLOUDFLARE_TUNNEL);
          setGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
          setTempGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
          try {
            localStorage.setItem("homepulse_dvr_gateway_url_v1", CURRENT_CLOUDFLARE_TUNNEL);
          } catch {}
        }
      });
  }, [gatewayUrl]);

  useEffect(() => {
    try {
      localStorage.setItem("homepulse_dvr_gateway_url_v1", gatewayUrl);
    } catch {}
  }, [gatewayUrl]);

  // Grid layout
  const [gridMode, setGridMode] = useState<GridMode>("2x2");
  const [focusedCameraId, setFocusedCameraId] = useState<string>(cameras[0]?.id || "cam-real-01");

  // Stream Quality
  const [streamQuality, setStreamQuality] = useState<"main" | "sub">("main");

  // Dialog states
  const [isCameraManagerOpen, setIsCameraManagerOpen] = useState(false);
  const [cameraToEdit, setCameraToEdit] = useState<IpCamera | null>(null);
  const [ptzCamera, setPtzCamera] = useState<IpCamera | null>(null);
  const [isStorageSettingsOpen, setIsStorageSettingsOpen] = useState(false);
  const [isMultiLensModalOpen, setIsMultiLensModalOpen] = useState(false);

  // Helper to open PTZ targeting root camera even when clicked on virtual sub-channel
  const handleOpenPtz = (cam: IpCamera) => {
    const baseId = cam.id.split("__lens_")[0];
    const baseCam = cameras.find((c) => c.id === baseId) || cam;
    setPtzCamera(baseCam);
  };

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(storageConfig));
    } catch (e) {
      console.warn("Failed to save storage config", e);
    }
  }, [storageConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(DISKS_STORAGE_KEY, JSON.stringify(disks));
    } catch (e) {
      console.warn("Failed to save disks", e);
    }
  }, [disks]);

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
    const derivedStream =
      cameraData.streamName ||
      (cameraData.ip === "192.168.0.139" || (cameraData.name && cameraData.name.toLowerCase().includes("garagem"))
        ? "garagem_rua"
        : `cam_${(cameraData.ip || "stream").replace(/\./g, "_")}`);

    if (cameraToEdit) {
      setCameras((prev) =>
        prev.map((c) =>
          c.id === cameraToEdit.id
            ? ({
                ...c,
                ...cameraData,
                streamName: derivedStream,
                gatewayHost: cameraData.gatewayHost || "localhost:1984",
                activeProtocol: cameraData.activeProtocol || "WebRTC",
              } as IpCamera)
            : c
        )
      );
      toast.success(`Câmera "${cameraData.name || cameraToEdit.name}" atualizada com sucesso.`);
    } else {
      const newCamera: IpCamera = {
        id: `cam-${Date.now().toString(36)}`,
        name: cameraData.name || "Nova Câmera IP",
        roomName: cameraData.roomName || "Geral",
        ip: cameraData.ip || "192.168.0.139",
        port: cameraData.port || 554,
        onvifPort: cameraData.onvifPort || 80,
        manufacturer: cameraData.manufacturer || "Generic",
        model: cameraData.model || "Câmera IP Full HD",
        protocol: cameraData.protocol || "RTSP",
        rtspPath: cameraData.rtspPath || "/onvif1",
        subStreamPath: cameraData.subStreamPath || "/onvif2",
        username: cameraData.username || "admin",
        password: cameraData.password || "",
        streamName: derivedStream,
        gatewayHost: cameraData.gatewayHost || "localhost:1984",
        activeProtocol: cameraData.activeProtocol || "WebRTC",
        resolution: cameraData.resolution || "1080p (1920x1080)",
        fps: cameraData.fps || 30,
        bitrateKbps: cameraData.bitrateKbps || 4096,
        codec: cameraData.codec || "H.264",
        status: "online",
        hasPtz: cameraData.hasPtz ?? false,
        hasTwoWayAudio: cameraData.hasTwoWayAudio ?? true,
        hasNightVision: cameraData.hasNightVision ?? true,
        nightVisionActive: false,
        recordingMode: cameraData.recordingMode || "continuous",
        streamUrl: cameraData.streamUrl,
        snapshotUrl: cameraData.snapshotUrl,
        viewMode: cameraData.viewMode || "stream",
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
        ...cameraData,
      };
      setCameras((prev) => [newCamera, ...prev]);
      setFocusedCameraId(newCamera.id);
      toast.success(`Câmera "${newCamera.name}" adicionada ao NVR com sucesso.`);
    }
    setCameraToEdit(null);
    setIsCameraManagerOpen(false);
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

  // Expand multi-lens cameras into individual grid channels when splitLensesIntoGrid is active
  const gridChannels = useMemo(() => {
    const list: IpCamera[] = [];
    for (const cam of cameras) {
      const total =
        cam.lensCount ??
        (cam.ip === "192.168.0.240" || cam.name.toLowerCase().includes("240") ? 3 : 1);
      const shouldSplit = cam.splitLensesIntoGrid ?? (total > 1);

      const effectiveStream =
        cam.streamName ||
        (cam.ip === "192.168.0.240" || cam.name.includes("240")
          ? "cam_192_168_0_240"
          : cam.ip === "192.168.0.198" || cam.name.includes("198")
          ? "cam_192_168_0_198"
          : cam.ip === "192.168.0.139" || cam.name.toLowerCase().includes("garagem")
          ? "garagem_rua"
          : cam.id);

      if (total > 1 && shouldSplit) {
        for (let lens = 1; lens <= total; lens++) {
          const label =
            total === 3
              ? lens === 1
                ? "Lente 1: Superior"
                : lens === 2
                ? "Lente 2: Central"
                : "Lente 3: Inferior"
              : `Lente ${lens}`;

          list.push({
            ...cam,
            id: `${cam.id}__lens_${lens}`,
            name: `${cam.name} — ${label}`,
            selectedLens: lens,
            lensCount: total,
            streamName: effectiveStream,
          });
        }
      } else {
        list.push({
          ...cam,
          streamName: effectiveStream,
        });
      }
    }
    return list;
  }, [cameras]);

  // Determine cameras to render in grid
  let displayedCameras = gridChannels;
  if (gridMode === "1x1") {
    const found = gridChannels.find((c) => c.id === focusedCameraId);
    displayedCameras = found ? [found] : gridChannels.slice(0, 1);
  } else if (gridMode === "2x2") {
    displayedCameras = gridChannels.slice(0, 4);
  } else if (gridMode === "3x3") {
    displayedCameras = gridChannels.slice(0, 9);
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

          {/* Multi-Lens Cameras Configuration Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMultiLensModalOpen(true)}
            className="gap-1.5 text-xs border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold shadow-sm"
            title="Configurar câmeras com múltiplas lentes / visões (Ex: 192.168.0.240 com 3 telas)"
          >
            <Layers className="size-4" />
            Multi-Lente (3 Visões)
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
            <div className="flex flex-wrap items-center gap-2">
              {/* Engine Switcher: Real WebRTC via Docker vs Simulação I.A. */}
              <div className="flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5 text-xs">
                <Button
                  variant={viewEngine === "real" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewEngine("real")}
                  className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${
                    viewEngine === "real"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Vídeo real direto do Docker go2rtc via WebRTC (<100ms)"
                >
                  <Radio className="size-3 text-emerald-300 animate-pulse" />
                  Vídeo Real (WebRTC)
                </Button>
                <Button
                  variant={viewEngine === "simulation" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewEngine("simulation")}
                  className="h-7 px-2.5 text-xs font-medium text-muted-foreground gap-1.5"
                  title="Simulação gráfica com IA (demonstrativo)"
                >
                  <Sparkles className="size-3 text-purple-400" />
                  Simulação I.A.
                </Button>
              </div>

              {/* Gateway CFTV Connection Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTempGatewayUrl(gatewayUrl);
                  setIsGatewayModalOpen(true);
                }}
                className="h-7 px-2.5 text-xs font-medium gap-1.5 border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Configurar endereço do Gateway CFTV / Túnel HTTPS"
              >
                <Server className="size-3 text-primary" />
                <span className="hidden sm:inline">Gateway CFTV</span>
                <span
                  className={`size-2 rounded-full ${
                    gatewayUrl.startsWith("https://") ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
              </Button>

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
                {viewEngine === "real" ? (
                  <RealCameraPlayer
                    camera={gridChannels.find((c) => c.id === focusedCameraId) || gridChannels[0]!}
                    gatewayUrl={gatewayUrl}
                    onOpenPtz={handleOpenPtz}
                    isFocused={true}
                  />
                ) : (
                  <LiveCameraView
                    camera={gridChannels.find((c) => c.id === focusedCameraId) || gridChannels[0]!}
                    onOpenPtz={handleOpenPtz}
                  />
                )}
              </div>
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {gridChannels
                  .filter((c) => c.id !== (focusedCameraId || gridChannels[0]?.id))
                  .slice(0, 5)
                  .map((cam) => (
                    <div
                      key={cam.id}
                      onClick={() => setFocusedCameraId(cam.id)}
                      className="cursor-pointer transition-transform hover:scale-[1.01] rounded-lg overflow-hidden border border-border/60 hover:border-primary/60"
                      title="Clique para destacar como câmera principal"
                    >
                      {viewEngine === "real" ? (
                        <RealCameraPlayer
                          camera={cam}
                          gatewayUrl={gatewayUrl}
                          onOpenPtz={handleOpenPtz}
                        />
                      ) : (
                        <LiveCameraView
                          camera={cam}
                          onOpenPtz={handleOpenPtz}
                        />
                      )}
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
                  {viewEngine === "real" ? (
                    <RealCameraPlayer
                      camera={camera}
                      gatewayUrl={gatewayUrl}
                      onOpenPtz={handleOpenPtz}
                      isFocused={focusedCameraId === camera.id}
                      onSelect={() => setFocusedCameraId(camera.id)}
                    />
                  ) : (
                    <LiveCameraView
                      camera={camera}
                      onOpenPtz={handleOpenPtz}
                      isFocused={focusedCameraId === camera.id}
                      onSelect={() => setFocusedCameraId(camera.id)}
                    />
                  )}
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
              {gridChannels.map((c) => (
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
          <TimelinePlayback
            cameras={cameras}
            selectedCameraId={focusedCameraId ?? cameras[0]?.id ?? ""}
            onSelectCamera={setFocusedCameraId}
            gatewayBase={gatewayUrl}
          />
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
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-foreground">{c.name}</div>
                          {c.lensCount && c.lensCount > 1 && (
                            <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary border-primary/30 gap-1 font-mono">
                              <Layers className="size-3" /> {c.lensCount} Lentes
                            </Badge>
                          )}
                        </div>
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
                      <td className="py-3 px-4 text-right space-x-1 sm:space-x-2">
                        {c.lensCount && c.lensCount > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsMultiLensModalOpen(true)}
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1 font-semibold"
                            title="Configurar Lentes e Múltiplas Visões"
                          >
                            <Layers className="size-3" /> Visões ({c.lensCount})
                          </Button>
                        )}
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
              <h2 className="text-lg font-semibold">Armazenamento & Destino de Gravação NVR</h2>
              <p className="text-xs text-muted-foreground">
                Diretório de gravação de imagens e vídeos, capacidade dos discos e integridade S.M.A.R.T.
              </p>
            </div>
            <Button
              onClick={() => setIsStorageSettingsOpen(true)}
              size="sm"
              className="gap-1.5"
            >
              <SlidersHorizontal className="size-4" /> Configurar Destino & Retenção
            </Button>
          </div>

          {/* Active Recording & Snapshot Destination Card */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  <FolderOpen className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">
                      Destino Ativo das Gravações & Fotos
                    </h3>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                      Armazenamento Pronto
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Onde o NVR armazena vídeos contínuos, detecções por I.A. e snapshots de fotos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsStorageSettingsOpen(true)}
                  className="gap-1.5 text-xs shadow"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Alterar Local de Gravação
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-background/80 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Film className="size-3.5 text-primary" /> Pasta de Gravação de Vídeos das Câmeras:
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(storageConfig.recordingsDirectory);
                      toast.success("Caminho de gravação copiado!");
                    }}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Copy className="size-3" /> Copiar
                  </Button>
                </div>
                <div className="font-mono text-xs font-bold text-primary truncate select-all bg-muted/50 p-2 rounded border border-border/40">
                  {storageConfig.recordingsDirectory}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-3 pt-0.5">
                  <span>Formato: <strong className="text-foreground uppercase">{storageConfig.fileFormat}</strong></span>
                  <span>Segmento: <strong className="text-foreground">{storageConfig.segmentDurationMinutes} min</strong></span>
                  <span>Qualidade: <strong className="text-foreground">{storageConfig.recordingQuality === "main" ? "Full HD" : "Sub (Fluido)"}</strong></span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-background/80 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CameraIcon className="size-3.5 text-primary" /> Pasta de Fotos (Snapshots):
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(storageConfig.snapshotsDirectory);
                      toast.success("Caminho de snapshots copiado!");
                    }}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Copy className="size-3" /> Copiar
                  </Button>
                </div>
                <div className="font-mono text-xs font-bold text-primary truncate select-all bg-muted/50 p-2 rounded border border-border/40">
                  {storageConfig.snapshotsDirectory}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-3 pt-0.5">
                  <span>Estrutura: <strong className="text-foreground">{storageConfig.folderStructure === "date_camera" ? "/[Data]/[Câmera]/" : "/[Câmera]/[Data]/"}</strong></span>
                  <span>Retenção: <strong className="text-foreground">{storageConfig.retentionDays} dias</strong></span>
                  <span className="text-emerald-400">● 24/7 Loop FIFO</span>
                </div>
              </div>
            </div>
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
        cameras={cameras}
        open={isCameraManagerOpen}
        onOpenChange={setIsCameraManagerOpen}
        onSaveCamera={handleSaveCamera}
        existingCamera={cameraToEdit}
        onDeleteCamera={handleDeleteCamera}
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
        storageConfig={storageConfig}
        onSaveStorageConfig={setStorageConfig}
        onUpdateDisks={setDisks}
      />

      {/* Multi-Lens Configuration Modal */}
      <MultiLensConfigDialog
        open={isMultiLensModalOpen}
        onOpenChange={setIsMultiLensModalOpen}
        cameras={cameras}
        onUpdateCameras={(updated) => {
          setCameras(updated);
          localStorage.setItem(CAMERAS_STORAGE_KEY, JSON.stringify(updated));
        }}
      />

      {/* Gateway CFTV Configuration Modal */}
      <Dialog open={isGatewayModalOpen} onOpenChange={setIsGatewayModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Server className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Gateway de Mídia CFTV (go2rtc)</DialogTitle>
                <DialogDescription className="text-xs">
                  Conecte o frontend Lovable ao gateway de streaming WebRTC das suas câmeras
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1 text-xs">
            {/* 3 Modes Selector Tabs */}
            <Tabs
              value={connectionMode}
              onValueChange={(val: any) => {
                setConnectionMode(val);
                try {
                  localStorage.setItem("homepulse_dvr_connection_mode_v1", val);
                } catch {}
                if (val === "robot") {
                  setTempGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
                } else if (val === "lan") {
                  setTempGatewayUrl("http://127.0.0.1:1984");
                } else if (val === "permanent" && permanentUrl) {
                  setTempGatewayUrl(permanentUrl);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1">
                <TabsTrigger value="robot" className="gap-1.5 text-xs py-1.5">
                  <Bot className="size-3.5 text-emerald-400" /> Auto-Sync
                </TabsTrigger>
                <TabsTrigger value="lan" className="gap-1.5 text-xs py-1.5">
                  <Wifi className="size-3.5 text-blue-400" /> Rede Local
                </TabsTrigger>
                <TabsTrigger value="permanent" className="gap-1.5 text-xs py-1.5">
                  <ShieldCheck className="size-3.5 text-purple-400" /> Túnel Fixo
                </TabsTrigger>
              </TabsList>

              {/* MODO 2: ROBÔ AUTO-SYNC (ATIVO PARA CASA TESTE) */}
              <TabsContent value="robot" className="space-y-3 pt-3 m-0">
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5 text-emerald-300">
                      <Bot className="size-4 text-emerald-400" /> Robô de Auto-Sincronização Ativo
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-[9px] py-0 border-emerald-500/40">
                      Casa Teste
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Sempre que o container do Docker reinicia, o robô captura o novo link temporário da Cloudflare automaticamente. O script <code>INICIAR_CFTV_HOMEPULSE.bat</code> já copia o link ativo para a sua área de transferência.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">URL Ativa Detectada:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tempGatewayUrl}
                      onChange={(e) => setTempGatewayUrl(e.target.value)}
                      placeholder="https://...trycloudflare.com"
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handlePasteFromClipboard}
                      className="shrink-0 gap-1.5 text-xs bg-muted/60 hover:bg-muted"
                      title="Colar URL copiada pelo script da Área de Transferência"
                    >
                      <ClipboardPaste className="size-3.5 text-primary" /> Colar do Robô
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTempGatewayUrl(CURRENT_CLOUDFLARE_TUNNEL);
                      handleTestPing(CURRENT_CLOUDFLARE_TUNNEL);
                    }}
                    className="h-7 text-[11px] gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <RefreshCw className="size-3" /> Restaurar Túnel Atual
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTestPing()}
                    disabled={isTestingPing}
                    className="h-7 text-[11px] gap-1.5"
                  >
                    <Activity className={`size-3 ${isTestingPing ? "animate-spin" : ""}`} />
                    {isTestingPing ? "Testando..." : "Testar Conexão / Ping"}
                  </Button>
                </div>
              </TabsContent>

              {/* MODO 1: REDE LOCAL DIRETA (LAN) */}
              <TabsContent value="lan" className="space-y-3 pt-3 m-0">
                <div className="p-3 rounded-lg border border-blue-500/40 bg-blue-500/10 space-y-1">
                  <div className="font-semibold text-xs flex items-center gap-1.5 text-blue-300">
                    <Wifi className="size-4 text-blue-400" /> Conexão Local Direta (Sem Internet)
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Comunica diretamente na sua rede Wi-Fi/cabo com a porta <code>1984</code> do Docker. Ideal ao usar o projeto localmente via <code>npm run dev</code> ou aplicativo para Windows.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">Preenchimento Direto:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTempGatewayUrl("http://127.0.0.1:1984");
                        handleTestPing("http://127.0.0.1:1984");
                      }}
                      className="h-8 text-xs justify-start font-mono text-[11px]"
                    >
                      http://127.0.0.1:1984
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTempGatewayUrl("http://192.168.0.117:1984");
                        handleTestPing("http://192.168.0.117:1984");
                      }}
                      className="h-8 text-xs justify-start font-mono text-[11px]"
                    >
                      http://192.168.0.117:1984
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Endereço Personalizado:</Label>
                  <Input
                    value={tempGatewayUrl}
                    onChange={(e) => setTempGatewayUrl(e.target.value)}
                    placeholder="http://127.0.0.1:1984"
                    className="font-mono text-xs"
                  />
                </div>
              </TabsContent>

              {/* MODO 3: TÚNEL FIXO PERMANENTE (CLOUDFLARE ZERO TRUST) */}
              <TabsContent value="permanent" className="space-y-3 pt-3 m-0">
                <div className="p-3 rounded-lg border border-purple-500/40 bg-purple-500/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5 text-purple-300">
                      <ShieldCheck className="size-4 text-purple-400" /> Túnel Permanente Cloudflare (100% Grátis)
                    </span>
                    <Badge className="bg-purple-500/20 text-purple-300 text-[9px] py-0 border-purple-500/40">
                      Recomendado p/ Produção
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Com um token fixo da Cloudflare, <strong>a URL nunca mais muda</strong>, mesmo reiniciando o computador, o Docker ou caindo a energia.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Sua URL Fixa Definitiva:</Label>
                  <Input
                    value={tempGatewayUrl}
                    onChange={(e) => {
                      setTempGatewayUrl(e.target.value);
                      setPermanentUrl(e.target.value);
                      try {
                        localStorage.setItem("homepulse_dvr_permanent_url_v1", e.target.value);
                      } catch {}
                    }}
                    placeholder="Ex: https://cftv.seudominio.com ou https://meu-tunnel-fixo.cf"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <ExternalLink className="size-3 text-primary" /> Como obter seu Token Fixo em 3 passos:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Acesse <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noreferrer" className="text-primary underline">one.dash.cloudflare.com</a> (grátis).</li>
                    <li>Vá em <strong>Networks &gt; Tunnels &gt; Create a Tunnel</strong>.</li>
                    <li>Copie o token gerado ou aponte para <code>http://ci-recorder:1985</code>.</li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>

            {/* Live Ping Feedback */}
            {pingResult && (
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                  pingResult.status === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {pingResult.status === "ok" ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="size-4 text-rose-400" />
                  )}
                  <span>
                    {pingResult.status === "ok"
                      ? `Conexão bem-sucedida! ${pingResult.streamsCount} canais de vídeo online.`
                      : `Falha na conexão: ${pingResult.message}`}
                  </span>
                </div>
                {pingResult.latency !== undefined && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">
                    {pingResult.latency}ms
                  </Badge>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsGatewayModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const clean = tempGatewayUrl.trim().replace(/\/$/, "");
                setGatewayUrl(clean);
                try {
                  localStorage.setItem("homepulse_dvr_gateway_url_v1", clean);
                  localStorage.setItem("homepulse_dvr_connection_mode_v1", connectionMode);
                } catch {}
                setIsGatewayModalOpen(false);
                toast.success("Conexão atualizada com sucesso!", {
                  description: `${connectionMode === "robot" ? "Modo Robô Auto-Sync" : connectionMode === "lan" ? "Modo Rede Local" : "Modo Túnel Fixo"}: ${clean}`,
                });
              }}
            >
              Salvar e Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
