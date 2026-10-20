export type CameraManufacturer = "Intelbras" | "Hikvision" | "Dahua" | "Reolink" | "Axis" | "Generic";
export type StreamProtocol = "RTSP" | "ONVIF" | "WebRTC" | "HLS" | "MJPEG";
export type RecordingMode = "continuous" | "motion" | "ai" | "disabled";

export interface IpCamera {
  id: string;
  name: string;
  roomName: string;
  ip: string;
  port: number;
  onvifPort?: number;
  manufacturer: CameraManufacturer;
  model: string;
  protocol: StreamProtocol;
  rtspPath: string;
  subStreamPath?: string;
  username: string;
  password?: string;
  resolution: string;
  fps: number;
  bitrateKbps: number;
  codec: "H.265" | "H.264" | "MJPEG";
  status: "online" | "offline" | "connecting";
  hasPtz: boolean;
  hasTwoWayAudio: boolean;
  hasNightVision: boolean;
  nightVisionActive?: boolean;
  recordingMode: RecordingMode;
  aiFeatures: {
    motionDetection: boolean;
    humanDetection: boolean;
    vehicleDetection: boolean;
    lineCrossing: boolean;
    facialRecognition: boolean;
  };
  presets?: Array<{ id: number; name: string }>;
  currentPtz?: { pan: number; tilt: number; zoom: number };
  streamUrl?: string; // Direct WebRTC, HLS (.m3u8), MP4 or HTTP/HTTPS proxy stream
  snapshotUrl?: string; // Direct HTTP snapshot (e.g. /cgi-bin/snapshot.cgi)
  viewMode?: "auto" | "stream" | "snapshot" | "simulation"; // Display mode preference
  haEntityId?: string; // Optional Home Assistant camera entity (e.g. camera.portao)
  streamName?: string; // Slug/Identifier in media gateway (e.g. garagem_rua)
  gatewayHost?: string; // Media gateway host:port (default: localhost:1984)
  activeProtocol?: "WebRTC" | "MSE" | "HLS" | "Snapshot"; // Real protocol used by player
  lastFrameAt?: string; // ISO timestamp of last received frame
  measuredLatencyMs?: number; // Measured latency in ms
  lensCount?: number; // Multi-lens count: 1 (standard), 2 (dual), 3 (triple 3-in-1), 4 (quad)
  selectedLens?: number; // 0 = all/composite, 1 = lens 1 (top), 2 = lens 2 (middle), 3 = lens 3 (bottom)
  splitLensesIntoGrid?: boolean; // Whether to expand into multiple individual screens in the DVR grid
}

export interface NvrRecording {
  id: string;
  cameraId: string;
  cameraName: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  durationSeconds: number;
  type: "continuous" | "motion" | "ai_person" | "ai_vehicle" | "manual";
  fileSizeBytes: number;
  thumbnailUrl?: string;
  locked: boolean;
}

export interface AuthorizedPerson {
  id: string;
  name: string;
  role: "morador" | "familiar" | "visitante" | "prestador";
  avatarUrl?: string;
  photoData?: string; // base64 da foto cadastrada
  enrolledAt: string;
  accessLevel: "total" | "parcial" | "horario_comercial";
  notifyOnDetection: boolean;
  notes?: string;
  lastSeenTimestamp?: string;
  lastSeenCamera?: string;
}

export const INITIAL_AUTHORIZED_PERSONS: AuthorizedPerson[] = [
  {
    id: "person-01",
    name: "Eduardo (Morador)",
    role: "morador",
    enrolledAt: "2026-10-15T10:00:00Z",
    accessLevel: "total",
    notifyOnDetection: false,
    lastSeenTimestamp: "Hoje às 11:35",
    lastSeenCamera: "Garagem Rua",
    notes: "Acesso total à residência, alarmes e portões automáticos",
  },
  {
    id: "person-02",
    name: "Família / Convidado",
    role: "familiar",
    enrolledAt: "2026-10-16T14:30:00Z",
    accessLevel: "total",
    notifyOnDetection: true,
    lastSeenTimestamp: "Hoje às 09:12",
    lastSeenCamera: "Câmera Tripla — Lente 1",
    notes: "Notificar celular ao chegar",
  },
  {
    id: "person-03",
    name: "Prestador de Serviço",
    role: "prestador",
    enrolledAt: "2026-10-18T08:00:00Z",
    accessLevel: "horario_comercial",
    notifyOnDetection: true,
    lastSeenTimestamp: "Ontem às 15:40",
    lastSeenCamera: "Câmera IP (192.168.0.198)",
    notes: "Acesso autorizado apenas entre 08h e 17h",
  },
];

export interface AiSecurityEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  type: "human" | "vehicle" | "motion" | "tripwire" | "tamper" | "face_recognized" | "face_unknown";
  confidence: number;
  description: string;
  snapshotUrl?: string;
  acknowledged: boolean;
  personName?: string;
  personRole?: "morador" | "familiar" | "visitante" | "prestador" | "desconhecido";
  faceBox?: { x: number; y: number; width: number; height: number };
}

export interface StorageDisk {
  id: string;
  name: string;
  type: "SATA" | "NVMe" | "NAS / NFS" | "Cloud";
  totalBytes: number;
  usedBytes: number;
  status: "healthy" | "warning" | "error";
  temperatureCelsius: number;
  smartStatus: "PASSED" | "WARNING" | "FAILING";
  retentionDays: number;
  mountPath?: string;
}

export interface StorageConfig {
  primaryDiskId: string;
  recordingsDirectory: string;
  snapshotsDirectory: string;
  segmentDurationMinutes: number;
  fileFormat: "mp4" | "mkv";
  retentionDays: number;
  overwriteMode: "loop" | "stop";
  recordingQuality: "main" | "sub";
  autoRecordOnMotion: boolean;
  autoRecordContinuous: boolean;
  folderStructure: "date_camera" | "camera_date";
}

export const INITIAL_STORAGE_CONFIG: StorageConfig = {
  primaryDiskId: "disk-1",
  recordingsDirectory: "D:\\Gravacoes_CFTV",
  snapshotsDirectory: "D:\\Gravacoes_CFTV\\Snapshots",
  segmentDurationMinutes: 15,
  fileFormat: "mp4",
  retentionDays: 30,
  overwriteMode: "loop",
  recordingQuality: "main",
  autoRecordOnMotion: true,
  autoRecordContinuous: true,
  folderStructure: "date_camera",
};

export const INITIAL_CAMERAS: IpCamera[] = [
  {
    id: "cam-real-01",
    name: "Câmera Garagem / Rua (Ao Vivo Real)",
    roomName: "Garagem / Rua",
    ip: "192.168.0.139",
    port: 554,
    onvifPort: 80,
    manufacturer: "Generic",
    model: "Câmera IP ONVIF (/onvif1)",
    protocol: "RTSP",
    rtspPath: "/onvif1",
    subStreamPath: "/onvif2",
    username: "admin",
    password: "", // Senha protegida mantida no gateway local
    streamName: "garagem_rua",
    activeProtocol: "WebRTC",
    resolution: "1080p (1920x1080)",
    fps: 30,
    bitrateKbps: 4096,
    codec: "H.264",
    status: "online",
    hasPtz: false,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "continuous",
    viewMode: "stream",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: true,
      lineCrossing: true,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Vista Geral Rua" },
      { id: 2, name: "Portão Garagem" },
    ],
  },
  {
    id: "cam-real-240",
    name: "Câmera Tripla Multi-Lente (3 Visões)",
    roomName: "Vigilância Externa",
    ip: "192.168.0.240",
    port: 554,
    onvifPort: 5000,
    manufacturer: "Generic",
    model: "Câmera IP Tripla (3 Lentes 1920x3240)",
    protocol: "RTSP",
    rtspPath: "/onvif1",
    subStreamPath: "/onvif2",
    username: "admin",
    password: "",
    streamName: "cam_192_168_0_240",
    activeProtocol: "WebRTC",
    resolution: "3240p (1920x3240 - 3 Lentes Full HD)",
    fps: 30,
    bitrateKbps: 4096,
    codec: "H.265",
    status: "online",
    hasPtz: true,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "continuous",
    viewMode: "stream",
    lensCount: 3,
    selectedLens: 0,
    splitLensesIntoGrid: true,
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: true,
      lineCrossing: true,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Lente 1 (Superior)" },
      { id: 2, name: "Lente 2 (Central)" },
      { id: 3, name: "Lente 3 (Inferior)" },
    ],
  },
  {
    id: "cam-real-198",
    name: "Câmera Externa 198 (Ao Vivo Real)",
    roomName: "Área Externa",
    ip: "192.168.0.198",
    port: 554,
    onvifPort: 80,
    manufacturer: "Generic",
    model: "Câmera IP ONVIF (/onvif1)",
    protocol: "RTSP",
    rtspPath: "/onvif1",
    subStreamPath: "/onvif2",
    username: "admin",
    password: "",
    streamName: "cam_192_168_0_198",
    activeProtocol: "WebRTC",
    resolution: "1080p (1920x1080)",
    fps: 30,
    bitrateKbps: 4096,
    codec: "H.264",
    status: "online",
    hasPtz: false,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "continuous",
    viewMode: "stream",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: true,
      lineCrossing: true,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Vista Geral" },
    ],
  },
  {
    id: "cam-01",
    name: "Entrada & Portão Principal",
    roomName: "Entrada",
    ip: "192.168.1.101",
    port: 554,
    onvifPort: 80,
    manufacturer: "Intelbras",
    model: "VIP 3230 B G3 (Bullet 2MP)",
    protocol: "RTSP",
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    subStreamPath: "/cam/realmonitor?channel=1&subtype=1",
    username: "admin",
    resolution: "1080p (1920x1080)",
    fps: 30,
    bitrateKbps: 4096,
    codec: "H.265",
    status: "online",
    hasPtz: true,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "continuous",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: true,
      lineCrossing: true,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Portão Veicular" },
      { id: 2, name: "Portão Social / Interfone" },
      { id: 3, name: "Calçada Externa" },
    ],
  },
  {
    id: "cam-02",
    name: "Garagem Principal",
    roomName: "Garagem",
    ip: "192.168.1.102",
    port: 554,
    onvifPort: 8000,
    manufacturer: "Hikvision",
    model: "DS-2CD2043G2-I (AcuSense 4MP)",
    protocol: "ONVIF",
    rtspPath: "/Streaming/Channels/101",
    subStreamPath: "/Streaming/Channels/102",
    username: "admin",
    resolution: "2K (2560x1440)",
    fps: 30,
    bitrateKbps: 6144,
    codec: "H.265",
    status: "online",
    hasPtz: false,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "continuous",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: true,
      lineCrossing: false,
      facialRecognition: false,
    },
  },
  {
    id: "cam-03",
    name: "Quintal & Área Gourmet",
    roomName: "Quintal",
    ip: "192.168.1.103",
    port: 554,
    onvifPort: 80,
    manufacturer: "Dahua",
    model: "IPC-HFW2431S-S-S2 (Starlight 4MP)",
    protocol: "RTSP",
    rtspPath: "/cam/realmonitor?channel=1&subtype=0",
    username: "admin",
    resolution: "2K (2560x1440)",
    fps: 25,
    bitrateKbps: 4096,
    codec: "H.265",
    status: "online",
    hasPtz: true,
    hasTwoWayAudio: false,
    hasNightVision: true,
    nightVisionActive: true,
    recordingMode: "ai",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: false,
      lineCrossing: true,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Piscina" },
      { id: 2, name: "Churrasqueira" },
      { id: 3, name: "Muro dos Fundos" },
    ],
  },
  {
    id: "cam-04",
    name: "Sala de Estar PTZ 360",
    roomName: "Sala",
    ip: "192.168.1.104",
    port: 554,
    onvifPort: 8899,
    manufacturer: "Reolink",
    model: "E1 Pro (PTZ Indoor 4MP)",
    protocol: "ONVIF",
    rtspPath: "/h264Preview_01_main",
    subStreamPath: "/h264Preview_01_sub",
    username: "admin",
    resolution: "2K (2560x1440)",
    fps: 25,
    bitrateKbps: 3072,
    codec: "H.264",
    status: "online",
    hasPtz: true,
    hasTwoWayAudio: true,
    hasNightVision: true,
    nightVisionActive: false,
    recordingMode: "motion",
    aiFeatures: {
      motionDetection: true,
      humanDetection: true,
      vehicleDetection: false,
      lineCrossing: false,
      facialRecognition: false,
    },
    presets: [
      { id: 1, name: "Porta de Entrada" },
      { id: 2, name: "Sofá / Centro" },
      { id: 3, name: "Corredor Quartos" },
    ],
  },
];

export const INITIAL_DISKS: StorageDisk[] = [
  {
    id: "disk-1",
    name: "Disco D:\\ (WD Purple Surveillance 4TB - Gravações Principais)",
    type: "SATA",
    totalBytes: 4_000_000_000_000,
    usedBytes: 2_450_000_000_000,
    status: "healthy",
    temperatureCelsius: 37,
    smartStatus: "PASSED",
    retentionDays: 30,
    mountPath: "D:\\Gravacoes_CFTV",
  },
  {
    id: "disk-2",
    name: "Disco D:\\ (Armazenamento Secundário D: / Snapshots & I.A. 4TB)",
    type: "SATA",
    totalBytes: 4_000_000_000_000,
    usedBytes: 1_220_000_000_000,
    status: "healthy",
    temperatureCelsius: 36,
    smartStatus: "PASSED",
    retentionDays: 30,
    mountPath: "D:\\Gravacoes_CFTV\\Snapshots",
  },
];

export const INITIAL_AI_EVENTS: AiSecurityEvent[] = [
  {
    id: "evt-face-01",
    cameraId: "cam_garagem__main",
    cameraName: "Garagem Rua",
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    type: "face_recognized",
    confidence: 0.98,
    description: "Morador identificado: Eduardo (Reconhecimento Facial I.A. 98%)",
    personName: "Eduardo (Morador)",
    personRole: "morador",
    faceBox: { x: 0.38, y: 0.22, width: 0.16, height: 0.24 },
    acknowledged: false,
  },
  {
    id: "evt-face-02",
    cameraId: "cam_240__lens_1",
    cameraName: "Câmera Tripla — Lente 1: Superior",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    type: "face_unknown",
    confidence: 0.89,
    description: "Rosto Não Cadastrado / Desconhecido detectado em frente à residência",
    personName: "Pessoa Não Identificada",
    personRole: "desconhecido",
    faceBox: { x: 0.52, y: 0.31, width: 0.14, height: 0.22 },
    acknowledged: false,
  },
  {
    id: "evt-01",
    cameraId: "cam-01",
    cameraName: "Entrada & Portão Principal",
    timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    type: "human",
    confidence: 0.97,
    description: "Pessoa identificada aproximando-se do portão social",
    acknowledged: true,
  },
  {
    id: "evt-02",
    cameraId: "cam-02",
    cameraName: "Garagem Principal",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    type: "vehicle",
    confidence: 0.94,
    description: "Veículo entrou na área da garagem (SUV Prata)",
    acknowledged: true,
  },
  {
    id: "evt-03",
    cameraId: "cam-03",
    cameraName: "Quintal & Área Gourmet",
    timestamp: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    type: "tripwire",
    confidence: 0.91,
    description: "Alarme de Cruzamento de Linha Virtual ativado no Muro dos Fundos",
    acknowledged: true,
  },
];
