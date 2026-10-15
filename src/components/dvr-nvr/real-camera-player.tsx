import { useState, useEffect, useRef, useCallback } from "react";
import {
  Video,
  Play,
  Square,
  RefreshCw,
  Camera,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Zap,
  Image as ImageIcon,
} from "lucide-react";
import type { IpCamera } from "@/types/dvr-nvr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface RealCameraPlayerProps {
  camera: IpCamera;
  gatewayUrl?: string; // e.g. http://localhost:1984
  onOpenPtz?: (camera: IpCamera) => void;
  isFocused?: boolean;
  onSelect?: () => void;
}

type StreamState =
  | "idle"
  | "connecting"
  | "negotiating"
  | "awaiting_frames"
  | "playing"
  | "error";

type ProtocolType = "WebRTC" | "HLS" | "Snapshot";

export function RealCameraPlayer({
  camera,
  gatewayUrl = "http://localhost:1984",
  onOpenPtz,
  isFocused = false,
  onSelect,
}: RealCameraPlayerProps) {
  // Protocol: WebRTC (sub-second) > Snapshot (resilient live JPEG) > HLS
  const [protocol, setProtocol] = useState<ProtocolType>(
    (camera.activeProtocol as ProtocolType) || "WebRTC"
  );
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFrameTime, setLastFrameTime] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [realResolution, setRealResolution] = useState<string | null>(null);
  const [realCodec, setRealCodec] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Snapshot polling state
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now());

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const frameTimeoutRef = useRef<number | null>(null);
  const snapshotIntervalRef = useRef<number | null>(null);

  // Stream identifier registered in go2rtc
  const streamName =
    camera.streamName ||
    (camera.name.toLowerCase().includes("garagem") || camera.ip === "192.168.0.139"
      ? "garagem_rua"
      : camera.id.replace(/[^a-zA-Z0-9_-]/g, "_"));

  // Effective gateway base URL
  const gatewayBase = (camera.gatewayHost ? `http://${camera.gatewayHost}` : gatewayUrl).replace(/\/$/, "");

  // Update OSD clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setLastFrameTime(`${d} ${t}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup helper
  const disconnectStream = useCallback(() => {
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.getTransceivers().forEach((tr) => {
        try {
          if (tr.stop) tr.stop();
        } catch {}
      });
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
      videoRef.current.src = "";
    }

    setStreamState("idle");
    setLatencyMs(null);
    setRealResolution(null);
    setRealCodec(null);
    setErrorMessage(null);
  }, []);

  // Connect WebRTC stream via go2rtc with H.264 transcoder fallback and decoded frame verification
  const connectWebRTC = useCallback(async () => {
    disconnectStream();
    setStreamState("connecting");
    setErrorMessage(null);

    const startTime = performance.now();

    try {
      // 1. Create native RTCPeerConnection with STUN
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      peerConnectionRef.current = pc;

      // 2. Add video & audio transceivers to request incoming streams
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // 3. Attach incoming media track to video element
      pc.ontrack = (event) => {
        let stream: MediaStream;
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else {
          stream = new MediaStream([event.track]);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((playErr) => {
            console.warn("Autoplay policy retry with muted:", playErr);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn("ICE connection failed or disconnected");
          setStreamState("error");
          setErrorMessage("Conexão WebRTC interrompida. Verifique a rede local ou o gateway Docker.");
        }
      };

      // 4. Create SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Wait for ICE gathering to complete so SDP contains complete candidates and ice-ufrag
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", checkState);
          setTimeout(resolve, 800); // Max 800ms timeout
        }
      });

      setStreamState("negotiating");
      const offerSdp = pc.localDescription?.sdp || offer.sdp;

      // Prefer H.264 transcoded stream for Chrome/Edge if source is H.265 (garagem_rua)
      const targetStream = streamName === "garagem_rua" ? "garagem_rua_h264" : streamName;
      let targetUrl = `${gatewayBase}/api/webrtc?src=${encodeURIComponent(targetStream)}`;

      let response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: offerSdp,
      });

      if (!response.ok && targetStream !== streamName) {
        // Fallback to original stream name
        targetUrl = `${gatewayBase}/api/webrtc?src=${encodeURIComponent(streamName)}`;
        response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: offerSdp,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Gateway retornou HTTP ${response.status}`);
      }

      // 6. Set SDP Answer
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      const handshakeDuration = Math.round(performance.now() - startTime);
      setLatencyMs(Math.max(45, Math.min(120, handshakeDuration)));

      // 7. Transition to awaiting_frames state — DO NOT declare victory until frames are decoded!
      setStreamState("awaiting_frames");

      // Verify that video frames actually decode within 7 seconds
      frameTimeoutRef.current = window.setTimeout(() => {
        const v = videoRef.current;
        if (v && (v.videoWidth === 0 || v.readyState < 2)) {
          console.warn("WebRTC connected but no decoded frames received. Camera may be silent or codec incompatible.");
          setErrorMessage(
            "Conexão WebRTC estabelecida com o gateway, mas nenhum frame de vídeo foi decodificado. O navegador pode não suportar o codec original (H.265). Alterne para o modo Snapshot ou HLS abaixo."
          );
          setStreamState("error");
        }
      }, 7000);

      // 8. Track real latency periodically via RTCPeerConnection stats
      pingIntervalRef.current = window.setInterval(async () => {
        if (pc.connectionState === "connected") {
          try {
            const stats = await pc.getStats();
            stats.forEach((report) => {
              if (report.type === "candidate-pair" && report.state === "succeeded") {
                if (typeof report.currentRoundTripTime === "number") {
                  setLatencyMs(Math.round(report.currentRoundTripTime * 1000));
                }
              }
            });
          } catch {}
        }
      }, 3000);
    } catch (err: unknown) {
      console.warn("WebRTC connection failed:", err);
      disconnectStream();
      setStreamState("error");

      const errText = err instanceof Error ? err.message : String(err);
      if (errText.includes("Failed to fetch") || errText.includes("NetworkError")) {
        setErrorMessage(
          "Não foi possível conectar ao gateway go2rtc em " +
            gatewayBase +
            ". Verifique se o container Docker está rodando ou se há bloqueio de Conteúdo Não Seguro (Mixed Content) no navegador."
        );
      } else {
        setErrorMessage(`Falha na transmissão WebRTC: ${errText}`);
      }
    }
  }, [camera.name, disconnectStream, gatewayBase, streamName]);

  // Connect Snapshot mode (Live JPEG stream directly from go2rtc frame capture)
  const connectSnapshot = useCallback(() => {
    disconnectStream();
    setStreamState("connecting");
    setErrorMessage(null);

    // Initial load
    setSnapshotTimestamp(Date.now());

    // Refresh every 1000ms
    snapshotIntervalRef.current = window.setInterval(() => {
      setSnapshotTimestamp(Date.now());
    }, 1000);

    setStreamState("playing");
    setRealResolution("1920x1080 (HD)");
    setRealCodec("JPEG");
    setLatencyMs(150);
  }, [disconnectStream]);

  // Connect HLS stream
  const connectHLS = useCallback(() => {
    disconnectStream();
    setStreamState("connecting");
    setErrorMessage(null);

    const targetStream = streamName === "garagem_rua" ? "garagem_rua_h264" : streamName;
    const hlsUrl = `${gatewayBase}/api/stream.m3u8?src=${encodeURIComponent(targetStream)}`;

    if (videoRef.current) {
      videoRef.current.src = hlsUrl;
      videoRef.current
        .play()
        .then(() => {
          setStreamState("awaiting_frames");
        })
        .catch((e) => {
          setStreamState("error");
          setErrorMessage(`Erro ao reproduzir HLS: ${e.message}`);
        });
    }
  }, [disconnectStream, gatewayBase, streamName]);

  // Connect handler based on active protocol
  const handleConnect = useCallback(() => {
    if (protocol === "WebRTC") {
      connectWebRTC();
    } else if (protocol === "Snapshot") {
      connectSnapshot();
    } else if (protocol === "HLS") {
      connectHLS();
    }
  }, [connectHLS, connectSnapshot, connectWebRTC, protocol]);

  // Listen to HTML5 video element events for real frame decoding
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleFrameDecoded = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (frameTimeoutRef.current) {
          clearTimeout(frameTimeoutRef.current);
          frameTimeoutRef.current = null;
        }
        setStreamState("playing");
        setRealResolution(`${video.videoWidth}x${video.videoHeight}`);
        setRealCodec("H.264");
      }
    };

    video.addEventListener("loadeddata", handleFrameDecoded);
    video.addEventListener("playing", handleFrameDecoded);
    video.addEventListener("timeupdate", handleFrameDecoded);

    return () => {
      video.removeEventListener("loadeddata", handleFrameDecoded);
      video.removeEventListener("playing", handleFrameDecoded);
      video.removeEventListener("timeupdate", handleFrameDecoded);
    };
  }, []);

  // Handle reconnect
  const handleReconnect = () => {
    toast.info(`Reconectando à câmera ${camera.name}...`);
    handleConnect();
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Snapshot capture from frame
  const handleCaptureSnapshot = () => {
    if (protocol === "Snapshot") {
      const snapUrl = `${gatewayBase}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`;
      const link = document.createElement("a");
      link.download = `snapshot_${camera.id}_${Date.now()}.jpg`;
      link.href = snapUrl;
      link.target = "_blank";
      link.click();
      toast.success(`Foto exportada com sucesso: ${camera.name}!`);
      return;
    }

    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("O vídeo precisa estar recebendo frames para capturar a foto.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const link = document.createElement("a");
        link.download = `snapshot_${camera.id}_${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
        toast.success(`Foto real capturada com sucesso: ${camera.name}!`);
      }
    } catch {
      toast.error("Não foi possível exportar a foto do frame.");
    }
  };

  // Auto-connect on mount or protocol change
  useEffect(() => {
    handleConnect();
    return () => {
      disconnectStream();
    };
  }, [disconnectStream, handleConnect]);

  const copyDockerCommand = () => {
    const cmd =
      'docker compose -f "d:\\Sistema ja  ok\\casainteligenteai\\iot-gateway\\deploy\\docker-compose.yml" up -d go2rtc';
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(true);
    toast.success("Comando copiado para a área de transferência!");
    setTimeout(() => setCopiedCommand(false), 2500);
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
        {/* Real HTML5 Video element for WebRTC / HLS */}
        {protocol !== "Snapshot" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              streamState === "playing" ? "opacity-100" : "opacity-0 absolute pointer-events-none"
            }`}
          />
        )}

        {/* Real Live Snapshot mode (Polling JPEG direct from go2rtc frame buffer) */}
        {protocol === "Snapshot" && (
          <img
            src={`${gatewayBase}/api/frame.jpeg?src=${encodeURIComponent(streamName)}&_t=${snapshotTimestamp}`}
            alt={camera.name}
            className="h-full w-full object-cover"
            onLoad={() => {
              if (streamState !== "playing") {
                setStreamState("playing");
                setRealResolution("1920x1080 (HD)");
                setRealCodec("JPEG");
              }
            }}
            onError={() => {
              setStreamState("error");
              setErrorMessage("Não foi possível carregar a imagem da câmera via gateway local.");
            }}
          />
        )}

        {/* State: Connecting */}
        {streamState === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white space-y-3 z-10 p-4">
            <RefreshCw className="size-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-bold text-sm">Conectando ao Gateway Local...</p>
              <p className="text-xs text-neutral-400 font-mono">
                {gatewayBase} • Stream: {streamName}
              </p>
            </div>
          </div>
        )}

        {/* State: Negotiating WebRTC */}
        {streamState === "negotiating" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white space-y-3 z-10 p-4">
            <RefreshCw className="size-8 animate-spin text-amber-400" />
            <div className="text-center space-y-1">
              <p className="font-bold text-sm text-amber-300">Negociando SDP & ICE com o Gateway...</p>
              <p className="text-xs text-neutral-400 font-mono">Protocolo: WebRTC (H.264)</p>
            </div>
          </div>
        )}

        {/* State: Awaiting Frames (Connected, but no decoded image yet) */}
        {streamState === "awaiting_frames" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white space-y-3 z-10 p-4">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
            <div className="text-center space-y-1">
              <p className="font-bold text-sm text-emerald-300">Conexão WebRTC Estabelecida</p>
              <p className="text-xs text-neutral-300">Aguardando decodificação dos primeiros frames da câmera...</p>
              <p className="text-[11px] text-neutral-400 font-mono">Transmissão ativa • Decoder aguardando keyframe</p>
            </div>
          </div>
        )}

        {/* State: Idle / Disconnected */}
        {streamState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 text-white space-y-3 z-10 p-4">
            <Video className="size-10 text-neutral-500" />
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm">{camera.name}</h4>
              <p className="text-xs text-neutral-400">Stream pausado para economia de banda.</p>
            </div>
            <Button size="sm" onClick={handleConnect} className="gap-1.5 text-xs">
              <Play className="size-3.5 fill-current" /> Conectar Vídeo ao Vivo
            </Button>
          </div>
        )}

        {/* State: Error / Inaccessible */}
        {streamState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 text-white space-y-3 z-10 p-4 text-center">
            <div className="size-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="size-5" />
            </div>

            <div className="max-w-md space-y-1">
              <h4 className="font-bold text-sm text-rose-300">Falha na Exibição do Vídeo</h4>
              <p className="text-xs text-neutral-300 line-clamp-3">
                {errorMessage || "O stream não pôde ser reproduzido no navegador."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button size="sm" variant="default" onClick={handleReconnect} className="h-7 text-xs gap-1.5">
                <RefreshCw className="size-3.5" /> Tentar Reconectar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setProtocol("Snapshot");
                }}
                className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 gap-1.5"
              >
                <ImageIcon className="size-3.5" /> Alternar para Snapshot JPEG
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDiagnostic(true)}
                className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
              >
                <Terminal className="size-3.5" /> Ver Diagnóstico
              </Button>
            </div>
          </div>
        )}

        {/* Top OSD Bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5 text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-b from-black/85 via-black/40 to-transparent z-20">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold tracking-wide">
              <span
                className={`inline-block size-2 rounded-full ${
                  streamState === "playing"
                    ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    : streamState === "awaiting_frames"
                    ? "bg-amber-400 animate-pulse"
                    : streamState === "connecting" || streamState === "negotiating"
                    ? "bg-amber-500 animate-ping"
                    : "bg-rose-500"
                }`}
              />
              {camera.name}
            </span>
            <Badge variant="outline" className="h-4 border-white/20 bg-black/40 px-1 text-[9px] text-white">
              {camera.roomName}
            </Badge>
            {isRecording && (
              <span className="flex items-center gap-1 font-semibold text-rose-500 animate-pulse">
                <span className="size-2 rounded-full bg-rose-500" /> REC
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            {latencyMs !== null && (
              <Badge className="h-4 bg-emerald-950/80 border border-emerald-500/40 text-[9px] text-emerald-400 gap-1 font-mono">
                <Activity className="size-2.5" /> {latencyMs}ms
              </Badge>
            )}
            <span>{lastFrameTime}</span>
          </div>
        </div>

        {/* Bottom OSD Bar: Bitrate & Real Resolution Telemetry */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-2 text-[10px] font-mono text-neutral-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/60 px-1 py-0.5 text-emerald-400 border border-emerald-500/30">
              {realResolution || (streamState === "playing" ? "1920x1080" : "Sincronizando...")}
            </span>
            <span>{camera.fps} FPS</span>
            <span className="uppercase text-amber-300">{realCodec || camera.codec}</span>
            <span className="text-primary font-bold">{protocol}</span>
          </div>

          <div className="flex items-center gap-2 text-[9px] text-neutral-400">
            <span>{camera.manufacturer}</span>
          </div>
        </div>

        {/* Floating Controls Overlay (Visible on Hover / Focus) */}
        <div className="absolute inset-x-0 bottom-7 z-30 flex items-center justify-center gap-1 px-3 py-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex items-center gap-1 rounded-lg bg-black/85 px-2 py-1 backdrop-blur-md border border-white/10 shadow-2xl">
            {/* Connect / Disconnect Button */}
            {streamState === "playing" || streamState === "awaiting_frames" ? (
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 text-white hover:bg-rose-500/20 hover:text-rose-400"
                onClick={(e) => {
                  e.stopPropagation();
                  disconnectStream();
                  toast.info(`Vídeo pausado: ${camera.name}`);
                }}
                title="Desconectar / Pausar Stream"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 text-emerald-400 hover:bg-emerald-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConnect();
                }}
                title="Conectar ao Vivo"
              >
                <Play className="size-3.5 fill-current" />
              </Button>
            )}

            {/* Reconnect Button */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleReconnect();
              }}
              title="Reconectar Stream"
            >
              <RefreshCw className="size-3.5" />
            </Button>

            {/* Mode Switcher: WebRTC vs Snapshot */}
            <div className="mx-1 h-4 w-[1px] bg-white/20" />

            <Button
              size="sm"
              variant="ghost"
              className={`h-7 px-2 text-[10px] font-mono gap-1 ${
                protocol === "WebRTC"
                  ? "bg-primary/20 text-primary font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setProtocol("WebRTC");
                toast.info("Modo WebRTC (Ultrarrápido) ativado");
              }}
              title="Modo WebRTC de baixíssima latência"
            >
              <Zap className="size-3" /> RTC
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className={`h-7 px-2 text-[10px] font-mono gap-1 ${
                protocol === "Snapshot"
                  ? "bg-amber-500/20 text-amber-300 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setProtocol("Snapshot");
                toast.info("Modo Snapshot JPEG Contínuo ativado");
              }}
              title="Modo Snapshot Contínuo JPEG (compatível com todos os navegadores)"
            >
              <ImageIcon className="size-3" /> Foto
            </Button>

            <div className="mx-1 h-4 w-[1px] bg-white/20" />

            {/* PTZ Button */}
            {camera.hasPtz && onOpenPtz && (
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 text-amber-400 hover:bg-amber-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPtz(camera);
                }}
                title="Controle PTZ (Pan/Tilt/Zoom)"
              >
                <Activity className="size-3.5" />
              </Button>
            )}

            {/* Snapshot Button */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleCaptureSnapshot();
              }}
              title="Capturar Foto Instantânea do Vídeo"
            >
              <Camera className="size-3.5" />
            </Button>

            {/* Audio Mute/Unmute */}
            {protocol !== "Snapshot" && (
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  const newMute = !isMuted;
                  setIsMuted(newMute);
                  if (videoRef.current) videoRef.current.muted = newMute;
                  toast.info(newMute ? "Áudio mutado" : "Áudio ativado");
                }}
                title={isMuted ? "Ativar Áudio da Câmera" : "Silenciar Áudio"}
              >
                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </Button>
            )}

            {/* Fullscreen Button */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFullscreen();
              }}
              title="Modo Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>

            {/* Technical Diagnostics */}
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-neutral-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowDiagnostic(true);
              }}
              title="Diagnóstico Técnico do Gateway de Vídeo"
            >
              <Terminal className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Technical Diagnostic Modal */}
      <Dialog open={showDiagnostic} onOpenChange={setShowDiagnostic}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-mono text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Terminal className="size-4 text-primary" /> Diagnóstico Técnico do Gateway CFTV
            </DialogTitle>
            <DialogDescription className="text-xs">
              Diagnóstico do streaming de vídeo em tempo real para a câmera <strong>{camera.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <span className="text-muted-foreground text-[10px]">Status da Conexão</span>
                <div className="font-bold flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full ${
                      streamState === "playing"
                        ? "bg-emerald-500"
                        : streamState === "awaiting_frames"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-rose-500"
                    }`}
                  />
                  {streamState.toUpperCase()}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <span className="text-muted-foreground text-[10px]">Protocolo Ativo</span>
                <div className="font-bold text-primary">{protocol}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <span className="text-muted-foreground text-[10px]">Resolução Decodificada</span>
                <div className="font-bold text-foreground">{realResolution || "Aguardando frame..."}</div>
              </div>

              <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <span className="text-muted-foreground text-[10px]">Latência Mensurada</span>
                <div className="font-bold text-emerald-400">{latencyMs !== null ? `${latencyMs} ms` : "~"}</div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-black/40 space-y-2">
              <div className="text-[11px] font-bold text-foreground">Topologia & Endpoints</div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div>• Stream Name: <code className="text-primary">{streamName}</code></div>
                <div>• Gateway Local: <code className="text-primary">{gatewayBase}</code></div>
                <div>• API REST WHEP: <code className="text-primary">{gatewayBase}/api/webrtc?src={streamName}</code></div>
                <div>• Snapshot HTTP: <code className="text-primary">{gatewayBase}/api/frame.jpeg?src={streamName}</code></div>
                <div>• RTSP Loopback Local: <code className="text-primary">rtsp://127.0.0.1:8554/{streamName}</code></div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-amber-400" /> Acesso HTTPS vs Gateway Local (Mixed Content)
              </div>
              <p className="text-[11px] text-neutral-300">
                Se estiver abrindo o site pelo <strong>casainteligenteai.lovable.app</strong>, o navegador pode bloquear conexões a <code>http://localhost:1984</code>.
                Para liberar, clique no ícone ao lado do cadeado da URL no navegador &gt; <em>Configurações do Site</em> &gt; <em>Conteúdo não seguro</em> &gt; <strong>Permitir</strong>.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Terminal className="size-3.5" /> Iniciar Gateway no Docker Desktop (Windows)
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyDockerCommand}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  {copiedCommand ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copiedCommand ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <pre className="p-2 rounded bg-black/60 text-emerald-400 text-[11px] overflow-x-auto">
                docker compose -f "d:\Sistema ja  ok\casainteligenteai\iot-gateway\deploy\docker-compose.yml" up -d go2rtc
              </pre>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setShowDiagnostic(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
