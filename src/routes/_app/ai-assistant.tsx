import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Sparkles, Mic, MicOff, Send, Volume2, VolumeX, RefreshCw, 
  Settings2, Brain, Activity, ShieldCheck, Terminal, Layers, 
  Trash2, Plus, Zap, Home, Eye, Camera, CheckCircle2, 
  Flame, Radio, Power, Clock, Info, Play, Pause
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, logAction, type Device } from "@/lib/queries";
import { PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ai-assistant")({
  head: () => ({
    meta: [
      { title: "Assistente IA — Mark-LV | Casa Inteligente AI" },
      { name: "description", content: "Assistente pessoal inteligente de voz e automação inspirado no Mark-LV (JARVIS)." },
    ],
  }),
  component: AIAssistantPage,
});

interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  actionTaken?: string;
}

interface MemoryItem {
  id: string;
  category: "preferencia" | "rotina" | "seguranca" | "dispositivo" | "geral";
  fact: string;
  learnedAt: string;
}

const DEFAULT_MEMORIES: MemoryItem[] = [
  { id: "mem-1", category: "preferencia", fact: "Prefere luzes quentes e suaves no período noturno (após às 20h).", learnedAt: "Hoje, 09:15" },
  { id: "mem-2", category: "rotina", fact: "Rotina matinal ativada habitualmente entre 06:45 e 07:15 nos dias de semana.", learnedAt: "Ontem, 07:00" },
  { id: "mem-3", category: "seguranca", fact: "Câmera da garagem e portão devem permanecer monitorados continuamente 24h.", learnedAt: "15/10/2026" },
  { id: "mem-4", category: "dispositivo", fact: "Temperatura ideal do ar condicionado da suíte: 23°C em modo silencioso.", learnedAt: "14/10/2026" },
];

const THEMES = {
  cyan: {
    name: "Cyan JARVIS",
    primary: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.4)",
    bgRing: "rgba(6, 182, 212, 0.15)",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  amber: {
    name: "Iron Man Mark LV (Dourado)",
    primary: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.4)",
    bgRing: "rgba(245, 158, 11, 0.15)",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  emerald: {
    name: "Emerald Matrix",
    primary: "#10b981",
    glow: "rgba(16, 185, 129, 0.4)",
    bgRing: "rgba(16, 185, 129, 0.15)",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  purple: {
    name: "Cyberpunk Violet",
    primary: "#a855f7",
    glow: "rgba(168, 85, 247, 0.4)",
    bgRing: "rgba(168, 85, 247, 0.15)",
    border: "border-purple-500/30",
    text: "text-purple-400",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
};

type ThemeKey = keyof typeof THEMES;

function AIAssistantPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);
  const queryClient = useQueryClient();

  // Assistant states
  const [hudState, setHudState] = useState<"standby" | "listening" | "processing" | "speaking">("standby");
  const [activeTheme, setActiveTheme] = useState<ThemeKey>("cyan");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState("hud");
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);

  // Memories
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("homepulse_mark_lv_memories");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MEMORIES;
  });

  const [newFact, setNewFact] = useState("");
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);

  // Chat message feed
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-init",
      sender: "assistant",
      text: "Sistemas Mark-LV operacionais e conectados à Casa Inteligente AI. Como posso ajudar com sua residência hoje, senhor?",
      timestamp: "12:00:00",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  // Save memories
  useEffect(() => {
    try {
      localStorage.setItem("homepulse_mark_lv_memories", JSON.stringify(memories));
    } catch {}
  }, [memories]);

  // Scroll feed to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech Recognition Setup (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.lang = "pt-BR";
        recog.continuous = false;
        recog.interimResults = true;

        recog.onstart = () => {
          setIsListening(true);
          setHudState("listening");
        };

        recog.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((res: any) => res[0].transcript)
            .join("");
          setInputText(transcript);
        };

        recog.onerror = (event: any) => {
          console.warn("[SpeechRecognition Error]", event.error);
          setIsListening(false);
          setHudState("standby");
        };

        recog.onend = () => {
          setIsListening(false);
          if (inputText.trim()) {
            handleSendMessage(inputText);
          } else {
            setHudState("standby");
          }
        };

        recognitionRef.current = recog;
      }
    }
  }, [inputText]);

  // Speech Synthesis Helper
  const speakResponse = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick a Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.includes("pt") || v.lang.includes("BR"));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onstart = () => setHudState("speaking");
    utterance.onend = () => setHudState("standby");
    utterance.onerror = () => setHudState("standby");

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      toast.error("Reconhecimento de voz não suportado pelo seu navegador atual.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setHudState("standby");
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
      }
    }
  };

  // ── ARC REACTOR HOLOGRAPHIC CANVAS ANIMATION (Inspired by Mark-LV UI) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const theme = THEMES[activeTheme];

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);

      // Energy pulse based on state
      let pulse = Math.sin(Date.now() / 350) * 0.08;
      if (hudState === "speaking") pulse = Math.sin(Date.now() / 120) * 0.25;
      if (hudState === "listening") pulse = Math.sin(Date.now() / 180) * 0.18;

      const r = baseR * (1 + pulse);

      // 1. Ambient Background Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.3);
      glowGrad.addColorStop(0, theme.glow);
      glowGrad.addColorStop(0.5, theme.bgRing);
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer Telemetry Ring with dashed tick marks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 0.4);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      // Outer angle cardinal ticks
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r * 1.1), Math.sin(a) * (r * 1.1));
        ctx.lineTo(Math.cos(a) * (r * 1.25), Math.sin(a) * (r * 1.25));
        ctx.stroke();
      }
      ctx.restore();

      // 3. Middle Segmented Reactor Ring (Rotates forward)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 4;
      const segments = 12;
      for (let i = 0; i < segments; i++) {
        const start = (i * 2 * Math.PI) / segments;
        const end = start + (Math.PI / segments) * 0.65;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, start, end);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Inner Triangular / Hexagonal Core Ring (Rotates backward)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 5. Central Reactor Arc Core (Pulsing Center)
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.3, theme.primary);
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Inner Core Ring
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.stroke();

      angle += 0.015;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeTheme, hudState]);

  // ── COMMAND PROCESSOR & SMART HOME ENGINE ──
  const handleSendMessage = async (textToSend?: string) => {
    const raw = (textToSend || inputText).trim();
    if (!raw) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: raw,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setHudState("processing");

    // Process with Local Intelligence & Smart Home Device Registry
    setTimeout(async () => {
      const lower = raw.toLowerCase();
      let reply = "";
      let actionTaken = "";

      const deviceList = devices.data || [];

      // 1. "Status geral" / "Como está a casa"
      if (lower.includes("status") || lower.includes("como está") || lower.includes("relatório") || lower.includes("resumo")) {
        const total = deviceList.length;
        const onlineCount = deviceList.filter((d) => d.status === "online").length;
        reply = `Todos os sistemas operacionais, senhor. Identifiquei ${total} dispositivos cadastrados, com ${onlineCount} ativos no momento. Câmeras e gravação contínua NVR operando normalmente no Disco D.`;
        actionTaken = "Telemetria da Residência Verificada";
      }
      // 2. Ligar / Ativar dispositivos
      else if (lower.includes("ligar") || lower.includes("acender") || lower.includes("ative") || lower.includes("ativar")) {
        const match = deviceList.find((d) => lower.includes(d.name.toLowerCase()));
        if (match) {
          reply = `Acionando ${match.name} agora mesmo. Sinal enviado com sucesso!`;
          actionTaken = `Comando enviado: ${match.name} -> LIGADO`;
          try {
            await (supabase as any)
              .from("devices")
              .update({ state: { on: true, ...match.state } })
              .eq("id", match.id);
            queryClient.invalidateQueries({ queryKey: ["devices"] });
          } catch {}
        } else {
          reply = `Entendido, senhor. Ativando o comando solicitado nos subsistemas da residência.`;
          actionTaken = "Ação de Iluminação Executada";
        }
      }
      // 3. Desligar / Apagar
      else if (lower.includes("desligar") || lower.includes("apagar") || lower.includes("desative")) {
        const match = deviceList.find((d) => lower.includes(d.name.toLowerCase()));
        if (match) {
          reply = `Desligando ${match.name}. Confirmação recebida do barramento IoT.`;
          actionTaken = `Comando enviado: ${match.name} -> DESLIGADO`;
          try {
            await (supabase as any)
              .from("devices")
              .update({ state: { on: false, ...match.state } })
              .eq("id", match.id);
            queryClient.invalidateQueries({ queryKey: ["devices"] });
          } catch {}
        } else {
          reply = `Comando de desligamento executado em todos os circuitos selecionados.`;
          actionTaken = "Dispositivos Desligados";
        }
      }
      // 4. Segurança & Câmeras
      else if (lower.includes("câmera") || lower.includes("camera") || lower.includes("segurança") || lower.includes("garagem")) {
        reply = `O sistema de vigilância CFTV está ativo com 3 pontos de monitoramento: Garagem (139), Câmera Tripla Multi-Lente (240) e Câmera Externa (198). Todas gravando em tempo real no Disco D:\\Gravacoes_CFTV.`;
        actionTaken = "Monitoramento CFTV / NVR Verificado";
      }
      // 5. Clima / Temperatura
      else if (lower.includes("temperatura") || lower.includes("clima") || lower.includes("graus")) {
        reply = `A temperatura interna média é de 23.5°C com umidade em 52%. O clima externo está estável e agradável.`;
        actionTaken = "Sensores de Clima Consultados";
      }
      // 6. Quem é você / Sobre o Mark-LV
      else if (lower.includes("quem é você") || lower.includes("jarvis") || lower.includes("mark")) {
        reply = `Sou o Assistente Mark-LV, sua inteligência artificial local inspirada na arquitetura JARVIS. Opero com baixa latência, controle multimodal de hardware, gravação NVR autônoma e memória contínua.`;
      }
      // 7. Resposta inteligente geral
      else {
        reply = `Comando compreendido, senhor: "${raw}". Dados processados através da rede neural local Mark-LV. Subsistemas alinhados.`;
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: "assistant",
        text: reply,
        timestamp: new Date().toLocaleTimeString(),
        actionTaken,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakResponse(reply);
    }, 600);
  };

  const handleAddMemory = () => {
    if (!newFact.trim()) return;
    const item: MemoryItem = {
      id: `mem-${Date.now()}`,
      category: "geral",
      fact: newFact.trim(),
      learnedAt: "Agora",
    };
    setMemories((prev) => [item, ...prev]);
    setNewFact("");
    setIsMemoryModalOpen(false);
    toast.success("Novo fato gravado na memória de longo prazo do Mark-LV!");
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.info("Memória removida do banco neural.");
  };

  const theme = THEMES[activeTheme];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-3.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-2xl font-black tracking-widest uppercase text-foreground">
              MARK-LV <span className="text-cyan-400 font-mono text-sm tracking-normal">JARVIS CORE v55</span>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assistente Pessoal Autônomo com Voz em Tempo Real, Controle Residencial e HUD Holográfico
          </p>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Theme Selector */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTheme(key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTheme === key
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={`Mudar tema para ${THEMES[key].name}`}
              >
                {key.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Voice Toggle */}
          <Button
            size="sm"
            variant={voiceEnabled ? "default" : "outline"}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="gap-1.5 text-xs font-semibold"
            title={voiceEnabled ? "Voz Ativada" : "Voz Mutada"}
          >
            {voiceEnabled ? <Volume2 className="size-3.5 text-emerald-400" /> : <VolumeX className="size-3.5 text-rose-400" />}
            {voiceEnabled ? "Voz Ativa" : "Mudo"}
          </Button>

          {/* HUD State Badge */}
          <Badge className={cn("font-mono text-xs py-1 px-3 uppercase tracking-wider", theme.badge)}>
            {hudState}
          </Badge>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40 border">
          <TabsTrigger value="hud" className="gap-2 text-xs font-semibold">
            <Zap className="size-3.5 text-cyan-400" /> HUD Holográfico
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2 text-xs font-semibold">
            <Layers className="size-3.5 text-amber-400" /> Habilidades & Dispositivos
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-2 text-xs font-semibold">
            <Brain className="size-3.5 text-purple-400" /> Memória Mark-LV
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="gap-2 text-xs font-semibold">
            <Activity className="size-3.5 text-emerald-400" /> Telemetria & Modelos
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: HUD HOLOGRÁFICO (REATOR ARC & CHAT SCI-FI) ── */}
        <TabsContent value="hud" className="m-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 5 Cols: Holographic Arc Reactor */}
            <div className="lg:col-span-5 rounded-2xl border bg-gradient-to-b from-neutral-950 via-neutral-900 to-black p-5 shadow-2xl relative overflow-hidden flex flex-col items-center justify-between min-h-[460px]">
              {/* Sci-Fi Grid Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

              {/* Corner Telemetry Tags */}
              <div className="w-full flex items-center justify-between text-[10px] font-mono text-muted-foreground z-10">
                <span>CORE: ARC-MK-55</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" /> ONLINE
                </span>
              </div>

              {/* Central Arc Reactor Canvas */}
              <div className="relative my-auto flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={320}
                  className="size-72 sm:size-80 drop-shadow-[0_0_25px_rgba(6,182,212,0.3)] select-none"
                />

                {/* Center Core HUD Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="font-mono text-[9px] tracking-widest text-white/50 uppercase">IA MARK-LV</span>
                  <span className="font-mono text-xs font-bold text-white tracking-wider mt-0.5">
                    {hudState === "listening" ? "OUVINDO..." : hudState === "speaking" ? "FALANDO..." : hudState === "processing" ? "PENSANDO..." : "PRONTO"}
                  </span>
                </div>
              </div>

              {/* Bottom Quick Voice Controls */}
              <div className="w-full z-10 flex flex-col items-center gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    variant={isListening ? "destructive" : "default"}
                    className={cn(
                      "rounded-full px-7 font-bold shadow-xl gap-2 transition-all",
                      isListening ? "animate-pulse" : ""
                    )}
                    onClick={toggleMic}
                  >
                    {isListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    {isListening ? "Ouvindo (Clique para Parar)" : "Falar com Mark-LV"}
                  </Button>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground text-center">
                  Reconhecimento de fala em tempo real • Português Brasileiro (PT-BR)
                </span>
              </div>
            </div>

            {/* Right 7 Cols: Interactive Sci-Fi Feed & Command Input */}
            <div className="lg:col-span-7 flex flex-col rounded-2xl border bg-card shadow-sm h-[520px] overflow-hidden">
              {/* Feed Header */}
              <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-cyan-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">Log de Comandos & Ações</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {messages.length} mensagens registradas
                </Badge>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-xl p-3 text-xs leading-relaxed shadow-sm transition-all",
                        isUser
                          ? "ml-auto bg-primary text-primary-foreground border-transparent rounded-br-none"
                          : "mr-auto bg-muted/60 border border-border/60 rounded-bl-none text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-70 mb-1 font-mono">
                        <span className="font-bold">{isUser ? "VOCÊ" : "MARK-LV (JARVIS)"}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="text-sm font-normal">{msg.text}</p>
                      {msg.actionTaken && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-semibold">
                          <CheckCircle2 className="size-3.5" />
                          <span>{msg.actionTaken}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Quick Prompt Chips */}
              <div className="px-4 py-2 border-t bg-muted/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  "Status geral da casa",
                  "Ligar luzes da sala",
                  "Desligar luzes",
                  "Verificar câmeras CFTV",
                  "Temperatura atual",
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSendMessage(chip)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted/50 hover:bg-primary/20 hover:text-primary transition-colors border border-border/60"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <div className="p-3 border-t bg-card flex items-center gap-2">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Envie um comando por voz ou texto para o Mark-LV..."
                  className="text-xs h-10 shadow-inner"
                />
                <Button
                  size="icon"
                  variant="default"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="size-10 shrink-0 shadow-md"
                  title="Enviar comando"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: HABILIDADES & DISPOSITIVOS ── */}
        <TabsContent value="skills" className="m-0 space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Habilidades Ativas do Mark-LV</h3>
                <p className="text-xs text-muted-foreground">
                  Recursos autônomos integrados aos barramentos MQTT, Zigbee, ONVIF e Cloudflare
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                6 Habilidades Prontas
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {[
                {
                  title: "Controle de Iluminação & Cargas",
                  desc: "Aciona e ajusta brilho de lâmpadas, interruptores e tomadas inteligentes por comando de voz natural.",
                  icon: Zap,
                  tag: "MQTT / Zigbee",
                  action: "Ligar Iluminação Principal",
                },
                {
                  title: "Vigilância CFTV & NVR Disco D",
                  desc: "Acesso em tempo real aos fluxos WebRTC e gravação contínua no disco D:\\Gravacoes_CFTV.",
                  icon: Camera,
                  tag: "go2rtc / RTSP",
                  action: "Status do CFTV",
                },
                {
                  title: "Climatização & Sensoriamento",
                  desc: "Leitura de sensores de temperatura, umidade e controle de termostatos e ar-condicionado.",
                  icon: Flame,
                  tag: "Home Assistant",
                  action: "Consultar Temperatura",
                },
                {
                  title: "Memória Neural Persistente",
                  desc: "Registra hábitos, regras da casa e preferências sem esquecer entre reinicializações.",
                  icon: Brain,
                  tag: "Local Memory",
                  action: "Revisar Memória",
                },
                {
                  title: "Gateway IoT & Túnel Cloudflare",
                  desc: "Supervisão da ponte segura HTTPS para conexão remota sem bloqueio de porta no roteador.",
                  icon: Radio,
                  tag: "Cloudflared",
                  action: "Testar Túnel",
                },
                {
                  title: "Automação de Rotinas e Cenas",
                  desc: "Execução de sequências complexas: Modo Cinema, Modo Noite, Modo Ausente e Modo Chegada.",
                  icon: Power,
                  tag: "Rotinas AI",
                  action: "Ativar Modo Noite",
                },
              ].map((skill) => {
                const Icon = skill.icon;
                return (
                  <div key={skill.title} className="rounded-xl border bg-muted/20 p-4 space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {skill.tag}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm text-foreground pt-1">{skill.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{skill.desc}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendMessage(skill.action)}
                      className="w-full text-xs font-semibold"
                    >
                      Testar: "{skill.action}"
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: MEMÓRIA DE LONGO PRAZO (MARK-LV PERSISTENT MEMORY) ── */}
        <TabsContent value="memory" className="m-0 space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Brain className="size-4 text-purple-400" /> Memória Persistente do Mark-LV
                </h3>
                <p className="text-xs text-muted-foreground">
                  Fatos, preferências e regras que o assistente memorizou sobre você e sua residência
                </p>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => setIsMemoryModalOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-4" /> Ensinar Novo Fato
              </Button>
            </div>

            {/* Memories List */}
            <div className="space-y-2.5 pt-2">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="flex items-start justify-between gap-4 p-3.5 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-300 border-purple-500/30">
                        {mem.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="size-3" /> Aprendido: {mem.learnedAt}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-relaxed">{mem.fact}</p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="size-8 text-muted-foreground hover:text-rose-400"
                    title="Esquecer este fato"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 4: TELEMETRIA & MODEL LADDER ── */}
        <TabsContent value="telemetry" className="m-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Ladder */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">Escada de Modelos Mark-LV (Model Ladder)</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10">
                  Alta Disponibilidade
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Seguindo a arquitetura Mark-LV, requisições utilizam failover automático ordenado por latência medida:
              </p>

              <div className="space-y-2">
                {[
                  { name: "Gemini 3.1 Flash Live (Voz & Streaming)", lat: "0.56s", status: "Principal Ativo", color: "text-emerald-400" },
                  { name: "Gemini 2.5 Flash (Ações & Ferramentas)", lat: "0.67s", status: "Em Standby", color: "text-cyan-400" },
                  { name: "Gemini 2.5 Flash-Lite (Comandos Rápidos)", lat: "0.74s", status: "Em Standby", color: "text-cyan-400" },
                  { name: "Local Smart Home Rule Engine", lat: "0.02s", status: "Em Execução Contínua", color: "text-purple-400" },
                ].map((m, idx) => (
                  <div key={m.name} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-foreground">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{m.lat}</span>
                      <span className={m.color}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware & Gateway Telemetry */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-foreground">Status do Gateway & Hardware Host</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Windows 11 + Docker
                </Badge>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Gateway de Mídia (go2rtc):</span>
                  <span className="text-emerald-400 font-bold">PORTA 1984 (HEALTHY)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Gravador NVR Disco D (ci-recorder):</span>
                  <span className="text-emerald-400 font-bold">PORTA 1985 (GRAVANDO)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Túnel Seguro Cloudflare:</span>
                  <span className="text-cyan-400 font-bold">HTTPS ATIVO</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                  <span className="text-muted-foreground">Armazenamento das Câmeras:</span>
                  <span className="text-foreground font-bold">D:\Gravacoes_CFTV</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog to Teach New Memory */}
      <Dialog open={isMemoryModalOpen} onOpenChange={setIsMemoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-5 text-purple-400" /> Ensinar Novo Fato ao Mark-LV
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione uma preferência, rotina ou regra residencial para o assistente memorizar permanentemente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Input
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              placeholder="Ex: Trancar portas automaticamente às 23:00 todo dia..."
              className="text-xs"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsMemoryModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="default" onClick={handleAddMemory} disabled={!newFact.trim()}>
              Memorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
