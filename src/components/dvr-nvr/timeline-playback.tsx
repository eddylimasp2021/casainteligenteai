import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Play, Pause, FastForward, Rewind, 
  Download, Calendar as CalendarIcon, Clock, Scissors,
  ChevronLeft, ChevronRight, Volume2, VolumeX, RefreshCw,
  HardDrive, Film, AlertCircle
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface RecordingSegment {
  id: string;
  camera: string;
  filename: string;
  date: string;
  startTime: string;
  startMinute: number;
  endMinute: number;
  durationSeconds: number;
  sizeBytes: number;
  url: string;
  type: string;
  status: string;
}

interface TimelinePlaybackProps {
  cameras: IpCamera[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
  gatewayBase?: string;
}

export function TimelinePlayback({
  cameras,
  selectedCameraId,
  onSelectCamera,
  gatewayBase: propGatewayBase,
}: TimelinePlaybackProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [recordings, setRecordings] = useState<RecordingSegment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeRecording, setActiveRecording] = useState<RecordingSegment | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentMinute, setCurrentMinute] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isClipping, setIsClipping] = useState<boolean>(false);
  const [clipStart, setClipStart] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Resolved gateway URL with fallback
  const gatewayBase = useMemo(() => {
    if (propGatewayBase && propGatewayBase.trim()) {
      return propGatewayBase.replace(/\/+$/, "");
    }
    try {
      const saved = localStorage.getItem("homepulse_dvr_gateway_url_v1");
      if (saved && saved.trim() && !saved.includes("dreams-metal")) {
        return saved.trim().replace(/\/+$/, "");
      }
    } catch {}
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    return isHttps
      ? "https://responsibility-decision-charleston-electronics.trycloudflare.com"
      : "http://127.0.0.1:1985";
  }, [propGatewayBase]);

  const activeCamera = useMemo(() => {
    return cameras.find((c) => c.id === selectedCameraId) || cameras[0]!;
  }, [cameras, selectedCameraId]);

  // Stream identifier registered in recorder and go2rtc
  const streamKey = useMemo(() => {
    const rawId = (activeCamera.id || "").split("__lens_")[0]!.trim();
    const rawStream = (activeCamera.streamName || "").split("__lens_")[0]!.trim();
    const cleanIp = (activeCamera.ip || "").trim();
    const lowerName = (activeCamera.name || "").toLowerCase();

    if (cleanIp === "192.168.0.139" || lowerName.includes("garagem") || rawId.includes("garagem")) {
      return "garagem_rua";
    }
    if (cleanIp === "192.168.0.240" || lowerName.includes("240") || rawId.includes("240")) {
      return "cam_192_168_0_240";
    }
    if (cleanIp === "192.168.0.198" || lowerName.includes("198") || rawId.includes("198")) {
      return "cam_192_168_0_198";
    }
    return rawStream || rawId || "garagem_rua";
  }, [activeCamera]);

  // 1. Fetch Real Recordings from API
  const fetchRecordings = async () => {
    if (!gatewayBase) return;
    setIsLoading(true);
    try {
      const targetUrl = `${gatewayBase}/api/recordings?camera=${encodeURIComponent(streamKey)}&date=${selectedDate}`;
      const res = await fetch(targetUrl);
      if (res.ok) {
        const data = await res.json();
        const list: RecordingSegment[] = data.recordings || [];
        setRecordings(list);

        if (list.length > 0) {
          // If no active recording or active recording is not in current list, pick the most recent
          const last = list[list.length - 1]!;
          setActiveRecording(last);
          setCurrentMinute(last.startMinute);
        } else {
          setActiveRecording(null);
        }
      } else {
        setRecordings([]);
        setActiveRecording(null);
      }
    } catch (e) {
      console.warn("[TimelinePlayback] Erro ao buscar gravações:", e);
      setRecordings([]);
      setActiveRecording(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [streamKey, selectedDate, gatewayBase]);

  // Sync playback speed to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle Play / Pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn("Autoplay/play failed", e);
      });
    }
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    const s = "00";
    return `${h}:${m}:${s}`;
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Click on Timeline Bar
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const clickedMinute = Math.floor(ratio * 1440);
    setCurrentMinute(clickedMinute);

    // Find if a recording covers this minute
    const found = recordings.find(
      (r) => clickedMinute >= r.startMinute && clickedMinute <= r.endMinute
    );

    if (found) {
      setActiveRecording(found);
      const offsetSec = Math.max(0, (clickedMinute - found.startMinute) * 60);
      if (videoRef.current) {
        videoRef.current.currentTime = offsetSec;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (recordings.length > 0) {
      // Find nearest recording before this minute
      const prev = [...recordings].reverse().find((r) => r.startMinute <= clickedMinute);
      if (prev) {
        setActiveRecording(prev);
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    }
  };

  // Video Time Update: sync minute marker and playhead
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !activeRecording) return;
    const cur = videoRef.current.currentTime;
    setVideoCurrentTime(cur);
    setVideoDuration(videoRef.current.duration || 0);

    const exactMinute = activeRecording.startMinute + Math.floor(cur / 60);
    if (exactMinute !== currentMinute && exactMinute <= 1439) {
      setCurrentMinute(exactMinute);
    }
  };

  // Video ended: auto-advance to next recording chunk if available
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (!activeRecording) return;
    const idx = recordings.findIndex((r) => r.id === activeRecording.id);
    if (idx !== -1 && idx + 1 < recordings.length) {
      const nextRec = recordings[idx + 1]!;
      setActiveRecording(nextRec);
      setCurrentMinute(nextRec.startMinute);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }, 200);
      toast.info(`Reproduzindo próximo bloco: ${nextRec.startTime}`);
    }
  };

  // Download Clip / Full Chunk
  const handleDownloadClip = () => {
    if (!activeRecording) {
      toast.warning("Nenhuma gravação selecionada para download!");
      return;
    }

    const downloadUrl = `${gatewayBase}${activeRecording.url}`;
    const filename = `${streamKey}_${activeRecording.date}_${activeRecording.filename}`;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Download iniciado!", {
      description: `Arquivo salvo: ${filename}`,
    });
  };

  // Total disk space used by today's recordings
  const totalBytesForDay = useMemo(() => {
    return recordings.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
  }, [recordings]);

  const totalMegabytes = (totalBytesForDay / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Top Playback Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        {/* Camera Selector & Date Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedCameraId} onValueChange={onSelectCamera}>
            <SelectTrigger className="w-60 font-semibold">
              <SelectValue placeholder="Selecione a câmera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>

          {/* Refresh Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchRecordings}
            disabled={isLoading}
            className="gap-1 text-xs"
            title="Recarregar gravações do disco D:"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            Buscar
          </Button>

          {/* Disk & Recordings Badge */}
          <Badge variant="outline" className="gap-1.5 font-mono text-xs bg-muted/40 border-primary/20">
            <HardDrive className="size-3.5 text-primary" />
            Disco D: {recordings.length} blocos ({totalMegabytes} MB)
          </Badge>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500 shadow-[0_0_6px_#10b981]" /> Contínuo (24/7)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-500" /> Movimento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rose-500" /> Evento / IA
          </span>
        </div>
      </div>

      {/* Main Video Playback Screen */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl flex items-center justify-center">
        {activeRecording ? (
          <>
            {/* Real HTML5 Video Player */}
            <video
              ref={videoRef}
              key={activeRecording.id}
              src={`${gatewayBase}${activeRecording.url}`}
              className="size-full object-contain"
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* OSD Watermark Header */}
            <div className="absolute top-4 left-4 font-mono text-xs text-white/90 bg-black/75 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md flex items-center gap-2 shadow-lg">
              <Film className="size-3.5 text-emerald-400" />
              <span>{activeCamera.name}</span>
              <span className="text-white/40">•</span>
              <span className="text-emerald-400 font-bold">{selectedDate} {formatTime(currentMinute)}</span>
            </div>

            {/* Right OSD Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Badge className="bg-black/75 text-emerald-400 border border-emerald-500/30 font-mono text-xs py-1 px-2.5 backdrop-blur-md">
                VELOCIDADE: {playbackSpeed}x
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="size-8 rounded-lg bg-black/75 text-white hover:bg-black/90 border border-white/10"
                title={isMuted ? "Ativar Áudio" : "Mutar Áudio"}
              >
                {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4 text-emerald-400" />}
              </Button>
            </div>

            {/* Floating Clip Mode Indicator */}
            {isClipping && (
              <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none">
                <Badge className="bg-rose-500 text-white font-bold animate-pulse text-sm py-1.5 px-4 shadow-xl">
                  <Scissors className="size-4 mr-2" /> MODO CORTE ATIVO: Arraste a timeline até o final
                </Badge>
              </div>
            )}
          </>
        ) : (
          /* Empty / No Recordings State */
          <div className="text-center space-y-3 p-6 max-w-md">
            <div className="size-14 mx-auto rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <AlertCircle className="size-7 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhuma Gravação nesta Data</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Não foram encontrados arquivos de vídeo gravados no disco <strong>D:\Gravacoes_CFTV</strong> para a câmera{" "}
              <strong className="text-white">{activeCamera.name}</strong> no dia <strong>{selectedDate}</strong>.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                variant="default"
                onClick={fetchRecordings}
                className="gap-2 font-semibold"
              >
                <RefreshCw className="size-4" /> Verificar Novamente no Disco D:
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 24-Hour Interactive Timeline Bar */}
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-4 text-primary" /> TIMELINE DE 24 HORAS (00:00 - 23:59)
          </span>
          <div className="flex items-center gap-3">
            {activeRecording && (
              <span className="text-xs text-muted-foreground font-mono">
                Segmento: <strong className="text-foreground">{activeRecording.filename}</strong> (
                {formatSeconds(videoCurrentTime)} / {formatSeconds(videoDuration || activeRecording.durationSeconds)})
              </span>
            )}
            <span className="text-sm font-bold text-primary font-mono">
              Posição: {formatTime(currentMinute)}
            </span>
          </div>
        </div>

        {/* Timeline Bar Container */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-14 w-full cursor-pointer select-none rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-inner"
        >
          {/* Hour grid markers */}
          <div className="absolute inset-0 flex justify-between pointer-events-none px-1">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center h-full">
                <div className={`w-px ${i % 2 === 0 ? "h-3 bg-neutral-600" : "h-1.5 bg-neutral-800"}`} />
                {i % 2 === 0 && (
                  <span className="text-[9px] font-mono text-neutral-400 mt-0.5">
                    {i.toString().padStart(2, "0")}h
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Real Recorded Segments Track (Green blocks from disk D:) */}
          <div className="absolute inset-x-0 bottom-1.5 h-6 pointer-events-none">
            {recordings.map((rec) => {
              const leftPercent = (rec.startMinute / 1440) * 100;
              const widthPercent = Math.max(0.4, ((rec.endMinute - rec.startMinute) / 1440) * 100);
              const isSelected = activeRecording?.id === rec.id;

              return (
                <div
                  key={rec.id}
                  className={`absolute h-full rounded-sm transition-all pointer-events-auto ${
                    isSelected
                      ? "bg-emerald-400 ring-2 ring-emerald-300 shadow-[0_0_12px_#34d399]"
                      : "bg-emerald-500/80 hover:bg-emerald-400 shadow-sm"
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  title={`Gravação: ${rec.startTime} (${rec.durationSeconds}s, ${(rec.sizeBytes / (1024 * 1024)).toFixed(1)} MB) - Clique para reproduzir`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveRecording(rec);
                    setCurrentMinute(rec.startMinute);
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                      }
                    }, 100);
                  }}
                />
              );
            })}
          </div>

          {/* Selected Clip Highlight Range */}
          {clipStart !== null && (
            <div
              className="absolute top-0 bottom-0 bg-primary/30 border-x-2 border-primary pointer-events-none"
              style={{
                left: `${(Math.min(clipStart, currentMinute) / 1440) * 100}%`,
                width: `${(Math.abs(currentMinute - clipStart) / 1440) * 100}%`,
              }}
            />
          )}

          {/* Red Playhead Indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-rose-500 shadow-[0_0_10px_#f43f5e] z-10 pointer-events-none transition-all duration-75"
            style={{ left: `${(currentMinute / 1440) * 100}%` }}
          >
            <div className="absolute -top-1 -left-1.5 size-4 rounded-full bg-rose-500 border-2 border-white shadow-md" />
          </div>
        </div>

        {/* Player Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Left Controls: Step & Skip */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextM = Math.max(0, currentMinute - 5);
                setCurrentMinute(nextM);
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 300);
              }}
              title="Voltar 5 minutos"
            >
              <Rewind className="size-4 mr-1" /> -5m
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextM = Math.max(0, currentMinute - 1);
                setCurrentMinute(nextM);
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 60);
              }}
              title="Voltar 1 minuto"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              size="default"
              variant={isPlaying ? "secondary" : "default"}
              className="px-6 font-bold shadow-sm"
              onClick={togglePlay}
              disabled={!activeRecording}
            >
              {isPlaying ? <Pause className="size-4 mr-2" /> : <Play className="size-4 mr-2" />}
              {isPlaying ? "Pausar" : "Reproduzir"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextM = Math.min(1439, currentMinute + 1);
                setCurrentMinute(nextM);
                if (videoRef.current) videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 60);
              }}
              title="Avançar 1 minuto"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextM = Math.min(1439, currentMinute + 5);
                setCurrentMinute(nextM);
                if (videoRef.current) videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 300);
              }}
              title="Avançar 5 minutos"
            >
              +5m <FastForward className="size-4 ml-1" />
            </Button>
          </div>

          {/* Center: Speed Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Velocidade:</span>
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              {[0.5, 1, 2, 4, 8, 16].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                    playbackSpeed === spd
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Right: Download Video Tool */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-emerald-500 hover:text-emerald-400 border-emerald-500/30"
              onClick={handleDownloadClip}
              disabled={!activeRecording}
              title="Baixar arquivo de vídeo .mp4 gravado do Disco D:"
            >
              <Download className="size-4" />
              Baixar Gravação (.mp4)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
