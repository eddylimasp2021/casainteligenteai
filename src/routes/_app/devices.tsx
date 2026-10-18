import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Cpu, Pencil, Plus, Trash2, Filter, Radar } from "lucide-react";
import { NetworkScanDialog } from "@/components/home/NetworkScanDialog";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, logAction, type Device } from "@/lib/queries";
import { CATEGORIES, PROTOCOL_LABEL, friendlyError } from "@/lib/catalog";
import { DeviceCard } from "@/components/home/DeviceCard";
import { DeviceFormDialog } from "@/components/home/DeviceFormDialog";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [protocol, setProtocol] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; device: Device | null }>({ open: false, device: null });
  const [scanOpen, setScanOpen] = useState(false);

  if (devices.isLoading) return <LoadingState />;
  if (devices.error) return <ErrorState message="Não foi possível carregar os dispositivos." onRetry={() => devices.refetch()} />;

  const list = (devices.data ?? []).filter((d) => {
    const matchCat = cat === "all" || d.category === cat;
    const matchProto = protocol === "all" || d.protocol === protocol;
    const matchRoom = selectedRoom === "all" || d.room_id === selectedRoom;
    const matchAvail =
      availability === "all" ||
      (availability === "online" && d.status === "online") ||
      (availability === "offline" && d.status !== "online");
    const matchQuery =
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      (d.manufacturer ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (d.model ?? "").toLowerCase().includes(q.toLowerCase());

    return matchCat && matchProto && matchRoom && matchAvail && matchQuery;
  });

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
      <PageHeader
        title="Dispositivos"
        description={`${devices.data?.length ?? 0} dispositivos cadastrados nesta residência.`}
        actions={
          canAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setScanOpen(true)}>
                <Radar className="size-4" /> Varrer rede
              </Button>
              <Button onClick={() => setForm({ open: true, device: null })}>
                <Plus className="size-4" /> Novo dispositivo
              </Button>
            </div>
          )
        }
      />

      {/* Barra de Filtros Avançada */}
      <div className="mb-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Input
            placeholder="Buscar por nome ou fabricante…"
            aria-label="Buscar dispositivo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger aria-label="Filtrar por cômodo">
              <SelectValue placeholder="Todos os cômodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cômodos</SelectItem>
              {(rooms.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={protocol} onValueChange={setProtocol}>
            <SelectTrigger aria-label="Filtrar por protocolo">
              <SelectValue placeholder="Todos os protocolos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os protocolos</SelectItem>
              {Object.entries(PROTOCOL_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={availability} onValueChange={setAvailability}>
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue placeholder="Qualquer disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer disponibilidade</SelectItem>
              <SelectItem value="online">Apenas Online</SelectItem>
              <SelectItem value="offline">Apenas Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Categorias em pílulas */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorias">
          {[["all", "Todas as categorias"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])].map(
            ([k, l]) => (
              <button
                key={k}
                aria-pressed={cat === k}
                onClick={() => setCat(k!)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  cat === k
                    ? "border-primary bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {l}
              </button>
            )
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Nenhum dispositivo encontrado"
          description={
            canAdmin
              ? "Cadastre um novo dispositivo ou ajuste os filtros acima."
              : "Nenhum dispositivo corresponde aos filtros selecionados."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <div key={d.id} className="relative">
              <DeviceCard device={d} roomName={roomName(d.room_id)} canControl={canControl} />
              <div className="mt-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span className="truncate">
                  {PROTOCOL_LABEL[d.protocol] ?? d.protocol}
                  {d.last_seen_at ? ` · visto ${new Date(d.last_seen_at).toLocaleTimeString("pt-BR")}` : " · nunca conectado"}
                </span>
                {canAdmin && (
                  <span className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Editar ${d.name}`}
                      onClick={() => setForm({ open: true, device: d })}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Excluir ${d.name}`}
                      onClick={() => remove(d)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <NetworkScanDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          householdId={current.id}
          knownIps={(devices.data ?? []).map((d) => d.ip_address ?? "").filter(Boolean)}
        />
      )}
      {current && (
        <DeviceFormDialog
          open={form.open}
          onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
          householdId={current.id}
          rooms={rooms.data ?? []}
          device={form.device}
        />
      )}
    </>
  );
}
