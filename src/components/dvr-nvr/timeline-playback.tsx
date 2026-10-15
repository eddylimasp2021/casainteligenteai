import { useState, useRef, useEffect } from "react";
import { 
  Play, Pause, RotateCcw, FastForward, Rewind, 
  Download, Calendar as CalendarIcon, Clock, Scissors, Check,
  ChevronLeft, ChevronRight
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface TimelinePlaybackProps {
  cameras: IpCamera[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
}

export function TimelinePlayback({ cameras, selectedCameraId, onSelectCamera }: TimelinePlaybackProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentMinute, setCurrentMinute] = useState<number>(14 * 60 + 15); // Default 14:15
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);

  const activeCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const timelineRef = useRef<HTMLDivElement>(null);

  // Playback timer ticker
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentMinute((prev) => {
          if (prev >= 1439) return 0;
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    const s = "00";
    return `${h}:${m}:${s}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const clickedMinute = Math.floor(ratio * 1440);
    setCurrentMinute(clickedMinute);
  };

  const handleDownloadClip = () => {
    if (!clipStart) {
      setClipStart(currentMinute);
      setIsClipping(true);
      toast.info(`Início do trecho marcado em ${formatTime(currentMinute)}!`, {
        description: "Avance a timeline até o final do trecho desejado e clique em Salvar Corte.",
      });
      return;
    }

    const start = Math.min(clipStart, currentMinute);
    const end = Math.max(clipStart, currentMinute);
    const duration = end - start;

    toast.success(`Vídeo exportado com sucesso!`, {
      description: `${activeCamera.name} | ${selectedDate} [${formatTime(start)} às ${formatTime(end)}] (${duration} min)`,
    });
    setIsClipping(false);
    setClipStart(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Playback Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        {/* Camera Selector */}
        <div className="flex items-center gap-3">
          <Select value={selectedCameraId} onValueChange={onSelectCamera}>
            <SelectTrigger className="w-56 font-semibold">
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
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" /> Contínuo (24/7)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-500" /> Movimento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rose-500" /> Alarme / IA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-sky-500" /> Manual
          </span>
        </div>
      </div>

      {/* Main Video Playback Screen */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl">
        {/* Mock Recorded CCTV Footage */}
        <div className="relative size-full flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-black">
          <div className="text-center space-y-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-sm py-1 px-3">
              REPRODUÇÃO DE GRAVAÇÃO (PLAYBACK)
            </Badge>
            <p className="text-lg font-bold text-white tracking-wide">
              {activeCamera.name}
            </p>
            <p className="font-mono text-2xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
              {selectedDate} {formatTime(currentMinute)}
            </p>
            <p className="text-xs text-neutral-400 font-mono">
              Resolução: {activeCamera.resolution} | Codec: {activeCamera.codec} | Armazenamento: Disco Local NVR
            </p>
          </div>

          {/* OSD Watermark */}
          <div className="absolute top-4 left-4 font-mono text-xs text-white/80 bg-black/60 px-2.5 py-1 rounded border border-white/10">
            {activeCamera.name} • GRAVAÇÃO INDEXADA
          </div>
          <div className="absolute top-4 right-4 font-mono text-xs text-emerald-400 bg-black/60 px-2.5 py-1 rounded border border-emerald-500/30">
            VELOCIDADE: {playbackSpeed}x
          </div>
        </div>

        {/* Floating Clip Mode Indicator */}
        {isClipping && (
          <div className="absolute top-16 inset-x-0 flex justify-center">
            <Badge className="bg-rose-500 text-white font-bold animate-pulse text-sm py-1.5 px-4 shadow-xl">
              <Scissors className="size-4 mr-2" /> MODO CORTE DE VÍDEO ATIVO: Arraste a timeline até o fim do trecho
            </Badge>
          </div>
        )}
      </div>

      {/* 24-Hour Interactive Timeline Bar */}
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-4 text-primary" /> TIMELINE DE 24 HORAS (00:00 - 23:59)
          </span>
          <span className="text-sm font-bold text-primary">
            Posição Atual: {formatTime(currentMinute)}
          </span>
        </div>

        {/* Timeline Bar Container */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-12 w-full cursor-pointer select-none rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-inner"
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

          {/* Recording blocks track (Simulated continuous & event blocks) */}
          <div className="absolute inset-x-0 bottom-1 h-5 pointer-events-none">
            {/* Continuous green blocks */}
            <div className="absolute left-[0%] w-[45%] h-full bg-emerald-500/60 rounded-sm" />
            <div className="absolute left-[50%] w-[48%] h-full bg-emerald-500/60 rounded-sm" />

            {/* Motion yellow blocks */}
            <div className="absolute left-[12%] w-[4%] h-full bg-amber-400/90 rounded-sm" />
            <div className="absolute left-[34%] w-[6%] h-full bg-amber-400/90 rounded-sm" />
            <div className="absolute left-[62%] w-[8%] h-full bg-amber-400/90 rounded-sm" />

            {/* AI event red blocks */}
            <div className="absolute left-[22%] w-[2%] h-full bg-rose-500/90 rounded-sm" />
            <div className="absolute left-[58%] w-[1.5%] h-full bg-rose-500/90 rounded-sm" />
            <div className="absolute left-[78%] w-[3%] h-full bg-rose-500/90 rounded-sm" />
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
            <div className="absolute -top-1 -left-1.5 size-4 rounded-full bg-rose-500 border-2 border-white" />
          </div>
        </div>

        {/* Player Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Left Controls: Step & Skip */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMinute((m) => Math.max(0, m - 5))}
              title="Voltar 5 minutos"
            >
              <Rewind className="size-4 mr-1" /> -5m
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMinute((m) => Math.max(0, m - 1))}
              title="Voltar 1 minuto / Frame"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {/* Play/Pause */}
            <Button
              size="default"
              variant={isPlaying ? "secondary" : "default"}
              className="px-6 font-bold"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="size-4 mr-2" /> : <Play className="size-4 mr-2" />}
              {isPlaying ? "Pausar" : "Reproduzir"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMinute((m) => Math.min(1439, m + 1))}
              title="Avançar 1 minuto / Frame"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMinute((m) => Math.min(1439, m + 5))}
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

          {/* Right: Clip and Export Tool */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isClipping ? "default" : "outline"}
              className={`gap-1.5 font-semibold ${isClipping ? "bg-rose-500 hover:bg-rose-600 text-white" : ""}`}
              onClick={handleDownloadClip}
            >
              <Scissors className="size-4" />
              {isClipping ? "Salvar Corte (Exportar)" : "Exportar Trecho"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
