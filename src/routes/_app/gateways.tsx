import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Server, Cpu, Activity, RefreshCw, Plus, CheckCircle2, AlertCircle, Copy, Terminal, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { PageHeader, LoadingState, EmptyState } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/gateways")({
  head: () => ({
    meta: [
      { title: "Gateways IoT — Casa Inteligente AI" },
      { property: "og:title", content: "Gateways IoT — Casa Inteligente AI" },
      { property: "og:description", content: "Gerencie os gateways conectados à sua residência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Gerencie os nós de gateway de hardware conectados à sua residência." },
    ],
  }),
  component: GatewaysPage,
});

interface GatewayRecord {
  id: string;
  name: string;
  gateway_key: string;
  version: string;
  status: "online" | "offline" | "degraded" | "maintenance";
  ip_address: string | null;
  supported_integrations: string[];
  last_seen_at: string | null;
  created_at: string;
}

function GatewaysPage() {
  const { current, canAdmin } = useHousehold();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: gateways, isLoading } = useQuery({
    queryKey: ["iot-gateways", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("iot_gateways")
        .select("*")
        .eq("household_id", current!.id)
        .order("created_at", { ascending: false });

      return (data as GatewayRecord[] | null) ?? [];
    },
  });

  const list = gateways ?? [];

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("✓ Chave do gateway copiada para a área de transferência!");
  }

  if (isLoading) return <LoadingState label="Carregando gateways registrados…" />;

  return (
    <>
      <PageHeader
        title="Gateways de Hardware"
        description="Pontes locais responsáveis por intermediar as comunicações com os rádios Zigbee, Matter, ESP32 e Home Assistant."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["iot-gateways"] })}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
            {canAdmin && (
              <Button size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="size-4" /> Conectar Gateway
              </Button>
            )}
          </div>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Server}
          title="Nenhum Gateway Físico Conectado"
          description="Inicie o serviço Casa Inteligente IoT Gateway em um Raspberry Pi, mini-PC ou servidor local na mesma rede dos seus dispositivos."
          action={
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Terminal className="size-4" /> Ver Instruções de Instalação
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((gw) => {
            const isOnline = gw.status === "online";
            return (
              <article key={gw.id} className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-xl p-2.5",
                        isOnline ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Server className="size-6" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{gw.name}</h2>
                      <p className="font-mono text-xs text-muted-foreground">{gw.gateway_key}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                      isOnline ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {isOnline ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 rounded-xl bg-background/50 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Versão do Software:</span>
                    <span className="font-mono">{gw.version} (atualizado)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Endereço IP:</span>
                    <span className="font-mono">{gw.ip_address ?? "Rede Local / Docker"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última comunicação:</span>
                    <span className="text-muted-foreground">
                      {gw.last_seen_at ? new Date(gw.last_seen_at).toLocaleString("pt-BR") : "Aguardando primeiro ping"}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Adaptadores Suportados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(gw.supported_integrations.length > 0 ? gw.supported_integrations : ["mqtt", "esp32"]).map(
                      (intg) => (
                        <span key={intg} className="rounded-md border bg-muted/40 px-2 py-0.5 text-[10px] uppercase font-mono">
                          {intg}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-5 flex gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => copyKey(gw.gateway_key)}
                  >
                    <Copy className="size-3.5" /> Copiar ID
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal com instruções para rodar o gateway */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="size-5 text-primary" />
              Como Conectar um Gateway IoT
            </DialogTitle>
            <DialogDescription>
              O serviço roda como um container Docker independente em qualquer servidor, Raspberry Pi ou mini-PC local.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs leading-relaxed">
            <p>
              1. Clone ou copie a pasta <code className="rounded bg-muted px-1.5 py-0.5 font-mono">iot-gateway/</code> para o seu servidor local.
            </p>

            <div className="rounded-xl bg-muted/80 p-3 font-mono text-[11px] space-y-1">
              <p className="text-muted-foreground"># No seu servidor/Raspberry Pi:</p>
              <p>cd iot-gateway/deploy</p>
              <p>cp ../.env.example .env</p>
              <p>docker compose up -d</p>
            </div>

            <p>
              2. No arquivo <code className="rounded bg-muted px-1.5 py-0.5 font-mono">.env</code> do gateway, configure a URL do Supabase e o ID desta residência:
            </p>

            <div className="rounded-xl border p-3 font-mono text-[11px]">
              <p>HOUSEHOLD_ID="{current?.id}"</p>
              <p>GATEWAY_ID="gw-{current?.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-01"</p>
            </div>

            <p className="text-muted-foreground">
              Assim que o container iniciar, ele enviará o ping de heartbeat inicial e registrará todos os adaptadores físicos detectados nesta tela automaticamente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
