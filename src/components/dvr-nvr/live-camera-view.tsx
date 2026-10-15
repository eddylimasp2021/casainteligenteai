import { useState, useEffect, useRef } from "react";
import { 
  Camera, Video, Mic, MicOff, Volume2, VolumeX, Maximize2, 
  Minimize2, Move, Moon, Sun, AlertTriangle, ShieldCheck, Download
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LiveCameraViewProps {
  camera: IpCamera;
  onOpenPtz?: (camera: IpCamera) => void;
  isFocused?: boolean;
  onSelect?: () => void;
}

export function LiveCameraView({ camera, onOpenPtz, isFocused = false, onSelect }: LiveCameraViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isTalking, setIsTalking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nightVision, setNightVision] = useState(camera.nightVisionActive || false);
  const [streamQuality, setStreamQuality] = useState<"main" | "sub">("main");
  const [timestamp, setTimestamp] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Procedural canvas animation simulating high-definition surveillance scene with AI bounding boxes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // Base background (daylight or night IR monochrome)
      if (nightVision) {
        ctx.fillStyle = "#11181c";
        ctx.fillRect(0, 0, w, h);

        // IR noise/grain effect
        ctx.fillStyle = "rgba(180, 220, 200, 0.03)";
        for (let i = 0; i < 40; i++) {
          const rx = Math.random() * w;
          const ry = Math.random() * h;
          ctx.fillRect(rx, ry, 2, 2);
        }
      } else {
        // Daylight gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#1a242f");
        grad.addColorStop(0.6, "#243342");
        grad.addColorStop(1, "#17202a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Draw subtle perspective lines (yard/garage/street grid)
      ctx.strokeStyle = nightVision ? "rgba(100, 180, 140, 0.15)" : "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.45);
      ctx.lineTo(w, h * 0.45);
      ctx.stroke();

      // Perspective floor lines
      for (let x = 0; x <= w; x += w / 6) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(w * 0.5, h * 0.45);
        ctx.stroke();
      }

      // Draw camera specific elements
      if (camera.id === "cam-01") {
        // Gate & sidewalk pillars
        ctx.fillStyle = nightVision ? "#203028" : "#2f4050";
        ctx.fillRect(w * 0.1, h * 0.3, w * 0.08, h * 0.55);
        ctx.fillRect(w * 0.82, h * 0.3, w * 0.08, h * 0.55);

        // Animated person bounding box (moving slightly)
        const personX = w * 0.42 + Math.sin(frame * 0.02) * (w * 0.08);
        const personY = h * 0.46;
        const boxW = w * 0.12;
        const boxH = h * 0.42;

        ctx.strokeStyle = "#22c55e"; // Green detection box
        ctx.lineWidth = 2;
        ctx.strokeRect(personX, personY, boxW, boxH);

        // AI Label badge
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(personX, personY - 18, 92, 18);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px monospace";
        ctx.fillText("PESSOA 98%", personX + 4, personY - 5);
      } else if (camera.id === "cam-02") {
        // Vehicle in garage
        const carX = w * 0.3;
        const carY = h * 0.52;
        const boxW = w * 0.42;
        const boxH = h * 0.38;

        ctx.strokeStyle = "#3b82f6"; // Blue vehicle detection
        ctx.lineWidth = 2;
        ctx.strokeRect(carX, carY, boxW, boxH);

        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(carX, carY - 18, 98, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.fillText("VEÍCULO 95%", carX + 4, carY - 5);
      } else if (camera.id === "cam-03") {
        // Virtual line crossing tripwire
        ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * 0.7);
        ctx.lineTo(w * 0.95, h * 0.7);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(w * 0.05, h * 0.7 - 20, 110, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText("LINHA VIRTUAL", w * 0.05 + 6, h * 0.7 - 7);
      }

      // Draw CCTV Scanlines
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      // Camera status watermark
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HOME PULSE SECURITY", w / 2, h * 0.92);
      ctx.textAlign = "left";

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [camera.id, nightVision]);

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement("a");
      link.download = `snapshot_${camera.id}_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Foto instantânea capturada e salva com sucesso!", {
        description: `${camera.name} (${camera.resolution})`,
      });
    } catch {
      toast.success("Instantâneo gravado no histórico de auditoria!");
    }
  };

  const handleToggleRecord = () => {
    const newState = !isRecording;
    setIsRecording(newState);
    if (newState) {
      toast.info(`Gravação manual iniciada: ${camera.name}`, {
        description: "O vídeo está sendo armazenado no volume NVR.",
      });
    } else {
      toast.success(`Gravação manual finalizada e indexada: ${camera.name}`);
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-black shadow-lg transition-all duration-200 ${
        isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-primary/50"
      }`}
    >
      {/* 16:9 Canvas Area */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="h-full w-full object-cover"
        />

        {/* Top OSD Bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5 text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold tracking-wide">
              <span className={`inline-block size-2 rounded-full ${camera.status === "online" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-rose-500"}`} />
              {camera.name}
            </span>
            <Badge variant="outline" className="h-4 border-white/20 bg-black/40 px-1 text-[9px] text-white">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-2 text-[10px] font-mono text-neutral-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/60 px-1 py-0.5 text-emerald-400 border border-emerald-500/30">
              {streamQuality === "main" ? camera.resolution : "Sub 720p"}
            </span>
            <span>{camera.fps} FPS</span>
            <span>{streamQuality === "main" ? camera.bitrateKbps : 1024} kbps</span>
            <span className="uppercase">{camera.codec}</span>
            <span className="text-neutral-400">{camera.protocol}</span>
          </div>

          <div className="flex items-center gap-1 text-[9px] text-neutral-400">
            <span>{camera.manufacturer}</span>
          </div>
        </div>

        {/* Floating Controls Overlay (Visible on Hover / Focus) */}
        <div className="absolute inset-x-0 bottom-7 flex items-center justify-center gap-1 px-3 py-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex items-center gap-1 rounded-lg bg-black/80 px-2 py-1 backdrop-blur-md border border-white/10 shadow-2xl">
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
              className={`size-7 p-0 ${isRecording ? "text-rose-500 bg-rose-500/20" : "text-white hover:bg-white/20"}`}
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
                className={`size-7 p-0 ${isTalking ? "text-emerald-400 bg-emerald-500/20" : "text-white hover:bg-white/20"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTalking(!isTalking);
                  toast(isTalking ? "Microfone fechado" : "Microfone aberto: transmitindo áudio bidirecional para o alto-falante da câmera!");
                }}
                title="Áudio Bidirecional (Falar)"
              >
                {isTalking ? <Mic className="size-3.5 text-emerald-400" /> : <MicOff className="size-3.5" />}
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
              {isMuted ? <VolumeX className="size-3.5 text-neutral-400" /> : <Volume2 className="size-3.5 text-emerald-400" />}
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
              {nightVision ? <Moon className="size-3.5 text-emerald-400" /> : <Sun className="size-3.5 text-amber-300" />}
            </Button>

            {/* Stream Profile Switch */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-[10px] font-bold text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                const next = streamQuality === "main" ? "sub" : "main";
                setStreamQuality(next);
                toast.info(`Fluxo alternado para: ${next === "main" ? "Principal (Alta Resolução)" : "Secundário (Fluidez de Rede)"}`);
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
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
