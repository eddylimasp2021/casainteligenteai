import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/home/ui-states";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Casa Inteligente AI" },
      { name: "description", content: "Acesse sua casa inteligente HomePulse AI." },
      { property: "og:title", content: "Entrar — Casa Inteligente AI" },
      { property: "og:description", content: "Acesse sua casa inteligente HomePulse AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot";

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) navigate({ to: "/dashboard", replace: true }); }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!remember) sessionStorage.setItem("hp-ephemeral", "1");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) { toast.success("Conta criada! Confira seu e-mail para confirmar o cadastro."); setMode("signin"); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Enviamos um link para redefinir sua senha.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally { setBusy(false); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com o Google.");
  }

  const titles: Record<Mode, string> = { signin: "Bem-vindo de volta", signup: "Criar sua conta", forgot: "Recuperar senha" };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-8 justify-center" />
        <div className="glass rounded-3xl p-6 shadow-2xl shadow-primary/5 sm:p-8">
          <h1 className="text-2xl font-semibold">{titles[mode]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot" ? "Informe seu e-mail para receber o link." : "Controle sua casa de qualquer lugar."}
          </p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-2"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            )}
            <div className="grid gap-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            {mode !== "forgot" && (
              <div className="grid gap-2"><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></div>
            )}
            {mode === "signin" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Lembrar sessão</label>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>Esqueci a senha</button>
              </div>
            )}
            <Button type="submit" disabled={busy} size="lg">{busy ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}</Button>
          </form>
          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />ou<div className="h-px flex-1 bg-border" /></div>
              <Button variant="secondary" className="w-full" size="lg" onClick={google}>Continuar com Google</Button>
            </>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? <>Não tem conta? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Criar conta</button></>
              : <>Já tem conta? <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Entrar</button></>}
          </p>
        </div>
      </div>
    </main>
  );
}
