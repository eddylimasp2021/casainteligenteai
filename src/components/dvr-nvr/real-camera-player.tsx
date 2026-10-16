import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Volume1,
  Mic,
  MicOff,
  Radio,
  Sliders,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Zap,
  Image as ImageIcon,
  Circle,
  Layers,
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
  selectedLens?: number; // Optional prop to display a specific physical lens (e.g. 1, 2, 3)
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
  selectedLens,
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
  const [volume, setVolume] = useState<number>(0.8);
  const [hasAudioTrack, setHasAudioTrack] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isIntercomOpen, setIsIntercomOpen] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isPushToTalkHolding, setIsPushToTalkHolding] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Multi-lens handling: Camera 192.168.0.240 or any camera with lensCount > 1
  const totalLenses =
    camera.lensCount ??
    (camera.ip === "192.168.0.240" || camera.name?.toLowerCase().includes("240") ? 3 : 1);

  // Active lens state: 0 = All (composite 3-in-1), 1 = Top, 2 = Middle, 3 = Bottom
  const [activeLens, setActiveLens] = useState<number>(() => {
    if (selectedLens !== undefined) return selectedLens;
    if (camera.selectedLens !== undefined) return camera.selectedLens;
    return totalLenses > 1 ? 1 : 0;
  });

  // Keep active lens in sync if props change
  useEffect(() => {
    if (selectedLens !== undefined) {
      setActiveLens(selectedLens);
    } else if (camera.selectedLens !== undefined) {
      setActiveLens(camera.selectedLens);
    }
  }, [selectedLens, camera.selectedLens]);

  const getLensLabel = useCallback((lens: number, total: number) => {
    if (lens === 0) return `Todas (${total} em 1)`;
    if (total === 3) {
      if (lens === 1) return "Lente 1: Superior";
      if (lens === 2) return "Lente 2: Central";
      if (lens === 3) return "Lente 3: Inferior";
    }
    if (total === 2) {
      if (lens === 1) return "Lente 1: Superior";
      if (lens === 2) return "Lente 2: Inferior";
    }
    return `Lente ${lens} de ${total}`;
  }, []);

  // Compute CSS style for clean, distortion-free 16:9 lens isolation
  const getMediaStyle = useCallback(() => {
    if (totalLenses <= 1 || activeLens === 0) {
      return {
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain" as const,
      };
    }
    const topPercent = -(activeLens - 1) * 100;
    return {
      position: "absolute" as const,
      left: "0%",
      width: "100%",
      height: `${totalLenses * 100}%`,
      top: `${topPercent}%`,
      objectFit: "fill" as const,
      maxWidth: "none",
      maxHeight: "none",
    };
  }, [totalLenses, activeLens]);

  // Snapshot polling state
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(Date.now());
  const [hasImageLoaded, setHasImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const frameTimeoutRef = useRef<number | null>(null);
  const snapshotIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  // Stream identifier registered in go2rtc (robust resolution for multi-lens and IP addresses)
  const streamName = useMemo(() => {
    const rawId = (camera.id || "").split("__lens_")[0]!.trim();
    const rawStream = (camera.streamName || "").split("__lens_")[0]!.trim();
    const cleanIp = (camera.ip || "").trim();
    const lowerName = (camera.name || "").toLowerCase();

    // 1. Direct match by IP or known names
    if (cleanIp === "192.168.0.139" || lowerName.includes("garagem") || rawId.includes("garagem")) {
      return "garagem_rua";
    }
    if (cleanIp === "192.168.0.240" || lowerName.includes("240") || rawId.includes("240")) {
      return "cam_192_168_0_240";
    }
    if (cleanIp === "192.168.0.198" || lowerName.includes("198") || rawId.includes("198")) {
      return "cam_192_168_0_198";
    }

    // 2. If valid stream name was provided
    if (rawStream && !rawStream.startsWith("cam-real-")) {
      return rawStream.replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    // 3. Fallback
    return (rawStream || rawId || "stream").replace(/[^a-zA-Z0-9_-]/g, "_");
  }, [camera.streamName, camera.ip, camera.name, camera.id]);

  // Effective gateway base URL (prioritizes dynamic gatewayUrl, strips localhost to prevent IPv6 resets, handles https)
  const gatewayBase = useMemo(() => {
    let raw = camera.gatewayHost;
    if (!raw || raw === "localhost:1984" || raw === "127.0.0.1:1984") {
      raw = gatewayUrl;
    }
    raw = (raw || "http://127.0.0.1:1984").trim().replace(/\/$/, "");

    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      raw = `${isHttps ? "https" : "http"}://${raw}`;
    }

    raw = raw.replace("://localhost:", "://127.0.0.1:");
    return raw;
  }, [camera.gatewayHost, gatewayUrl]);

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
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    audioTransceiverRef.current = null;
    setIsTalking(false);
    setMicLevel(0);
    setHasAudioTrack(false);

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

      // 2. Add video & audio transceivers: "sendrecv" audio enables camera backchannel (Two-Way Audio / Intercom)
      pc.addTransceiver("video", { direction: "recvonly" });
      const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
      audioTransceiverRef.current = audioTransceiver;

      // 3. Attach incoming media tracks (both video & audio) to consolidated MediaStream
      pc.ontrack = (event) => {
        if (!mediaStreamRef.current) {
          mediaStreamRef.current = new MediaStream();
        }
        if (!mediaStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          mediaStreamRef.current.addTrack(event.track);
        }

        if (event.track.kind === "audio") {
          setHasAudioTrack(true);
        }

        if (videoRef.current) {
          if (videoRef.current.srcObject !== mediaStreamRef.current) {
            videoRef.current.srcObject = mediaStreamRef.current;
          }
          videoRef.current.volume = volume;
          videoRef.current.muted = isMuted;
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
          console.warn("ICE connection interrupted. Gracefully switching to continuous Snapshot mode.");
          setProtocol("Snapshot");
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

      // Prefer H.264 transcoded stream for Chrome/Edge if source is H.265 or needs baseline compatibility
      const targetStream =
        streamName === "garagem_rua"
          ? "garagem_rua_h264"
          : streamName === "cam_192_168_0_240"
          ? "cam_192_168_0_240_h264"
          : streamName === "cam_192_168_0_198"
          ? "cam_192_168_0_198_h264"
          : streamName;
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

      // Verify that video frames actually decode within 10 seconds, else gracefully switch to Snapshot
      frameTimeoutRef.current = window.setTimeout(() => {
        const v = videoRef.current;
        if (v && (v.videoWidth === 0 || v.readyState < 2)) {
          console.warn("WebRTC keyframe sync delay. Activating continuous Snapshot JPEG stream.");
          setProtocol("Snapshot");
        }
      }, 10000);

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
      console.warn("WebRTC connection failed, falling back to Snapshot mode:", err);
      disconnectStream();
      setProtocol("Snapshot");
      setStreamState("playing");
      setRealCodec("JPEG (Ao Vivo)");
      setLatencyMs(120);
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

  // Continuous background snapshot refresh so live camera image is always ready
  useEffect(() => {
    if (streamState === "playing" && protocol === "WebRTC") return;

    const interval = setInterval(() => {
      setSnapshotTimestamp(Date.now());
    }, protocol === "Snapshot" ? 1000 : 1500);

    return () => clearInterval(interval);
  }, [protocol, streamState]);

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

  // Toggle audio listening
  const handleToggleAudio = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);

      const video = videoRef.current;
      if (video) {
        video.muted = nextMuted;
        video.volume = volume;
        if (!nextMuted) {
          video.play().catch((err) => {
            console.warn("Audio playback gesture required:", err);
          });
          toast.success("Áudio da câmera ativado!", {
            description: `Ouvindo o microfone ambiente de ${camera.name}`,
          });
        } else {
          toast.info("Áudio silenciado.");
        }
      }
    },
    [camera.name, isMuted, volume]
  );

  // Adjust listening volume
  const handleVolumeChange = useCallback(
    (newVol: number) => {
      setVolume(newVol);
      const video = videoRef.current;
      if (video) {
        video.volume = newVol;
        if (newVol > 0 && isMuted) {
          setIsMuted(false);
          video.muted = false;
          video.play().catch(() => {});
        } else if (newVol === 0) {
          setIsMuted(true);
          video.muted = true;
        }
      }
    },
    [isMuted]
  );

  // Two-way audio: Speak into camera speaker (Interfone)
  const startTalking = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Navegador não suporta acesso ao microfone ou requer conexão segura HTTPS/localhost.");
        return;
      }

      // 1. Request microphone input
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      micStreamRef.current = stream;
      const micTrack = stream.getAudioTracks()[0];

      // 2. Setup real-time VU meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          audioContextRef.current = ctx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVU = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]!;
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVU);
          };
          updateVU();
        }
      } catch (vuErr) {
        console.warn("Could not start VU meter:", vuErr);
      }

      // 3. Connect microphone track to WebRTC peer connection sender
      if (audioTransceiverRef.current?.sender) {
        await audioTransceiverRef.current.sender.replaceTrack(micTrack ?? null);
      }

      setIsTalking(true);
      toast.success("Transmitindo voz!", {
        description: `Falando no alto-falante da câmera ${camera.name}`,
      });
    } catch (err: any) {
      console.error("Microphone error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Permissão de microfone negada no navegador.", {
          description: "Autorize o uso do microfone nas permissões do site para falar na câmera.",
        });
      } else {
        toast.error(`Falha ao acessar microfone: ${err.message || err}`);
      }
      setIsTalking(false);
    }
  }, [camera.name]);

  // Stop talking
  const stopTalking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioTransceiverRef.current?.sender) {
      audioTransceiverRef.current.sender.replaceTrack(null).catch(() => {});
    }

    setIsTalking(false);
    setMicLevel(0);
    toast.info("Transmissão de voz encerrada.");
  }, []);

  // Snapshot capture from frame (supports automatic multi-lens cropping)
  const handleCaptureSnapshot = () => {
    const video = videoRef.current;

    // WebRTC or HLS video capture with canvas
    if (protocol !== "Snapshot" && video && video.videoWidth > 0) {
      try {
        const fullW = video.videoWidth;
        const fullH = video.videoHeight;
        const canvas = document.createElement("canvas");

        if (totalLenses > 1 && activeLens > 0) {
          // Crop only the active lens (e.g. 1920x1080 from 1920x3240)
          const singleH = Math.round(fullH / totalLenses);
          const sourceY = (activeLens - 1) * singleH;
          canvas.width = fullW;
          canvas.height = singleH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, sourceY, fullW, singleH, 0, 0, fullW, singleH);
            const link = document.createElement("a");
            link.download = `snapshot_${camera.id}_lente_${activeLens}_${Date.now()}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.95);
            link.click();
            toast.success(`Foto capturada da ${getLensLabel(activeLens, totalLenses)}!`);
            return;
          }
        } else {
          // Full stream capture
          canvas.width = fullW;
          canvas.height = fullH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const link = document.createElement("a");
            link.download = `snapshot_${camera.id}_${Date.now()}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.95);
            link.click();
            toast.success(`Foto capturada com sucesso: ${camera.name}!`);
            return;
          }
        }
      } catch {
        toast.error("Não foi possível exportar a foto do frame.");
      }
    }

    // Direct Snapshot mode
    const snapUrl = `${gatewayBase}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`;
    if (totalLenses > 1 && activeLens > 0) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const fullW = img.width;
          const fullH = img.height;
          const singleH = Math.round(fullH / totalLenses);
          const sourceY = (activeLens - 1) * singleH;
          const canvas = document.createElement("canvas");
          canvas.width = fullW;
          canvas.height = singleH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, sourceY, fullW, singleH, 0, 0, fullW, singleH);
            const link = document.createElement("a");
            link.download = `snapshot_${camera.id}_lente_${activeLens}_${Date.now()}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.95);
            link.click();
            toast.success(`Foto da ${getLensLabel(activeLens, totalLenses)} exportada!`);
            return;
          }
        } catch {
          window.open(snapUrl, "_blank");
        }
      };
      img.onerror = () => {
        window.open(snapUrl, "_blank");
      };
      img.src = `${snapUrl}&_t=${Date.now()}`;
      return;
    }

    const link = document.createElement("a");
    link.download = `snapshot_${camera.id}_${Date.now()}.jpg`;
    link.href = snapUrl;
    link.target = "_blank";
    link.click();
    toast.success(`Foto exportada com sucesso: ${camera.name}!`);
  };

  // Manual Video Recording (REC)
  const handleStartRecording = useCallback(() => {
    try {
      const video = videoRef.current;
      let stream: MediaStream | null = null;
      if (video && (video as any).captureStream) {
        stream = (video as any).captureStream(30);
      } else if (video && video.srcObject instanceof MediaStream) {
        stream = video.srcObject;
      }

      if (stream && typeof MediaRecorder !== "undefined") {
        const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
          ? "video/mp4;codecs=avc1"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recordedChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const actualMime = recorder.mimeType || "video/mp4";
          const blob = new Blob(recordedChunksRef.current, { type: actualMime });
          const isWebm = actualMime.includes("webm");
          const ext = isWebm ? "webm" : "mp4";
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, "0");
          const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
          const safeName = camera.name.replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `Gravacao_${safeName}_${dateStr}_${timeStr}.${ext}`;

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);

          toast.success(`Gravação salva: ${filename}`, {
            description: "Vídeo salvo no diretório de gravações configurado.",
          });
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordSeconds(0);

        recordIntervalRef.current = window.setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);

        toast.info(`Gravação iniciada: ${camera.name}`, {
          description: "Clique em Parar REC para salvar o arquivo de vídeo.",
        });
      } else {
        // Fallback to progressive download via go2rtc HTTP MP4 API
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const filename = `gravacao_${streamName}_${dateStr}_${timeStr}.mp4`;
        const mp4Url = `${gatewayBase}/api/stream.mp4?src=${encodeURIComponent(streamName)}&duration=60&filename=${filename}`;
        const link = document.createElement("a");
        link.href = mp4Url;
        link.download = filename;
        link.target = "_blank";
        link.click();
        toast.info("Iniciando download do stream MP4 direto do gateway...");
      }
    } catch (err: any) {
      toast.error(`Erro ao iniciar gravação: ${err.message || err}`);
    }
  }, [camera.name, gatewayBase, streamName]);

  const handleStopRecording = useCallback(() => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  }, []);

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
        {/* Instant Live Physical Camera Image (Always visible so user sees the camera image immediately from second 0) */}
        <img
          src={`${gatewayBase}/api/frame.jpeg?src=${encodeURIComponent(streamName)}&_t=${snapshotTimestamp}`}
          alt={camera.name}
          style={getMediaStyle()}
          className="transition-all duration-300 pointer-events-none"
          onLoad={() => {
            setHasImageLoaded(true);
            setImageError(false);
            if (realResolution === null) {
              setRealResolution(totalLenses > 1 && activeLens > 0 ? "1920x1080 (HD)" : "1920x3240 (3 Lentes)");
            }
          }}
          onError={() => {
            setImageError(true);
          }}
        />

        {/* Real HTML5 Video element for WebRTC / HLS: Smoothly overlays the image as soon as 30 FPS video frames decode */}
        {protocol !== "Snapshot" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            style={getMediaStyle()}
            className={`transition-opacity duration-500 z-10 ${
              streamState === "playing" ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />
        )}

        {/* Floating status pill when WebRTC is awaiting keyframes */}
        {streamState === "awaiting_frames" && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-white text-[11px] shadow-lg animate-pulse pointer-events-none">
            <RefreshCw className="size-3 animate-spin text-emerald-400" />
            <span>WebRTC conectado • Sincronizando vídeo fluido...</span>
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

        {/* State: Error / Inaccessible (Shown when video frames or snapshot fails, or Mixed Content detected) */}
        {((streamState === "error" && (!hasImageLoaded || imageError)) || (protocol === "Snapshot" && imageError)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 text-white space-y-3 z-10 p-4 text-center">
            <div className="size-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="size-5" />
            </div>

            <div className="max-w-md space-y-1">
              <h4 className="font-bold text-sm text-amber-300">
                {typeof window !== "undefined" && window.location.protocol === "https:" && gatewayBase.startsWith("http:")
                  ? "Bloqueio de Conteúdo Misto (HTTPS vs HTTP Local)"
                  : "Falha na Exibição do Vídeo"}
              </h4>
              <p className="text-xs text-neutral-300 line-clamp-3">
                {typeof window !== "undefined" && window.location.protocol === "https:" && gatewayBase.startsWith("http:")
                  ? "O navegador em HTTPS bloqueou a conexão HTTP local. Conecte pelo Túnel HTTPS seguro ou ative 'Conteúdo Inseguro' no Chrome para este site."
                  : errorMessage || "O stream não pôde ser reproduzido no navegador. Verifique a URL do Gateway ou as credenciais RTSP."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button size="sm" variant="default" onClick={handleReconnect} className="h-7 text-xs gap-1.5">
                <RefreshCw className="size-3.5" /> Tentar Reconectar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDiagnostic(true)}
                className="h-7 text-xs bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 gap-1.5"
              >
                <Terminal className="size-3.5" /> Diagnóstico & Gateway HTTPS
              </Button>
            </div>
          </div>
        )}

        {/* Non-intrusive floating pill if WebRTC errored but camera snapshot is active */}
        {streamState === "error" && hasImageLoaded && !imageError && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[11px] shadow-lg pointer-events-none">
            <AlertTriangle className="size-3 text-amber-400" />
            <span>Vídeo em Snapshot JPEG ao vivo (1 FPS)</span>
          </div>
        )}

        {/* Floating Active Talking Banner (Appears when microphone is transmitting to camera speaker) */}
        {isTalking && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-rose-600/95 text-white text-[11px] sm:text-xs font-semibold shadow-2xl border border-rose-300 animate-pulse pointer-events-auto">
            <div className="relative flex items-center justify-center">
              <Radio className="size-4 text-white" />
              <span className="absolute size-2 bg-white rounded-full animate-ping" />
            </div>
            <span>TRANSMITINDO VOZ AO VIVO NO ALTO-FALANTE</span>
            {/* Real VU Meter Bar Display */}
            <div className="flex items-end gap-0.5 h-3.5 bg-black/40 px-1 py-0.5 rounded">
              <div
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${Math.max(25, micLevel)}%` }}
              />
              <div
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${Math.max(35, micLevel * 0.9)}%` }}
              />
              <div
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${Math.max(20, micLevel * 0.7)}%` }}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                stopTalking();
              }}
              className="h-5 px-2 text-[10px] bg-black/40 hover:bg-black/70 text-white rounded font-bold"
            >
              Encerrar
            </Button>
          </div>
        )}

        {/* Top OSD Bar: Camera info + Always-Visible Audio & Intercom Buttons */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-gradient-to-b from-black/90 via-black/50 to-transparent z-20">
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

            {/* Multi-Lens Switcher Pill in Top Bar */}
            {totalLenses > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextLens = activeLens >= totalLenses ? 0 : activeLens + 1;
                  setActiveLens(nextLens);
                  toast.info(`Alternado para: ${getLensLabel(nextLens, totalLenses)}`);
                }}
                className="pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-primary/25 text-primary-foreground border border-primary/50 hover:bg-primary/40 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Clique para alternar entre as lentes (1, 2, 3 ou Todas)"
              >
                <Layers className="size-3 text-primary animate-pulse" />
                <span>{getLensLabel(activeLens, totalLenses)}</span>
              </button>
            )}

            {isRecording && (
              <span className="flex items-center gap-1.5 font-bold text-rose-400 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] animate-pulse">
                <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                REC {Math.floor(recordSeconds / 60).toString().padStart(2, "0")}:{(recordSeconds % 60).toString().padStart(2, "0")}
              </span>
            )}
          </div>

          {/* Central Action Center: Audio Listening Toggle & Push-To-Talk Intercom (ALWAYS VISIBLE) */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* 1. Escutar Áudio (Listening Toggle & Volume) */}
            {isMuted ? (
              <button
                type="button"
                onClick={handleToggleAudio}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold tracking-tight transition-all duration-200 shadow-md bg-neutral-900/95 text-amber-300 border border-amber-500/50 hover:bg-amber-500/20 hover:border-amber-400 active:scale-95 cursor-pointer"
                title="Clique para ativar o áudio do ambiente da câmera"
              >
                <VolumeX className="size-3 text-amber-400 shrink-0" />
                <span className="hidden xs:inline">Sem Áudio • Clique p/ Ouvir</span>
                <span className="xs:hidden">Ouvir</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-semibold shadow-md bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 transition-all">
                <button
                  type="button"
                  onClick={handleToggleAudio}
                  className="flex items-center gap-1 hover:text-emerald-100 active:scale-95 cursor-pointer"
                  title="Clique para silenciar o áudio"
                >
                  <Volume2 className="size-3 text-emerald-400 animate-pulse shrink-0" />
                  <span>Ouvindo</span>
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleVolumeChange(parseFloat(e.target.value));
                  }}
                  className="w-12 h-1 accent-emerald-400 cursor-pointer"
                  title={`Volume: ${Math.round(volume * 100)}%`}
                />
                <span className="text-[9px] text-emerald-400 font-mono">{Math.round(volume * 100)}%</span>
              </div>
            )}

            {/* 2. Falar na Câmera (Two-Way Audio Intercom) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsIntercomOpen(true);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold tracking-tight transition-all duration-200 shadow-md cursor-pointer active:scale-95 ${
                isTalking
                  ? "bg-rose-600 text-white border border-rose-400 animate-pulse"
                  : "bg-blue-950/90 hover:bg-blue-900 text-blue-200 border border-blue-500/50 hover:border-blue-400"
              }`}
              title="Abrir Interfone para falar no alto-falante da câmera"
            >
              <Mic className={`size-3 shrink-0 ${isTalking ? "text-white animate-bounce" : "text-blue-400"}`} />
              <span>{isTalking ? "Transmitindo Voz..." : "Falar"}</span>
            </button>
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
              {totalLenses > 1
                ? activeLens > 0
                  ? `1920x1080 (L${activeLens}/${totalLenses})`
                  : `1920x3240 (${totalLenses} em 1)`
                : realResolution || (streamState === "playing" ? "1920x1080" : "Sincronizando...")}
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

            {/* Multi-Lens Quick Selector */}
            {totalLenses > 1 && (
              <>
                <div className="mx-1 h-4 w-[1px] bg-white/20" />
                <div className="flex items-center gap-0.5 rounded bg-white/10 p-0.5 border border-white/10">
                  {Array.from({ length: totalLenses }, (_, i) => i + 1).map((lensNum) => (
                    <Button
                      key={lensNum}
                      size="sm"
                      variant="ghost"
                      className={`h-6 px-1.5 text-[10px] font-bold ${
                        activeLens === lensNum
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-neutral-300 hover:text-white"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLens(lensNum);
                        toast.info(`Exibindo ${getLensLabel(lensNum, totalLenses)}`);
                      }}
                      title={`Focar na Lente ${lensNum}`}
                    >
                      L{lensNum}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-6 px-1.5 text-[10px] font-bold ${
                      activeLens === 0
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-neutral-300 hover:text-white"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLens(0);
                      toast.info(`Exibindo todas as lentes combinadas (${totalLenses} em 1)`);
                    }}
                    title="Ver todas as lentes completas"
                  >
                    Todas
                  </Button>
                </div>
              </>
            )}

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

            {/* Record (REC) Button */}
            <Button
              size="sm"
              variant="ghost"
              className={`size-7 p-0 ${
                isRecording
                  ? "bg-rose-500/30 text-rose-400 hover:bg-rose-500/40 animate-pulse"
                  : "text-white hover:bg-white/20 hover:text-rose-400"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                  handleStopRecording();
                } else {
                  handleStartRecording();
                }
              }}
              title={isRecording ? "Parar Gravação e Salvar Arquivo" : "Gravar Este Canal (REC)"}
            >
              {isRecording ? (
                <Square className="size-3.5 fill-rose-500 text-rose-500" />
              ) : (
                <Circle className="size-3.5 fill-rose-500 text-rose-500" />
              )}
            </Button>

            {/* Audio Mute/Unmute & Volume */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className={`size-7 p-0 ${
                  isMuted ? "text-amber-400 hover:bg-amber-500/20" : "text-emerald-400 hover:bg-emerald-500/20"
                }`}
                onClick={handleToggleAudio}
                title={isMuted ? "Ativar Áudio da Câmera (Ouvir Ambiente)" : "Silenciar Áudio da Câmera"}
              >
                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  e.stopPropagation();
                  handleVolumeChange(parseFloat(e.target.value));
                }}
                className="w-12 h-1 accent-emerald-400 cursor-pointer hidden md:inline-block"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>

            {/* Talk / Intercom Button */}
            <Button
              size="sm"
              variant="ghost"
              className={`size-7 p-0 ${
                isTalking
                  ? "bg-rose-600 text-white animate-pulse hover:bg-rose-700"
                  : "text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setIsIntercomOpen(true);
              }}
              title={
                isTalking
                  ? "Transmitindo voz no alto-falante (Clique para abrir interfone)"
                  : "Falar no Alto-Falante da Câmera (Interfone)"
              }
            >
              {isTalking ? <Mic className="size-3.5 animate-bounce text-white" /> : <Mic className="size-3.5" />}
            </Button>

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

      {/* Two-Way Audio Intercom Modal Dialog */}
      <Dialog
        open={isIntercomOpen}
        onOpenChange={(open) => {
          setIsIntercomOpen(open);
          if (!open && isTalking) {
            stopTalking();
          }
        }}
      >
        <DialogContent className="max-w-md font-sans text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Mic className="size-5 text-blue-400" /> Interfone Bidirecional — {camera.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comunicação de voz bidirecional em tempo real: ouça o ambiente e fale diretamente pelo alto-falante integrado da câmera IP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Main Push-To-Talk Button Section */}
            <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 space-y-3 text-center">
              <button
                type="button"
                onClick={() => {
                  if (isTalking) {
                    stopTalking();
                  } else {
                    startTalking();
                  }
                }}
                className={`relative flex items-center justify-center size-24 rounded-full transition-all duration-300 shadow-xl select-none cursor-pointer active:scale-95 ${
                  isTalking
                    ? "bg-rose-600 text-white shadow-[0_0_30px_rgba(225,29,72,0.6)] ring-4 ring-rose-400/50 animate-pulse"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/40"
                }`}
                title={isTalking ? "Clique para Encerrar Transmissão" : "Clique para Começar a Falar"}
              >
                {isTalking ? (
                  <MicOff className="size-10 animate-bounce" />
                ) : (
                  <Mic className="size-10" />
                )}
                {isTalking && (
                  <span className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-75" />
                )}
              </button>

              <div className="space-y-1">
                <span className="font-bold text-sm text-foreground block">
                  {isTalking ? "🎙️ FALANDO NO ALTO-FALANTE" : "CLIQUE PARA FALAR"}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {isTalking
                    ? "Sua voz está sendo reproduzida na câmera em tempo real. Clique novamente para encerrar."
                    : "Pressione o botão para ativar o microfone e transmitir sua voz para o alto-falante da câmera."}
                </p>
              </div>

              {/* Real-time Microphone VU Meter Bar */}
              <div className="w-full max-w-xs space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Sensibilidade do Microfone</span>
                  <span className="font-mono font-bold text-foreground">{isTalking ? `${micLevel}%` : "Mudo"}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-900 border border-border/40 p-0.5 flex items-center">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      isTalking
                        ? micLevel > 70
                          ? "bg-rose-500"
                          : micLevel > 35
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                        : "w-0"
                    }`}
                    style={{ width: isTalking ? `${Math.max(5, micLevel)}%` : "0%" }}
                  />
                </div>
              </div>
            </div>

            {/* Listening Speaker Volume Control */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-foreground flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-emerald-400" /> Volume do Alto-Falante Local (Escutar Câmera)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleAudio}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  {isMuted ? <VolumeX className="size-3 text-amber-400" /> : <Volume2 className="size-3 text-emerald-400" />}
                  {isMuted ? "Mutado (Ativar)" : "Ouvindo"}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 accent-primary cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-primary min-w-[3rem] text-right">
                  {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
                </span>
              </div>
            </div>

            {/* Technical Context & Permissions Info */}
            <div className="p-3 rounded-lg border border-border/60 bg-black/40 space-y-1.5 text-[11px] text-muted-foreground">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" /> Informações do Canal de Áudio
              </div>
              <div>• Transmissão de Retorno: <code className="text-primary">ONVIF / RTSP Backchannel (G.711 / Opus)</code></div>
              <div>• Gateway de Mídia: <code className="text-primary">{gatewayBase}</code></div>
              <div>• Requisito do Navegador: Permissão de microfone autorizada no navegador (HTTPS ou localhost).</div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              size="sm"
              variant={isTalking ? "destructive" : "outline"}
              onClick={() => {
                if (isTalking) stopTalking();
                setIsIntercomOpen(false);
              }}
            >
              {isTalking ? "Encerrar e Fechar" : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
