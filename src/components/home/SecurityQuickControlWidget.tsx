import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Shield, Lock, Unlock, Siren } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getSecurityState, setAlarmMode } from "@/lib/security";
import { useHousehold } from "@/lib/household";
import type { AlarmMode, SecuritySystemState } from "@/types/security";

export function SecurityQuickControlWidget() {
  const { current } = useHousehold();
  const householdId = current?.id ?? "default";
  const [secState, setSecState] = useState<SecuritySystemState>(() =>
    getSecurityState(householdId)
  );

  useEffect(() => {
    setSecState(getSecurityState(householdId));
    // Keep in sync with security changes
    const interval = setInterval(() => {
      setSecState(getSecurityState(householdId));
    }, 2000);
    return () => clearInterval(interval);
  }, [householdId]);

  const handleToggleMode = async (mode: AlarmMode) => {
    const updated = await setAlarmMode(householdId, mode);
    setSecState(updated);
    toast.success(`Alarme perimetral atualizado para: ${mode.toUpperCase()}`);
  };

  const isArmed = secState.mode !== "disarmed";

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
      <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span>Segurança & Ações Rápidas</span>
            <Badge
              variant="outline"
              className={`ml-1 text-[10px] py-0 ${
                isArmed
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-amber-500/40 text-amber-400 bg-amber-500/10"
              }`}
            >
              {isArmed ? "ARMADO" : "DESARMADO"}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Controle perimetral da residência e acionamentos de emergência
          </CardDescription>
        </div>
        <Link to="/security">
          <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10">
            Gerenciar Zonas
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Button
            variant={secState.mode === "disarmed" ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleMode("disarmed")}
            className="h-10 text-xs justify-start gap-2 border-border/60"
          >
            <Unlock className="size-4 text-emerald-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="font-semibold block">Desarmado</span>
              <span className="text-[10px] text-muted-foreground">Acesso livre</span>
            </div>
          </Button>

          <Button
            variant={secState.mode === "armed_home" ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleMode("armed_home")}
            className="h-10 text-xs justify-start gap-2 border-border/60"
          >
            <Shield className="size-4 text-blue-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="font-semibold block">Em Casa</span>
              <span className="text-[10px] text-muted-foreground">Perímetro ativo</span>
            </div>
          </Button>

          <Button
            variant={secState.mode === "armed_away" ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleMode("armed_away")}
            className="h-10 text-xs justify-start gap-2 border-border/60"
          >
            <Lock className="size-4 text-purple-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="font-semibold block">Ausente</span>
              <span className="text-[10px] text-muted-foreground">Todos os sensores</span>
            </div>
          </Button>

          <Button
            variant={secState.mode === "panic" ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleMode("panic")}
            className="h-10 text-xs justify-start gap-2 border-border/60"
          >
            <Siren className="size-4 text-red-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="font-semibold block">Pânico</span>
              <span className="text-[10px] text-muted-foreground">Emergência</span>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
