import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Plus, Thermometer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, stateOf, logAction } from "@/lib/queries";
import { friendlyError, roomIcon } from "@/lib/catalog";
import { EmptyState, LoadingState, PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/rooms/")({
  head: () => ({
    meta: [
      { title: "Cômodos — Casa Inteligente AI" },
      { name: "description", content: "Todos os ambientes da sua casa com clima e dispositivos." },
      { property: "og:title", content: "Cômodos — Casa Inteligente AI" },
      { property: "og:description", content: "Ambientes da sua casa inteligente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const { current, canAdmin } = useHousehold();
  const rooms = useRooms(current?.id);
  const devices = useDevices(current?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !name.trim()) return;
    const { data, error } = await supabase.from("rooms").insert({ household_id: current.id, name: name.trim(), icon: name.trim().toLowerCase(), sort_order: (rooms.data?.length ?? 0) + 1 }).select("id").single();
    if (error) return toast.error(friendlyError(error));
    await logAction(current.id, "room.created", null, { room_id: data.id, name });
    qc.invalidateQueries({ queryKey: ["rooms", current.id] });
    toast.success("✓ Cômodo criado.");
    setName(""); setOpen(false);
  }

  if (rooms.isLoading) return <LoadingState />;
  const list = rooms.data ?? [];
  return (
    <>
      <PageHeader title="Cômodos" description={`${list.length} ambientes`} actions={canAdmin && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Novo cômodo</Button>} />
      {list.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Nenhum cômodo" description="Crie ambientes para organizar seus dispositivos." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => {
            const Icon = roomIcon(r.icon);
            const ds = (devices.data ?? []).filter((d) => d.room_id === r.id);
            const sensor = ds.find((d) => stateOf(d).temperature !== undefined && !d.capabilities.includes("temperature"));
            const on = ds.filter((d) => stateOf(d).on).length;
            return (
              <Link key={r.id} to="/rooms/$id" params={{ id: r.id }} className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-primary/15 p-3 text-primary"><Icon className="size-6" /></div>
                  {sensor && <span className="flex items-center gap-1 text-sm"><Thermometer className="size-4 text-cyan" />{stateOf(sensor).temperature}°C · {stateOf(sensor).humidity ?? "—"}%</span>}
                </div>
                <h2 className="mt-4 text-lg font-semibold">{r.name}</h2>
                <p className="text-sm text-muted-foreground">{ds.length} dispositivos · {on} ligados</p>
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cômodo</DialogTitle></DialogHeader>
          <form onSubmit={add} className="grid gap-4">
            <Input aria-label="Nome do cômodo" autoFocus placeholder="Ex.: Escritório" value={name} onChange={(e) => setName(e.target.value)} />
            <DialogFooter><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
