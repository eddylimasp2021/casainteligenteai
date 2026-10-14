import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cpu, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms, logAction } from "@/lib/queries";
import { friendlyError, roomIcon } from "@/lib/catalog";
import { DeviceCard } from "@/components/home/DeviceCard";
import { DeviceFormDialog } from "@/components/home/DeviceFormDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/rooms/$id")({
  head: () => ({
    meta: [
      { title: "Ambiente — Casa Inteligente AI" },
      { name: "description", content: "Painel completo do ambiente com seus dispositivos." },
      { property: "og:title", content: "Ambiente — Casa Inteligente AI" },
      { property: "og:description", content: "Painel do ambiente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { id } = Route.useParams();
  const { current, canAdmin, canControl } = useHousehold();
  const rooms = useRooms(current?.id);
  const devices = useDevices(current?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [del, setDel] = useState(false);

  if (rooms.isLoading) return <LoadingState />;
  const room = rooms.data?.find((r) => r.id === id);
  if (!room) return <ErrorState message="Ambiente não encontrado." />;
  const Icon = roomIcon(room.icon);
  const ds = (devices.data ?? []).filter((d) => d.room_id === id);

  async function rename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name || !current) return;
    const { error } = await supabase.from("rooms").update({ name }).eq("id", id);
    if (error) return toast.error(friendlyError(error));
    await logAction(current.id, "room.updated", null, { room_id: id, name });
    qc.invalidateQueries({ queryKey: ["rooms", current.id] });
    setEditing(null); toast.success("✓ Cômodo renomeado.");
  }
  async function remove() {
    if (!current) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return toast.error(friendlyError(error));
    await logAction(current.id, "room.deleted", null, { name: room!.name });
    qc.invalidateQueries({ queryKey: ["rooms", current.id] });
    toast.success("✓ Cômodo excluído."); navigate({ to: "/rooms" });
  }

  return (
    <>
      <Link to="/rooms" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Cômodos</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="rounded-2xl bg-primary/15 p-4 text-primary"><Icon className="size-7" /></div>
        {editing ? (
          <form onSubmit={rename} className="flex gap-2"><Input name="name" defaultValue={room.name} autoFocus aria-label="Nome do cômodo" /><Button type="submit">Salvar</Button></form>
        ) : (
          <div><h1 className="text-3xl font-semibold">{room.name}</h1><p className="text-sm text-muted-foreground">{ds.length} dispositivos</p></div>
        )}
        {canAdmin && (
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="icon" aria-label="Renomear" onClick={() => setEditing(id)}><Pencil className="size-4" /></Button>
            <Button variant="secondary" size="icon" aria-label="Excluir cômodo" onClick={() => setDel(true)}><Trash2 className="size-4" /></Button>
            <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Dispositivo</Button>
          </div>
        )}
      </div>
      {ds.length === 0 ? <EmptyState icon={Cpu} title="Nenhum dispositivo neste ambiente" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ds.map((d) => <DeviceCard key={d.id} device={d} canControl={canControl} />)}</div>
      )}
      {current && <DeviceFormDialog open={adding} onOpenChange={setAdding} householdId={current.id} rooms={rooms.data ?? []} defaultRoomId={id} />}
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir “{room.name}”?</AlertDialogTitle><AlertDialogDescription>Os dispositivos continuarão cadastrados, sem cômodo.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
