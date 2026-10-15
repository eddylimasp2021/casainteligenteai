import { useState } from "react";
import { 
  Camera, Plus, Trash2, Edit, Search, CheckCircle2, 
  AlertCircle, RefreshCw, Radio, Shield, Network, Server
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
  cameras: IpCamera[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCamera: (camera: IpCamera) => void;
  onDeleteCamera: (id: string) => void;
}

const MANUFACTURER_PRESETS: Record<CameraManufacturer, { port: number; onvifPort: number; rtspPath: string; subPath: string }> = {
  Intelbras: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    subPath: "/cam/realmonitor?channel=1&subtype=1",
  },
  Hikvision: {
    port: 554,
    onvifPort: 8000,
    rtspPath: "/Streaming/Channels/101",
    subPath: "/Streaming/Channels/102",
  },
  Dahua: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    subPath: "/cam/realmonitor?channel=1&subtype=1",
  },
  Reolink: {
    port: 554,
    onvifPort: 8000,
    rtspPath: "/h264Preview_01_main",
    subPath: "/h264Preview_01_sub",
  },
  Axis: {
    port: 554,
    onvifPort: 80,
    rtspPath: "/axis-media/media.amp",
    subPath: "/axis-media/media.amp?videocodec=h264&resolution=640x360",
  },
  Generic: {
    port: 554,
    onvifPort: 8899,
    rtspPath: "/live/ch0",
    subPath: "/live/ch1",
  },
};

export function CameraManagerDialog({
  cameras,
  open,
  onOpenChange,
  onAddCamera,
  onDeleteCamera,
}: CameraManagerDialogProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Array<{ ip: string; manufacturer: string; model: string; onvif: boolean }>>([]);

  // Form states
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("Entrada");
  const [manufacturer, setManufacturer] = useState<CameraManufacturer>("Intelbras");
  const [ip, setIp] = useState("192.168.1.105");
  const [port, setPort] = useState(554);
  const [onvifPort, setOnvifPort] = useState(80);
  const [protocol, setProtocol] = useState<StreamProtocol>("RTSP");
  const [rtspPath, setRtspPath] = useState(MANUFACTURER_PRESETS.Intelbras.rtspPath);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [hasPtz, setHasPtz] = useState(true);
  const [hasTwoWayAudio, setHasTwoWayAudio] = useState(true);

  const handleManufacturerChange = (val: CameraManufacturer) => {
    setManufacturer(val);
    const preset = MANUFACTURER_PRESETS[val];
    setPort(preset.port);
    setOnvifPort(preset.onvifPort);
    setRtspPath(preset.rtspPath);
  };

  const handleScanNetwork = () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    setTimeout(() => {
      setIsScanning(false);
      const mockDiscovered = [
        { ip: "192.168.1.110", manufacturer: "Intelbras", model: "VIP 1230 D (Dome ONVIF)", onvif: true },
        { ip: "192.168.1.115", manufacturer: "Hikvision", model: "DS-2CD1023G0E (Bullet)", onvif: true },
        { ip: "192.168.1.120", manufacturer: "Dahua", model: "IPC-HDW1230T1 (Eyeball)", onvif: true },
      ];
      setDiscoveredDevices(mockDiscovered);
      toast.success("Varredura ONVIF concluída!", {
        description: `Encontradas ${mockDiscovered.length} câmeras IP ativas na rede local.`,
      });
    }, 2000);
  };

  const handleQuickAddDiscovered = (item: { ip: string; manufacturer: string; model: string }) => {
    setName(`Câmera ${item.manufacturer} (${item.ip.split(".").pop()})`);
    setManufacturer(item.manufacturer as CameraManufacturer);
    setIp(item.ip);
    setShowAddForm(true);
  };

  const handleSaveCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) {
      toast.error("Preencha o nome e o IP da câmera.");
      return;
    }

    const newCam: IpCamera = {
      id: `cam-${Date.now()}`,
      name: name.trim(),
      roomName: roomName.trim() || "Geral",
      ip: ip.trim(),
      port,
      onvifPort,
      manufacturer,
      model: `${manufacturer} IP Camera`,
      protocol,
      rtspPath,
      username: username.trim(),
      password: password.trim(),
      resolution: "1080p (1920x1080)",
      fps: 30,
      bitrateKbps: 4096,
      codec: "H.265",
      status: "online",
      hasPtz,
      hasTwoWayAudio,
      hasNightVision: true,
      recordingMode: "continuous",
      aiFeatures: {
        motionDetection: true,
        humanDetection: true,
        vehicleDetection: true,
        lineCrossing: false,
        facialRecognition: false,
      },
    };

    onAddCamera(newCam);
    toast.success(`Câmera '${newCam.name}' adicionada com sucesso ao NVR!`);
    setShowAddForm(false);
    setName("");
    setPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Camera className="size-5 text-primary" /> Gerenciamento de Câmeras IP & ONVIF
            </DialogTitle>
          </div>
          <DialogDescription>
            Cadastre câmeras de qualquer fabricante compatíveis com RTSP e ONVIF (Profile S/G/T).
          </DialogDescription>
        </DialogHeader>

        {showAddForm ? (
          <form onSubmit={handleSaveCamera} className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Network className="size-4 text-primary" /> Parâmetros de Conexão da Câmera
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome da Câmera</Label>
                  <Input
                    placeholder="Ex: Câmera Portão Garagem"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Cômodo / Localização</Label>
                  <Input
                    placeholder="Ex: Garagem, Entrada, Quintal"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Fabricante / Marca</Label>
                  <Select value={manufacturer} onValueChange={(v) => handleManufacturerChange(v as CameraManufacturer)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intelbras">Intelbras (M系列 / VIP)</SelectItem>
                      <SelectItem value="Hikvision">Hikvision (AcuSense / TurboHD)</SelectItem>
                      <SelectItem value="Dahua">Dahua (Starlight / WizSense)</SelectItem>
                      <SelectItem value="Reolink">Reolink</SelectItem>
                      <SelectItem value="Axis">Axis Communications</SelectItem>
                      <SelectItem value="Generic">Genérico / Padrão ONVIF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Protocolo Principal</Label>
                  <Select value={protocol} onValueChange={(v) => setProtocol(v as StreamProtocol)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RTSP">RTSP (Real-Time Streaming Protocol)</SelectItem>
                      <SelectItem value="ONVIF">ONVIF (Profile S - Vídeo e PTZ)</SelectItem>
                      <SelectItem value="WebRTC">WebRTC (Ultra Baixa Latência)</SelectItem>
                      <SelectItem value="MJPEG">HTTP / MJPEG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Endereço IP Local</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Porta RTSP</Label>
                    <Input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Porta ONVIF</Label>
                    <Input
                      type="number"
                      value={onvifPort}
                      onChange={(e) => setOnvifPort(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Usuário Câmera</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Senha Câmera</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Caminho do Stream RTSP (Auto-preenchido pelo fabricante)</Label>
                <Input
                  value={rtspPath}
                  onChange={(e) => setRtspPath(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={hasPtz} onCheckedChange={setHasPtz} id="ptz-switch" />
                  <Label htmlFor="ptz-switch" className="cursor-pointer text-xs font-semibold">
                    Possui PTZ (Movimento Motorizado 360°)
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={hasTwoWayAudio} onCheckedChange={setHasTwoWayAudio} id="audio-switch" />
                  <Label htmlFor="audio-switch" className="cursor-pointer text-xs font-semibold">
                    Áudio Bidirecional (Microfone e Alto-falante)
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Câmera no NVR</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 py-2">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button onClick={() => setShowAddForm(true)} className="gap-2 font-semibold">
                <Plus className="size-4" /> Adicionar Câmera Manualmente
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={handleScanNetwork}
                disabled={isScanning}
              >
                <RefreshCw className={`size-4 ${isScanning ? "animate-spin text-primary" : ""}`} />
                {isScanning ? "Varrendo Rede Local..." : "Escanear Rede (ONVIF Discovery)"}
              </Button>
            </div>

            {/* Discovered Cameras Banner (if any) */}
            {discoveredDevices.length > 0 && (
              <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <h4 className="font-bold text-sm flex items-center gap-2 text-primary">
                  <CheckCircle2 className="size-4" /> Câmeras IP Detectadas na Rede Local
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {discoveredDevices.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs shadow-sm"
                    >
                      <div>
                        <p className="font-bold text-foreground">{item.manufacturer} • {item.model}</p>
                        <p className="font-mono text-muted-foreground">{item.ip} (ONVIF Profile S)</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs font-semibold"
                        onClick={() => handleQuickAddDiscovered(item)}
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configured Cameras List */}
            <div className="space-y-3">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Câmeras Conectadas ao NVR ({cameras.length})
              </h4>

              <div className="divide-y rounded-xl border bg-card">
                {cameras.map((c) => (
                  <div key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Camera className="size-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{c.name}</span>
                          <Badge variant="outline" className="text-[10px]">{c.roomName}</Badge>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            {c.resolution}
                          </Badge>
                          {c.hasPtz && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                              PTZ
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">
                          {c.manufacturer} • {c.ip}:{c.port} • Protocolo: {c.protocol} ({c.codec})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Remover a câmera '${c.name}' do NVR?`)) {
                            onDeleteCamera(c.id);
                            toast.success("Câmera removida.");
                          }
                        }}
                        title="Remover Câmera"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
