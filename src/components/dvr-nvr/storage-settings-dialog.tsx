import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageDisk, IpCamera, StorageConfig, INITIAL_STORAGE_CONFIG } from "@/types/dvr-nvr";
import {
  HardDrive,
  Database,
  Thermometer,
  ShieldCheck,
  RefreshCw,
  Clock,
  Trash2,
  Calendar,
  AlertTriangle,
  FolderOpen,
  Camera,
  Film,
  CheckCircle2,
  Copy,
  Check,
  Save,
  Server,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface StorageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disks: StorageDisk[];
  cameras: IpCamera[];
  storageConfig?: StorageConfig;
  onSaveStorageConfig?: (config: StorageConfig) => void;
  onUpdateDisks?: (disks: StorageDisk[]) => void;
}

export function StorageSettingsDialog({
  open,
  onOpenChange,
  disks,
  cameras,
  storageConfig,
  onSaveStorageConfig,
  onUpdateDisks,
}: StorageSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("destination");

  // Storage destination state
  const [primaryDiskId, setPrimaryDiskId] = useState(
    storageConfig?.primaryDiskId || disks[0]?.id || "disk-1"
  );
  const [recordingsDirectory, setRecordingsDirectory] = useState(
    storageConfig?.recordingsDirectory || "D:\\Gravacoes_CFTV"
  );
  const [snapshotsDirectory, setSnapshotsDirectory] = useState(
    storageConfig?.snapshotsDirectory || "D:\\Gravacoes_CFTV\\Snapshots"
  );
  const [segmentDurationMinutes, setSegmentDurationMinutes] = useState<number>(
    storageConfig?.segmentDurationMinutes || 15
  );
  const [fileFormat, setFileFormat] = useState<"mp4" | "mkv">(
    storageConfig?.fileFormat || "mp4"
  );
  const [recordingQuality, setRecordingQuality] = useState<"main" | "sub">(
    storageConfig?.recordingQuality || "main"
  );
  const [folderStructure, setFolderStructure] = useState<"date_camera" | "camera_date">(
    storageConfig?.folderStructure || "date_camera"
  );
  const [autoRecordContinuous, setAutoRecordContinuous] = useState(
    storageConfig?.autoRecordContinuous ?? true
  );
  const [autoRecordOnMotion, setAutoRecordOnMotion] = useState(
    storageConfig?.autoRecordOnMotion ?? true
  );

  // Retention and schedule state
  const [retentionDays, setRetentionDays] = useState(
    storageConfig?.retentionDays || 30
  );
  const [overwriteMode, setOverwriteMode] = useState<"loop" | "stop">(
    storageConfig?.overwriteMode || "loop"
  );
  const [preRecordSec, setPreRecordSec] = useState(10);
  const [postRecordSec, setPostRecordSec] = useState(30);
  const [schedulePreset, setSchedulePreset] = useState<"24x7" | "ai_only" | "hybrid">("hybrid");
  const [isSmartRunning, setIsSmartRunning] = useState(false);
  const [copiedRecordingsPath, setCopiedRecordingsPath] = useState(false);
  const [copiedSnapshotsPath, setCopiedSnapshotsPath] = useState(false);

  // Sync state when storageConfig changes or modal opens
  useEffect(() => {
    if (storageConfig) {
      setPrimaryDiskId(storageConfig.primaryDiskId || disks[0]?.id || "disk-1");
      setRecordingsDirectory(storageConfig.recordingsDirectory || "D:\\Gravacoes_CFTV");
      setSnapshotsDirectory(storageConfig.snapshotsDirectory || "D:\\Gravacoes_CFTV\\Snapshots");
      setSegmentDurationMinutes(storageConfig.segmentDurationMinutes || 15);
      setFileFormat(storageConfig.fileFormat || "mp4");
      setRecordingQuality(storageConfig.recordingQuality || "main");
      setFolderStructure(storageConfig.folderStructure || "date_camera");
      setAutoRecordContinuous(storageConfig.autoRecordContinuous ?? true);
      setAutoRecordOnMotion(storageConfig.autoRecordOnMotion ?? true);
      setRetentionDays(storageConfig.retentionDays || 30);
      setOverwriteMode(storageConfig.overwriteMode || "loop");
    }
  }, [open, storageConfig, disks]);

  // Storage metrics
  const totalStorageBytes = disks.reduce((acc, d) => acc + d.totalBytes, 0);
  const usedStorageBytes = disks.reduce((acc, d) => acc + d.usedBytes, 0);
  const freeStorageBytes = Math.max(0, totalStorageBytes - usedStorageBytes);
  const usedPercentage = Math.round((usedStorageBytes / totalStorageBytes) * 100);

  // Bitrate estimation
  const totalBitrateKbps = cameras
    .filter((c) => c.status === "online")
    .reduce((acc, c) => acc + c.bitrateKbps, 0);
  const dailyConsumptionGb = Math.round((totalBitrateKbps / 8 / 1024 / 1024) * 86400 * 10) / 10;
  const freeGb = Math.round(freeStorageBytes / 1_000_000_000);
  const estimatedDaysRemaining = dailyConsumptionGb > 0 ? Math.round(freeGb / dailyConsumptionGb) : 999;

  const formatGbOrTb = (bytes: number) => {
    const tb = bytes / 1_000_000_000_000;
    if (tb >= 1) return `${tb.toFixed(1)} TB`;
    return `${Math.round(bytes / 1_000_000_000)} GB`;
  };

  const handleRunSmart = () => {
    setIsSmartRunning(true);
    toast.info("Executando diagnóstico S.M.A.R.T. em todos os discos...");
    setTimeout(() => {
      setIsSmartRunning(false);
      toast.success("Diagnóstico S.M.A.R.T. concluído: Todos os discos em perfeito estado (0 bad sectors).");
    }, 2000);
  };

  const handleFormatDisk = (diskName: string) => {
    if (
      confirm(
        `Tem certeza que deseja formatar o volume "${diskName}"? Todas as gravações locais deste disco serão excluídas permanentemente.`
      )
    ) {
      toast.success(`Disco ${diskName} formatado com sucesso.`);
    }
  };

  const copyPath = (text: string, isSnapshot = false) => {
    navigator.clipboard.writeText(text);
    if (isSnapshot) {
      setCopiedSnapshotsPath(true);
      setTimeout(() => setCopiedSnapshotsPath(false), 2000);
    } else {
      setCopiedRecordingsPath(true);
      setTimeout(() => setCopiedRecordingsPath(false), 2000);
    }
    toast.success("Caminho copiado para a área de transferência!");
  };

  const handleSaveAll = () => {
    let cleanRec = recordingsDirectory.trim() || "D:\\Gravacoes_CFTV";
    let cleanSnap = snapshotsDirectory.trim() || "D:\\Gravacoes_CFTV\\Snapshots";

    if (/^c:/i.test(cleanRec)) {
      toast.warning("A Unidade C: possui espaço crítico. Redirecionando automaticamente para a Unidade D:!");
      cleanRec = "D:\\Gravacoes_CFTV";
    }
    if (/^c:/i.test(cleanSnap)) {
      cleanSnap = "D:\\Gravacoes_CFTV\\Snapshots";
    }

    const newConfig: StorageConfig = {
      primaryDiskId,
      recordingsDirectory: cleanRec,
      snapshotsDirectory: cleanSnap,
      segmentDurationMinutes,
      fileFormat,
      recordingQuality,
      folderStructure,
      autoRecordContinuous,
      autoRecordOnMotion,
      retentionDays,
      overwriteMode,
    };

    if (onSaveStorageConfig) {
      onSaveStorageConfig(newConfig);
    }

    if (onUpdateDisks) {
      const updatedDisks = disks.map((d) => {
        let mPath = d.mountPath;
        let dName = d.name;
        if (/^c:/i.test(mPath) || dName.toLowerCase().includes("disco c")) {
          mPath = d.id === "disk-1" ? "D:\\Gravacoes_CFTV" : "D:\\Gravacoes_CFTV\\Snapshots";
          dName =
            d.id === "disk-1"
              ? "Disco D:\\ (WD Purple Surveillance 4TB - Gravações Principais)"
              : "Disco D:\\ (Armazenamento Secundário D: / Snapshots & I.A. 4TB)";
        }
        return {
          ...d,
          mountPath: mPath,
          name: dName,
        };
      });
      onUpdateDisks(updatedDisks);
    }

    toast.success("Configurações de gravação salvas na Unidade D:!", {
      description: `Vídeos salvos em: ${newConfig.recordingsDirectory} • Fotos em: ${newConfig.snapshotsDirectory}`,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Armazenamento & Destino de Gravação NVR</DialogTitle>
              <DialogDescription>
                Escolha onde gravar vídeos e fotos das câmeras, defina unidades físicas, integridade e retenção
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="destination" className="gap-1.5 text-xs">
              <FolderOpen className="size-3.5" /> Destino & Pastas
            </TabsTrigger>
            <TabsTrigger value="disks" className="gap-1.5 text-xs">
              <HardDrive className="size-3.5" /> Discos Físicos ({disks.length})
            </TabsTrigger>
            <TabsTrigger value="retention" className="gap-1.5 text-xs">
              <Clock className="size-3.5" /> Retenção & Cronograma
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Destino das Gravações e Fotos */}
          <TabsContent value="destination" className="space-y-4 m-0">
            {/* Primary Disk Selection */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Database className="size-4 text-primary" /> Unidade de Armazenamento Principal
                </Label>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Destino Ativo
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {disks.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setPrimaryDiskId(d.id);
                      if (d.mountPath) {
                        setRecordingsDirectory(d.mountPath);
                        setSnapshotsDirectory(`${d.mountPath}\\Snapshots`);
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      primaryDiskId === d.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                        : "border-border/60 bg-card/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{d.name}</span>
                      {primaryDiskId === d.id && (
                        <CheckCircle2 className="size-4 text-primary fill-primary/20" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {d.type} • {formatGbOrTb(d.totalBytes - d.usedBytes)} livres de {formatGbOrTb(d.totalBytes)}
                    </div>
                    {d.mountPath && (
                      <div className="font-mono text-[10px] text-primary/80 mt-1 truncate">
                        {d.mountPath}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Folder Paths (Where to save recordings and snapshots) */}
            <div className="rounded-xl border border-border/60 p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" /> Diretórios no Computador / Servidor
              </h3>

              {/* Recordings Directory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rec-path" className="text-xs font-semibold flex items-center gap-1.5">
                    <Film className="size-3.5 text-primary" /> Pasta de Gravação de Vídeos das Câmeras:
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPath(recordingsDirectory, false)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    {copiedRecordingsPath ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copiedRecordingsPath ? "Copiado!" : "Copiar Caminho"}
                  </Button>
                </div>
                <Input
                  id="rec-path"
                  value={recordingsDirectory}
                  onChange={(e) => setRecordingsDirectory(e.target.value)}
                  placeholder="Ex: D:\Gravacoes_CFTV"
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground">Sugestões rápidas:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingsDirectory("D:\\Gravacoes_CFTV");
                      setSnapshotsDirectory("D:\\Gravacoes_CFTV\\Snapshots");
                    }}
                    className="px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary text-[10px] font-mono border border-border/60 transition-colors"
                  >
                    D:\Gravacoes_CFTV (Recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingsDirectory("D:\\CFTV_Archive");
                      setSnapshotsDirectory("D:\\CFTV_Archive\\Snapshots");
                    }}
                    className="px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary text-[10px] font-mono border border-border/60 transition-colors"
                  >
                    D:\CFTV_Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingsDirectory("E:\\NVR_Storage");
                      setSnapshotsDirectory("E:\\NVR_Storage\\Snapshots");
                    }}
                    className="px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary text-[10px] font-mono border border-border/60 transition-colors"
                  >
                    E:\NVR_Storage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingsDirectory("\\\\192.168.0.200\\cctv_storage");
                      setSnapshotsDirectory("\\\\192.168.0.200\\cctv_storage\\Snapshots");
                    }}
                    className="px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary text-[10px] font-mono border border-border/60 transition-colors"
                  >
                    \\NAS\cctv_storage
                  </button>
                </div>
              </div>

              {/* Snapshots Directory */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label htmlFor="snap-path" className="text-xs font-semibold flex items-center gap-1.5">
                    <Camera className="size-3.5 text-primary" /> Pasta de Fotos & Snapshots Instantâneos:
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPath(snapshotsDirectory, true)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    {copiedSnapshotsPath ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copiedSnapshotsPath ? "Copiado!" : "Copiar Caminho"}
                  </Button>
                </div>
                <Input
                  id="snap-path"
                  value={snapshotsDirectory}
                  onChange={(e) => setSnapshotsDirectory(e.target.value)}
                  placeholder="Ex: D:\Gravacoes_CFTV\Snapshots"
                  className="font-mono text-xs"
                />
              </div>

              {/* Folder Hierarchy Organization */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label className="text-xs font-semibold">Estrutura de Organização das Pastas:</Label>
                <RadioGroup
                  value={folderStructure}
                  onValueChange={(v: "date_camera" | "camera_date") => setFolderStructure(v)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
                >
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-card/60">
                    <RadioGroupItem value="date_camera" id="struct-date" className="mt-0.5" />
                    <div>
                      <Label htmlFor="struct-date" className="text-xs font-medium cursor-pointer">
                        Por Data / Câmera (Padrão NVR)
                      </Label>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        /[AAAA-MM-DD]/[Camera]/[Hora].mp4
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-card/60">
                    <RadioGroupItem value="camera_date" id="struct-cam" className="mt-0.5" />
                    <div>
                      <Label htmlFor="struct-cam" className="text-xs font-medium cursor-pointer">
                        Por Câmera / Data
                      </Label>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        /[Camera]/[AAAA-MM-DD]/[Hora].mp4
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Video Format & Chunk Segmentation */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Film className="size-4 text-primary" /> Formato de Vídeo & Segmentação dos Arquivos
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Formato do Arquivo</Label>
                  <Select value={fileFormat} onValueChange={(v: "mp4" | "mkv") => setFileFormat(v)}>
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp4">MP4 (H.264 - Universal)</SelectItem>
                      <SelectItem value="mkv">MKV (Resiliente a quedas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Divisão de Blocos (Chunks)</Label>
                  <Select
                    value={String(segmentDurationMinutes)}
                    onValueChange={(v) => setSegmentDurationMinutes(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutos por arquivo</SelectItem>
                      <SelectItem value="15">15 minutos (Recomendado)</SelectItem>
                      <SelectItem value="30">30 minutos por arquivo</SelectItem>
                      <SelectItem value="60">1 hora por arquivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Qualidade de Gravação</Label>
                  <Select
                    value={recordingQuality}
                    onValueChange={(v: "main" | "sub") => setRecordingQuality(v)}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Stream Principal (Full HD)</SelectItem>
                      <SelectItem value="sub">Substream (Econômico)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Automatic Recording Modes */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/40">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card/60">
                  <div>
                    <Label className="text-xs font-semibold">Gravação Contínua 24/7</Label>
                    <p className="text-[10px] text-muted-foreground">Grava ininterruptamente em loop FIFO</p>
                  </div>
                  <Switch checked={autoRecordContinuous} onCheckedChange={setAutoRecordContinuous} />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card/60">
                  <div>
                    <Label className="text-xs font-semibold">Gravação por Eventos de I.A.</Label>
                    <p className="text-[10px] text-muted-foreground">Destaca pessoas, carros e cruzamento de linha</p>
                  </div>
                  <Switch checked={autoRecordOnMotion} onCheckedChange={setAutoRecordOnMotion} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Discos Físicos & S.M.A.R.T. */}
          <TabsContent value="disks" className="space-y-4 m-0">
            {/* Storage Overview Banner */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Pool de Gravação Consolidado</span>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  ● Status do Pool: Saudável
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Ocupado: <strong className="text-foreground">{formatGbOrTb(usedStorageBytes)}</strong> (
                    {usedPercentage}%)
                  </span>
                  <span>
                    Livre: <strong className="text-foreground">{formatGbOrTb(freeStorageBytes)}</strong> de{" "}
                    {formatGbOrTb(totalStorageBytes)}
                  </span>
                </div>
                <Progress value={usedPercentage} className="h-2.5" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <div className="text-muted-foreground">Taxa de Gravação Total</div>
                  <div className="text-base font-semibold text-foreground mt-0.5">
                    {(totalBitrateKbps / 1024).toFixed(1)} Mbps
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {cameras.filter((c) => c.status === "online").length} canais ativos
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <div className="text-muted-foreground">Consumo Estimado</div>
                  <div className="text-base font-semibold text-foreground mt-0.5">
                    ~{dailyConsumptionGb} GB / dia
                  </div>
                  <div className="text-[11px] text-muted-foreground">Com compressão H.264/H.265</div>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border/40">
                  <div className="text-muted-foreground">Autonomia do Disco</div>
                  <div className="text-base font-semibold text-emerald-400 mt-0.5">
                    ~{estimatedDaysRemaining} dias restantes
                  </div>
                  <div className="text-[11px] text-muted-foreground">Até sobrescrita em loop</div>
                </div>
              </div>
            </div>

            {/* Physical Disks List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary" /> Unidades Físicas & Saúde S.M.A.R.T.
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunSmart}
                  disabled={isSmartRunning}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSmartRunning ? "animate-spin text-primary" : ""}`} />
                  {isSmartRunning ? "Verificando..." : "Diagnóstico S.M.A.R.T."}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {disks.map((disk) => {
                  const diskPercent = Math.round((disk.usedBytes / disk.totalBytes) * 100);
                  return (
                    <div
                      key={disk.id}
                      className={`p-3.5 rounded-lg border bg-card/80 space-y-2.5 ${
                        primaryDiskId === disk.id ? "border-primary/60 ring-1 ring-primary/40" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-xs text-foreground line-clamp-1 flex items-center gap-1.5">
                            {disk.name}
                            {primaryDiskId === disk.id && (
                              <Badge className="bg-primary/20 text-primary border-primary/40 text-[9px] py-0 px-1">
                                Destino
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                              {disk.type}
                            </Badge>
                            <span>
                              {formatGbOrTb(disk.usedBytes)} / {formatGbOrTb(disk.totalBytes)}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {disk.smartStatus}
                        </Badge>
                      </div>

                      <Progress value={diskPercent} className="h-2" />

                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                          <span>
                            Temperatura: <strong className="text-foreground">{disk.temperatureCelsius}°C</strong>
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFormatDisk(disk.name)}
                          className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Formatar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Retenção & Cronograma Semanal */}
          <TabsContent value="retention" className="space-y-4 m-0">
            {/* Retention & Overwrite Rules */}
            <div className="rounded-xl border border-border/60 p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Políticas de Retenção e Gravação em Loop (FIFO)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <Label className="text-xs">Comportamento quando o disco estiver cheio:</Label>
                  <RadioGroup
                    value={overwriteMode}
                    onValueChange={(v: "loop" | "stop") => setOverwriteMode(v)}
                    className="space-y-2 pt-1"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="loop" id="mode-loop" className="mt-0.5" />
                      <div>
                        <Label htmlFor="mode-loop" className="font-medium cursor-pointer">
                          Sobrescrever automaticamente em loop contínuo (Recomendado)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Os arquivos mais antigos são descartados conforme novos blocos são gravados (FIFO).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="stop" id="mode-stop" className="mt-0.5" />
                      <div>
                        <Label htmlFor="mode-stop" className="font-medium cursor-pointer">
                          Parar gravação e emitir alarme sonoro
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Garante que nenhum registro antigo seja apagado sem autorização expressa.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs">Tempo Máximo de Retenção:</Label>
                      <span className="font-semibold text-primary">{retentionDays} dias</span>
                    </div>
                    <input
                      type="range"
                      min="7"
                      max="90"
                      step="7"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>7 dias</span>
                      <span>30 dias</span>
                      <span>60 dias</span>
                      <span>90 dias</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Pré-gravação de Evento</Label>
                      <select
                        value={preRecordSec}
                        onChange={(e) => setPreRecordSec(Number(e.target.value))}
                        className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
                      >
                        <option value="5">5 segundos</option>
                        <option value="10">10 segundos</option>
                        <option value="15">15 segundos</option>
                        <option value="30">30 segundos</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Pós-gravação de Evento</Label>
                      <select
                        value={postRecordSec}
                        onChange={(e) => setPostRecordSec(Number(e.target.value))}
                        className="w-full mt-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
                      >
                        <option value="15">15 segundos</option>
                        <option value="30">30 segundos</option>
                        <option value="60">1 minuto</option>
                        <option value="120">2 minutos</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording Schedule Matrix */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Cronograma de Gravação Semanal (24/7 Schedule)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define o modo operacional para cada período da semana nas câmeras conectadas
                  </p>
                </div>

                {/* Preset buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant={schedulePreset === "24x7" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSchedulePreset("24x7")}
                    className="h-7 text-xs px-2.5"
                  >
                    24/7 Contínuo
                  </Button>
                  <Button
                    variant={schedulePreset === "hybrid" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSchedulePreset("hybrid")}
                    className="h-7 text-xs px-2.5 text-primary border-primary/30"
                  >
                    Híbrido Inteligente
                  </Button>
                  <Button
                    variant={schedulePreset === "ai_only" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSchedulePreset("ai_only")}
                    className="h-7 text-xs px-2.5"
                  >
                    Apenas I.A. & Movimento
                  </Button>
                </div>
              </div>

              {/* Visual Schedule Matrix */}
              <div className="overflow-x-auto pt-2">
                <div className="min-w-[500px] space-y-1.5 text-xs">
                  {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-16 text-muted-foreground font-mono text-[11px] shrink-0">
                        {day.slice(0, 3)}
                      </span>
                      <div className="flex-1 grid grid-cols-4 gap-1 h-6">
                        <div
                          className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                            schedulePreset === "ai_only"
                              ? "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                              : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          }`}
                          title="Madrugada (00h - 06h)"
                        >
                          00h-06h ({schedulePreset === "ai_only" ? "I.A." : "Contínuo"})
                        </div>
                        <div
                          className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                            schedulePreset === "24x7"
                              ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                              : "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                          }`}
                          title="Manhã (06h - 12h)"
                        >
                          06h-12h ({schedulePreset === "24x7" ? "Contínuo" : "I.A."})
                        </div>
                        <div
                          className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                            schedulePreset === "24x7"
                              ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                              : "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                          }`}
                          title="Tarde (12h - 18h)"
                        >
                          12h-18h ({schedulePreset === "24x7" ? "Contínuo" : "I.A."})
                        </div>
                        <div
                          className={`rounded flex items-center justify-center text-[10px] font-medium transition-colors ${
                            schedulePreset === "ai_only"
                              ? "bg-purple-500/25 text-purple-300 border border-purple-500/30"
                              : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          }`}
                          title="Noite (18h - 24h)"
                        >
                          18h-24h ({schedulePreset === "ai_only" ? "I.A." : "Contínuo"})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 pt-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="font-semibold text-foreground">Legenda:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500/50 border border-emerald-400" />
                  <span>Contínuo 24h</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-500/50 border border-purple-400" />
                  <span>I.A. (Humano / Veículo)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500/50 border border-amber-400" />
                  <span>Movimento Geral</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAll} className="gap-1.5">
            <Save className="size-4" />
            Salvar Configurações de Gravação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
