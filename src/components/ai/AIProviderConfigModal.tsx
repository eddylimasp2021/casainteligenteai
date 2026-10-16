import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles, Key, CheckCircle2, XCircle, ExternalLink, Loader2,
  Cpu, Zap, Shield, Eye, EyeOff, Sliders, RefreshCw, Check, AlertTriangle
} from "lucide-react";
import {
  AI_PROVIDERS,
  AIProviderId,
  AIConfig,
  loadAIConfig,
  saveAIConfig,
  testAIConnection,
} from "@/lib/ai-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AIProviderConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIProviderConfigModal({ open, onOpenChange }: AIProviderConfigModalProps) {
  const [config, setConfig] = useState<AIConfig>(loadAIConfig);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("gemini");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // Recarregar configurações ao abrir modal
  useEffect(() => {
    if (open) {
      const current = loadAIConfig();
      setConfig(current);
      setSelectedProvider(current.activeProvider);
      setTestResult(null);
    }
  }, [open]);

  const currentMeta = AI_PROVIDERS[selectedProvider];
  const currentKey = config.keys[selectedProvider] || "";
  const currentModel = config.selectedModels[selectedProvider] || currentMeta.defaultModel;

  const handleKeyChange = (val: string) => {
    // Limpeza automática de espaços, quebras de linha e aspas acidentais
    const cleaned = val.trim().replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "");
    setConfig((prev) => ({
      ...prev,
      keys: {
        ...prev.keys,
        [selectedProvider]: cleaned,
      },
    }));
    setTestResult(null);
  };

  const handleModelSelect = (model: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedModels: {
        ...prev.selectedModels,
        [selectedProvider]: model,
      },
    }));
  };

  const handleSetActive = (id: AIProviderId) => {
    setSelectedProvider(id);
    setConfig((prev) => ({
      ...prev,
      activeProvider: id,
    }));
    setTestResult(null);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(selectedProvider, currentKey, currentModel);
      setTestResult(res);
      if (res.ok) {
        toast.success(`✓ Conexão validada com ${currentMeta.name}! (${res.latencyMs}ms)`);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      const err = { ok: false, latencyMs: 0, message: e?.message || "Erro desconhecido" };
      setTestResult(err);
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveAIConfig(config);
    toast.success(`Configurações de IA salvas! Provedor ativo: ${AI_PROVIDERS[config.activeProvider].name}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border border-primary/20 shadow-2xl bg-card">
        {/* Header com estilo HUD */}
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/30">
              <Sparkles className="size-6 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Chaves de API & Provedores de Inteligência Artificial
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure sua chave do <strong>Google Gemini</strong> ou selecione provedores universais (OpenAI, Groq, Claude, DeepSeek, Ollama).
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Seletor de Provedores em Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selecione o Provedor de IA
              </Label>
              <span className="text-xs text-primary font-medium">
                Ativo: <strong>{AI_PROVIDERS[config.activeProvider].name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {(Object.keys(AI_PROVIDERS) as AIProviderId[]).map((pid) => {
                const p = AI_PROVIDERS[pid];
                const isSelected = selectedProvider === pid;
                const isActive = config.activeProvider === pid;
                const hasKey = Boolean(config.keys[pid]?.trim()) || !p.keyRequired;

                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handleSetActive(pid)}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-xl border text-xs transition-all relative",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 hover:border-primary/40 bg-muted/10",
                      isActive && "ring-1 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-bold truncate text-foreground">{p.name}</span>
                      {isActive && (
                        <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-sm" title="Provedor ativo" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-auto">
                      {p.badge && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                          {p.badge}
                        </Badge>
                      )}
                      {hasKey ? (
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="size-3" /> Configurado
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          Sem chave
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de Configuração do Provedor Selecionado */}
          <div className="rounded-xl border bg-muted/15 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>{currentMeta.name}</span>
                  {currentMeta.badge && (
                    <Badge variant="default" className="text-[10px] h-5">
                      {currentMeta.badge}
                    </Badge>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">{currentMeta.description}</p>
              </div>

              {currentMeta.docUrl && (
                <a
                  href={currentMeta.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium shrink-0"
                >
                  <ExternalLink className="size-3.5" />
                  {currentMeta.docLabel}
                </a>
              )}
            </div>

            {/* Input da Chave API */}
            {currentMeta.keyRequired ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="apiKeyInput" className="text-xs font-semibold flex items-center gap-1.5">
                    <Key className="size-3.5 text-primary" />
                    Chave de API do {currentMeta.name}
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Armazenada com segurança no seu navegador
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKeyInput"
                      type={showKey ? "text" : "password"}
                      value={currentKey}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      placeholder={currentMeta.keyPlaceholder}
                      className="pr-10 font-mono text-xs h-10 tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showKey ? "Ocultar chave" : "Mostrar chave"}
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={runTest}
                    disabled={testing || !currentKey.trim()}
                    className="h-10 text-xs gap-1.5 shrink-0"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" />
                        Testar Chave
                      </>
                    )}
                  </Button>
                </div>

                {/* Validador visual e dicas para Google Gemini */}
                {selectedProvider === "gemini" && (
                  <div className="space-y-2 pt-1">
                    {currentKey ? (
                      currentKey.startsWith("AIzaSy") ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                          <Check className="size-3.5" />
                          <span>Formato de chave válido do Google AI Studio (inicia com AIzaSy, {currentKey.length} caracteres)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          <span>Atenção: A chave do Gemini deve começar com &quot;AIzaSy&quot;. Verifique se você não copiou o nome do projeto ou título da chave no AI Studio.</span>
                        </div>
                      )
                    ) : null}

                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-blue-400">
                        <Sparkles className="size-3.5" />
                        Dicas para chaves gratuitas do Google AI Studio:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 pl-1">
                        <li><strong>Chave recém-gerada?</strong> O Google pode levar de 1 a 3 minutos para propagar e ativar a chave mundialmente. Se der erro ao testar agora, aguarde 60 segundos e tente novamente.</li>
                        <li><strong>Modelo gratuito padrão:</strong> Mantenha selecionado <strong>gemini-1.5-flash</strong> (modelo oficial mais rápido e estável com alta cota gratuita).</li>
                        <li><strong>Extensões do navegador:</strong> Se der erro de rede (&quot;Failed to fetch&quot;), pause bloqueadores de anúncio (uBlock, Brave Shields) nesta página.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-primary" /> Endpoint Local do Ollama
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={config.customEndpoints.ollama || "http://localhost:11434/v1/chat/completions"}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        customEndpoints: { ...prev.customEndpoints, ollama: e.target.value },
                      }))
                    }
                    className="font-mono text-xs h-10"
                    placeholder="http://localhost:11434/v1/chat/completions"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runTest}
                    disabled={testing}
                    className="h-10 text-xs gap-1.5 shrink-0"
                  >
                    {testing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Testar
                  </Button>
                </div>
              </div>
            )}

            {/* Resultado do Teste de Conexão */}
            {testResult && (
              <div
                className={cn(
                  "p-3 rounded-lg text-xs font-mono flex items-start gap-2 border",
                  testResult.ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.latencyMs > 0 && (
                    <p className="text-[10px] opacity-80 mt-0.5">Tempo de resposta da API: {testResult.latencyMs}ms</p>
                  )}
                </div>
              </div>
            )}

            {/* Seleção de Modelo para o Provedor */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold">Modelo de IA Selecionado</Label>
              <div className="flex flex-wrap gap-2">
                {currentMeta.models.map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => handleModelSelect(mod)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors",
                      currentModel === mod
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                        : "bg-card text-muted-foreground border-border/80 hover:border-primary/50"
                    )}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parâmetros Globais do Assistente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 bg-muted/10 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sliders className="size-3.5 text-primary" /> Personalidade do Assistente
              </Label>
              <select
                value={config.personality}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    personality: e.target.value as any,
                  }))
                }
                className="w-full bg-background border rounded-lg px-3 py-2 text-xs font-sans text-foreground"
              >
                <option value="jarvis">JARVIS (Educado, refinado e sofisticado)</option>
                <option value="tecnico">Técnico (Direto, preciso e focado em telemetria)</option>
                <option value="amigavel">Amigável (Descontraído e atencioso)</option>
                <option value="conciso">Conciso (Respostas ultra-curtas)</option>
              </select>
            </div>

            <div className="rounded-xl border p-4 bg-muted/10 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Temperatura / Criatividade</Label>
                <span className="text-xs font-mono text-muted-foreground">{config.temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    temperature: parseFloat(e.target.value),
                  }))
                }
                className="w-full cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0.1 (Exato/Rígido)</span>
                <span>0.7 (Equilibrado)</span>
                <span>1.0 (Criativo)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <DialogFooter className="p-4 border-t bg-muted/10 flex sm:justify-between items-center gap-2">
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Provedor ativo ao salvar: <strong>{AI_PROVIDERS[config.activeProvider].name}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} className="gap-1.5 shadow-md">
              <Check className="size-4" />
              Salvar Configurações
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
