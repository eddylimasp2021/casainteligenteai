import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROOM_SUGGESTIONS, friendlyError, roomIcon } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState, Logo } from "@/components/home/ui-states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Configurar residência — Casa Inteligente AI" },
      { name: "description", content: "Configure sua residência e ambientes no HomePulse AI." },
      { property: "og:title", content: "Configurar residência — Casa Inteligente AI" },
      { property: "og:description", content: "Configure sua casa inteligente em poucos passos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Noronha", "Europe/Lisbon", "America/New_York", "UTC"];
const CURRENCIES = ["BRL", "USD", "EUR"];
const TYPES: Record<string, string> = { casa: "Casa", apartamento: "Apartamento", escritorio: "Escritório", casa_praia: "Casa de praia", outro: "Outro" };

function Onboarding() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", address: "", home_type: "casa", rooms_count: "4", timezone: "America/Sao_Paulo", currency: "BRL" });
  const [rooms, setRooms] = useState<string[]>(["Sala", "Cozinha", "Quarto"]);
  const [custom, setCustom] = useState("");

  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [loading, session, navigate]);
  if (loading || !session) return <LoadingState />;

  const toggle = (r: string) => setRooms((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  async function finish() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_household", {
      _name: f.name.trim(), _address: f.address, _home_type: f.home_type, _timezone: f.timezone, _currency: f.currency, _rooms: rooms,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    localStorage.setItem("hp-household", data as string);
    await qc.invalidateQueries({ queryKey: ["households"] });
    toast.success("✓ Residência criada!");
    navigate({ to: "/dashboard" });
  }

  async function demo() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_demo_household");
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    localStorage.setItem("hp-household", data as string);
    await qc.invalidateQueries({ queryKey: ["households"] });
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <Logo className="mb-6 justify-center" />
        <div className="mb-4 flex justify-center gap-2" aria-label={`Passo ${step + 1} de 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={cn("h-1.5 w-10 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />)}
        </div>
        <div className="glass rounded-3xl p-6 sm:p-8">
          {step === 0 && (
            <div className="text-center">
              <div className="mx-auto mb-4 w-fit rounded-2xl bg-primary/15 p-4 text-primary"><Sparkles className="size-8" /></div>
              <h1 className="text-3xl font-semibold">Bem-vindo ao <span className="text-gradient">HomePulse AI</span></h1>
              <p className="mt-3 text-muted-foreground">Vamos configurar sua casa inteligente.</p>
              <div className="mt-8 grid gap-3">
                <Button size="lg" onClick={() => setStep(1)}>Começar <ArrowRight className="size-4" /></Button>
                <Button size="lg" variant="ghost" disabled={busy} onClick={demo}>Explorar com uma casa de demonstração</Button>
              </div>
            </div>
          )}
          {step === 1 && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) setStep(2); }}>
              <h2 className="text-2xl font-semibold">Sua residência</h2>
              <div className="grid gap-2"><Label htmlFor="hn">Nome da residência</Label><Input id="hn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Minha casa" /></div>
              <div className="grid gap-2"><Label htmlFor="ha">Endereço (opcional)</Label><Input id="ha" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Tipo</Label>
                  <Select value={f.home_type} onValueChange={(v) => setF({ ...f, home_type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="grid gap-2"><Label htmlFor="rc">Quantidade de cômodos</Label><Input id="rc" type="number" min={1} max={50} value={f.rooms_count} onChange={(e) => setF({ ...f, rooms_count: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Fuso horário</Label>
                  <Select value={f.timezone} onValueChange={(v) => setF({ ...f, timezone: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="grid gap-2"><Label>Moeda</Label>
                  <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="mt-2 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="size-4" /> Voltar</Button>
                <Button type="submit">Continuar <ArrowRight className="size-4" /></Button>
              </div>
            </form>
          )}
          {step === 2 && (
            <div className="grid gap-4">
              <h2 className="text-2xl font-semibold">Quais ambientes você deseja adicionar?</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...ROOM_SUGGESTIONS, ...rooms.filter((r) => !ROOM_SUGGESTIONS.includes(r))].map((r) => {
                  const Icon = roomIcon(r); const on = rooms.includes(r);
                  return (
                    <button key={r} type="button" aria-pressed={on} onClick={() => toggle(r)}
                      className={cn("flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors", on ? "border-primary bg-primary/10 text-foreground" : "hover:bg-muted")}>
                      <Icon className="size-4 text-primary" /> <span className="flex-1">{r}</span> {on && <Check className="size-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = custom.trim(); if (c && !rooms.includes(c)) setRooms([...rooms, c]); setCustom(""); }}>
                <Input aria-label="Ambiente personalizado" placeholder="Outro ambiente…" value={custom} onChange={(e) => setCustom(e.target.value)} />
                <Button type="submit" variant="secondary"><Plus className="size-4" /> Adicionar</Button>
              </form>
              <div className="mt-2 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Voltar</Button>
                <Button disabled={busy} onClick={finish}>{busy ? "Criando…" : "Concluir"} <Check className="size-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
