import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Thermometer, Droplets, Zap, ShieldCheck, ShieldAlert, Cpu, Workflow, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, stateOf } from "@/lib/queries";
import { DeviceCard } from "@/components/home/DeviceCard";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Casa Inteligente AI" },
      { name: "description", content: "Visão geral da sua casa: clima, energia, segurança e dispositivos." },
      { property: "og:title", content: "Painel — Casa Inteligente AI" },
      { property: "og:description", content: "Centro de controle da sua residência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, hint, tone = "primary" }: { icon: typeof Zap; label: string; value: string; hint?: string; tone?: "primary" | "cyan" | "violet" | "success" | "warning" | "destructive" }) {
  const tones = { primary: "bg-primary/15 text-primary", cyan: "bg-cyan/15 text-cyan", violet: "bg-violet/15 text-violet", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", destructive: "bg-destructive/15 text-destructive" };
  return (
    <div className="glass rounded-2xl p-4">
      <div className={cn("mb-3 w-fit rounded-xl p-2", tones[tone])}><Icon className="size-5" aria-hidden /></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const { current, canControl, canAdmin } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);
  const today = useQuery({
    queryKey: ["actions-today", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("household_id", current!.id).gte("created_at", start.toISOString());
      return count ?? 0;
    },
  });

  if (devices.isLoading) return <LoadingState />;
  if (devices.error) return <ErrorState message="Não foi possível carregar os dispositivos." onRetry={() => devices.refetch()} />;
  const list = devices.data ?? [];
  const roomName = (id: string | null) => rooms.data?.find((r) => r.id === id)?.name;

  const sensors = list.filter((d) => d.status === "online" && stateOf(d).temperature !== undefined && !d.capabilities.includes("temperature"));
  const avg = (k: "temperature" | "humidity") => {
    const v = sensors.map((d) => stateOf(d)[k]).filter((x): x is number => typeof x === "number");
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(k === "temperature" ? 1 : 0) : null;
  };
  const power = list.reduce((s, d) => s + (d.status === "online" && stateOf(d).on !== false ? stateOf(d).power ?? 0 : 0), 0);
  const online = list.filter((d) => d.status === "online").length;
  const security = list.filter((d) => d.category === "seguranca");
  const secIssue = security.some((d) => d.status !== "online") || security.some((d) => stateOf(d).locked === false);
  const quick = list.filter((d) => d.capabilities.length > 0).slice(0, 8);

  return (
    <>
      <PageHeader title={`Olá! ${current?.name}`} description="Centro de controle da sua residência." />
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Thermometer} label="Temperatura" value={avg("temperature") ? `${avg("temperature")}°C` : "—"} hint={sensors.length ? "média dos sensores" : "sem sensor"} />
        <Stat icon={Droplets} label="Umidade" value={avg("humidity") ? `${avg("humidity")}%` : "—"} tone="cyan" />
        <Stat icon={Zap} label="Energia agora" value={`${power} W`} hint="tomadas com medição" tone="warning" />
        <Stat icon={secIssue ? ShieldAlert : ShieldCheck} label="Segurança" value={security.length === 0 ? "—" : secIssue ? "Atenção" : "Protegida"} tone={security.length === 0 ? "primary" : secIssue ? "warning" : "success"} />
        <Stat icon={Cpu} label="Dispositivos" value={`${online}/${list.length}`} hint="online" tone="violet" />
        <Stat icon={Workflow} label="Ações hoje" value={String(today.data ?? 0)} hint="registradas no histórico" />
      </section>

      {/* Banner de Rotinas & Automações com IA */}
      <section className="mt-6 rounded-2xl border bg-gradient-to-r from-card via-card to-primary/10 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Rotinas Domésticas com IA</h3>
              <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30 font-mono">
                AI Gateway
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descreva sua rotina em texto livre e a IA mapeará os dispositivos e condições automaticamente.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="gap-2 shrink-0 font-semibold shadow-xs">
          <Link to="/automations">
            <Sparkles className="size-3.5 text-cyan-300" />
            <span>Criar Rotina com IA</span>
          </Link>
        </Button>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Controle rápido</h2>
          <Link to="/devices" className="text-sm text-primary hover:underline">Ver todos</Link>
        </div>
        {quick.length === 0 ? (
          <EmptyState icon={Cpu} title="Nenhum dispositivo ainda" description="Cadastre seu primeiro dispositivo para controlá-lo por aqui."
            action={canAdmin && <Button asChild><Link to="/devices"><Plus className="size-4" /> Adicionar dispositivo</Link></Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quick.map((d) => <DeviceCard key={d.id} device={d} roomName={roomName(d.room_id)} canControl={canControl} compact />)}
          </div>
        )}
      </section>
    </>
  );
}
