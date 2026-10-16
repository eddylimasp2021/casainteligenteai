import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Sun, Monitor, LogOut, Sparkles, Key, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { useHousehold } from "@/lib/household";
import { friendlyError } from "@/lib/catalog";
import { PageHeader } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AIProviderConfigModal } from "@/components/ai/AIProviderConfigModal";
import { AI_PROVIDERS, loadAIConfig, AIConfig } from "@/lib/ai-provider";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Casa Inteligente AI" },
      { name: "description", content: "Perfil, residência e aparência do HomePulse AI." },
      { property: "og:title", content: "Ajustes — Casa Inteligente AI" },
      { property: "og:description", content: "Configurações da sua conta e residência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const ROLE: Record<string, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro", guest: "Convidado" };

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { current, canAdmin, refetch } = useHousehold();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>(loadAIConfig);

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      if (e.detail) setAiConfig(e.detail);
      else setAiConfig(loadAIConfig());
    };
    window.addEventListener("homepulse:ai-config-changed", handleConfigChange);
    return () => window.removeEventListener("homepulse:ai-config-changed", handleConfigChange);
  }, []);

  async function saveHousehold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.from("households").update({
      name: String(fd.get("name")).trim(), address: String(fd.get("address")).trim() || null,
    }).eq("id", current.id);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    await qc.invalidateQueries({ queryKey: ["households"] });
    toast.success("✓ Residência atualizada.");
  }

  async function deleteHousehold() {
    if (!current || !confirm(`Excluir definitivamente “${current.name}” e todos os seus dados?`)) return;
    const { error } = await supabase.from("households").delete().eq("id", current.id);
    if (error) return toast.error(friendlyError(error));
    localStorage.removeItem("hp-household");
    refetch();
    toast.success("✓ Residência excluída.");
    navigate({ to: "/dashboard" });
  }

  const themes: [ThemeChoice, string, typeof Sun][] = [["dark", "Escuro", Moon], ["light", "Claro", Sun], ["system", "Sistema", Monitor]];

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inteligência Artificial & Provedores */}
        <section className="glass rounded-2xl p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Inteligência Artificial & Chave API
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Conecte sua chave do <strong>Google Gemini</strong> ou selecione OpenAI, Claude, Groq e Ollama para o Assistente IA (Mark-LV).
                </p>
              </div>
            </div>

            <Button onClick={() => setIsAiModalOpen(true)} className="gap-2 shrink-0 shadow-md">
              <Key className="size-4" /> Configurar Chave Gemini / Provedores
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Provedor Ativo</span>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                {AI_PROVIDERS[aiConfig.activeProvider].name}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Status da Chave</span>
              <p className="text-sm font-bold text-foreground font-mono">
                {aiConfig.keys[aiConfig.activeProvider] ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="size-3.5" /> Chave Configurada
                  </span>
                ) : (
                  <span className="text-amber-400">Pendente de Chave</span>
                )}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Modelo em Uso</span>
              <p className="text-sm font-bold text-foreground font-mono truncate">
                {aiConfig.selectedModels[aiConfig.activeProvider] || AI_PROVIDERS[aiConfig.activeProvider].defaultModel}
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="mb-1 text-lg font-semibold">Perfil</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="mt-1 text-sm">Seu papel nesta residência: <strong>{ROLE[current?.role ?? ""]}</strong></p>
          <Button variant="secondary" className="mt-4" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-semibold">Aparência</h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
            {themes.map(([k, l, Icon]) => (
              <button key={k} role="radio" aria-checked={theme === k} onClick={() => setTheme(k)}
                className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors", theme === k ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                <Icon className="size-5" />{l}
              </button>
            ))}
          </div>
        </section>

        {current && (
          <section className="glass rounded-2xl p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Residência</h2>
            <form key={current.id} onSubmit={saveHousehold} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="hn">Nome</Label><Input id="hn" name="name" defaultValue={current.name} disabled={!canAdmin} required /></div>
              <div className="grid gap-2"><Label htmlFor="ha">Endereço</Label><Input id="ha" name="address" defaultValue={current.address ?? ""} disabled={!canAdmin} /></div>
              <p className="text-sm text-muted-foreground">Fuso: {current.timezone} · Moeda: {current.currency}</p>
              {canAdmin && <div className="flex justify-end gap-2 sm:col-span-2">
                {current.role === "owner" && <Button type="button" variant="destructive" onClick={deleteHousehold}>Excluir residência</Button>}
                <Button type="submit" disabled={busy}>Salvar</Button>
              </div>}
            </form>
          </section>
        )}
      </div>

      {/* Modal de Configuração Universal de Chaves de IA */}
      <AIProviderConfigModal open={isAiModalOpen} onOpenChange={setIsAiModalOpen} />
    </>
  );
}
