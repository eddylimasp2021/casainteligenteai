import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Cpu, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, logAction, type Device } from "@/lib/queries";
import { CATEGORIES, PROTOCOL_LABEL, friendlyError } from "@/lib/catalog";
import { DeviceCard } from "@/components/home/DeviceCard";
import { DeviceFormDialog } from "@/components/home/DeviceFormDialog";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/devices")({
  head: () => ({
    meta: [
      { title: "Dispositivos — Casa Inteligente AI" },
      { name: "description", content: "Cadastre, controle e organize os dispositivos da sua casa." },
      { property: "og:title", content: "Dispositivos — Casa Inteligente AI" },
      { property: "og:description", content: "Todos os dispositivos da sua casa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { current, canAdmin, canControl } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);
  const qc = useQueryClient();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });

  if (devices.isLoading) return <LoadingState />;
  if (devices.error) return <ErrorState message="Não foi possível carregar os dispositivos." onRetry={() => devices.refetch()} />;
  const list = (devices.data ?? []).filter((d) => (cat === "all" || d.category === cat) && d.name.toLowerCase().includes(q.toLowerCase()));
  const roomName = (id: string | null) => rooms.data?.find((r) => r.id === id)?.name;

  async function remove(d: Device) {
    if (!current || !confirm(`Excluir “${d.name}”?`)) return;
    const { error } = await supabase.from("devices").delete().eq("id", d.id);
    if (error) return toast.error(friendlyError(error));
    await logAction(current.id, "device.deleted", null, { name: d.name });
    qc.invalidateQueries({ queryKey: ["devices", current.id] });
    toast.success("✓ Dispositivo excluído.");
  }

  return (
    <>
      <PageHeader title="Dispositivos" description={`${devices.data?.length ?? 0} cadastrados`}
        actions={canAdmin && <Button onClick={() => setForm({ open: true, device: null })}><Plus className="size-4" /> Novo dispositivo</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Buscar…" aria-label="Buscar dispositivo" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorias">
          {[["all", "Todos"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])].map(([k, l]) => (
            <button key={k} aria-pressed={cat === k} onClick={() => setCat(k!)}
              className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors", cat === k ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted")}>{l}</button>
          ))}
        </div>
      </div>
      {list.length === 0 ? <EmptyState icon={Cpu} title="Nenhum dispositivo encontrado" description={canAdmin ? "Cadastre um novo dispositivo para começar." : undefined} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <div key={d.id} className="relative">
              <DeviceCard device={d} roomName={roomName(d.room_id)} canControl={canControl} />
              <div className="mt-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>{PROTOCOL_LABEL[d.protocol] ?? d.protocol}{d.last_seen_at ? ` · visto ${new Date(d.last_seen_at).toLocaleString("pt-BR")}` : " · nunca conectado"}</span>
                {canAdmin && (
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Editar ${d.name}`} onClick={() => setForm({ open: true, device: d })}><Pencil className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Excluir ${d.name}`} onClick={() => remove(d)}><Trash2 className="size-3.5" /></Button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {current && <DeviceFormDialog open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} householdId={current.id} rooms={rooms.data ?? []} device={form.device} />}
    </>
  );
}
