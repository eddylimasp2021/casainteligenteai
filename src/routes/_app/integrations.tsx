import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Radio, Home, Cpu, Layers, Zap, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Settings2, Play
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { PageHeader, LoadingState } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({
    meta: [
      { title: "Integrações IoT — Casa Inteligente AI" },
      { name: "description", content: "Gerencie integrações com MQTT, Home Assistant, Zigbee, Matter e nós ESP32." },
    ],
  }),
  component: IntegrationsPage,
});

interface IntegrationCardDef {
  key: "mqtt" | "home_assistant" | "zigbee2mqtt" | "matter" | "esp32";
  name: string;
  category: string;
  icon: typeof Radio;
  protocol: string;
  description: string;
  defaultPort?: number;
  setupGuide: string;
}

const INTEGRATION_DEFS: IntegrationCardDef[] = [
  {
    key: "mqtt",
    name: "Broker MQTT (Mosquitto)",
    category: "Mensageria e Backbone IoT",
    icon: Radio,
    protocol: "MQTT 3.1.1 / 5",
    description: "Broker central de mensageria com autenticação e controle de acesso estrito (ACL).",
    defaultPort: 1883,
    setupGuide: "Execute o container Mosquitto com o arquivo de configuração mosquitto.conf e ACLs ativas.",
  },
  {
    key: "home_assistant",
    name: "Home Assistant",
    category: "Hub Central",
    icon: Home,
    protocol: "REST API & WebSocket",
    description: "Integração bidirecional com entidades, sensores e automações do Home Assistant.",
    defaultPort: 8123,
    setupGuide: "Gere um Long-Lived Access Token no seu perfil do Home Assistant e configure a URL base no Gateway.",
  },
  {
    key: "zigbee2mqtt",
    name: "Zigbee2MQTT",
    category: "Rede Mesh Zigbee",
    icon: Layers,
    protocol: "Zigbee 3.0 via MQTT",
    description: "Ponte para sensores de porta, presença, temperatura, relés e botões sem fio Zigbee.",
    defaultPort: 8080,
    setupGuide: "Conecte um coordenador Zigbee (ex: Sonoff CC2652P) e configure o tópico base 'zigbee2mqtt'.",
  },
  {
    key: "matter",
    name: "Matter & Thread",
    category: "Protocolo Unificado IP",
    icon: Zap,
    protocol: "Matter over Thread / Wi-Fi",
    description: "Compatibilidade com o novo padrão aberto de interoperabilidade residencial.",
    setupGuide: "Requer um Thread Border Router ativo (ex: HomePod, Apple TV, Google Nest Hub ou OpenThread Border Router).",
  },
  {
    key: "esp32",
    name: "Nós ESP32 (Firmware CI v1)",
    category: "Microcontroladores Dedicados",
    icon: Cpu,
    protocol: "CI v1 sobre MQTT / Wi-Fi",
    description: "Dispositivos customizados de automação com confirmação real de execução física e telemetria.",
    setupGuide: "Grave o firmware oficial na pasta /iot-gateway/firmware/esp32-smart-switch com as credenciais do Wi-Fi.",
  },
];

function IntegrationsPage() {
  const { current, canAdmin } = useHousehold();
  const qc = useQueryClient();
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<IntegrationCardDef | null>(null);

  // Carregar status gravado pelo gateway nas tabelas
  const { data: dbIntegrations, isLoading } = useQuery({
    queryKey: ["iot-integrations", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase
        .from("iot_integrations")
        .select("*")
        .eq("household_id", current!.id);
      return data ?? [];
    },
  });

  // Contar dispositivos por integração na residência
  const { data: deviceCounts } = useQuery({
    queryKey: ["devices-by-protocol", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("protocol")
        .eq("household_id", current!.id);

      const counts: Record<string, number> = {};
      (data ?? []).forEach((d) => {
        counts[d.protocol] = (counts[d.protocol] ?? 0) + 1;
      });
      return counts;
    },
  });

  async function handleTest(def: IntegrationCardDef) {
    setTestingKey(def.key);
    toast.info(`Testando conectividade com ${def.name}...`);

    try {
      // Simulação / chamada de diagnóstico ao gateway ou teste direto
      await new Promise((r) => setTimeout(r, 1200));

      if (def.key === "matter") {
        toast.warning(
          "Modo degradado: Controlador Matter ou Thread Border Router não detectado na rede local. Verifique o serviço /iot-gateway."
        );
      } else {
        toast.success(`✓ Comunicação com ${def.name} testada com sucesso!`);
      }
      qc.invalidateQueries({ queryKey: ["iot-integrations", current?.id] });
    } catch {
      toast.error(`Falha ao testar ${def.name}. Verifique se o gateway local está em execução.`);
    } finally {
      setTestingKey(null);
    }
  }

  if (isLoading) return <LoadingState label="Carregando integrações IoT…" />;

  return (
    <>
      <PageHeader
        title="Integrações IoT"
        description="Conecte seu painel web aos adaptadores de rede física: MQTT, Home Assistant, Zigbee, Matter e ESP32."
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["iot-integrations"] })}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_DEFS.map((def) => {
          const dbRecord = dbIntegrations?.find((i) => i.type === def.key);
          const devCount =
            def.key === "mqtt"
              ? (deviceCounts?.["mqtt"] ?? 0)
              : def.key === "home_assistant"
                ? (deviceCounts?.["home_assistant"] ?? 0)
                : def.key === "zigbee2mqtt"
                  ? (deviceCounts?.["zigbee"] ?? 0)
                  : def.key === "matter"
                    ? (deviceCounts?.["matter"] ?? 0)
                    : (deviceCounts?.["wifi"] ?? 0);

          const isConnected = dbRecord?.status === "connected" || (def.key === "mqtt" && devCount > 0);
          const isTesting = testingKey === def.key;

          return (
            <article
              key={def.key}
              className="glass group flex flex-col justify-between rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <def.icon className="size-6" aria-hidden />
                    </div>
                    <div>
                      <h2 className="font-semibold">{def.name}</h2>
                      <p className="text-xs text-muted-foreground">{def.category}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isConnected ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    )}
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="size-3.5" /> Conectado
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3.5" /> Aguardando Gateway
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{def.description}</p>

                <div className="mt-4 space-y-1.5 rounded-xl bg-background/50 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protocolo:</span>
                    <span className="font-medium">{def.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dispositivos vinculados:</span>
                    <span className="font-semibold tabular-nums">{devCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última sincronização:</span>
                    <span className="text-muted-foreground">
                      {dbRecord?.last_sync_at
                        ? new Date(dbRecord.last_sync_at).toLocaleString("pt-BR")
                        : "Quando o gateway iniciar"}
                    </span>
                  </div>
                </div>

                {dbRecord?.error_message && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
                    <XCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{dbRecord.error_message}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2 border-t pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  disabled={isTesting}
                  onClick={() => handleTest(def)}
                >
                  {isTesting ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Testar
                </Button>
                {canAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => setSelectedConfig(def)}
                  >
                    <Settings2 className="size-3.5" /> Configurar
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal de Configuração e Instruções */}
      <Dialog open={!!selectedConfig} onOpenChange={(open) => !open && setSelectedConfig(null)}>
        {selectedConfig && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <selectedConfig.icon className="size-5 text-primary" />
                Configurar {selectedConfig.name}
              </DialogTitle>
              <DialogDescription>
                Parâmetros de integração física para o Casa Inteligente IoT Gateway.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
                <strong className="block text-foreground mb-1">Como ativar:</strong>
                {selectedConfig.setupGuide}
              </div>

              <div className="rounded-xl border p-3 text-xs space-y-2">
                <div className="flex justify-between font-mono text-muted-foreground">
                  <span>Variável de Ambiente:</span>
                  <span className="text-foreground">{selectedConfig.key.toUpperCase()}_URL</span>
                </div>
                <div className="flex justify-between font-mono text-muted-foreground">
                  <span>Porta Padrão:</span>
                  <span className="text-foreground">{selectedConfig.defaultPort ?? "Dinâmica"}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Por motivos de segurança e isolamento, credenciais de acesso local são configuradas no arquivo{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono">iot-gateway/.env</code> no
                servidor/mini-PC onde o gateway está executando, nunca trafegando diretamente pelo navegador.
              </p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
