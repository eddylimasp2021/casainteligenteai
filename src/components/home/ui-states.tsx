import type { LucideIcon } from "lucide-react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src={logo} alt="" width={36} height={36} className="size-9 rounded-xl" />
      {withText && (
        <div className="leading-tight">
          <div className="font-display text-base font-semibold">HomePulse <span className="text-gradient">AI</span></div>
          <div className="text-[11px] text-muted-foreground">Casa Inteligente</div>
        </div>
      )}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="glass mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
      <AlertTriangle className="size-8 text-warning" aria-hidden />
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
      <div className="rounded-2xl bg-primary/10 p-4 text-primary"><Icon className="size-7" aria-hidden /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  online: { label: "Online", cls: "bg-success/15 text-success" },
  offline: { label: "Offline", cls: "bg-destructive/15 text-destructive" },
  unavailable: { label: "Indisponível", cls: "bg-warning/15 text-warning" },
  pairing: { label: "Pareando", cls: "bg-cyan/15 text-cyan" },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS["unavailable"]!;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
