import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, LayoutGrid, Cpu, History, Settings, LogOut, Wifi, WifiOff, Check, ChevronsUpDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HouseholdProvider, useHousehold } from "@/lib/household";
import { LoadingState, Logo } from "@/components/home/ui-states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOnline } from "@/hooks/use-online";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/rooms", label: "Cômodos", icon: LayoutGrid },
  { to: "/devices", label: "Dispositivos", icon: Cpu },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !session) navigate({ to: "/login", replace: true }); }, [loading, session, navigate]);
  if (loading || !session) return <LoadingState />;
  return <HouseholdProvider><Shell /></HouseholdProvider>;
}

function Shell() {
  const { households, current, setCurrentId, loading } = useHousehold();
  const navigate = useNavigate();
  const online = useOnline();
  const { user } = useAuth();

  useEffect(() => { if (!loading && households.length === 0) navigate({ to: "/onboarding", replace: true }); }, [loading, households.length, navigate]);
  if (loading || !current) return <LoadingState />;

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar: compact on tablet, full on desktop */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar backdrop-blur-xl md:flex md:w-20 lg:w-64">
        <div className="p-4 lg:p-5"><Logo withText={false} className="lg:hidden justify-center" /><Logo className="hidden lg:flex" /></div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Principal">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} title={label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:justify-center lg:justify-start"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-semibold" }}>
              <Icon className="size-5 shrink-0" aria-hidden /><span className="md:sr-only lg:not-sr-only">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <Button variant="ghost" className="w-full md:justify-center lg:justify-start" onClick={() => supabase.auth.signOut()} title="Sair">
            <LogOut className="size-5" /><span className="md:sr-only lg:not-sr-only">Sair</span>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <Logo withText={false} className="md:hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-w-0 max-w-[60vw] justify-between gap-2 px-2 sm:max-w-xs">
                <span className="truncate font-semibold">{current.name}</span><ChevronsUpDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Residências</DropdownMenuLabel>
              {households.map((h) => (
                <DropdownMenuItem key={h.id} onClick={() => setCurrentId(h.id)}>
                  <span className="flex-1 truncate">{h.name}</span>{h.id === current.id && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/onboarding" })}><Plus className="size-4" /> Nova residência</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {current.is_demo && <span className="hidden rounded-full bg-violet/15 px-2 py-0.5 text-xs text-violet sm:inline">Modo demonstração</span>}
          <div className="ml-auto flex items-center gap-3">
            <span className={online ? "flex items-center gap-1.5 text-xs text-success" : "flex items-center gap-1.5 text-xs text-destructive"} role="status">
              {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}<span className="hidden sm:inline">{online ? "Conectado" : "Sem conexão"}</span>
            </span>
            <Link to="/settings" aria-label="Perfil" className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold uppercase text-primary">
              {(user?.email ?? "?").slice(0, 1)}
            </Link>
          </div>
        </header>
        {!online && <div role="alert" className="bg-destructive/15 px-4 py-2 text-center text-sm text-destructive">Sem conexão. Os controles voltam a funcionar quando a internet retornar.</div>}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <Icon className="size-5" aria-hidden />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
