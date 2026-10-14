import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices } from "@/lib/queries";
import { EmptyState, LoadingState, PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/history")({
  head: () => ({
    meta: [
      { title: "Histórico — Casa Inteligente AI" },
      { name: "description", content: "Registro de todas as ações realizadas na sua casa." },
      { property: "og:title", content: "Histórico — Casa Inteligente AI" },
      { property: "og:description", content: "Auditoria das ações da sua casa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const PERIODS: Record<string, [string, number]> = { today: ["Hoje", 0], yesterday: ["Ontem", 1], "7d": ["7 dias", 7], "30d": ["30 dias", 30] };
const ACTIONS: Record<string, string> = {
  "device.control": "Controle de dispositivo", "device.created": "Dispositivo cadastrado", "device.updated": "Dispositivo editado",
  "device.deleted": "Dispositivo excluído", "room.created": "Cômodo criado", "room.updated": "Cômodo editado", "room.deleted": "Cômodo excluído",
  "household.created": "Residência criada", "demo.created": "Casa de demonstração criada",
};
const RESULTS: Record<string, [string, string]> = {
  success: ["Sucesso", "text-success"], simulated: ["Simulado", "text-violet"], pending_gateway: ["Aguardando gateway", "text-warning"], device_offline: ["Dispositivo offline", "text-destructive"],
};
const PAGE = 30;

function HistoryPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const [period, setPeriod] = useState("7d");
  const [device, setDevice] = useState("all");
  const [page, setPage] = useState(0);

  const q = useQuery({
    queryKey: ["history", current?.id, period, device, page],
    enabled: !!current,
    queryFn: async () => {
      const days = PERIODS[period]![1];
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - days);
      let query = supabase.from("audit_logs").select("*", { count: "exact" }).eq("household_id", current!.id).gte("created_at", from.toISOString());
      if (period === "yesterday") { const to = new Date(); to.setHours(0, 0, 0, 0); query = query.lt("created_at", to.toISOString()); }
      if (device !== "all") query = query.eq("device_id", device);
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const dname = (id: string | null) => devices.data?.find((d) => d.id === id)?.name;

  return (
    <>
      <PageHeader title="Histórico" description="Todas as ações registradas nesta residência." />
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(PERIODS).map(([k, [l]]) => (
          <Button key={k} size="sm" variant={period === k ? "default" : "secondary"} aria-pressed={period === k} onClick={() => { setPeriod(k); setPage(0); }}>{l}</Button>
        ))}
        <Select value={device} onValueChange={(v) => { setDevice(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os dispositivos</SelectItem>{devices.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {q.isLoading ? <LoadingState /> : !q.data?.rows.length ? <EmptyState icon={History} title="Nada registrado neste período" /> : (
        <>
          <ol className="glass divide-y rounded-2xl">
            {q.data.rows.map((r) => {
              const [rl, rc] = RESULTS[r.result] ?? [r.result, "text-muted-foreground"];
              const det = r.details as Record<string, unknown>;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <time className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">{new Date(r.created_at).toLocaleString("pt-BR")}</time>
                  <span className="font-medium">{ACTIONS[r.action] ?? r.action}</span>
                  <span className="text-muted-foreground">{dname(r.device_id) ?? (typeof det["name"] === "string" ? det["name"] : "")}</span>
                  {r.action === "device.control" && <code className="rounded bg-muted px-1.5 text-xs">{JSON.stringify(det)}</code>}
                  <span className={cn("ml-auto text-xs font-medium", rc)}>{rl}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{q.data.count} registros</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= q.data.count} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
