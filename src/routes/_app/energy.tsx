import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Zap,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Leaf,
  Clock,
  Sparkles,
  Sliders,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useHousehold } from "@/lib/household";
import { useDevices, useRooms } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/home/ui-states";
import { calculateEnergyOverview, DEFAULT_TARIFF_PER_KWH } from "@/lib/energy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/energy")({
  head: () => ({
    meta: [
      { title: "Gestão de Energia — Casa Inteligente AI" },
      { property: "og:title", content: "Gestão de Energia — Casa Inteligente AI" },
      {
        property: "og:description",
        content: "Telemetria de consumo em Watts, projeção da fatura mensal e ranking de vilões de energia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content:
          "Acompanhe o consumo elétrico residencial em tempo real, custos estimados em Reais, pegada de carbono e recomendações inteligentes de economia.",
      },
    ],
  }),
  component: EnergyPage,
});

function EnergyPage() {
  const { current } = useHousehold();
  const devices = useDevices(current?.id);
  const rooms = useRooms(current?.id);

  const [tariff, setTariff] = useState(DEFAULT_TARIFF_PER_KWH);
  const [chartView, setChartView] = useState<"hourly" | "daily">("hourly");

  const devList = devices.data || [];
  const roomList = rooms.data || [];

  const overview = useMemo(() => {
    return calculateEnergyOverview(devList, roomList, tariff);
  }, [devList, roomList, tariff]);

  if (devices.isLoading || rooms.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-500/15 text-amber-400 grid place-items-center">
              <Zap className="size-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Gestão de Energia & Consumo
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Telemetria em tempo real de potência (Watts), projeção de faturas e diagnóstico de desperdício.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-amber-500/30 text-amber-300 bg-amber-500/10">
            Tarifa: R$ {tariff.toFixed(2)}/kWh
          </Badge>
        </div>
      </div>

      {/* 4 Cards de Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass rounded-2xl p-4 border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Potência Agora</span>
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Zap className="size-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-display tabular-nums text-foreground">
            {overview.currentPowerW} <span className="text-sm font-normal text-muted-foreground">W</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Demanda instantânea da residência
          </p>
        </div>

        <div className="glass rounded-2xl p-4 border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Consumo Hoje</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-display tabular-nums text-foreground">
            {overview.todayKwh} <span className="text-sm font-normal text-muted-foreground">kWh</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Aproximadamente R$ {overview.todayCostReais.toFixed(2)} hoje
          </p>
        </div>

        <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Projeção Mensal</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-display tabular-nums text-foreground">
            R$ {overview.projectedMonthBillReais.toFixed(0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Estimativa de {overview.projectedMonthKwh} kWh no mês
          </p>
        </div>

        <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Impacto Ecológico</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Leaf className="size-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-display tabular-nums text-foreground">
            {overview.carbonFootprintKg} <span className="text-sm font-normal text-muted-foreground">kg</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pegada estimada de CO2 / mês
          </p>
        </div>
      </div>

      {/* Gráfico Principal de Consumo Temporal */}
      <div className="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-foreground tracking-tight">
              Curva de Demanda Energética
            </h3>
            <p className="text-xs text-muted-foreground">
              {chartView === "hourly"
                ? "Distribuição de potência ao longo das 24 horas do dia"
                : "Consumo acumulado em kWh nos últimos 7 dias"}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-xl border text-xs">
            <button
              onClick={() => setChartView("hourly")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all",
                chartView === "hourly"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Horário (24h)
            </button>
            <button
              onClick={() => setChartView("daily")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all",
                chartView === "daily"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semanal (7 dias)
            </button>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === "hourly" ? (
              <AreaChart data={overview.hourlyHistory}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  unit=" W"
                  width={55}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]!.payload;
                      return (
                        <div className="rounded-xl border bg-background/95 p-2.5 shadow-md text-xs font-mono">
                          <p className="font-bold text-foreground">{data.hour}</p>
                          <p className="text-amber-400 font-semibold">{data.watts} Watts</p>
                          <p className="text-muted-foreground">{data.kwh} kWh</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="watts"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#powerGradient)"
                />
              </AreaChart>
            ) : (
              <BarChart data={overview.dailyHistory}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} unit=" kWh" width={55} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]!.payload;
                      return (
                        <div className="rounded-xl border bg-background/95 p-2.5 shadow-md text-xs font-mono">
                          <p className="font-bold text-foreground">{data.day}</p>
                          <p className="text-cyan-400 font-semibold">{data.kwh} kWh</p>
                          <p className="text-emerald-400">R$ {data.costReais.toFixed(2)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="kwh" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Composição por Categoria e Ranking dos Vilões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composição por Categoria */}
        <div className="rounded-3xl border bg-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground tracking-tight">
              Composição do Consumo
            </h3>
            <span className="text-xs text-muted-foreground">Por categoria</span>
          </div>

          <div className="space-y-3.5">
            {overview.categoryShares.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-semibold text-foreground">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground font-mono">
                    <span>{cat.kwh} kWh</span>
                    <strong className="text-foreground">({cat.percentage}%)</strong>
                  </div>
                </div>

                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking de Vilões de Energia */}
        <div className="rounded-3xl border bg-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground tracking-tight">
              Maiores Consumidores
            </h3>
            <span className="text-xs text-muted-foreground">Top aparelhos</span>
          </div>

          {overview.deviceBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              Nenhum dispositivo com telemetria ativa no momento.
            </p>
          ) : (
            <div className="space-y-3">
              {overview.deviceBreakdown.slice(0, 5).map((dev, idx) => (
                <div
                  key={dev.deviceId}
                  className="rounded-xl border p-3 flex items-center justify-between gap-3 bg-muted/15 hover:bg-muted/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary font-bold text-xs grid place-items-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">
                        {dev.deviceName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {dev.roomName} • {dev.currentPowerW}W instantâneo
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-xs text-foreground block">
                      R$ {dev.estimatedCostReais.toFixed(2)}/mês
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {dev.monthKwh} kWh ({dev.percentageOfTotal}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dicas de Economia Inteligente com IA */}
      <div className="rounded-2xl border bg-gradient-to-r from-emerald-500/10 via-card to-card p-5 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">
            Otimização Inteligente de Energia (Eco-IA)
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nossa IA identificou que desligar aparelhos em standby nas madrugadas e ajustar o ar condicionado em 23°C pode gerar uma economia estimada de até <strong>18% na sua fatura mensal</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
