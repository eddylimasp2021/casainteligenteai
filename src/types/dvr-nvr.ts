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

export interface AiSecurityEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  type: "human" | "vehicle" | "motion" | "tripwire" | "tamper";
  confidence: number;
  description: string;
  snapshotUrl?: string;
  acknowledged: boolean;
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
}

export const INITIAL_CAMERAS: IpCamera[] = [
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
    name: "WD Purple Surveillance 4TB (SATA 1)",
    type: "SATA",
    totalBytes: 4_000_000_000_000,
    usedBytes: 2_450_000_000_000,
    status: "healthy",
    temperatureCelsius: 37,
    smartStatus: "PASSED",
    retentionDays: 30,
  },
  {
    id: "disk-2",
    name: "Seagate SkyHawk AI 4TB (SATA 2)",
    type: "SATA",
    totalBytes: 4_000_000_000_000,
    usedBytes: 1_820_000_000_000,
    status: "healthy",
    temperatureCelsius: 38,
    smartStatus: "PASSED",
    retentionDays: 30,
  },
];

export const INITIAL_AI_EVENTS: AiSecurityEvent[] = [
  {
    id: "evt-01",
    cameraId: "cam-01",
    cameraName: "Entrada & Portão Principal",
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    type: "human",
    confidence: 0.97,
    description: "Pessoa identificada aproximando-se do portão social",
    acknowledged: false,
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
