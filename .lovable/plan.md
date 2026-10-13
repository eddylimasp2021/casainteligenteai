# Casa Inteligente AI (HomePulse AI) — Plano em fases

O pedido é grande demais para uma única entrega com qualidade. Proposta: construir em fases. Cada fase termina funcionando de verdade, com dados reais salvos, sem botões de enfeite.

## Fase 1 — Base (esta entrega)
- Ativar o Lovable Cloud (banco de dados, login, armazenamento).
- Identidade visual: logo HomePulse (casa + pulso + circuito), ícone do site, ícones do app instalável. Tema escuro premium (azul elétrico, ciano, roxo, verde neon com moderação), tema claro e opção "seguir o sistema".
- Login em /login: e-mail e senha, criar conta, recuperar senha, lembrar sessão.
- Primeira entrada (onboarding): boas-vindas, dados da residência (nome, endereço, tipo, fuso horário, moeda) e escolha dos ambientes (sugestões + personalizados).
- Várias residências por usuário, com seletor no topo; papéis OWNER / ADMIN / MEMBER / GUEST e isolamento total entre residências.
- Estrutura de telas: barra lateral no computador, barra compacta no tablet, navegação inferior no celular.
- Dashboard: temperatura, umidade, energia, segurança, dispositivos online/offline, automações de hoje, controle rápido.
- Cômodos (/rooms, /rooms/:id) e Dispositivos (/devices) com cadastro, edição, exclusão e liga/desliga, brilho, temperatura etc. Atualização em tempo real.
- Histórico/auditoria de cada ação.
- Botão "Carregar casa de demonstração" (Casa Eduardo), marcada claramente como demonstração.

## Fase 2 — Cenas e automações
- /scenes com cenas prontas (Bom dia, Boa noite, Cinema, Saí de casa, Cheguei) e personalizadas.
- /automations: construtor QUANDO → CONDIÇÕES → AÇÕES, com AND/OR/NOT, operadores, ativar/desativar, teste manual e histórico de execuções.

## Fase 3 — Assistente IA
- Chat HomePulse AI que entende comandos, respeita permissões, pede confirmação para ações críticas e nunca diz que executou sem confirmação.
- Criação de automações por texto, só salvando após o "Criar automação".

## Fase 4 — Segurança, energia, alertas, câmeras, presença
- /security com modos (Desarmado, Casa, Ausente, Noite, Personalizado), PIN para ações críticas.
- /energy com tarifas, limites, gráficos e alertas.
- /alerts e central de notificações (lida/não lida).
- /cameras e /presence preparados, mostrando "Integração não configurada" até ligar um serviço.

## Fase 5 — Integrações e gateway
- Camada "Device Gateway" com cadastro de gateways, webhooks assinados (POST /api/webhooks/device), chaves de API e registro de integrações (MQTT, Home Assistant, Shelly, Tuya etc. como conectores configuráveis).
- /devices/pair e assistente de cadastro em 10 passos.

## Fase 6 — Administração e SaaS
- /household/users: convites e permissões granulares.
- /admin (super admin): usuários, residências, logs, saúde dos serviços.
- Planos FREE/BASIC/PRO/ENTERPRISE configuráveis (sem preços no código).
- /settings completo e controles de privacidade (exportar/excluir dados).

## Fase 7 — App instalável e offline
- Instalação no celular, aviso "Sem conexão" e funcionamento offline básico (vale só no site publicado).
- Testes automáticos dos fluxos principais.

## Detalhes técnicos
- TanStack Start + Lovable Cloud (Postgres com RLS por residência; papéis em tabela própria com função security definer).
- Tabelas da Fase 1: profiles, households, household_members, rooms, device_types, devices, device_states, audit_logs; as demais tabelas da lista entram na fase em que são usadas.
- Tempo real via Realtime do Cloud nas tabelas de estado.
- Ações sensíveis passam por funções do servidor que validam permissão antes de gravar.
- Observação: dispositivos reais só reagem quando um gateway externo estiver conectado (Fase 5); até lá os comandos ficam registrados como "aguardando gateway", sem fingir execução.
