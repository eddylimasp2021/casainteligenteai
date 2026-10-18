import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Radar, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ScannedHost {
  ip: string;
  mac?: string;
  hostname?: string;
  openPorts: number[];
  services: string[];
  guess: { category: string; deviceType: string; label: string; protocol: string };
}

const KEY = "homepulse_scanner_url_v1";

export function NetworkScanDialog({
  open, onOpenChange, householdId, knownIps,
}: { open: boolean; onOpenChange: (o: boolean) => void; householdId: string; knownIps: string[] }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(() => (typeof window !== "undefined" && localStorage.getItem(KEY)) || "http://127.0.0.1:8080");
  const [subnet, setSubnet] = useState("");
  const [loading, setLoading] = useState(false);
  const [hosts, setHosts] = useState<ScannedHost[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  async function scan() {
    setLoading(true);
    setHosts(null);
    localStorage.setItem(KEY, url);
    try {
      const qs = subnet.trim() ? `?subnet=${encodeURIComponent(subnet.trim())}` : "";
      const res = await fetch(`${url.replace(/\/+$/, "")}/network/scan${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { subnets: string[]; hosts: ScannedHost[] };
      setHosts(data.hosts);
      toast.success(`${data.hosts.length} aparelhos encontrados em ${data.subnets.map((s) => s + ".x").join(", ")}`);
    } catch {
      toast.error("Não consegui falar com o Gateway local. Verifique se ele está ligado neste computador.");
    } finally {
      setLoading(false);
    }
  }

  async function add(h: ScannedHost) {
    const { error } = await supabase.from("devices").insert({
      household_id: householdId,
      name: h.hostname?.split(".")[0] || `${h.guess.label} (${h.ip})`,
      category: h.guess.category,
      device_type: h.guess.deviceType,
      protocol: h.guess.protocol,
      ip_address: h.ip,
      status: "online",
    } as never);
    if (error) return toast.error(friendlyError(error));
    setAdded((a) => [...a, h.ip]);
    qc.invalidateQueries({ queryKey: ["devices", householdId] });
    toast.success(`✓ ${h.ip} adicionado.`);
  }

  async function addAll() {
    for (const h of hosts ?? []) if (!knownIps.includes(h.ip) && !added.includes(h.ip)) await add(h);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Radar className="size-5 text-primary" /> Varredura da rede</DialogTitle>
          <DialogDescription>
            Procura todos os aparelhos ligados na sua rede (todos os IPs) e identifica TVs, câmeras, tomadas e outros.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Endereço do Gateway local" placeholder="http://127.0.0.1:8080" />
          <Input value={subnet} onChange={(e) => setSubnet(e.target.value)} aria-label="Rede (opcional)" placeholder="Auto (ex: 192.168.0)" />
          <Button onClick={scan} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            {loading ? "Varrendo…" : "Varrer"}
          </Button>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Testando os 254 endereços da rede… leva cerca de 30 segundos.</p>}

        {hosts && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{hosts.length} aparelhos encontrados</p>
              <Button size="sm" variant="outline" onClick={addAll}><Plus className="size-4" /> Adicionar todos os novos</Button>
            </div>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {hosts.map((h) => {
                const exists = knownIps.includes(h.ip) || added.includes(h.ip);
                return (
                  <li key={h.ip} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">{h.ip} <span className="font-sans font-normal text-muted-foreground">· {h.guess.label}</span></p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[h.hostname, h.mac].filter(Boolean).join(" · ") || "sem nome"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.services.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </div>
                    <Button size="sm" variant={exists ? "ghost" : "default"} disabled={exists} onClick={() => add(h)}>
                      {exists ? <><Check className="size-4" /> Cadastrado</> : <><Plus className="size-4" /> Adicionar</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
