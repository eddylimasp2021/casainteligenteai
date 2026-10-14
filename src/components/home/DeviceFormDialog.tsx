import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, PROTOCOLS, PROTOCOL_LABEL, friendlyError } from "@/lib/catalog";
import { logAction, type Device, type Room } from "@/lib/queries";

export function DeviceFormDialog({ open, onOpenChange, householdId, rooms, device, defaultRoomId }: {
  open: boolean; onOpenChange: (o: boolean) => void; householdId: string; rooms: Room[]; device?: Device | null; defaultRoomId?: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", category: "iluminacao", device_type: "lampada", room_id: "", protocol: "wifi", manufacturer: "", model: "", external_id: "", ip_address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(device ? {
      name: device.name, category: device.category, device_type: device.device_type, room_id: device.room_id ?? "",
      protocol: device.protocol, manufacturer: device.manufacturer ?? "", model: device.model ?? "",
      external_id: device.external_id ?? "", ip_address: device.ip_address ?? "",
    } : { name: "", category: "iluminacao", device_type: "lampada", room_id: defaultRoomId ?? "", protocol: "wifi", manufacturer: "", model: "", external_id: "", ip_address: "" });
  }, [open, device, defaultRoomId]);

  const types = CATEGORIES[f.category]?.types ?? {};

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Informe o nome do dispositivo.");
    setSaving(true);
    const t = types[f.device_type];
    const row = {
      name: f.name.trim(), category: f.category, device_type: f.device_type, room_id: f.room_id || null,
      protocol: f.protocol, manufacturer: f.manufacturer || null, model: f.model || null,
      external_id: f.external_id || null, ip_address: f.ip_address || null,
      capabilities: t?.caps ?? [], is_critical: !!t?.critical,
    };
    const res = device
      ? await supabase.from("devices").update(row).eq("id", device.id).select("id").single()
      : await supabase.from("devices").insert({ ...row, household_id: householdId, status: "offline" }).select("id").single();
    setSaving(false);
    if (res.error) return toast.error(friendlyError(res.error));
    await logAction(householdId, device ? "device.updated" : "device.created", res.data.id, { name: row.name });
    qc.invalidateQueries({ queryKey: ["devices", householdId] });
    toast.success(device ? "✓ Dispositivo atualizado." : "✓ Dispositivo cadastrado. Ele ficará offline até um gateway se conectar.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{device ? "Editar dispositivo" : "Novo dispositivo"}</DialogTitle>
          <DialogDescription>Os comandos chegam ao aparelho através de um gateway conectado à sua casa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="dn">Nome</Label><Input id="dn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Luz da sala" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Categoria</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v, device_type: Object.keys(CATEGORIES[v]?.types ?? {})[0] ?? "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORIES).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Tipo</Label>
              <Select value={f.device_type} onValueChange={(v) => setF({ ...f, device_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(types).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Cômodo</Label>
              <Select value={f.room_id || "none"} onValueChange={(v) => setF({ ...f, room_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Sem cômodo</SelectItem>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Protocolo</Label>
              <Select value={f.protocol} onValueChange={(v) => setF({ ...f, protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{PROTOCOL_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="dm">Fabricante</Label><Input id="dm" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="dmo">Modelo</Label><Input id="dmo" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="dx">Identificador externo</Label><Input id="dx" value={f.external_id} onChange={(e) => setF({ ...f, external_id: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="dip">IP (opcional)</Label><Input id="dip" value={f.ip_address} onChange={(e) => setF({ ...f, ip_address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
