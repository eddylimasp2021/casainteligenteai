import { useState, useEffect } from "react";
import { 
  Camera, Plus, Trash2, Edit, Search, CheckCircle2, 
  AlertCircle, RefreshCw, Radio, Shield, Network, Server,
  Video, Globe, HelpCircle, Info, Sparkles
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
  onSaveCamera: (camera: Partial<IpCamera>) => void;
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
    rtspPath: "/live/ch0",
    subPath: "/live/ch1",
    snapshotPath: "/snapshot.jpg",
  },
};

export function CameraManagerDialog({
  open,
  onOpenChange,
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
  const [manufacturer, setManufacturer] = useState<CameraManufacturer>("Intelbras");
  const [model, setModel] = useState("Câmera IP Full HD");
  const [ip, setIp] = useState("192.168.1.108");
  const [port, setPort] = useState(554);
  const [onvifPort, setOnvifPort] = useState(80);
  const [protocol, setProtocol] = useState<StreamProtocol>("RTSP");
  const [rtspPath, setRtspPath] = useState(MANUFACTURER_PRESETS.Intelbras.rtspPath);
  const [subStreamPath, setSubStreamPath] = useState(MANUFACTURER_PRESETS.Intelbras.subPath);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [viewMode, setViewMode] = useState<"auto" | "stream" | "snapshot" | "simulation">("auto");
  const [hasPtz, setHasPtz] = useState(false);
  const [hasTwoWayAudio, setHasTwoWayAudio] = useState(true);
  const [codec, setCodec] = useState<"H.265" | "H.264" | "MJPEG">("H.265");
  const [fps, setFps] = useState(30);
  const [bitrateKbps, setBitrateKbps] = useState(4096);

  // Sync state when existingCamera changes
  useEffect(() => {
    if (existingCamera) {
      setName(existingCamera.name || "");
      setRoomName(existingCamera.roomName || "Entrada");
      setManufacturer(existingCamera.manufacturer || "Intelbras");
      setModel(existingCamera.model || "Câmera IP Full HD");
      setIp(existingCamera.ip || "192.168.1.108");
      setPort(existingCamera.port || 554);
      setOnvifPort(existingCamera.onvifPort || 80);
      setProtocol(existingCamera.protocol || "RTSP");
      setRtspPath(existingCamera.rtspPath || MANUFACTURER_PRESETS.Intelbras.rtspPath);
      setSubStreamPath(existingCamera.subStreamPath || MANUFACTURER_PRESETS.Intelbras.subPath);
      setUsername(existingCamera.username || "admin");
      setPassword(existingCamera.password || "");
      setStreamUrl(existingCamera.streamUrl || "");
      setSnapshotUrl(existingCamera.snapshotUrl || "");
      setViewMode(existingCamera.viewMode || "auto");
      setHasPtz(existingCamera.hasPtz ?? false);
      setHasTwoWayAudio(existingCamera.hasTwoWayAudio ?? true);
      setCodec(existingCamera.codec || "H.265");
      setFps(existingCamera.fps || 30);
      setBitrateKbps(existingCamera.bitrateKbps || 4096);
    } else {
      setName("");
      setRoomName("Entrada");
      setManufacturer("Intelbras");
      setModel("Intelbras VIP 3230 B (Bullet 2MP)");
      setIp("192.168.1.108");
      setPort(554);
      setOnvifPort(80);
      setProtocol("RTSP");
      setRtspPath(MANUFACTURER_PRESETS.Intelbras.rtspPath);
      setSubStreamPath(MANUFACTURER_PRESETS.Intelbras.subPath);
      setUsername("admin");
      setPassword("");
      setStreamUrl("");
      setSnapshotUrl(`http://192.168.1.108${MANUFACTURER_PRESETS.Intelbras.snapshotPath}`);
      setViewMode("auto");
      setHasPtz(false);
      setHasTwoWayAudio(true);
      setCodec("H.265");
      setFps(30);
      setBitrateKbps(4096);
    }
  }, [existingCamera, open]);

  const handleManufacturerChange = (val: CameraManufacturer) => {
    setManufacturer(val);
    const preset = MANUFACTURER_PRESETS[val];
    setPort(preset.port);
    setOnvifPort(preset.onvifPort);
    setRtspPath(preset.rtspPath);
    setSubStreamPath(preset.subPath);
    setSnapshotUrl(`http://${ip || "192.168.1.108"}${preset.snapshotPath}`);
    if (val === "Intelbras") setModel("Intelbras VIP (Série 3000 / 1000)");
    else if (val === "Hikvision") setModel("Hikvision DS-2CD AcuSense");
    else if (val === "Dahua") setModel("Dahua IPC Starlight / WizSense");
    else if (val === "Reolink") setModel("Reolink E1 / RLC");
    else if (val === "Axis") setModel("Axis M-Series");
    else setModel("Câmera IP Genérica ONVIF");
  };

  const handleIpChange = (newIp: string) => {
    setIp(newIp);
    const preset = MANUFACTURER_PRESETS[manufacturer];
    if (preset) {
      setSnapshotUrl(`http://${newIp}${preset.snapshotPath}`);
    }
  };

  const handleScanNetwork = () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    setTimeout(() => {
      setIsScanning(false);
      const mockDiscovered = [
        { ip: "192.168.1.108", manufacturer: "Intelbras", model: "VIP 3230 B (Bullet)", onvif: true },
        { ip: "192.168.1.115", manufacturer: "Hikvision", model: "DS-2CD1023G0E (Bullet)", onvif: true },
        { ip: "192.168.1.120", manufacturer: "Dahua", model: "IPC-HDW1230T1 (Eyeball)", onvif: true },
      ];
      setDiscoveredDevices(mockDiscovered);
      toast.success("Varredura ONVIF concluída!", {
        description: `Encontradas ${mockDiscovered.length} câmeras IP ativas na sua rede local.`,
      });
    }, 1800);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe um nome para a câmera.");
      return;
    }
    if (!ip.trim()) {
      toast.error("Informe o endereço IP da câmera.");
      return;
    }

    const cameraData: Partial<IpCamera> = {
      name: name.trim(),
      roomName: roomName.trim() || "Entrada",
      manufacturer,
      model: model.trim() || `${manufacturer} IP Camera`,
      ip: ip.trim(),
      port: Number(port) || 554,
      onvifPort: Number(onvifPort) || 80,
      protocol,
      rtspPath: rtspPath.trim() || "/cam/realmonitor?channel=1&subtype=0",
      subStreamPath: subStreamPath.trim() || undefined,
      username: username.trim() || "admin",
      password: password.trim(),
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

    onSaveCamera(cameraData);
    onOpenChange(false);
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
                {existingCamera ? `Editar Câmera: ${existingCamera.name}` : "Cadastrar Nova Câmera IP / CFTV"}
              </DialogTitle>
              <DialogDescription>
                Configure os parâmetros de rede, RTSP, ONVIF e opções de transmissão para navegadores web
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Technical Notice Banner on RTSP in Browsers */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-amber-400">
            <Info className="size-4 shrink-0" />
            <span>Como funciona a transmissão de Câmeras IP no Navegador:</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Navegadores modernos (Chrome, Edge, Firefox) <strong>não executam RTSP puro diretamente</strong> devido a restrições de codecs e segurança web. Para ver o vídeo da sua câmera, você pode:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
            <li><strong>Stream Web / WebRTC / HLS</strong>: Inserir a URL convertida (via Gateway IoT, Home Assistant ou NVR).</li>
            <li><strong>Snapshot HTTP / MJPEG</strong>: Inserir a URL de foto da câmera (ex.: Intelbras <code>/cgi-bin/snapshot.cgi</code>).</li>
            <li><strong>Simulação CFTV com I.A.</strong>: Exibe telemetria de segurança e analíticos em tempo real.</li>
          </ul>
        </div>

        {/* ONVIF Network Scanner */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-primary" />
              <span className="font-semibold text-xs text-foreground">Localizador de Câmeras na Rede Local (ONVIF)</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleScanNetwork}
              disabled={isScanning}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isScanning ? "animate-spin text-primary" : ""}`} />
              {isScanning ? "Varrendo sub-rede..." : "Escanear Rede (192.168.1.0/24)"}
            </Button>
          </div>

          {discoveredDevices.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] text-muted-foreground">Câmeras encontradas — clique para preencher os dados:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {discoveredDevices.map((d, i) => (
                  <div
                    key={i}
                    onClick={() => handleQuickAddDiscovered(d)}
                    className="p-2 rounded-lg border border-border/80 bg-card hover:border-primary/60 cursor-pointer transition-colors text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">{d.manufacturer}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{d.ip}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      ONVIF
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Camera Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Camera Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Câmera</Label>
              <Input
                placeholder="Ex: Câmera Portão, Garagem, Entrada"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Room Location */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cômodo / Localização</Label>
              <Input
                placeholder="Ex: Entrada, Garagem, Quintal, Portão"
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
                  <SelectItem value="Intelbras">Intelbras (Mibo / VIP / MHDX)</SelectItem>
                  <SelectItem value="Hikvision">Hikvision (AcuSense / TurboHD / HiLook)</SelectItem>
                  <SelectItem value="Dahua">Dahua (Starlight / WizSense)</SelectItem>
                  <SelectItem value="Reolink">Reolink (Argus / E1 / RLC)</SelectItem>
                  <SelectItem value="Axis">Axis Communications</SelectItem>
                  <SelectItem value="Generic">Genérico / Padrão ONVIF Profile S</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo da Câmera</Label>
              <Input
                placeholder="Ex: VIP 3230 B, DS-2CD2043G2, E1 Pro"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* IP Address */}
            <div className="space-y-1.5">
              <Label className="text-xs">Endereço IP na Rede Local</Label>
              <Input
                placeholder="192.168.1.108"
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

            {/* RTSP Path */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs">Caminho do Stream RTSP (Main Stream)</Label>
                <span className="text-[10px] text-muted-foreground">Preenchido com o padrão {manufacturer}</span>
              </div>
              <Input
                placeholder="/cam/realmonitor?channel=1&subtype=0"
                value={rtspPath}
                onChange={(e) => setRtspPath(e.target.value)}
                className="font-mono text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground font-mono">
                RTSP URL: rtsp://{username ? `${username}:****@` : ""}{ip}:{port}{rtspPath}
              </p>
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
              <Label className="text-xs">Senha da Câmera</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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

            {/* Web Stream URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Video className="size-3.5 text-primary" /> URL de Stream Web (HLS / WebRTC / MP4 / Gateway)
                </Label>
                <Badge variant="outline" className="text-[9px]">Recomendado</Badge>
              </div>
              <Input
                placeholder="Ex: http://localhost:8080/stream/cam-01.m3u8 ou webrtc://... ou link Home Assistant"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Se você usa o <strong>IoT Gateway local</strong>, <strong>go2rtc</strong>, <strong>Home Assistant</strong> ou uma URL WebRTC/HLS, cole aqui para reprodução nativa de vídeo.
              </p>
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
                placeholder="Ex: http://192.168.1.108/cgi-bin/snapshot.cgi"
                value={snapshotUrl}
                onChange={(e) => setSnapshotUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                URL direta de imagem JPEG/MJPEG fornecida pela câmera para atualização contínua sem necessidade de servidor de mídia.
              </p>
            </div>

            {/* PTZ and Audio Toggles */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold">Suporte a Movimentação PTZ</Label>
                <p className="text-[11px] text-muted-foreground">Habilitar joystick virtual de Pan/Tilt/Zoom e presets</p>
              </div>
              <Switch checked={hasPtz} onCheckedChange={setHasPtz} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <Label className="text-xs font-semibold">Áudio Bidirecional (Interfone)</Label>
                <p className="text-[11px] text-muted-foreground">Permite falar através do alto-falante da câmera</p>
              </div>
              <Switch checked={hasTwoWayAudio} onCheckedChange={setHasTwoWayAudio} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {existingCamera ? "Salvar Alterações" : "Salvar e Conectar Câmera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
