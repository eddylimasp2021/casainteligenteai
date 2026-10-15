import { useState, useEffect } from "react";
import { 
  Camera, Plus, Trash2, Edit, Search, CheckCircle2, 
  AlertCircle, RefreshCw, Radio, Shield, Network, Server,
  Video, Globe, HelpCircle, Info, Sparkles, KeyRound, Lock, Eye, EyeOff
} from "lucide-react";
import type { IpCamera, CameraManufacturer, StreamProtocol } from "@/types/dvr-nvr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface CameraManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cameras?: IpCamera[];
  onAddCamera?: (camera: IpCamera) => void;
  onSaveCamera?: (camera: Partial<IpCamera>) => void;
  existingCamera?: IpCamera | null;
  onDeleteCamera?: (id: string) => void;
}

const MANUFACTURER_PRESETS: Record<
  CameraManufacturer,
  {
    port: number;
    onvifPort: number;
    rtspPath: string;
    subPath: string;
    snapshotPath: string;
  }
> = {
  Intelbras: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    subPath: "/cam/realmonitor?channel=1&subtype=1",
    snapshotPath: "/cgi-bin/snapshot.cgi",
  },
  Hikvision: {
    port: 554,
    onvifPort: 8000,
    rtspPath: "/Streaming/Channels/101",
    subPath: "/Streaming/Channels/102",
    snapshotPath: "/ISAPI/Streaming/channels/101/picture",
  },
  Dahua: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    subPath: "/cam/realmonitor?channel=1&subtype=1",
    snapshotPath: "/cgi-bin/snapshot.cgi",
  },
  Reolink: {
    port: 554,
    onvifPort: 8000,
    rtspPath: "/h264Preview_01_main",
    subPath: "/h264Preview_01_sub",
    snapshotPath: "/cgi-bin/api.cgi?cmd=Snap&channel=0",
  },
  Axis: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/axis-media/media.amp",
    subPath: "/axis-media/media.amp?videocodec=h264&resolution=640x360",
    snapshotPath: "/axis-cgi/jpg/image.cgi",
  },
  Generic: {
    port: 554,
    onvifPort: 8899,
    rtspPath: "/onvif1",
    subPath: "/onvif2",
    snapshotPath: "/snapshot.jpg",
  },
};

/**
 * Parses any RTSP URL format (e.g. rtsp://admin:senha@192.168.0.139:554/onvif1)
 */
function parseAndExtractRtsp(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Regex to extract username, password, host, port, path
  const match = trimmed.match(
    /^rtsp:\/\/(?:([^:@\s]+)(?::([^@\s]+))?@)?([^:/@\s]+)(?::(\d+))?(\/[^\s]*)?$/i
  );

  if (match) {
    return {
      username: match[1] || "",
      password: match[2] || "",
      ip: match[3] || "",
      port: match[4] ? Number(match[4]) : 554,
      path: match[5] || "/live/ch0",
    };
  }
  return null;
}

/**
 * Returns a strictly masked RTSP preview (rtsp://admin:*********@192.168.0.139:554/onvif1)
 * NEVER exposing the real password!
 */
function getSanitizedRtspPreview(
  username: string,
  ip: string,
  port: number,
  rtspPath: string
): string {
  // If rtspPath itself contains a full rtsp:// URL, parse it first to avoid duplicate strings
  if (rtspPath.startsWith("rtsp://")) {
    const parsed = parseAndExtractRtsp(rtspPath);
    if (parsed) {
      const u = parsed.username || username || "admin";
      const host = parsed.ip || ip || "192.168.0.139";
      const p = parsed.port || port || 554;
      const path = parsed.path.startsWith("/") ? parsed.path : `/${parsed.path}`;
      return `rtsp://${u}:*********@${host}:${p}${path}`;
    }
  }

  const cleanPath = rtspPath.startsWith("/") ? rtspPath : `/${rtspPath}`;
  const user = username || "admin";
  const host = ip || "192.168.0.139";
  const p = port || 554;

  return `rtsp://${user}:*********@${host}:${p}${cleanPath}`;
}

export function CameraManagerDialog({
  open,
  onOpenChange,
  cameras,
  onAddCamera,
  onSaveCamera,
  existingCamera,
  onDeleteCamera,
}: CameraManagerDialogProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<
    Array<{ ip: string; manufacturer: string; model: string; onvif: boolean }>
  >([]);

  // Form states
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("Entrada");
  const [manufacturer, setManufacturer] = useState<CameraManufacturer>("Generic");
  const [model, setModel] = useState("Câmera IP Genérica ONVIF");
  const [ip, setIp] = useState("192.168.0.139");
  const [port, setPort] = useState(554);
  const [onvifPort, setOnvifPort] = useState(80);
  const [protocol, setProtocol] = useState<StreamProtocol>("RTSP");
  const [rtspPath, setRtspPath] = useState("/onvif1");
  const [subStreamPath, setSubStreamPath] = useState("/onvif2");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [quickRtspPaste, setQuickRtspPaste] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [viewMode, setViewMode] = useState<"auto" | "stream" | "snapshot" | "simulation">("auto");
  const [hasPtz, setHasPtz] = useState(false);
  const [hasTwoWayAudio, setHasTwoWayAudio] = useState(true);
  const [codec, setCodec] = useState<"H.265" | "H.264" | "MJPEG">("H.264");
  const [fps, setFps] = useState(30);
  const [bitrateKbps, setBitrateKbps] = useState(4096);

  // Sync state when existingCamera changes or dialog opens
  useEffect(() => {
    if (existingCamera) {
      setName(existingCamera.name || "");
      setRoomName(existingCamera.roomName || "Entrada");
      setManufacturer(existingCamera.manufacturer || "Generic");
      setModel(existingCamera.model || "Câmera IP Genérica ONVIF");
      setIp(existingCamera.ip || "192.168.0.139");
      setPort(existingCamera.port || 554);
      setOnvifPort(existingCamera.onvifPort || 80);
      setProtocol(existingCamera.protocol || "RTSP");
      setRtspPath(existingCamera.rtspPath || "/onvif1");
      setSubStreamPath(existingCamera.subStreamPath || "/onvif2");
      setUsername(existingCamera.username || "admin");
      setPassword(existingCamera.password || "");
      setStreamUrl(existingCamera.streamUrl || "");
      setSnapshotUrl(existingCamera.snapshotUrl || "");
      setViewMode(existingCamera.viewMode || "auto");
      setHasPtz(existingCamera.hasPtz ?? false);
      setHasTwoWayAudio(existingCamera.hasTwoWayAudio ?? true);
      setCodec(existingCamera.codec || "H.264");
      setFps(existingCamera.fps || 30);
      setBitrateKbps(existingCamera.bitrateKbps || 4096);
      setQuickRtspPaste("");
    } else {
      setName("");
      setRoomName("Entrada");
      setManufacturer("Generic");
      setModel("Câmera IP Genérica ONVIF");
      setIp("192.168.0.139");
      setPort(554);
      setOnvifPort(80);
      setProtocol("RTSP");
      setRtspPath("/onvif1");
      setSubStreamPath("/onvif2");
      setUsername("admin");
      setPassword("");
      setStreamUrl("");
      setSnapshotUrl(`http://192.168.0.139/snapshot.jpg`);
      setViewMode("auto");
      setHasPtz(false);
      setHasTwoWayAudio(true);
      setCodec("H.264");
      setFps(30);
      setBitrateKbps(4096);
      setQuickRtspPaste("");
    }
  }, [existingCamera, open]);

  // Handle pasting full RTSP URL
  const handleProcessRtspString = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.startsWith("rtsp://")) {
      const parsed = parseAndExtractRtsp(trimmed);
      if (parsed) {
        if (parsed.ip) setIp(parsed.ip);
        if (parsed.port) setPort(parsed.port);
        if (parsed.username) setUsername(parsed.username);
        if (parsed.password) setPassword(parsed.password);
        setRtspPath(parsed.path);
        setSnapshotUrl(`http://${parsed.ip}/snapshot.jpg`);
        toast.success("URL RTSP identificada!", {
          description: `IP: ${parsed.ip} • Porta: ${parsed.port} • Senha ocultada com segurança.`,
        });
        return true;
      }
    }
    return false;
  };

  const handleRtspPathChange = (val: string) => {
    // If user pasted full rtsp:// in the path box, parse it automatically
    if (val.trim().startsWith("rtsp://")) {
      handleProcessRtspString(val);
    } else {
      setRtspPath(val);
    }
  };

  const handleManufacturerChange = (val: CameraManufacturer) => {
    setManufacturer(val);
    const preset = MANUFACTURER_PRESETS[val];
    setPort(preset.port);
    setOnvifPort(preset.onvifPort);
    setRtspPath(preset.rtspPath);
    setSubStreamPath(preset.subPath);
    setSnapshotUrl(`http://${ip || "192.168.0.139"}${preset.snapshotPath}`);
    if (val === "Intelbras") setModel("Intelbras VIP / Mibo");
    else if (val === "Hikvision") setModel("Hikvision DS-2CD AcuSense");
    else if (val === "Dahua") setModel("Dahua IPC Starlight");
    else if (val === "Reolink") setModel("Reolink E1 / RLC");
    else if (val === "Axis") setModel("Axis M-Series");
    else setModel("Câmera IP Genérica ONVIF");
  };

  const handleIpChange = (newIp: string) => {
    setIp(newIp);
    const preset = MANUFACTURER_PRESETS[manufacturer] || MANUFACTURER_PRESETS.Generic;
    setSnapshotUrl(`http://${newIp}${preset.snapshotPath}`);
  };

  const handleScanNetwork = () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    setTimeout(() => {
      setIsScanning(false);
      const mockDiscovered = [
        { ip: "192.168.0.139", manufacturer: "Generic", model: "Câmera ONVIF Profile S (/onvif1)", onvif: true },
        { ip: "192.168.0.108", manufacturer: "Intelbras", model: "VIP 3230 B (Bullet)", onvif: true },
        { ip: "192.168.0.115", manufacturer: "Hikvision", model: "DS-2CD1023G0E (Bullet)", onvif: true },
      ];
      setDiscoveredDevices(mockDiscovered);
      toast.success("Varredura ONVIF concluída!", {
        description: `Encontradas ${mockDiscovered.length} câmeras IP ativas na sua rede local.`,
      });
    }, 1500);
  };

  const handleQuickAddDiscovered = (item: { ip: string; manufacturer: string; model: string }) => {
    setName(`Câmera ${item.manufacturer} (${item.ip.split(".").pop()})`);
    setManufacturer(item.manufacturer as CameraManufacturer);
    setModel(item.model);
    setIp(item.ip);
    const preset = MANUFACTURER_PRESETS[item.manufacturer as CameraManufacturer] || MANUFACTURER_PRESETS.Generic;
    setPort(preset.port);
    setOnvifPort(preset.onvifPort);
    setRtspPath(preset.rtspPath);
    setSnapshotUrl(`http://${item.ip}${preset.snapshotPath}`);
    toast.info(`Dados da câmera ${item.manufacturer} carregados.`);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    try {
      if (!name.trim()) {
        toast.error("Informe um nome para a câmera.");
        return;
      }
      if (!ip.trim()) {
        toast.error("Informe o endereço IP da câmera.");
        return;
      }

      // Sanitize RTSP path: ensure it doesn't accidentally retain a full rtsp:// prefix
      let finalPath = rtspPath.trim();
      let finalIp = ip.trim();
      let finalPort = Number(port) || 554;
      let finalUser = username.trim() || "admin";
      let finalPass = password.trim();

      if (finalPath.startsWith("rtsp://")) {
        const parsed = parseAndExtractRtsp(finalPath);
        if (parsed) {
          if (parsed.ip) finalIp = parsed.ip;
          if (parsed.port) finalPort = parsed.port;
          if (parsed.username) finalUser = parsed.username;
          if (parsed.password) finalPass = parsed.password;
          finalPath = parsed.path;
        }
      }

      if (!finalPath.startsWith("/")) {
        finalPath = "/" + finalPath;
      }

      const cameraData: Partial<IpCamera> = {
        name: name.trim(),
        roomName: roomName.trim() || "Entrada",
        manufacturer,
        model: model.trim() || `${manufacturer} IP Camera`,
        ip: finalIp,
        port: finalPort,
        onvifPort: Number(onvifPort) || 80,
        protocol,
        rtspPath: finalPath,
        subStreamPath: subStreamPath.trim() || undefined,
        username: finalUser,
        password: finalPass,
        streamUrl: streamUrl.trim() || undefined,
        snapshotUrl: snapshotUrl.trim() || undefined,
        viewMode,
        resolution: "1080p (1920x1080)",
        fps: Number(fps) || 30,
        bitrateKbps: Number(bitrateKbps) || 4096,
        codec,
        status: "online",
        hasPtz,
        hasTwoWayAudio,
        hasNightVision: true,
        recordingMode: "continuous",
        aiFeatures: {
          motionDetection: true,
          humanDetection: true,
          vehicleDetection: true,
          lineCrossing: true,
          facialRecognition: false,
        },
      };

      if (onSaveCamera) {
        onSaveCamera(cameraData);
      } else if (onAddCamera) {
        onAddCamera({
          id: existingCamera?.id || `cam-${Date.now().toString(36)}`,
          status: "online",
          ...cameraData,
        } as IpCamera);
      }

      toast.success(
        existingCamera
          ? `Câmera "${name.trim()}" atualizada!`
          : `Câmera "${name.trim()}" adicionada ao NVR!`
      );

      // Close the modal cleanly
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar câmera:", err);
      toast.error("Ocorreu um erro ao salvar a câmera.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {existingCamera ? `Editar Câmera: ${existingCamera.name}` : "Cadastrar Câmera IP / ONVIF"}
              </DialogTitle>
              <DialogDescription>
                Configure os parâmetros de rede da câmera, credenciais RTSP e opções de visualização
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Quick RTSP Link Parser Box */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Colar Link RTSP Completo (Preenchimento Automático)
            </Label>
            <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
              Auto-Detecção
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ex: rtsp://admin:senha@192.168.0.139:554/onvif1"
              value={quickRtspPaste}
              onChange={(e) => {
                setQuickRtspPaste(e.target.value);
                handleProcessRtspString(e.target.value);
              }}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (quickRtspPaste) {
                  const ok = handleProcessRtspString(quickRtspPaste);
                  if (!ok) toast.error("Formato RTSP inválido. Exemplo: rtsp://admin:senha@192.168.0.139:554/onvif1");
                }
              }}
              className="h-9 px-3 text-xs shrink-0"
            >
              Aplicar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cole a URL RTSP completa fornecida pelo aplicativo da câmera ou NVR. Os campos de IP, porta, usuário e senha serão preenchidos automaticamente com a senha protegida.
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Camera Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Câmera</Label>
              <Input
                placeholder="Ex: Garagem rua, Entrada, Portão"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Room Location */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cômodo / Localização</Label>
              <Input
                placeholder="Ex: Rua, Garagem, Quintal, Entrada"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
            </div>

            {/* Manufacturer */}
            <div className="space-y-1.5">
              <Label className="text-xs">Fabricante</Label>
              <Select value={manufacturer} onValueChange={(v) => handleManufacturerChange(v as CameraManufacturer)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Generic">Genérico / Padrão ONVIF Profile S (/onvif1)</SelectItem>
                  <SelectItem value="Intelbras">Intelbras (Mibo / VIP / MHDX)</SelectItem>
                  <SelectItem value="Hikvision">Hikvision (AcuSense / TurboHD / HiLook)</SelectItem>
                  <SelectItem value="Dahua">Dahua (Starlight / WizSense)</SelectItem>
                  <SelectItem value="Reolink">Reolink (Argus / E1 / RLC)</SelectItem>
                  <SelectItem value="Axis">Axis Communications</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo da Câmera</Label>
              <Input
                placeholder="Ex: Câmera IP Genérica ONVIF, VIP 3230 B"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* IP Address */}
            <div className="space-y-1.5">
              <Label className="text-xs">Endereço IP na Rede Local</Label>
              <Input
                placeholder="192.168.0.139"
                value={ip}
                onChange={(e) => handleIpChange(e.target.value)}
                required
              />
            </div>

            {/* RTSP Port */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-xs">Porta RTSP</Label>
                <span className="text-[10px] text-muted-foreground">Padrão: 554</span>
              </div>
              <Input
                type="number"
                placeholder="554"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
              />
            </div>

            {/* Username & Password */}
            <div className="space-y-1.5">
              <Label className="text-xs">Usuário da Câmera</Label>
              <Input
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs flex items-center gap-1">
                  <Lock className="size-3 text-primary" /> Senha da Câmera
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* RTSP Path */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs">Caminho do Stream RTSP (Ex: /onvif1 ou /live/ch0)</Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Canal: {rtspPath.startsWith("/") ? rtspPath : `/${rtspPath}`}
                </span>
              </div>
              <Input
                placeholder="/onvif1"
                value={rtspPath}
                onChange={(e) => handleRtspPathChange(e.target.value)}
                className="font-mono text-xs"
                required
              />

              {/* STRICTLY PROTECTED RTSP PREVIEW: ALWAYS MASKS PASSWORD */}
              <div className="p-2 rounded-lg bg-black/40 border border-border/60 text-[11px] font-mono text-foreground flex items-center gap-2">
                <Shield className="size-3.5 text-emerald-400 shrink-0" />
                <span className="text-muted-foreground shrink-0">String RTSP:</span>
                <span className="text-emerald-400 font-bold truncate">
                  {getSanitizedRtspPreview(username, ip, port, rtspPath)}
                </span>
              </div>
            </div>

            {/* Visual Mode Selector */}
            <div className="space-y-1.5 sm:col-span-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <Globe className="size-3.5" /> Modo de Visualização no Navegador
              </Label>
              <Select
                value={viewMode}
                onValueChange={(v) => setViewMode(v as "auto" | "stream" | "snapshot" | "simulation")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (Vídeo Web Real &gt; Snapshot &gt; Simulação)</SelectItem>
                  <SelectItem value="stream">Stream Web / WebRTC / HLS (Vídeo Fluido com Áudio)</SelectItem>
                  <SelectItem value="snapshot">Snapshot HTTP / MJPEG (Fotos contínuas leves)</SelectItem>
                  <SelectItem value="simulation">Simulação Gráfica CFTV com I.A.</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Snapshot URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Camera className="size-3.5 text-primary" /> URL de Snapshot HTTP (Foto contínua / MJPEG)
                </Label>
                <Badge variant="outline" className="text-[9px]">Acesso Direto</Badge>
              </div>
              <Input
                placeholder="Ex: http://192.168.0.139/snapshot.jpg ou /cgi-bin/snapshot.cgi"
                value={snapshotUrl}
                onChange={(e) => setSnapshotUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                URL direta de imagem JPEG da câmera na rede local para exibição contínua sem necessidade de servidor de mídia.
              </p>
            </div>

            {/* Web Stream URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Video className="size-3.5 text-primary" /> URL de Stream Web (HLS / WebRTC / Gateway)
                </Label>
                <Badge variant="outline" className="text-[9px]">Opcional</Badge>
              </div>
              <Input
                placeholder="Ex: http://localhost:8080/stream/cam-01.m3u8 ou link Home Assistant"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* PTZ and Audio Toggles */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold">Suporte a Movimentação PTZ</Label>
                <p className="text-[11px] text-muted-foreground">Habilitar joystick de Pan/Tilt/Zoom e presets</p>
              </div>
              <Switch checked={hasPtz} onCheckedChange={setHasPtz} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold">Áudio Bidirecional (Interfone)</Label>
                <p className="text-[11px] text-muted-foreground">Permite falar no alto-falante da câmera</p>
              </div>
              <Switch checked={hasTwoWayAudio} onCheckedChange={setHasTwoWayAudio} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {existingCamera ? "Salvar Alterações" : "Salvar e Conectar Câmera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
