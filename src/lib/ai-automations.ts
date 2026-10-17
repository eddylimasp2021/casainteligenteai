/**
 * Motor de Geração e Execução de Automações por IA (AI Gateway)
 * Casa Inteligente AI — HomePulse
 */

import { supabase } from "@/integrations/supabase/client";
import { Device, Room } from "@/lib/queries";
import {
  ConfigurableAutomation,
  AutomationAction,
  AutomationTrigger,
  AutomationCondition,
  AutomationCategory,
} from "@/types/automations";
import { loadAIConfig, AI_PROVIDERS } from "@/lib/ai-provider";
import { LG_COMMANDS, getSmartTvGatewayUrl } from "@/lib/smart-tv";

const STORAGE_PREFIX = "homepulse_automations_v1_";

/**
 * Carrega a lista de automações salvas para a residência ativa
 */
export function getStoredAutomations(householdId: string): ConfigurableAutomation[] {
  if (typeof window === "undefined" || !householdId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${householdId}`);
    if (!raw) return getDefaultTemplateAutomations(householdId);
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erro ao carregar automações salvas:", e);
    return [];
  }
}

/**
 * Salva a lista inteira de automações no armazenamento local
 */
export function saveStoredAutomations(
  householdId: string,
  automations: ConfigurableAutomation[]
): void {
  if (typeof window === "undefined" || !householdId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${householdId}`, JSON.stringify(automations));
    window.dispatchEvent(
      new CustomEvent("homepulse:automations-updated", { detail: { householdId, automations } })
    );
  } catch (e) {
    console.error("Erro ao salvar automações:", e);
  }
}

/**
 * Salva ou atualiza uma única automação
 */
export function saveSingleAutomation(
  householdId: string,
  automation: ConfigurableAutomation
): void {
  const current = getStoredAutomations(householdId);
  const index = current.findIndex((a) => a.id === automation.id);
  let updated: ConfigurableAutomation[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...automation, updatedAt: new Date().toISOString() };
  } else {
    updated = [automation, ...current];
  }
  saveStoredAutomations(householdId, updated);
}

/**
 * Exclui uma automação
 */
export function deleteStoredAutomation(householdId: string, id: string): void {
  const current = getStoredAutomations(householdId);
  const filtered = current.filter((a) => a.id !== id);
  saveStoredAutomations(householdId, filtered);
}

/**
 * Alterna estado ativado/desativado
 */
export function toggleAutomationEnabled(householdId: string, id: string): boolean {
  const current = getStoredAutomations(householdId);
  const item = current.find((a) => a.id === id);
  if (!item) return false;
  item.enabled = !item.enabled;
  saveStoredAutomations(householdId, current);
  return item.enabled;
}

/**
 * Executa todas as ações configuradas em uma automação contra os dispositivos reais
 */
export async function executeAutomation(
  automation: ConfigurableAutomation,
  devicesList: Device[]
): Promise<{ executed: number; failed: number; log: string[] }> {
  let executed = 0;
  let failed = 0;
  const log: string[] = [];

  for (const action of automation.actions) {
    try {
      const dev = devicesList.find((d) => d.id === action.deviceId);
      const isTv =
        dev?.category === "entretenimento" ||
        dev?.device_type === "televisao" ||
        (dev?.model && dev.model.includes("70LB7200"));
      const tvIp = dev?.ip_address || "192.168.0.168";

      // 1. Executa no Supabase RPC
      const patchState: Record<string, any> = {};
      if (typeof action.params.on === "boolean") patchState.on = action.params.on;
      if (typeof action.params.locked === "boolean") patchState.locked = action.params.locked;
      if (typeof action.params.brightness === "number") patchState.brightness = action.params.brightness;
      if (typeof action.params.temperature === "number") patchState.temperature = action.params.temperature;
      if (typeof action.params.volume === "number") patchState.volume = action.params.volume;

      const { error } = await supabase.rpc("set_device_state", {
        _device: action.deviceId,
        _patch: patchState as never,
        _confirmed: true,
      });

      // 2. Se for Smart TV, envia comando direto na rede interna / Gateway
      if (isTv) {
        try {
          if (action.params.on === false) {
            await LG_COMMANDS.powerOff(tvIp);
          } else if (typeof action.params.volume === "number") {
            await LG_COMMANDS.setVolume(tvIp, action.params.volume);
          }
        } catch (tvErr) {
          console.warn("[Automations] TV direct command warning:", tvErr);
        }
      }

      if (error) {
        failed++;
        log.push(`Falha em "${action.deviceName}": ${error.message}`);
      } else {
        executed++;
        log.push(`✓ "${action.deviceName}" atualizado com sucesso (${action.actionType})`);
      }
    } catch (err: any) {
      failed++;
      log.push(`Erro em "${action.deviceName}": ${err?.message || "Exceção"}`);
    }
  }

  // Atualiza última execução da automação
  try {
    automation.lastExecutedAt = new Date().toISOString();
    automation.executionCount = (automation.executionCount || 0) + 1;
    saveSingleAutomation(automation.householdId, automation);

    // Registra no histórico de auditoria
    await supabase.from("audit_logs").insert({
      household_id: automation.householdId,
      action: `automation_executed:${automation.id}`,
      source: "ai_automation_runner",
      result: failed === 0 ? "success" : executed > 0 ? "partial" : "error",
      details: {
        automation_name: automation.name,
        actions_count: automation.actions.length,
        executed,
        failed,
        log,
      },
    });
  } catch (e) {
    console.warn("Falha ao registrar audit log de automação:", e);
  }

  return { executed, failed, log };
}

/**
 * Utiliza o AI Gateway (Gemini, OpenAI, Claude, Groq, etc.) para interpretar o texto livre
 * e gerar uma automação configurável mapeando para os dispositivos reais da casa.
 */
export async function generateAutomationWithAI(
  freeTextPrompt: string,
  devicesList: Device[],
  roomsList: Room[],
  householdId: string
): Promise<{ automation: ConfigurableAutomation; modelUsed: string }> {
  const config = loadAIConfig();
  const providerId = config.activeProvider;
  const key = (config.keys[providerId] || "").trim();
  const model = config.selectedModels[providerId] || AI_PROVIDERS[providerId].defaultModel;
  const meta = AI_PROVIDERS[providerId];

  // Prepara resumo dos dispositivos reais disponíveis
  const availableDevices = devicesList.map((d) => {
    const room = roomsList.find((r) => r.id === d.room_id)?.name || "Geral";
    return {
      id: d.id,
      name: d.name,
      room,
      category: d.category,
      capabilities: d.capabilities,
      current_state: d.state,
    };
  });

  const promptPayload = {
    user_request: freeTextPrompt,
    house_devices: availableDevices,
    rooms: roomsList.map((r) => ({ id: r.id, name: r.name })),
  };

  const systemInstruction = `Você é o gerador de automações residenciais inteligentes do HomePulse AI (MARK-LV).
Sua missão é ler a descrição em texto livre do morador e gerar uma automação residencial completa, estruturada e configurável.

REGRAS OBRIGATÓRIAS:
1. MAPEIE as ações EXCLUSIVAMENTE para os IDs de dispositivos reais existentes na lista 'house_devices'. Se o usuário citar "luz da sala", ache o dispositivo de iluminação da sala.
2. Identifique o GATILHO ('trigger'):
   - "time": se houver horário (ex: "às 22:00", "todo dia às 7h")
   - "sensor": se depender de movimento, abertura de porta ou presença
   - "manual": se for um modo ou cena ativada sob demanda (ex: "Modo Cinema", "Modo Festa")
3. Identifique as CONDIÇÕES ('conditions'): ex: "Apenas se for período noturno", "Apenas nos dias de semana", "Se morador estiver presente".
4. Defina as AÇÕES ('actions') com o actionType apropriado:
   - "turn_on" / "turn_off"
   - "set_brightness" (params: { on: true, brightness: 0-100 })
   - "set_volume" (params: { volume: 0-100 })
   - "set_temperature" (params: { temperature: 16-30 })
   - "lock" / "unlock" (params: { locked: true/false })
5. Responda ESTRITAMENTE um objeto JSON válido (sem markdown, sem \`\`\`json, apenas o JSON puro) com esta estrutura exata:
{
  "name": "Nome descritivo da Rotina (ex: Modo Cinema Noturno)",
  "description": "Explicação concisa do que esta rotina faz",
  "category": "conforto" | "seguranca" | "energia" | "noturno" | "clima" | "geral",
  "trigger": {
    "type": "time" | "sensor" | "manual",
    "time": "HH:mm" ou null,
    "daysOfWeek": [1,2,3,4,5] (array de números onde 0=domingo, 6=sábado) ou null,
    "description": "Texto explicando o gatilho"
  },
  "conditions": [
    {
      "id": "c1",
      "type": "time_range" | "days" | "presence" | "ambient",
      "description": "Descrição clara da condição"
    }
  ],
  "actions": [
    {
      "id": "a1",
      "deviceId": "ID_REAL_DO_DISPOSITIVO",
      "deviceName": "Nome do Dispositivo",
      "roomName": "Nome do Cômodo",
      "actionType": "turn_on" | "turn_off" | "set_brightness" | "set_volume" | "set_temperature" | "lock",
      "params": {
        "on": true/false,
        "volume": 20,
        ...
      }
    }
  ]
}`;

  let parsedJson: any = null;
  let modelReported = `${meta.name} (${model})`;

  // Se tiver chave e provedor configurado, chama o AI Gateway
  if (!meta.keyRequired || key) {
    try {
      if (providerId === "gemini") {
        const cleanKey = key.trim().replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "").trim();
        const targetModel = model && model !== "gemini-2.5-flash" ? model : "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify(promptPayload) }] }],
            generationConfig: {
              temperature: 0.2, // Baixa temperatura para precisão de JSON
              responseMimeType: "application/json",
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) parsedJson = JSON.parse(cleanJsonString(text));
        }
      } else if (
        providerId === "openai" ||
        providerId === "groq" ||
        providerId === "openrouter" ||
        providerId === "deepseek" ||
        providerId === "ollama"
      ) {
        let targetUrl = "https://api.openai.com/v1/chat/completions";
        if (providerId === "groq") targetUrl = "https://api.groq.com/openai/v1/chat/completions";
        if (providerId === "openrouter") targetUrl = "https://openrouter.ai/api/v1/chat/completions";
        if (providerId === "deepseek") targetUrl = "https://api.deepseek.com/chat/completions";
        if (providerId === "ollama") targetUrl = config.customEndpoints.ollama || "http://localhost:11434/v1/chat/completions";

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (key) headers["Authorization"] = `Bearer ${key}`;

        const res = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: JSON.stringify(promptPayload) },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) parsedJson = JSON.parse(cleanJsonString(text));
        }
      }
    } catch (aiErr) {
      console.warn("[Automations] Falha na chamada da API de IA, utilizando fallback inteligente:", aiErr);
    }
  }

  // Fallback Heurístico Robusto se a IA estiver sem chave ou offline
  if (!parsedJson) {
    modelReported = "HomePulse Rule Engine (Local Fallback)";
    parsedJson = generateHeuristicAutomation(freeTextPrompt, devicesList, roomsList);
  }

  // Monta objeto final garantindo IDs e integridade
  const automation: ConfigurableAutomation = {
    id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    householdId,
    name: parsedJson.name || "Rotina Doméstica com IA",
    description: parsedJson.description || freeTextPrompt,
    category: parsedJson.category || "geral",
    enabled: true,
    trigger: {
      type: parsedJson.trigger?.type || "manual",
      time: parsedJson.trigger?.time || undefined,
      daysOfWeek: parsedJson.trigger?.daysOfWeek || [1, 2, 3, 4, 5],
      description: parsedJson.trigger?.description || "Ativação Manual ou por Gatilho",
    },
    conditions: Array.isArray(parsedJson.conditions)
      ? parsedJson.conditions.map((c: any, i: number) => ({
          id: c.id || `c-${i + 1}`,
          type: c.type || "time_range",
          description: c.description || "Condição de ativação",
        }))
      : [],
    actions: Array.isArray(parsedJson.actions)
      ? parsedJson.actions.map((a: any, i: number) => {
          const dev = devicesList.find((d) => d.id === a.deviceId) || devicesList[0];
          return {
            id: a.id || `act-${i + 1}`,
            deviceId: dev ? dev.id : a.deviceId,
            deviceName: dev ? dev.name : a.deviceName || "Dispositivo",
            roomName: a.roomName || "Geral",
            actionType: a.actionType || "turn_off",
            params: a.params || { on: false },
          };
        })
      : [],
    createdFromPrompt: freeTextPrompt,
    modelUsed: modelReported,
    createdAt: new Date().toISOString(),
  };

  return { automation, modelUsed: modelReported };
}

/**
 * Remove blocos de código markdown que alguns modelos LLM retornam
 */
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

/**
 * Parser heurístico local para quando a IA estiver sem conexão
 */
function generateHeuristicAutomation(
  prompt: string,
  devicesList: Device[],
  roomsList: Room[]
): any {
  const lower = prompt.toLowerCase();

  // Detecta horário (ex: 22h, 22:30, 07:00, às 23h)
  const timeMatch = lower.match(/(\d{1,2})(?::|h)(\d{2})?/i);
  let timeStr: string | null = null;
  if (timeMatch) {
    const h = timeMatch[1]!.padStart(2, "0");
    const m = (timeMatch[2] || "00").padStart(2, "0");
    timeStr = `${h}:${m}`;
  }

  // Categoria
  let category: AutomationCategory = "geral";
  if (lower.includes("noite") || lower.includes("dormir") || lower.includes("madrugada")) category = "noturno";
  else if (lower.includes("segurança") || lower.includes("alarme") || lower.includes("câmera")) category = "seguranca";
  else if (lower.includes("cinema") || lower.includes("filme") || lower.includes("festa")) category = "conforto";
  else if (lower.includes("ar") || lower.includes("temperatura") || lower.includes("clima")) category = "clima";

  // Identifica ações para dispositivos
  const actions: AutomationAction[] = [];

  for (const dev of devicesList) {
    const devLower = dev.name.toLowerCase();
    const isTv = dev.category === "entretenimento" || dev.device_type === "televisao";
    const isLight = dev.category === "iluminacao";
    const isClimate = dev.category === "clima";
    const isSecurity = dev.category === "seguranca";

    if (category === "noturno" || lower.includes("desligar") || lower.includes("apagar")) {
      if (isLight) {
        actions.push({
          id: `act-${dev.id}`,
          deviceId: dev.id,
          deviceName: dev.name,
          actionType: "turn_off",
          params: { on: false },
        });
      } else if (isTv && (lower.includes("tv") || lower.includes("desligar tudo"))) {
        actions.push({
          id: `act-${dev.id}`,
          deviceId: dev.id,
          deviceName: dev.name,
          actionType: "turn_off",
          params: { on: false },
        });
      }
    } else if (category === "conforto" || lower.includes("cinema")) {
      if (isLight) {
        actions.push({
          id: `act-${dev.id}`,
          deviceId: dev.id,
          deviceName: dev.name,
          actionType: "set_brightness",
          params: { on: true, brightness: 20 },
        });
      } else if (isTv) {
        actions.push({
          id: `act-${dev.id}`,
          deviceId: dev.id,
          deviceName: dev.name,
          actionType: "turn_on",
          params: { on: true, volume: 22 },
        });
      }
    } else {
      // Se citado diretamente no texto
      if (lower.includes(devLower) || (isLight && lower.includes("luz")) || (isTv && lower.includes("tv"))) {
        actions.push({
          id: `act-${dev.id}`,
          deviceId: dev.id,
          deviceName: dev.name,
          actionType: lower.includes("deslig") ? "turn_off" : "turn_on",
          params: { on: !lower.includes("deslig") },
        });
      }
    }
  }

  // Fallback se nenhum foi selecionado
  if (actions.length === 0 && devicesList.length > 0) {
    const first = devicesList[0]!;
    actions.push({
      id: `act-${first.id}`,
      deviceId: first.id,
      deviceName: first.name,
      actionType: "turn_off",
      params: { on: false },
    });
  }

  return {
    name: category === "noturno" ? "Modo Noturno & Descanso" : category === "conforto" ? "Modo Cinema & Relaxamento" : "Rotina Personalizada",
    description: `Automação gerada a partir da descrição: "${prompt}"`,
    category,
    trigger: {
      type: timeStr ? "time" : "manual",
      time: timeStr || "22:00",
      daysOfWeek: [1, 2, 3, 4, 5],
      description: timeStr ? `Diariamente às ${timeStr}` : "Ativação Manual",
    },
    conditions: [
      {
        id: "c-1",
        type: "presence",
        description: "Apenas se algum morador estiver em casa",
      },
    ],
    actions,
  };
}

/**
 * Automações modelo iniciais caso o morador não tenha nenhuma
 */
function getDefaultTemplateAutomations(householdId: string): ConfigurableAutomation[] {
  return [
    {
      id: "auto-preset-noite",
      householdId,
      name: "Proteção & Repouso Noturno",
      description: "Desliga a iluminação da sala, desliga a TV da sala e mantém as câmeras de vigilância operacionais.",
      category: "noturno",
      enabled: true,
      trigger: {
        type: "time",
        time: "23:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        description: "Todos os dias às 23:00",
      },
      conditions: [
        {
          id: "c-1",
          type: "time_range",
          description: "Apenas no período noturno (após às 22:00)",
        },
      ],
      actions: [
        {
          id: "act-tv",
          deviceId: "tv-lg-sala",
          deviceName: "TV SALA (LG 70LB7200)",
          roomName: "Sala de Estar",
          actionType: "turn_off",
          params: { on: false },
        },
      ],
      createdFromPrompt: "Às 23h, desligue a TV da sala e apague as luzes para dormir.",
      modelUsed: "Template Nativo",
      createdAt: new Date().toISOString(),
    },
  ];
}
