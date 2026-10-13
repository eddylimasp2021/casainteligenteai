import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/home/ui-states";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Casa Inteligente AI" },
      { name: "description", content: "Defina uma nova senha para sua conta HomePulse AI." },
      { property: "og:title", content: "Nova senha — Casa Inteligente AI" },
      { property: "og:description", content: "Defina uma nova senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("✓ Senha atualizada.");
    navigate({ to: "/dashboard" });
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Logo className="mb-8 justify-center" />
        <form onSubmit={submit} className="glass grid gap-4 rounded-3xl p-8">
          <h1 className="text-2xl font-semibold">Definir nova senha</h1>
          <div className="grid gap-2"><Label htmlFor="np">Nova senha</Label><Input id="np" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
          <Button type="submit" disabled={busy}>Salvar senha</Button>
        </form>
      </div>
    </main>
  );
}
