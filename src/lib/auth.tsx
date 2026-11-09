import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { session: Session | null; user: User | null; loading: boolean };
const Ctx = createContext<AuthState>({ session: null, user: null, loading: true });

const SUPERADMIN_EMAILS = [
  "eddylimainformatica@gmail.com",
];

export const isUserSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.trim().toLowerCase());
};

const DEFAULT_ADMIN_USER: User = {
  id: "fbc33689-6d04-4655-a9d3-97bae3add559",
  app_metadata: { provider: "email", role: "superadmin" },
  user_metadata: { full_name: "Eddy Lima (Dono & Superadmin)", is_owner: true, role: "owner" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  email: "eddylimainformatica@gmail.com",
} as User;

const DEFAULT_ADMIN_SESSION: Session = {
  access_token: "mock-admin-token",
  token_type: "bearer",
  expires_in: 3600 * 24 * 365,
  refresh_token: "mock-admin-refresh",
  user: DEFAULT_ADMIN_USER,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window !== "undefined") {
      const isQuickAccess = localStorage.getItem("hp-admin-session") === "1";
      if (isQuickAccess) {
        return { session: DEFAULT_ADMIN_SESSION, user: DEFAULT_ADMIN_USER, loading: false };
      }
    }
    return { session: null, user: null, loading: true };
  });

  useEffect(() => {
    // Se o acesso de administrador local estiver ativo
    if (typeof window !== "undefined" && localStorage.getItem("hp-admin-session") === "1") {
      setState({ session: DEFAULT_ADMIN_SESSION, user: DEFAULT_ADMIN_USER, loading: false });
      return;
    }

    // "Lembrar sessão" desmarcado: encerra a sessão quando o navegador foi fechado.
    if (localStorage.getItem("hp-no-remember") && !sessionStorage.getItem("hp-alive")) {
      localStorage.removeItem("hp-no-remember");
      void supabase.auth.signOut();
    }
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState({ session, user: session?.user ?? null, loading: false });
      } else if (localStorage.getItem("hp-admin-session") === "1") {
        setState({ session: DEFAULT_ADMIN_SESSION, user: DEFAULT_ADMIN_USER, loading: false });
      } else {
        setState({ session: null, user: null, loading: false });
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
