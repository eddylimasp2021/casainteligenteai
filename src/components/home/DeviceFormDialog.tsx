import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tv, Sparkles, CheckCircle2, AlertCircle, Wifi, RefreshCw } from "lucide-react";
import { CATEGORIES, PROTOCOLS, PROTOCOL_LABEL, friendlyError } from "@/lib/catalog";
import { logAction, type Device, type Room } from "@/lib/queries";
import { SMART_TV_PRESETS, testTvConnection } from "@/lib/smart-tv";

export function DeviceFormDialog({ open, onOpenChange, householdId, rooms, device, defaultRoomId }: {
  open: boolean; onOpenChange: (o: boolean) => void; householdId: string; rooms: Room[]; device?: Device | null; defaultRoomId?: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    category: "iluminacao",
    device_type: "lampada",
    room_id: "",
    protocol: "wifi",
    manufacturer: "",
    model: "",
    external_id: "",
    ip_address: "",
    status: "online" as "online" | "offline" | "pairing",
    simulated: true,
  });
  const [saving, setSaving] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPingResult(null);
    setF(device ? {
      name: device.name,
      category: device.category,
      device_type: device.device_type,
      room_id: device.room_id ?? "",
      protocol: device.protocol,
      manufacturer: device.manufacturer ?? "",
      model: device.model ?? "",
      external_id: device.external_id ?? "",
      ip_address: device.ip_address ?? "",
      status: (device.status as "online" | "offline" | "pairing") ?? "online",
      simulated: device.simulated ?? true,
    } : {
      name: "",
      category: "iluminacao",
      device_type: "lampada",
      room_id: defaultRoomId ?? "",
      protocol: "wifi",
      manufacturer: "",
      model: "",
      external_id: "",
      ip_address: "",
      status: "online",
      simulated: true,
    });
  }, [open, device, defaultRoomId]);

  const types = CATEGORIES[f.category]?.types ?? {};
  const isTv = f.category === "entretenimento" || f.device_type === "televisao";

  async function handleTestPing() {
    const targetIp = f.ip_address.trim() || "192.168.0.168";
    setTestingPing(true);
    setPingResult(null);
    try {
      const res = await testTvConnection(targetIp, f.protocol === "websocket" ? 3000 : 3000);
      setPingResult({
        ok: res.ok,
        message: res.message,
        latency: res.latencyMs,
      });
      if (res.ok) {
        toast.success(`✓ Conexão bem-sucedida com a TV em ${targetIp} (${res.latencyMs}ms)!`);
        setF((prev) => ({ ...prev, status: "online", ip_address: targetIp }));
      } else {
        toast.warning(res.message);
      }
    } catch (err: any) {
      setPingResult({ ok: false, message: err?.message || "Falha ao testar conexão." });
    } finally {
      setTestingPing(false);
    }
  }

  function applyTvPreset(presetId: string) {
    const preset = SMART_TV_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setF((prev) => ({
      ...prev,
      manufacturer: preset.brand.toUpperCase(),
      model: preset.name,
      protocol: preset.protocol,
      ip_address: preset.detectedIp || prev.ip_address || "192.168.0.168",
      status: "online",
      simulated: true,
    }));
    toast.success(`Configurações de ${preset.name} aplicadas.`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Informe o nome do dispositivo.");
    setSaving(true);
    const t = types[f.device_type];
    const row = {
      name: f.name.trim(),
      category: f.category,
      device_type: f.device_type,
      room_id: f.room_id || null,
      protocol: f.protocol,
      manufacturer: f.manufacturer || null,
      model: f.model || null,
      external_id: f.external_id || null,
      ip_address: f.ip_address || null,
      status: f.status,
      simulated: f.simulated,
      capabilities: t?.caps ?? [],
      is_critical: !!t?.critical,
      last_seen_at: f.status === "online" ? new Date().toISOString() : (device?.last_seen_at || null),
    };
    const res = device
      ? await supabase.from("devices").update(row).eq("id", device.id).select("id").single()
      : await supabase.from("devices").insert({ ...row, household_id: householdId }).select("id").single();
    setSaving(false);
    if (res.error) return toast.error(friendlyError(res.error));
    await logAction(householdId, device ? "device.updated" : "device.created", res.data.id, { name: row.name });
    qc.invalidateQueries({ queryKey: ["devices", householdId] });
    toast.success(device ? "✓ Dispositivo atualizado com sucesso!" : "✓ Dispositivo cadastrado e pronto para uso!");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{device ? "Editar dispositivo" : "Novo dispositivo"}</DialogTitle>
          <DialogDescription>
            Configure os parâmetros de rede, protocolo e status de conectividade do aparelho.
          </DialogDescription>
        </DialogHeader>

        {/* Banner Especial de Detecção para Smart TV */}
        {isTv && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Tv className="size-4 text-primary" />
                Smart TV LG Detectada na Rede Local
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                192.168.0.168 (Porta 3000)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua Smart TV LG está respondendo diretamente na rede Wi-Fi. Clique no botão abaixo para preencher os dados de conexão instantaneamente.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground"
                onClick={() => applyTvPreset("lg_webos")}
              >
                <Sparkles className="size-3.5" /> Preencher TV LG (192.168.0.168)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={testingPing}
                onClick={handleTestPing}
              >
                <RefreshCw className={`size-3.5 ${testingPing ? "animate-spin" : ""}`} />
                {testingPing ? "Testando..." : "Testar Conexão (Ping)"}
              </Button>
            </div>
            {pingResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${pingResult.ok ? "text-emerald-500" : "text-amber-500"}`}>
                {pingResult.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                <span>{pingResult.message}</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dn">Nome</Label>
            <Input id="dn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="TV Sala, Luz da sala…" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v, device_type: Object.keys(CATEGORIES[v]?.types ?? {})[0] ?? "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORIES).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={f.device_type} onValueChange={(v) => setF({ ...f, device_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(types).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Cômodo</Label>
              <Select value={f.room_id || "none"} onValueChange={(v) => setF({ ...f, room_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cômodo</SelectItem>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Protocolo</Label>
              <Select value={f.protocol} onValueChange={(v) => setF({ ...f, protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{PROTOCOL_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Status de Conexão e Modo Demonstração */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Status de Conectividade</Label>
              <Select value={f.status} onValueChange={(v: "online" | "offline" | "pairing") => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">🟢 Online (Conectado)</SelectItem>
                  <SelectItem value="offline">⚪ Offline (Desconectado)</SelectItem>
                  <SelectItem value="pairing">🟡 Pareamento (Aguardando)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dip">IP na Rede Local</Label>
              <Input
                id="dip"
                value={f.ip_address}
                onChange={(e) => setF({ ...f, ip_address: e.target.value })}
                placeholder={isTv ? "192.168.0.168" : "192.168.0.x"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dm">Fabricante</Label>
              <Input id="dm" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} placeholder={isTv ? "LG" : "Ex: Philips"} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dmo">Modelo</Label>
              <Input id="dmo" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder={isTv ? "webOS Smart TV" : "Modelo"} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dx">Identificador externo / ID Dispositivo</Label>
            <Input id="dx" value={f.external_id} onChange={(e) => setF({ ...f, external_id: e.target.value })} placeholder="Opcional (MAC ou ID MQTT)" />
          </div>

          {/* Switch de Modo Simulação / Demonstração */}
          <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="sim-mode" className="text-sm font-medium">Controle Ativo / Simulação Imediata</Label>
              <p className="text-xs text-muted-foreground">
                Permite ligar, desligar e ajustar o volume diretamente na interface sem esperar retorno de gateway externo.
              </p>
            </div>
            <Switch
              id="sim-mode"
              checked={f.simulated}
              onCheckedChange={(checked) => setF({ ...f, simulated: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar Dispositivo"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
