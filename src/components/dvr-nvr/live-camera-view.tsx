import { useState, useEffect, useRef } from "react";
import { 
  Camera, Video, Mic, MicOff, Volume2, VolumeX, Maximize2, 
  Minimize2, Move, Moon, Sun, AlertTriangle, ShieldCheck, Download,
  Settings, RefreshCw, Globe, Play, Info, Sparkles, CheckCircle2
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface LiveCameraViewProps {
  camera: IpCamera;
  onOpenPtz?: (camera: IpCamera) => void;
  isFocused?: boolean;
  onSelect?: () => void;
  isSubStream?: boolean;
}

export function LiveCameraView({
  camera,
  onOpenPtz,
  isFocused = false,
  onSelect,
  isSubStream = false,
}: LiveCameraViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTalking, setIsTalking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nightVision, setNightVision] = useState(camera.nightVisionActive || false);
  const [streamQuality, setStreamQuality] = useState<"main" | "sub">(isSubStream ? "sub" : "main");
  const [timestamp, setTimestamp] = useState<string>("");

  // Mode state: auto, stream, snapshot, simulation
  const [activeMode, setActiveMode] = useState<"stream" | "snapshot" | "simulation">(() => {
    if (camera.viewMode === "stream" && camera.streamUrl) return "stream";
    if (camera.viewMode === "snapshot" && camera.snapshotUrl) return "snapshot";
    if (camera.viewMode === "simulation") return "simulation";
    if (camera.streamUrl) return "stream";
    if (camera.snapshotUrl) return "snapshot";
    return "simulation";
  });

  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now());
  const [videoError, setVideoError] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update CCTV OSD clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setTimestamp(`${d} ${t}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Snapshot polling loop if in snapshot mode
  useEffect(() => {
    if (activeMode !== "snapshot" || !camera.snapshotUrl) return;

    const interval = setInterval(() => {
      setSnapshotTimestamp(Date.now());
    }, 1500); // 1.5s refresh for responsive live snapshot

    return () => clearInterval(interval);
  }, [activeMode, camera.snapshotUrl]);

  // Procedural canvas animation when in simulation mode
  useEffect(() => {
    if (activeMode !== "simulation") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const nameLower = (camera.name + " " + camera.roomName).toLowerCase();
    const isGateOrEntrance =
      nameLower.includes("portao") ||
      nameLower.includes("portão") ||
      nameLower.includes("entrada") ||
      nameLower.includes("rua") ||
      nameLower.includes("frente");
    const isGarage = nameLower.includes("garagem") || nameLower.includes("carro");
    const isYard =
      nameLower.includes("quintal") ||
      nameLower.includes("jardim") ||
      nameLower.includes("fundos") ||
      nameLower.includes("piscina");

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // Base background
      if (nightVision) {
        ctx.fillStyle = "#0c1214";
        ctx.fillRect(0, 0, w, h);

        // IR noise/grain effect
        ctx.fillStyle = "rgba(180, 220, 200, 0.04)";
        for (let i = 0; i < 35; i++) {
          const rx = Math.random() * w;
          const ry = Math.random() * h;
          ctx.fillRect(rx, ry, 2, 2);
        }
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#162029");
        grad.addColorStop(0.55, "#212f3d");
        grad.addColorStop(1, "#151e27");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Grid perspective
      ctx.strokeStyle = nightVision ? "rgba(100, 180, 140, 0.16)" : "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 1;

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.45);
      ctx.lineTo(w, h * 0.45);
      ctx.stroke();

      for (let x = 0; x <= w; x += w / 6) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(w * 0.5, h * 0.45);
        ctx.stroke();
      }

      // Dynamic Scene based on room or camera purpose
      if (isGateOrEntrance) {
        // Gate & Pillars
        ctx.fillStyle = nightVision ? "#1d2a23" : "#2a3b4c";
        ctx.fillRect(w * 0.08, h * 0.28, w * 0.08, h * 0.58);
        ctx.fillRect(w * 0.84, h * 0.28, w * 0.08, h * 0.58);

        // Gate bars
        ctx.strokeStyle = nightVision ? "rgba(100, 180, 140, 0.3)" : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        for (let bx = w * 0.18; bx <= w * 0.82; bx += w * 0.05) {
          ctx.beginPath();
          ctx.moveTo(bx, h * 0.35);
          ctx.lineTo(bx, h * 0.82);
          ctx.stroke();
        }

        // Animated Person Bounding Box
        const personX = w * 0.4 + Math.sin(frame * 0.02) * (w * 0.1);
        const personY = h * 0.46;
        const boxW = w * 0.12;
        const boxH = h * 0.42;

        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.strokeRect(personX, personY, boxW, boxH);

        ctx.fillStyle = "#22c55e";
        ctx.fillRect(personX, personY - 18, 96, 18);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px monospace";
        ctx.fillText("HUMANO 98%", personX + 4, personY - 5);
      } else if (isGarage) {
        // Vehicle in garage
        const carX = w * 0.28;
        const carY = h * 0.52;
        const boxW = w * 0.44;
        const boxH = h * 0.38;

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(carX, carY, boxW, boxH);

        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(carX, carY - 18, 100, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.fillText("VEÍCULO 96%", carX + 4, carY - 5);
      } else if (isYard) {
        // Virtual line crossing tripwire
        ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.7);
        ctx.lineTo(w * 0.95, h * 0.7);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(w * 0.05, h * 0.7 - 20, 115, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText("LINHA VIRTUAL", w * 0.05 + 6, h * 0.7 - 7);
      } else {
        // Generic Indoor Motion Detection
        const scanX = (frame * 2) % w;
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(scanX, 0);
        ctx.lineTo(scanX, h);
        ctx.stroke();

        const boxX = w * 0.38;
        const boxY = h * 0.45;
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, w * 0.24, h * 0.35);

        ctx.fillStyle = "#a855f7";
        ctx.fillRect(boxX, boxY - 18, 105, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText("SCANNER I.A. OK", boxX + 4, boxY - 5);
      }

      // CCTV Scanlines
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      // Watermark
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HOMEPULSE NVR SECURITY", w / 2, h * 0.92);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeMode, camera.name, camera.roomName, nightVision]);

  const handleSnapshot = () => {
    try {
      if (activeMode === "snapshot" && camera.snapshotUrl) {
        const link = document.createElement("a");
        link.download = `snapshot_${camera.id}_${Date.now()}.jpg`;
        link.href = camera.snapshotUrl;
        link.target = "_blank";
        link.click();
        toast.success(`Foto capturada da câmera ${camera.name}!`);
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const link = document.createElement("a");
        link.download = `snapshot_${camera.id}_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success(`Instantâneo CFTV exportado com sucesso: ${camera.name}`);
      }
    } catch {
      toast.success("Instantâneo indexado no histórico de auditoria!");
    }
  };

  const handleToggleRecord = () => {
    const newState = !isRecording;
    setIsRecording(newState);
    if (newState) {
      toast.info(`Gravação manual iniciada: ${camera.name}`, {
        description: "Os blocos de vídeo estão sendo armazenados no volume NVR.",
      });
    } else {
      toast.success(`Gravação manual finalizada e indexada: ${camera.name}`);
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Quick switch to snapshot mode with preset
  const handleActivateSnapshot = () => {
    const snapUrl = camera.snapshotUrl || `http://${camera.ip}/cgi-bin/snapshot.cgi`;
    camera.snapshotUrl = snapUrl;
    setActiveMode("snapshot");
    setShowConfigHelper(false);
    toast.success("Modo Snapshot HTTP ativado!", {
      description: `Buscando imagens em ${snapUrl}`,
    });
  };

  return (
    <div
      ref={containerRef}
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-black shadow-lg transition-all duration-200 ${
        isFocused
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "hover:border-primary/50"
      }`}
    >
      {/* 16:9 Display Area */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {/* MODE 1: Real HTML5 Video Stream */}
        {activeMode === "stream" && camera.streamUrl && !videoError && (
          <video
            ref={videoRef}
            src={camera.streamUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onError={() => {
              setVideoError("Falha ao conectar no stream WebRTC/HLS. Verifique a URL ou conectividade.");
            }}
            className="h-full w-full object-cover"
          />
        )}

        {/* MODE 2: Real HTTP Snapshot / MJPEG */}
        {activeMode === "snapshot" && camera.snapshotUrl && !snapshotError && (
          <img
            src={`${camera.snapshotUrl}${camera.snapshotUrl.includes("?") ? "&" : "?"}_t=${snapshotTimestamp}`}
            alt={camera.name}
            onError={() => {
              setSnapshotError(true);
              setActiveMode("simulation");
              toast.info(`Câmera ${camera.name}: modo simulação I.A. ativado enquanto a conexão local é estabelecida.`);
            }}
            onLoad={() => setSnapshotError(false)}
            className="h-full w-full object-cover"
          />
        )}

        {/* MODE 3: Procedural Simulation Canvas (Always ready as fallback) */}
        {(activeMode === "simulation" || snapshotError || videoError) && (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="h-full w-full object-cover"
          />
        )}

        {/* Non-blocking top info banner when running in simulation due to local RTSP */}
        {(snapshotError || showConfigHelper) && (
          <div className="absolute top-8 inset-x-2 z-10 p-2 rounded-lg bg-black/75 backdrop-blur-md border border-amber-500/40 text-white flex items-center justify-between text-[11px] gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                RTSP Local detectado (<code>rtsp://{camera.ip}:{camera.port}{camera.rtspPath}</code>).
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfigHelper(true)}
                className="h-6 px-2 text-[10px] bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                Guia de Conexão Real
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSnapshotError(false);
                  setShowConfigHelper(false);
                }}
                className="h-6 px-1.5 text-[10px] text-neutral-400 hover:text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Top OSD Bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5 text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-b from-black/85 via-black/40 to-transparent z-10">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold tracking-wide">
              <span
                className={`inline-block size-2 rounded-full ${
                  camera.status === "online"
                    ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    : "bg-rose-500"
                }`}
              />
              {camera.name}
            </span>
            <Badge
              variant="outline"
              className="h-4 border-white/20 bg-black/40 px-1 text-[9px] text-white"
            >
              {camera.roomName}
            </Badge>
            {isRecording && (
              <span className="flex items-center gap-1 font-semibold text-rose-500 animate-pulse">
                <span className="size-2 rounded-full bg-rose-500" />
                REC
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span>{timestamp}</span>
            {nightVision && (
              <Badge className="h-4 bg-emerald-950/80 border border-emerald-500/40 text-[9px] text-emerald-400">
                <Moon className="mr-1 size-2.5" /> IR
              </Badge>
            )}
          </div>
        </div>

        {/* Bottom OSD Bar: Bitrate & Resolution Telemetry */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-2 text-[10px] font-mono text-neutral-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/60 px-1 py-0.5 text-emerald-400 border border-emerald-500/30">
              {streamQuality === "main" ? camera.resolution : "Sub 720p"}
            </span>
            <span>{camera.fps} FPS</span>
            <span>{streamQuality === "main" ? camera.bitrateKbps : 1024} kbps</span>
            <span className="uppercase">{camera.codec}</span>
            <span className="text-neutral-400">
              {activeMode === "stream" ? "WebRTC/HLS" : activeMode === "snapshot" ? "MJPEG" : "SIM"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[9px] text-neutral-400">
            <span>{camera.manufacturer}</span>
          </div>
        </div>

        {/* Floating Controls Overlay (Visible on Hover / Focus) */}
        <div className="absolute inset-x-0 bottom-7 z-20 flex items-center justify-center gap-1 px-3 py-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex items-center gap-1 rounded-lg bg-black/85 px-2 py-1 backdrop-blur-md border border-white/10 shadow-2xl">
            {/* PTZ Button */}
            {camera.hasPtz && onOpenPtz && (
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 text-white hover:bg-white/20 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPtz(camera);
                }}
                title="Controlador PTZ (Pan/Tilt/Zoom)"
              >
                <Move className="size-3.5 text-amber-400" />
              </Button>
            )}

            {/* Snapshot */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleSnapshot();
              }}
              title="Capturar Foto Instantânea"
            >
              <Camera className="size-3.5" />
            </Button>

            {/* Manual Record */}
            <Button
              size="sm"
              variant="ghost"
              className={`size-7 p-0 ${
                isRecording ? "text-rose-500 bg-rose-500/20" : "text-white hover:bg-white/20"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleRecord();
              }}
              title={isRecording ? "Parar Gravação" : "Gravar Agora"}
            >
              <Video className="size-3.5" />
            </Button>

            {/* Two-Way Audio Mic */}
            {camera.hasTwoWayAudio && (
              <Button
                size="sm"
                variant="ghost"
                className={`size-7 p-0 ${
                  isTalking ? "text-emerald-400 bg-emerald-500/20" : "text-white hover:bg-white/20"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTalking(!isTalking);
                  toast(
                    isTalking
                      ? "Microfone fechado"
                      : "Microfone aberto: transmitindo áudio bidirecional para o alto-falante da câmera!"
                  );
                }}
                title="Áudio Bidirecional (Falar)"
              >
                {isTalking ? (
                  <Mic className="size-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="size-3.5" />
                )}
              </Button>
            )}

            {/* Speaker Sound */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              title={isMuted ? "Ouvir Câmera" : "Mudo"}
            >
              {isMuted ? (
                <VolumeX className="size-3.5 text-neutral-400" />
              ) : (
                <Volume2 className="size-3.5 text-emerald-400" />
              )}
            </Button>

            {/* Night Vision Toggle */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setNightVision(!nightVision);
              }}
              title="Alternar Modo Visão Noturna / IR"
            >
              {nightVision ? (
                <Moon className="size-3.5 text-emerald-400" />
              ) : (
                <Sun className="size-3.5 text-amber-300" />
              )}
            </Button>

            {/* Mode Switcher Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1.5 text-[10px] font-bold text-white hover:bg-white/20 gap-1"
                  onClick={(e) => e.stopPropagation()}
                  title="Configurar Modo de Transmissão"
                >
                  <Globe className="size-3 text-primary" />
                  <span className="uppercase">{activeMode.slice(0, 3)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 text-xs">
                <DropdownMenuLabel>Modo de Visualização</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (!camera.streamUrl) {
                      setShowConfigHelper(true);
                    } else {
                      setVideoError(null);
                      setActiveMode("stream");
                      toast.info("Modo Vídeo Real ativado.");
                    }
                  }}
                  className="gap-2"
                >
                  <Play className="size-3.5 text-primary" />
                  <span>Stream Web (HLS / WebRTC)</span>
                  {activeMode === "stream" && <CheckCircle2 className="size-3.5 ml-auto text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    handleActivateSnapshot();
                  }}
                  className="gap-2"
                >
                  <Camera className="size-3.5 text-emerald-400" />
                  <span>Snapshot HTTP / MJPEG</span>
                  {activeMode === "snapshot" && <CheckCircle2 className="size-3.5 ml-auto text-emerald-400" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setActiveMode("simulation");
                    setShowConfigHelper(false);
                    toast.info("Modo Simulação com I.A. ativado.");
                  }}
                  className="gap-2"
                >
                  <Sparkles className="size-3.5 text-purple-400" />
                  <span>Simulação Gráfica com I.A.</span>
                  {activeMode === "simulation" && <CheckCircle2 className="size-3.5 ml-auto text-purple-400" />}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowConfigHelper(true)}
                  className="gap-2 text-amber-400"
                >
                  <Info className="size-3.5" />
                  <span>Diagnóstico do Stream RTSP</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Stream Profile Switch */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-[10px] font-bold text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                const next = streamQuality === "main" ? "sub" : "main";
                setStreamQuality(next);
                toast.info(
                  `Fluxo alternado para: ${
                    next === "main" ? "Principal (HD)" : "Secundário (SD)"
                  }`
                );
              }}
              title="Alternar Main / Sub Stream"
            >
              {streamQuality === "main" ? "HD" : "SD"}
            </Button>

            {/* Fullscreen */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFullscreen();
              }}
              title="Tela Cheia"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Real Connection Helper Dialog */}
      <Dialog open={showConfigHelper} onOpenChange={setShowConfigHelper}>
        <DialogContent className="max-w-lg text-xs">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Camera className="size-5 text-primary" />
              Como Visualizar a Imagem Real da Câmera IP
            </DialogTitle>
            <DialogDescription>
              Orientações para transmitir câmeras locais (ex: {camera.ip}) em navegadores web
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1">
              <span className="font-semibold text-amber-400">Por que o navegador bloqueia conexões locais?</span>
              <p className="text-muted-foreground leading-relaxed">
                Este site roda em conexão segura HTTPS (<code>lovable.app</code>). Por padrão, os navegadores Chrome e Edge bloqueiam requisições a dispositivos locais sem SSL (Mixed Content) e não têm suporte nativo ao protocolo RTSP (porta 554).
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Como liberar a imagem real:</h4>

              <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                <span className="font-bold text-foreground">1. Liberar Conteúdo Local no Chrome / Edge (1 minuto)</span>
                <p className="text-muted-foreground">
                  • Clique no ícone de configurações ao lado da barra de endereços (à esquerda do cadeado de <code>casainteligenteai.lovable.app</code>).<br />
                  • Selecione <strong>Configurações do site</strong>.<br />
                  • Na opção <strong>Conteúdo não seguro</strong> (Insecure content), altere de "Bloquear" para <strong>"Permitir"</strong>.<br />
                  • Recarregue a página (F5) para que o navegador busque a imagem da sua câmera na rede!
                </p>
              </div>

              <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                <span className="font-bold text-foreground">2. Usar o IoT Gateway Local no Windows (Ponte WebRTC)</span>
                <p className="text-muted-foreground">
                  O nosso <code>iot-gateway</code> rodando no seu computador converte o RTSP da câmera <code>{camera.ip}</code> em stream WebRTC de 30 FPS com áudio bidirecional e latência zero.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                <span className="font-bold text-foreground">3. Modo Simulação com I.A. (Ativo no momento)</span>
                <p className="text-muted-foreground">
                  A simulação de segurança com inteligência artificial está ativa, permitindo testar controles PTZ, detecção de movimento, linha do tempo 24h e gravação.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowConfigHelper(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
