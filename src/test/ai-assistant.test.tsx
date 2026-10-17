import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";

import { AIAssistantPage } from "@/routes/_app/ai-assistant";
import { toast } from "sonner";

// ── Mock do TanStack Router ──
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    options: config,
  }),
  Link: ({ to, children, ...props }: any) => (
    <a href={to} data-testid="router-link" {...props}>
      {children}
    </a>
  ),
}));

// ── Mock de Sonner Toast ──
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// ── Mock de Supabase Client ──
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// ── Mock de Household e Queries ──
const mockCurrentHousehold = {
  id: "hh-test-123",
  name: "Residência Principal",
  role: "owner" as const,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  deleted_at: null,
};

let mockDevicesData: any[] | undefined = [
  {
    id: "dev-light-1",
    household_id: "hh-test-123",
    name: "Luz da Sala",
    category: "lighting",
    status: "online",
    state: { on: false, brightness: 100 },
    rooms: { name: "Sala de Estar" },
  },
  {
    id: "dev-tv-1",
    household_id: "hh-test-123",
    name: "Smart TV LG",
    category: "entertainment",
    status: "online",
    state: { on: true, volume: 20 },
    rooms: { name: "Sala de Estar" },
  },
];

let mockRoomsData: any[] | undefined = [
  { id: "room-1", household_id: "hh-test-123", name: "Sala de Estar", sort_order: 1 },
  { id: "room-2", household_id: "hh-test-123", name: "Cozinha", sort_order: 2 },
];

vi.mock("@/lib/household", () => ({
  useHousehold: () => ({
    current: mockCurrentHousehold,
    households: [mockCurrentHousehold],
    loading: false,
    canAdmin: true,
    canControl: true,
    refetch: vi.fn(),
    setCurrentId: vi.fn(),
  }),
}));

vi.mock("@/lib/queries", () => ({
  useDevices: () => ({
    data: mockDevicesData,
    isLoading: false,
  }),
  useRooms: () => ({
    data: mockRoomsData,
    isLoading: false,
  }),
  logAction: vi.fn(),
  stateOf: (d: any) => d?.state || {},
}));

// Helper para renderizar com QueryClientProvider
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// Helper para acionar mudança de abas no Radix UI (que escuta onMouseDown)
function clickTab(tabElement: HTMLElement) {
  fireEvent.mouseDown(tabElement, { button: 0, ctrlKey: false });
  fireEvent.click(tabElement);
}

describe("AIAssistantPage — Suite de Validação de Ícones & Prevenção de Telas em Branco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDevicesData = [
      {
        id: "dev-light-1",
        household_id: "hh-test-123",
        name: "Luz da Sala",
        category: "lighting",
        status: "online",
        state: { on: false, brightness: 100 },
        rooms: { name: "Sala de Estar" },
      },
    ];
    mockRoomsData = [{ id: "room-1", household_id: "hh-test-123", name: "Sala de Estar", sort_order: 1 }];
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 1: VALIDAÇÃO DE ÍCONES (ICON RENDERING INTEGRITY)
  // ══════════════════════════════════════════════════════════════
  describe("1. Renderização de Ícones Lucide (Prevenção de Telas em Branco por Missing Icons)", () => {
    const requiredIcons = [
      "Sparkles",
      "Mic",
      "MicOff",
      "Send",
      "Volume2",
      "VolumeX",
      "RefreshCw",
      "Settings2",
      "Brain",
      "Activity",
      "ShieldCheck",
      "Terminal",
      "Layers",
      "Trash2",
      "Plus",
      "Zap",
      "Home",
      "Eye",
      "Camera",
      "CheckCircle2",
      "Flame",
      "Radio",
      "Power",
      "Clock",
      "Info",
      "Play",
      "Pause",
      "Key",
      "ExternalLink",
      "Check",
      "AlertTriangle",
      "Workflow",
    ] as const;

    it("todos os 32 ícones Lucide usados na página do assistente de IA devem existir e ser componentes válidos", () => {
      for (const iconName of requiredIcons) {
        const IconComponent = (LucideIcons as any)[iconName];
        expect(
          IconComponent,
          `O ícone "${iconName}" está indefinido no pacote lucide-react e causará tela em branco!`
        ).toBeDefined();
        expect(
          typeof IconComponent === "function" || typeof IconComponent === "object",
          `O ícone "${iconName}" não é um componente React válido!`
        ).toBe(true);
      }
    });

    it("renderiza cada ícone com sucesso sem lançar erros no DOM", () => {
      for (const iconName of requiredIcons) {
        const IconComponent = (LucideIcons as any)[iconName];
        const { container, unmount } = render(<IconComponent className="test-icon size-4" data-testid={`icon-${iconName}`} />);
        const svg = container.querySelector("svg");
        expect(svg, `O ícone "${iconName}" falhou ao produzir elemento <svg>`).not.toBeNull();
        expect(svg).toHaveClass("lucide");
        unmount();
      }
    });

    it("valida os ícones dinâmicos do array de Habilidades (Skills) para que nunca sejam nulos", () => {
      const skillIcons = [
        LucideIcons.Zap,
        LucideIcons.Camera,
        LucideIcons.Flame,
        LucideIcons.Brain,
        LucideIcons.Radio,
        LucideIcons.Power,
      ];

      for (const Icon of skillIcons) {
        expect(Icon).toBeDefined();
        const { container, unmount } = render(<Icon className="size-4 text-primary" />);
        expect(container.querySelector("svg")).not.toBeNull();
        unmount();
      }
    });

    it("valida os ícones das abas do sistema (HUD, Habilidades, Memória, Telemetria, Chaves IA, Rotinas)", () => {
      const tabIcons = [
        LucideIcons.Zap,
        LucideIcons.Layers,
        LucideIcons.Brain,
        LucideIcons.Activity,
        LucideIcons.Key,
        LucideIcons.Workflow,
      ];

      for (const Icon of tabIcons) {
        expect(Icon).toBeDefined();
        const { container, unmount } = render(<Icon className="size-3.5" />);
        expect(container.querySelector("svg")).not.toBeNull();
        unmount();
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 2: RENDERIZAÇÃO INICIAL & HUD HOLOGRÁFICO
  // ══════════════════════════════════════════════════════════════
  describe("2. Renderização Inicial da Página & HUD Holográfico", () => {
    it("renderiza o cabeçalho Mark-LV e os elementos principais sem tela em branco", () => {
      renderWithProviders(<AIAssistantPage />);

      expect(screen.getByRole("heading", { level: 1, name: /MARK-LV/i })).toBeInTheDocument();
      expect(screen.getByText(/JARVIS CORE v55/i)).toBeInTheDocument();
      expect(screen.getByText(/Assistente Pessoal Autônomo com Voz em Tempo Real/i)).toBeInTheDocument();
      expect(screen.getByText(/standby/i)).toBeInTheDocument();
    });

    it("renderiza o canvas holográfico do Reator Arc e seu rótulo de telemetria", () => {
      const { container } = renderWithProviders(<AIAssistantPage />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas?.width).toBe(320);
      expect(canvas?.height).toBe(320);

      expect(screen.getByText(/CORE: ARC-MK-55/i)).toBeInTheDocument();
      expect(screen.getByText("IA MARK-LV")).toBeInTheDocument();
      expect(screen.getByText(/PRONTO/i)).toBeInTheDocument();
    });

    it("renderiza o feed de mensagens do terminal com a mensagem inicial do assistente", () => {
      renderWithProviders(<AIAssistantPage />);

      expect(screen.getByText(/Log de Comandos & Ações/i)).toBeInTheDocument();
      expect(screen.getByText(/Sistemas Mark-LV operacionais e conectados à Casa Inteligente AI/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Envie um comando por voz ou texto para o Mark-LV.../i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 3: SELEÇÃO DE TEMAS VISUAIS
  // ══════════════════════════════════════════════════════════════
  describe("3. Fluxo de Seleção de Temas (Theming)", () => {
    it("permite alternar entre os temas CYAN, AMBER, EMERALD e PURPLE sem erros", () => {
      renderWithProviders(<AIAssistantPage />);

      const amberBtn = screen.getByRole("button", { name: "AMBER" });
      const emeraldBtn = screen.getByRole("button", { name: "EMERALD" });
      const purpleBtn = screen.getByRole("button", { name: "PURPLE" });
      const cyanBtn = screen.getByRole("button", { name: "CYAN" });

      // Troca para AMBER
      fireEvent.click(amberBtn);
      expect(amberBtn).toHaveClass("bg-primary");

      // Troca para EMERALD
      fireEvent.click(emeraldBtn);
      expect(emeraldBtn).toHaveClass("bg-primary");

      // Troca para PURPLE
      fireEvent.click(purpleBtn);
      expect(purpleBtn).toHaveClass("bg-primary");

      // Volta para CYAN
      fireEvent.click(cyanBtn);
      expect(cyanBtn).toHaveClass("bg-primary");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 4: CONTROLES DE VOZ E ÁUDIO
  // ══════════════════════════════════════════════════════════════
  describe("4. Fluxo de Controles de Áudio e Voz", () => {
    it("alterna entre Voz Ativa e Mudo ao clicar no botão de volume", () => {
      renderWithProviders(<AIAssistantPage />);

      const voiceToggleBtn = screen.getByTitle("Voz Ativada");
      expect(voiceToggleBtn).toHaveTextContent("Voz Ativa");

      // Clica para mutar
      fireEvent.click(voiceToggleBtn);
      expect(screen.getByTitle("Voz Mutada")).toHaveTextContent("Mudo");

      // Clica para desmutar
      fireEvent.click(screen.getByTitle("Voz Mutada"));
      expect(screen.getByTitle("Voz Ativada")).toHaveTextContent("Voz Ativa");
    });

    it("lida graciosamente com clique no microfone quando o navegador não suporta SpeechRecognition", () => {
      renderWithProviders(<AIAssistantPage />);

      const micButton = screen.getByRole("button", { name: /Falar com Mark-LV/i });
      fireEvent.click(micButton);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Reconhecimento de voz não suportado")
      );
      // Garante que o componente continua totalmente montado
      expect(screen.getByRole("heading", { level: 1, name: /MARK-LV/i })).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 5: NAVEGAÇÃO ENTRE TODAS AS ABAS (TABS CRASH PREVENTION)
  // ══════════════════════════════════════════════════════════════
  describe("5. Navegação Entre Abas (Verificação contra Telas em Branco)", () => {
    it("navega para a aba 'Habilidades & Dispositivos' e exibe os 6 cards de recursos", () => {
      renderWithProviders(<AIAssistantPage />);

      const skillsTab = screen.getByRole("tab", { name: /Habilidades & Dispositivos/i });
      clickTab(skillsTab);

      expect(screen.getByText(/Habilidades Ativas do Mark-LV/i)).toBeInTheDocument();
      expect(screen.getByText(/6 Habilidades Prontas/i)).toBeInTheDocument();

      // Verifica os 6 recursos essenciais
      expect(screen.getByText(/Controle de Iluminação & Cargas/i)).toBeInTheDocument();
      expect(screen.getByText(/Vigilância CFTV & NVR Disco D/i)).toBeInTheDocument();
      expect(screen.getByText(/Climatização & Sensoriamento/i)).toBeInTheDocument();
      expect(screen.getByText(/Memória Neural Persistente/i)).toBeInTheDocument();
      expect(screen.getByText(/Gateway IoT & Túnel Cloudflare/i)).toBeInTheDocument();
      expect(screen.getByText(/Automação de Rotinas e Cenas/i)).toBeInTheDocument();
    });

    it("navega para a aba 'Memória Mark-LV' e exibe os fatos memorizados e botão de novo fato", () => {
      renderWithProviders(<AIAssistantPage />);

      const memoryTab = screen.getByRole("tab", { name: /Memória Mark-LV/i });
      clickTab(memoryTab);

      expect(screen.getByText(/Memória Persistente do Mark-LV/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ensinar Novo Fato/i })).toBeInTheDocument();
      expect(screen.getByText(/Prefere luzes quentes e suaves no período noturno/i)).toBeInTheDocument();
      expect(screen.getByText(/Câmera da garagem e portão devem permanecer monitorados/i)).toBeInTheDocument();
    });

    it("navega para a aba 'Telemetria & Modelos' e exibe a Escada de Modelos e status de hardware", () => {
      renderWithProviders(<AIAssistantPage />);

      const telemetryTab = screen.getByRole("tab", { name: /Telemetria & Modelos/i });
      clickTab(telemetryTab);

      expect(screen.getByText(/Escada de Modelos Mark-LV/i)).toBeInTheDocument();
      expect(screen.getByText(/Gemini 3.1 Flash Live/i)).toBeInTheDocument();
      expect(screen.getByText(/Gemini 2.5 Flash \(Ações & Ferramentas\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Local Smart Home Rule Engine/i)).toBeInTheDocument();

      expect(screen.getByText(/Status do Gateway & Hardware Host/i)).toBeInTheDocument();
      expect(screen.getByText(/PORTA 1984 \(HEALTHY\)/i)).toBeInTheDocument();
      expect(screen.getByText(/PORTA 1985 \(GRAVANDO\)/i)).toBeInTheDocument();
      expect(screen.getByText(/HTTPS ATIVO/i)).toBeInTheDocument();
      expect(screen.getByText(/D:\\Gravacoes_CFTV/i)).toBeInTheDocument();
    });

    it("navega para a aba 'Provedores & Chaves IA' e exibe o Google Gemini e provedores universais", () => {
      renderWithProviders(<AIAssistantPage />);

      const keysTab = screen.getByRole("tab", { name: /Provedores & Chaves IA/i });
      clickTab(keysTab);

      expect(screen.getByText(/Provedores de Inteligência Artificial & Chave API/i)).toBeInTheDocument();
      expect(screen.getByText(/Google Gemini \(Recomendado\)/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Cole sua chave do Gemini aqui/i)).toBeInTheDocument();

      // Provedores universais da lista
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Groq Cloud")).toBeInTheDocument();
      expect(screen.getByText("Anthropic Claude")).toBeInTheDocument();
      expect(screen.getByText("DeepSeek")).toBeInTheDocument();
      expect(screen.getByText("OpenRouter")).toBeInTheDocument();
      expect(screen.getByText("Ollama / Local")).toBeInTheDocument();
    });

    it("navega para a aba 'Rotinas Domésticas IA' e exibe os cards de inspiração e botão de criação", () => {
      renderWithProviders(<AIAssistantPage />);

      const routinesTab = screen.getByRole("tab", { name: /Rotinas Domésticas IA/i });
      clickTab(routinesTab);

      expect(screen.getByText(/Gerador de Rotinas Residenciais Mark-LV/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Criar Nova Rotina com IA/i })).toBeInTheDocument();
      expect(screen.getByText(/Ver Painel Completo de Automações/i)).toBeInTheDocument();

      // 3 cards de inspiração pré-configurados
      expect(screen.getByText(/Modo Repouso & Dormir/i)).toBeInTheDocument();
      expect(screen.getByText(/Experiência de Cinema/i)).toBeInTheDocument();
      expect(screen.getByText(/Bom Dia Produtivo/i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 6: INTERAÇÃO DE COMANDOS & CHIPS RÁPIDOS
  // ══════════════════════════════════════════════════════════════
  describe("6. Interação de Comandos, Input de Texto & Pílulas de Ação", () => {
    it("envia comando digitado no input e exibe resposta heurística do assistente", async () => {
      renderWithProviders(<AIAssistantPage />);

      const input = screen.getByPlaceholderText(/Envie um comando por voz ou texto para o Mark-LV.../i);
      const sendButton = screen.getByTitle("Enviar comando");

      // Digita comando
      fireEvent.change(input, { target: { value: "Status geral da casa" } });
      expect(sendButton).not.toBeDisabled();

      // Envia
      fireEvent.click(sendButton);

      // Mensagem do usuário aparece no feed
      expect(screen.getAllByText("Status geral da casa").length).toBeGreaterThanOrEqual(1);
      expect(input).toHaveValue("");

      // Resposta do assistente aparece após processamento
      await waitFor(
        () => {
          expect(screen.getByText(/Todos os sistemas operacionais, senhor/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it("executa comando ao clicar no chip de atalho rápido 'Temperatura atual'", async () => {
      renderWithProviders(<AIAssistantPage />);

      const chip = screen.getByRole("button", { name: "Temperatura atual" });
      fireEvent.click(chip);

      expect(screen.getAllByText("Temperatura atual").length).toBeGreaterThanOrEqual(1);

      await waitFor(
        () => {
          expect(screen.getByText(/A temperatura interna média é de 23.5°C/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it("aciona dispositivo ao pedir para ligar e emite sinal de telemetria", async () => {
      renderWithProviders(<AIAssistantPage />);

      const input = screen.getByPlaceholderText(/Envie um comando por voz ou texto para o Mark-LV.../i);
      const sendButton = screen.getByTitle("Enviar comando");

      fireEvent.change(input, { target: { value: "Ligar Luz da Sala" } });
      fireEvent.click(sendButton);

      await waitFor(
        () => {
          expect(screen.getByText(/Acionando Luz da Sala agora mesmo/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 7: CRUD DA MEMÓRIA PERSISTENTE DO MARK-LV
  // ══════════════════════════════════════════════════════════════
  describe("7. Gerenciamento da Memória Neural (CRUD)", () => {
    it("permite ensinar um novo fato e exibi-lo na lista de memórias", async () => {
      renderWithProviders(<AIAssistantPage />);

      // Abre aba de memória
      clickTab(screen.getByRole("tab", { name: /Memória Mark-LV/i }));

      // Abre modal de ensinar fato
      fireEvent.click(screen.getByRole("button", { name: /Ensinar Novo Fato/i }));

      expect(screen.getByText(/Ensinar Novo Fato ao Mark-LV/i)).toBeInTheDocument();

      const memoryInput = screen.getByPlaceholderText(/Ex: Trancar portas automaticamente às 23:00/i);
      fireEvent.change(memoryInput, {
        target: { value: "Manter portão principal sempre travado após as 22h" },
      });

      // Clica em Memorizar
      fireEvent.click(screen.getByRole("button", { name: "Memorizar" }));

      // Fato agora aparece na lista
      await waitFor(() => {
        expect(screen.getByText("Manter portão principal sempre travado após as 22h")).toBeInTheDocument();
      });
    });

    it("permite excluir uma memória existente", async () => {
      renderWithProviders(<AIAssistantPage />);

      clickTab(screen.getByRole("tab", { name: /Memória Mark-LV/i }));

      expect(screen.getByText(/Prefere luzes quentes e suaves no período noturno/i)).toBeInTheDocument();

      const deleteButtons = screen.getAllByTitle("Esquecer este fato");
      expect(deleteButtons.length).toBeGreaterThan(0);

      // Clica para esquecer o primeiro fato
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/Prefere luzes quentes e suaves no período noturno/i)).not.toBeInTheDocument();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 8: ABERTURA DE MODAIS (AI CONFIG & ROUTINES)
  // ══════════════════════════════════════════════════════════════
  describe("8. Abertura de Diálogos e Modais Integrados", () => {
    it("abre o modal de configuração de chaves de IA ao clicar no botão do topo", () => {
      renderWithProviders(<AIAssistantPage />);

      const aiKeyButton = screen.getByTitle(/Configurar Chave do Google Gemini/i);
      fireEvent.click(aiKeyButton);

      // Modal de chaves deve estar visível no DOM
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("abre o modal do Gerador de Rotinas IA a partir da aba de rotinas", () => {
      renderWithProviders(<AIAssistantPage />);

      // Abre aba de rotinas
      clickTab(screen.getByRole("tab", { name: /Rotinas Domésticas IA/i }));

      // Clica em 'Criar Nova Rotina com IA'
      fireEvent.click(screen.getByRole("button", { name: /Criar Nova Rotina com IA/i }));

      // Diálogo de automações com IA deve estar aberto
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Criador de Rotinas com IA/i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // SUITE 9: CASOS DE BORDA & PREVENÇÃO DE TELAS EM BRANCO
  // ══════════════════════════════════════════════════════════════
  describe("9. Casos de Borda e Tolerância a Falhas (Prevenção de Tela em Branco)", () => {
    it("renderiza perfeitamente quando devices.data é undefined (estado de loading/falha de rede)", () => {
      mockDevicesData = undefined;
      expect(() => {
        renderWithProviders(<AIAssistantPage />);
      }).not.toThrow();

      expect(screen.getByRole("heading", { level: 1, name: /MARK-LV/i })).toBeInTheDocument();
    });

    it("renderiza perfeitamente quando rooms.data é undefined", () => {
      mockRoomsData = undefined;
      expect(() => {
        renderWithProviders(<AIAssistantPage />);
      }).not.toThrow();

      expect(screen.getByRole("heading", { level: 1, name: /MARK-LV/i })).toBeInTheDocument();
    });

    it("recupera-se graciosamente se localStorage contiver JSON corrompido em homepulse_mark_lv_memories", () => {
      localStorage.setItem("homepulse_mark_lv_memories", "{ corrupt-json-data: true, invalid");

      expect(() => {
        renderWithProviders(<AIAssistantPage />);
      }).not.toThrow();

      clickTab(screen.getByRole("tab", { name: /Memória Mark-LV/i }));
      // Deve ter feito fallback para DEFAULT_MEMORIES
      expect(screen.getByText(/Prefere luzes quentes e suaves no período noturno/i)).toBeInTheDocument();
    });

    it("não quebra a página se o usuário enviar comando com espaços em branco", () => {
      renderWithProviders(<AIAssistantPage />);

      const input = screen.getByPlaceholderText(/Envie um comando por voz ou texto para o Mark-LV.../i);
      const sendButton = screen.getByTitle("Enviar comando");

      fireEvent.change(input, { target: { value: "    " } });
      expect(sendButton).toBeDisabled();

      // Pressiona Enter com input vazio/espaços
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      // Página continua intacta
      expect(screen.getByRole("heading", { level: 1, name: /MARK-LV/i })).toBeInTheDocument();
    });
  });
});
