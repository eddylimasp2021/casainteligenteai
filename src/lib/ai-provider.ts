/**
 * Provedores Universais de Inteligência Artificial para Casa Inteligente AI (Mark-LV)
 * Suporte a Google Gemini, OpenAI, Groq, Anthropic Claude, OpenRouter, DeepSeek e Ollama Local.
 */

export type AIProviderId = 
  | "gemini" 
  | "openai" 
  | "groq" 
  | "anthropic" 
  | "openrouter" 
  | "deepseek" 
  | "ollama";

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  defaultModel: string;
  models: string[];
  keyPlaceholder: string;
  keyRequired: boolean;
  docUrl: string;
  docLabel: string;
  defaultEndpoint?: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderMeta> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Multimodal, ultra-rápido e gratuito para começar",
    description: "Recomendado para o HomePulse AI. Executa visão de câmeras, comandos rápidos e raciocínio avançado com latência mínima.",
    badge: "Recomendado",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    keyPlaceholder: "AIzaSy...",
    keyRequired: true,
    docUrl: "https://aistudio.google.com/app/apikey",
    docLabel: "Obter Chave Gratuita no Google AI Studio",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    tagline: "GPT-4o, GPT-4o-mini e raciocínio estruturado",
    description: "Excelente para interpretação complexa de rotinas, conversas detalhadas e controle preciso de parâmetros de automação.",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
    keyPlaceholder: "sk-proj-...",
    keyRequired: true,
    docUrl: "https://platform.openai.com/api-keys",
    docLabel: "Gerar Chave na OpenAI Platform",
  },
  groq: {
    id: "groq",
    name: "Groq Cloud",
    tagline: "Inferência LPU ultra-rápida (<300ms)",
    description: "Ideal para comandos de voz instantâneos utilizando modelos abertos como Llama 3.3 70B e Mixtral.",
    badge: "Mais Rápido",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    keyPlaceholder: "gsk_...",
    keyRequired: true,
    docUrl: "https://console.groq.com/keys",
    docLabel: "Obter Chave no Console Groq",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Hub universal com dezenas de modelos",
    description: "Acesse centenas de IAs em uma única chave de API (Claude, GPT-4, Gemini, DeepSeek, Mistral).",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    models: [
      "google/gemini-2.0-flash-exp:free",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "deepseek/deepseek-chat",
    ],
    keyPlaceholder: "sk-or-v1-...",
    keyRequired: true,
    docUrl: "https://openrouter.ai/keys",
    docLabel: "Obter Chave no OpenRouter",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    tagline: "Claude 3.5 Sonnet & Haiku",
    description: "Raciocínio analítico avançado, linguagem natural empática e alta aderência a regras residenciais.",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    keyPlaceholder: "sk-ant-...",
    keyRequired: true,
    docUrl: "https://console.anthropic.com/settings/keys",
    docLabel: "Obter Chave no Anthropic Console",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    tagline: "Modelos V3 e R1 de altíssimo desempenho",
    description: "Excelente desempenho para automações e raciocínio lógico estruturado a baixo custo.",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyPlaceholder: "sk-...",
    keyRequired: true,
    docUrl: "https://platform.deepseek.com/api_keys",
    docLabel: "Gerar Chave na DeepSeek Platform",
  },
  ollama: {
    id: "ollama",
    name: "Ollama / IA Local",
    tagline: "100% Offline e Privado na sua Rede",
    description: "Execução direta no seu próprio computador ou servidor local sem envio de áudio ou dados para a internet.",
    badge: "100% Offline",
    defaultModel: "llama3.2",
    models: ["llama3.2", "mistral", "qwen2.5:7b", "phi3"],
    keyPlaceholder: "Não obrigatório (padrão local)",
    keyRequired: false,
    docUrl: "https://ollama.com",
    docLabel: "Download do Ollama para PC",
    defaultEndpoint: "http://localhost:11434/v1/chat/completions",
  },
};

export interface AIConfig {
  activeProvider: AIProviderId;
  keys: Record<AIProviderId, string>;
  selectedModels: Record<AIProviderId, string>;
  customEndpoints: Record<AIProviderId, string>;
  temperature: number;
  personality: "jarvis" | "tecnico" | "amigavel" | "conciso";
}

const STORAGE_KEY = "homepulse_ai_universal_config";

export function getDefaultAIConfig(): AIConfig {
  const envGeminiKey =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.GEMINI_API_KEY) ||
    "";

  return {
    activeProvider: "gemini",
    keys: {
      gemini: envGeminiKey,
      openai: "",
      groq: "",
      openrouter: "",
      anthropic: "",
      deepseek: "",
      ollama: "",
    },
    selectedModels: {
      gemini: "gemini-1.5-flash",
      openai: "gpt-4o-mini",
      groq: "llama-3.3-70b-versatile",
      openrouter: "google/gemini-2.0-flash-exp:free",
      anthropic: "claude-3-5-sonnet-20241022",
      deepseek: "deepseek-chat",
      ollama: "llama3.2",
    },
    customEndpoints: {
      gemini: "",
      openai: "",
      groq: "",
      openrouter: "",
      anthropic: "",
      deepseek: "",
      ollama: "http://localhost:11434/v1/chat/completions",
    },
    temperature: 0.7,
    personality: "jarvis",
  };
}

export function loadAIConfig(): AIConfig {
  const defaults = getDefaultAIConfig();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      activeProvider: parsed.activeProvider || defaults.activeProvider,
      keys: {
        ...defaults.keys,
        ...(parsed.keys || {}),
        gemini: parsed.keys?.gemini?.trim() || defaults.keys.gemini,
      },
      selectedModels: { ...defaults.selectedModels, ...(parsed.selectedModels || {}) },
      customEndpoints: { ...defaults.customEndpoints, ...(parsed.customEndpoints || {}) },
      temperature: typeof parsed.temperature === "number" ? parsed.temperature : defaults.temperature,
      personality: parsed.personality || defaults.personality,
    };
  } catch (err) {
    console.error("Erro ao carregar configurações de IA:", err);
    return defaults;
  }
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("homepulse:ai-config-changed", { detail: config }));
  } catch (err) {
    console.error("Erro ao salvar configurações de IA:", err);
  }
}

/**
 * Realiza um teste de conexão rápido com o provedor e a chave fornecidos
 */
export async function testAIConnection(
  providerId: AIProviderId,
  overrideKey?: string,
  overrideModel?: string,
  overrideEndpoint?: string
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const config = loadAIConfig();
  const key = (overrideKey !== undefined ? overrideKey : config.keys[providerId] || "").trim();
  const model = overrideModel || config.selectedModels[providerId] || AI_PROVIDERS[providerId].defaultModel;
  const endpoint = overrideEndpoint || config.customEndpoints[providerId] || AI_PROVIDERS[providerId].defaultEndpoint;

  const meta = AI_PROVIDERS[providerId];
  if (meta.keyRequired && !key) {
    return { ok: false, latencyMs: 0, message: `Informe uma chave de API para o provedor ${meta.name}.` };
  }

  const start = performance.now();

  try {
    if (providerId === "gemini") {
      let cleanKey = key.trim().replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "").trim();

      if (!cleanKey) {
        return { ok: false, latencyMs: 0, message: "Informe a sua chave do Google Gemini." };
      }

      // Validação de formato para evitar erros comuns de cópia
      if (!cleanKey.startsWith("AIzaSy")) {
        return {
          ok: false,
          latencyMs: 0,
          message: "Atenção: A chave do Google Gemini (gratuita no Google AI Studio) sempre começa com 'AIzaSy' e tem cerca de 39 caracteres. Verifique se você copiou o código da chave e não o nome ou título dela no AI Studio.",
        };
      }

      // Modelos para tentar em cascata caso o selecionado tenha instabilidade
      const modelsToTry = [
        model && model !== "gemini-2.5-flash" ? model : "gemini-1.5-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
      ];

      let lastError = "";

      for (const m of Array.from(new Set(modelsToTry))) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(cleanKey)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cleanKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Responda apenas 'Sistemas Online - Mark-LV'." }] }],
              generationConfig: { maxOutputTokens: 25, temperature: 0.1 },
            }),
          });

          const elapsed = Math.round(performance.now() - start);

          if (res.ok) {
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Online";
            return {
              ok: true,
              latencyMs: elapsed,
              message: `✓ Google Gemini conectado com sucesso no modelo '${m}'! Resposta: "${reply}"`,
            };
          }

          const errJson = await res.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `Erro HTTP ${res.status}`;
          const errReason = errJson?.error?.details?.[0]?.reason || "";

          // Se a chave for recém-criada, orientar sobre tempo de propagação do Google
          if (errReason === "API_KEY_INVALID" || errMsg.toLowerCase().includes("api key not valid")) {
            return {
              ok: false,
              latencyMs: elapsed,
              message: "Chave inválida: Se você acabou de criar a chave no Google AI Studio agora há pouco, o Google costuma levar de 1 a 3 minutos para propagar a ativação nos servidores mundiais. Aguarde 1 minuto e clique em 'Testar Chave' novamente. Certifique-se também de ter copiado o código completo.",
            };
          }

          if (errMsg.toLowerCase().includes("not been used") || errMsg.toLowerCase().includes("not enabled")) {
            return {
              ok: false,
              latencyMs: elapsed,
              message: "A API do Gemini está sendo ativada no seu projeto Google. Aguarde cerca de 1 a 2 minutos para o Google concluir a liberação e teste novamente.",
            };
          }

          if (errMsg.toLowerCase().includes("location is not supported")) {
            return {
              ok: false,
              latencyMs: elapsed,
              message: "Região não suportada pelo Google Gemini. Caso esteja utilizando VPN ou proxy estrangeiro, desative-o.",
            };
          }

          if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exhausted")) {
            return {
              ok: false,
              latencyMs: elapsed,
              message: "Limite de cota temporária por minuto atingido na conta gratuita do Google. Aguarde 10 segundos e teste novamente.",
            };
          }

          lastError = errMsg;
          // Se o modelo deu 404, continua o loop para testar gemini-1.5-flash
        } catch (fetchErr: any) {
          const fetchMsg = fetchErr?.message || "";
          if (fetchMsg.includes("Failed to fetch") || fetchMsg.includes("NetworkError")) {
            return {
              ok: false,
              latencyMs: Math.round(performance.now() - start),
              message: "Bloqueio de rede no navegador (Failed to fetch). Extensões como uBlock Origin, Brave Shields ou antivírus costumam bloquear chamadas diretas para a API do Google. Pause o bloqueador nesta página e teste novamente.",
            };
          }
          lastError = fetchMsg;
        }
      }

      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        message: `Google Gemini: ${lastError || "Não foi possível conectar com o modelo."}`,
      };
    }

    if (providerId === "openai" || providerId === "groq" || providerId === "openrouter" || providerId === "deepseek") {
      let targetUrl = "https://api.openai.com/v1/chat/completions";
      if (providerId === "groq") targetUrl = "https://api.groq.com/openai/v1/chat/completions";
      if (providerId === "openrouter") targetUrl = "https://openrouter.ai/api/v1/chat/completions";
      if (providerId === "deepseek") targetUrl = "https://api.deepseek.com/chat/completions";

      const cleanKey = key.trim().replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "").trim();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      };
      if (providerId === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Casa Inteligente AI";
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Responda apenas 'Sistemas Online'." }],
          max_tokens: 20,
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `Erro HTTP ${res.status}: ${res.statusText}`;
        return { ok: false, latencyMs: elapsed, message: `${meta.name}: ${msg}` };
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Online";
      return { ok: true, latencyMs: elapsed, message: `✓ ${meta.name} conectado com sucesso! Resposta: "${reply}"` };
    }

    if (providerId === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 25,
          messages: [{ role: "user", content: "Responda apenas 'Sistemas Online'." }],
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `Erro HTTP ${res.status}`;
        return { ok: false, latencyMs: elapsed, message: `Anthropic: ${msg}` };
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text?.trim() || "Online";
      return { ok: true, latencyMs: elapsed, message: `✓ Anthropic conectado com sucesso! Resposta: "${reply}"` };
    }

    if (providerId === "ollama") {
      const targetUrl = endpoint || "http://localhost:11434/v1/chat/completions";
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Responda apenas 'Sistemas Online'." }],
          max_tokens: 20,
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latencyMs: elapsed, message: `Ollama não respondeu em ${targetUrl}. Verifique se o executável do Ollama está rodando.` };
      }

      return { ok: true, latencyMs: elapsed, message: `✓ Ollama local conectado com sucesso em ${targetUrl}!` };
    }

    return { ok: false, latencyMs: 0, message: "Provedor desconhecido." };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      ok: false,
      latencyMs: elapsed,
      message: `Falha na requisição: ${err?.message || "Verifique a chave ou conexão de rede."}`,
    };
  }
}

export interface SmartHomeAIContext {
  devices: Array<{ id: string; name: string; is_on: boolean; category: string; room?: string }>;
  rooms: Array<{ id: string; name: string }>;
  cftvStatus: { isRecording: boolean; path: string; activeStreams: number };
  memories: Array<{ category: string; fact: string }>;
}

export interface AIExecutionResult {
  text: string;
  actionTaken?: string;
  deviceToToggle?: { id: string; name: string; targetState: boolean };
  latencyMs: number;
  providerUsed: string;
  modelUsed: string;
}

/**
 * Gera uma resposta inteligente utilizando a IA configurada (ex: Google Gemini)
 * e infere comandos reais nos dispositivos da residência.
 */
export async function generateAICompletion(
  userPrompt: string,
  context: SmartHomeAIContext,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AIExecutionResult> {
  const config = loadAIConfig();
  const providerId = config.activeProvider;
  const key = (config.keys[providerId] || "").trim();
  const model = config.selectedModels[providerId] || AI_PROVIDERS[providerId].defaultModel;
  const meta = AI_PROVIDERS[providerId];

  // Caso o usuário ainda não tenha configurado chave para o provedor ativo
  if (meta.keyRequired && !key) {
    return {
      text: `Olá! Percebi que a chave de API do provedor ${meta.name} ainda não foi inserida. Você pode clicar no botão "Chaves de IA" no topo da tela para inserir sua chave do Google Gemini ou de outro provedor de sua preferência. Enquanto isso, meus controles locais continuam operacionais.`,
      latencyMs: 15,
      providerUsed: "Local Fallback",
      modelUsed: "Rule-Engine",
    };
  }

  // Prepara prompt de sistema com contexto em tempo real da Casa Inteligente
  const devicesSummary = context.devices
    .map((d) => `- "${d.name}" (ID: ${d.id}, Cômodo: ${d.room || "Geral"}, Tipo: ${d.category}, Estado atual: ${d.is_on ? "LIGADO" : "DESLIGADO"})`)
    .join("\n");

  const roomsSummary = context.rooms.map((r) => r.name).join(", ");
  const memoriesSummary = context.memories.map((m) => `[${m.category}] ${m.fact}`).join("\n");

  const systemPrompt = `Você é o MARK-LV (JARVIS), a inteligência artificial central da Casa Inteligente AI (HomePulse AI).
Seu tom de voz é cordial, refinado, altamente confiante, preciso e elegante como o assistente JARVIS. Chame o usuário ocasionalmente de "senhor" ou "senhora".

ESTADO ATUAL DA RESIDÊNCIA:
- Cômodos disponíveis: ${roomsSummary || "Nenhum cadastrado"}
- Câmeras & CFTV: Gravador contínuo em ${context.cftvStatus.path} (${context.cftvStatus.isRecording ? "GRAVAÇÃO ATIVA" : "PARADO"}). Streams go2rtc operacionais.
- Dispositivos cadastrados:
${devicesSummary || "Nenhum dispositivo cadastrado no momento"}

MEMÓRIA DE LONGO PRAZO DO MARK-LV:
${memoriesSummary || "Nenhum fato gravado"}

INSTRUÇÃO CRÍTICA PARA EXECUÇÃO DE AÇÕES:
Se o usuário solicitar ligar, desligar, ativar, alternar ou acender qualquer dispositivo ou luz, você DEVE responder confirmando a ação no tom de JARVIS e obrigatoriamente adicionar no final da sua resposta exatamente uma tag no formato:
[[ACTION: {"deviceId": "ID_DO_DISPOSITIVO", "deviceName": "NOME_DO_DISPOSITIVO", "targetState": true ou false}]]

Exemplo:
Usuário: "Ligue a luz da sala"
Resposta: "Com certeza, senhor. Acionando a iluminação da sala agora mesmo. [[ACTION: {"deviceId": "dev-123", "deviceName": "Luz Sala", "targetState": true}]]"

Se o usuário perguntar sobre o estado da casa, segurança ou câmeras, sintetize as informações com base no estado acima. Responda em Português do Brasil. Seja direto e evite enrolação.`;

  const start = performance.now();

  try {
    let rawOutput = "";

    if (providerId === "gemini") {
      const cleanKey = key.trim().replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "").trim();
      const targetModel = model && model !== "gemini-2.5-flash" ? model : "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      
      const contents: any[] = [];
      // Inclui histórico recente se houver
      for (const h of chatHistory.slice(-4)) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: userPrompt }],
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Status HTTP ${res.status}`);
      }

      const data = await res.json();
      rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (providerId === "openai" || providerId === "groq" || providerId === "openrouter" || providerId === "deepseek" || providerId === "ollama") {
      let targetUrl = "https://api.openai.com/v1/chat/completions";
      if (providerId === "groq") targetUrl = "https://api.groq.com/openai/v1/chat/completions";
      if (providerId === "openrouter") targetUrl = "https://openrouter.ai/api/v1/chat/completions";
      if (providerId === "deepseek") targetUrl = "https://api.deepseek.com/chat/completions";
      if (providerId === "ollama") targetUrl = config.customEndpoints.ollama || "http://localhost:11434/v1/chat/completions";

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      if (providerId === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Casa Inteligente AI";
      }

      const messages: any[] = [{ role: "system", content: systemPrompt }];
      for (const h of chatHistory.slice(-4)) {
        messages.push({ role: h.role, content: h.content });
      }
      messages.push({ role: "user", content: userPrompt });

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Status HTTP ${res.status}`);
      }

      const data = await res.json();
      rawOutput = data.choices?.[0]?.message?.content || "";
    } else if (providerId === "anthropic") {
      const messages: any[] = [];
      for (const h of chatHistory.slice(-4)) {
        messages.push({ role: h.role, content: h.content });
      }
      messages.push({ role: "user", content: userPrompt });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages,
          max_tokens: 500,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Status HTTP ${res.status}`);
      }

      const data = await res.json();
      rawOutput = data.content?.[0]?.text || "";
    }

    const elapsed = Math.round(performance.now() - start);

    // Interpretar tags de ação [[ACTION: {...}]]
    let cleanText = rawOutput;
    let actionTaken: string | undefined;
    let deviceToToggle: { id: string; name: string; targetState: boolean } | undefined;

    const actionRegex = /\[\[ACTION:\s*(\{.*?\})\s*\]\]/s;
    const match = rawOutput.match(actionRegex);
    if (match) {
      try {
        const actionObj = JSON.parse(match[1]);
        if (actionObj.deviceId) {
          deviceToToggle = {
            id: actionObj.deviceId,
            name: actionObj.deviceName || "Dispositivo",
            targetState: Boolean(actionObj.targetState),
          };
          actionTaken = `${actionObj.targetState ? "Ligado" : "Desligado"}: ${actionObj.deviceName}`;
        }
      } catch (e) {
        console.warn("Falha ao processar tag de ação da IA:", e);
      }
      cleanText = rawOutput.replace(actionRegex, "").trim();
    }

    return {
      text: cleanText || "Comando processado com sucesso.",
      actionTaken,
      deviceToToggle,
      latencyMs: elapsed,
      providerUsed: meta.name,
      modelUsed: model,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    console.error("Erro na chamada de IA:", err);
    return {
      text: `Houve uma intercorrência com o provedor ${meta.name}: ${err?.message || "falha na comunicação"}. Meus protocolos locais foram mantidos.`,
      latencyMs: elapsed,
      providerUsed: meta.name,
      modelUsed: model,
    };
  }
}
