import React, { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Cctv,
  Check,
  Download,
  CreditCard,
  Cloud,
  Cpu,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SaaSPlanCardProps {
  householdId: string;
  householdName: string;
}

export function SaaSPlanCard({ householdId, householdName }: SaaSPlanCardProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Coleta dados da residência, dispositivos e logs
      const [devicesRes, roomsRes, logsRes] = await Promise.all([
        supabase.from("devices").select("*").eq("household_id", householdId),
        supabase.from("rooms").select("*").eq("household_id", householdId),
        supabase.from("audit_logs").select("*").eq("household_id", householdId).limit(200),
      ]);

      const backup = {
        app: "HomePulse AI — Casa Inteligente AI",
        exportedAt: new Date().toISOString(),
        household: {
          id: householdId,
          name: householdName,
        },
        rooms: roomsRes.data || [],
        devices: devicesRes.data || [],
        auditLogs: logsRes.data || [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `homepulse_backup_${householdName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("✓ Backup completo exportado com sucesso!");
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e.message || "Erro desconhecido"}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-6 lg:col-span-2 space-y-5 border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-primary text-white flex items-center justify-center shadow-md">
            <Sparkles className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Plano HomePulse AI PRO
              </h2>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                ATIVO • VITALÍCIO
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instância SaaS conectada com infraestrutura IoT híbrida (Local Edge + Cloud).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportData}
            disabled={isExporting}
            className="text-xs gap-1.5 h-9 font-semibold"
            title="Exportar dados de dispositivos e logs"
          >
            <Download className="size-3.5 text-primary" />
            <span>{isExporting ? "Exportando..." : "Exportar Dados (LGPD)"}</span>
          </Button>
        </div>
      </div>

      {/* Grid de Benefícios e Recursos Inclusos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400">
            <Cctv className="size-4" />
            <span className="text-xs font-bold text-foreground">CFTV & NVR Ilimitado</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Gravação contínua no Disco D: sem limites de câmeras ou taxas extras por canal.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Cpu className="size-4" />
            <span className="text-xs font-bold text-foreground">Face ID Local 24/7</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Reconhecimento biométrico local com alertas no Telegram para moradores e visitantes.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
          <div className="flex items-center gap-2 text-amber-400">
            <Zap className="size-4" />
            <span className="text-xs font-bold text-foreground">Telemetria de Energia</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Monitoramento de Watts, curvas horárias e diagnóstico de vilões de consumo.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="size-4" />
            <span className="text-xs font-bold text-foreground">Túnel Zero Trust</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Acesso externo criptografado de ponta a ponta sem necessidade de IP fixo.
          </p>
        </div>
      </div>
    </section>
  );
}
