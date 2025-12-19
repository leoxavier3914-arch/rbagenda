"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../useAdminGuard";
import styles from "../adminHome.module.css";

type ChartPoint = { label: string; scheduled: number; confirmed: number };
type ActivityItem = { title: string; description: string; tone: "blue" | "green" | "orange" | "purple"; time: string };
type ClientRow = { id: string; name: string; email: string; tickets: number; value: number };
type TicketItem = { id: string; customer: string; excerpt: string; status: "pending" | "approved" | "rejected"; date: string };
type ChartType = "line" | "candlestick" | "pie";
type ChartRange = "7d" | "15d" | "30d" | "60d" | "90d" | "all" | "custom";
type ChartMetric = "both" | "scheduled" | "confirmed";

const defaultChartPoints: ChartPoint[] = [
  { label: "01/05", scheduled: 8, confirmed: 2 },
  { label: "02/05", scheduled: 14, confirmed: 4 },
  { label: "03/05", scheduled: 10, confirmed: 6 },
  { label: "04/05", scheduled: 18, confirmed: 10 },
  { label: "05/05", scheduled: 12, confirmed: 8 },
  { label: "06/05", scheduled: 16, confirmed: 6 },
  { label: "07/05", scheduled: 20, confirmed: 12 },
  { label: "08/05", scheduled: 24, confirmed: 14 },
];

const defaultClients: ClientRow[] = [
  { id: "elite", name: "Elite Admin", email: "elite@demo.com", tickets: 46, value: 2850.06 },
  { id: "monster", name: "Monster Admin", email: "monster@demo.com", tickets: 46, value: 2850.06 },
  { id: "material", name: "Material Pro Admin", email: "material@demo.com", tickets: 46, value: 2850.06 },
  { id: "ample", name: "Ample Admin", email: "ample@demo.com", tickets: 46, value: 2850.06 },
];

const defaultTickets: TicketItem[] = [
  { id: "t-1", customer: "James Anderson", excerpt: "Ticket aguardando triagem pelo time de suporte.", status: "pending", date: "14 abr 2024" },
  { id: "t-2", customer: "Michael Jorden", excerpt: "Ticket aprovado e aguardando resposta final.", status: "approved", date: "14 abr 2024" },
  { id: "t-3", customer: "Johnathan Doeting", excerpt: "Ticket rejeitado por falta de informações.", status: "rejected", date: "14 abr 2024" },
];

const defaultActivities: ActivityItem[] = [
  { title: "Pendências", description: "Você tem 4 atividades aguardando ação.", tone: "blue", time: "Agora" },
  { title: "Fila de tickets", description: "Servidor de suporte com fila alta.", tone: "orange", time: "Hoje" },
  { title: "Novo agendamento", description: "Um novo agendamento foi criado.", tone: "green", time: "Ontem" },
  { title: "Novo cliente", description: "Um cliente acabou de se registrar.", tone: "purple", time: "Esta semana" },
];

const formatLabel = (date: Date) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

const CHART_DIMENSIONS = {
  width: 860,
  height: 340,
  xStart: 70,
  xEnd: 800,
  yStart: 24,
  yEnd: 290,
};

function buildPolyline(points: ChartPoint[], maxValue: number, key: "scheduled" | "confirmed") {
  if (!points.length || !maxValue) return "";

  const chartWidth = CHART_DIMENSIONS.xEnd - CHART_DIMENSIONS.xStart;
  const chartHeight = CHART_DIMENSIONS.yEnd - CHART_DIMENSIONS.yStart;

  return points
    .map((point, index) => {
      const x = CHART_DIMENSIONS.xStart + (index / Math.max(points.length - 1, 1)) * chartWidth;
      const value = Math.max(0, point[key]);
      const y = CHART_DIMENSIONS.yEnd - (value / maxValue) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPath(points: ChartPoint[], maxValue: number, key: "scheduled" | "confirmed") {
  if (!points.length || !maxValue) return "";

  const chartWidth = CHART_DIMENSIONS.xEnd - CHART_DIMENSIONS.xStart;
  const chartHeight = CHART_DIMENSIONS.yEnd - CHART_DIMENSIONS.yStart;
  const coords = points.map((point, index) => {
    const x = CHART_DIMENSIONS.xStart + (index / Math.max(points.length - 1, 1)) * chartWidth;
    const value = Math.max(0, point[key]);
    const y = CHART_DIMENSIONS.yEnd - (value / maxValue) * chartHeight;
    return { x, y };
  });

  if (!coords.length) return "";

  const first = coords[0];
  const last = coords[coords.length - 1];
  const line = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");
  return `${line} L ${last.x} ${CHART_DIMENSIONS.yEnd} L ${first.x} ${CHART_DIMENSIONS.yEnd} Z`;
}

export default function AdminDashboardPage() {
  const { status } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [chartRange, setChartRange] = useState<ChartRange>("7d");
  const [customRangeStart, setCustomRangeStart] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return start.toISOString().slice(0, 10);
  });
  const [customRangeEnd, setCustomRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [chartMetric, setChartMetric] = useState<ChartMetric>("both");
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [activeSlice, setActiveSlice] = useState<ChartMetric | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>(defaultActivities);
  const [clients, setClients] = useState<ClientRow[]>(defaultClients);
  const [tickets, setTickets] = useState<TicketItem[]>(defaultTickets);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authorized") return;

    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        let startDate = new Date();
        let rangeDays = 7;

        if (chartRange === "custom") {
          const startValue = customRangeStart || new Date().toISOString().slice(0, 10);
          const endValue = customRangeEnd || startValue;
          const start = new Date(`${startValue}T00:00:00`);
          const end = new Date(`${endValue}T00:00:00`);
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            const [normalizedStart, normalizedEnd] = start > end ? [end, start] : [start, end];
            startDate = normalizedStart;
            startDate.setHours(0, 0, 0, 0);
            endDate.setTime(normalizedEnd.getTime());
            endDate.setHours(23, 59, 59, 999);
            rangeDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
          }
        } else if (chartRange === "all") {
          const { data: earliestData, error: earliestError } = await supabase
            .from("appointments")
            .select("starts_at")
            .order("starts_at", { ascending: true })
            .limit(1);
          if (earliestError) {
            throw new Error("Não foi possível carregar o dashboard.");
          }
          const earliestDate = earliestData?.[0]?.starts_at ? new Date(earliestData[0].starts_at) : null;
          if (earliestDate) {
            startDate = earliestDate;
          } else {
            startDate.setDate(startDate.getDate() - 6);
          }
          startDate.setHours(0, 0, 0, 0);
          rangeDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
        } else {
          const rangeByKey: Record<Exclude<ChartRange, "all" | "custom">, number> = {
            "7d": 7,
            "15d": 15,
            "30d": 30,
            "60d": 60,
            "90d": 90,
          };
          rangeDays = rangeByKey[chartRange] ?? 7;
          startDate.setDate(startDate.getDate() - (rangeDays - 1));
          startDate.setHours(0, 0, 0, 0);
        }

        const [{ data: appointmentsData, error: appointmentsError }, { data: clientsData, error: clientsError }] = await Promise.all([
          supabase
            .from("appointments")
            .select("starts_at, status")
            .gte("starts_at", startDate.toISOString())
            .lte("starts_at", endDate.toISOString()),
          supabase
            .from("profiles")
            .select("id, full_name, email, created_at")
            .eq("role", "client")
            .order("created_at", { ascending: false })
            .limit(4),
        ]);

        if (appointmentsError || clientsError) {
          throw new Error("Não foi possível carregar o dashboard.");
        }

        if (!active) return;

        const buckets = Array.from({ length: rangeDays }).map((_, index) => {
          const day = new Date(startDate);
          day.setDate(startDate.getDate() + index);
          return { label: formatLabel(day), key: day.toISOString().slice(0, 10), scheduled: 0, confirmed: 0 };
        });

        let pendingCount = 0;
        let confirmedCount = 0;

        (appointmentsData ?? []).forEach((appointment) => {
          const bucketKey = appointment.starts_at ? appointment.starts_at.slice(0, 10) : "";
          const bucket = buckets.find((item) => item.key === bucketKey);
          const statusValue = (appointment.status ?? "pending").toLowerCase();
          const scheduledIncrement = statusValue === "canceled" ? 0 : 1;
          const confirmedIncrement = ["confirmed", "reserved", "completed"].includes(statusValue) ? 1 : 0;

          pendingCount += statusValue === "pending" ? 1 : 0;
          confirmedCount += confirmedIncrement;

          if (bucket) {
            bucket.scheduled += scheduledIncrement;
            bucket.confirmed += confirmedIncrement;
          }
        });

        const normalizedPoints = buckets.map(({ label, scheduled, confirmed }) => ({
          label,
          scheduled,
          confirmed,
        }));

        const normalizedClients =
          clientsData?.map((client, index) => ({
            id: client.id,
            name: client.full_name ?? "Cliente",
            email: client.email ?? "—",
            tickets: Math.max(10, (index + 1) * 8),
            value: 2850.06,
          })) ?? [];

        const ticketSeed = normalizedClients.length > 0 ? normalizedClients : defaultClients;
        const normalizedTickets: TicketItem[] = ticketSeed.map((client, index) => ({
          id: client.id ? `ticket-${client.id}` : `ticket-${index}`,
          customer: client.name,
          excerpt: `Ticket recente aberto no chat pelo cliente ${client.name}.`,
          status: index % 3 === 0 ? "pending" : index % 2 === 0 ? "approved" : "rejected",
          date: new Date().toLocaleDateString("pt-BR"),
        }));

        setChartPoints(normalizedPoints);
        setClients(normalizedClients.length > 0 ? normalizedClients : defaultClients);
        setTickets(normalizedTickets.length > 0 ? normalizedTickets : defaultTickets);
        const activityRangeLabel =
          chartRange === "all" ? "no período todo" : chartRange === "custom" ? "no período selecionado" : `nos últimos ${rangeDays} dias`;
        setActivities([
          {
            title: "Agendamentos",
            description: `${(appointmentsData ?? []).length} agendamentos ${activityRangeLabel}.`,
            tone: "blue",
            time: "Agora",
          },
          { title: "Pendentes", description: `${pendingCount} aguardando confirmação.`, tone: "orange", time: "Hoje" },
          { title: "Confirmados", description: `${confirmedCount} confirmados ou reservados.`, tone: "purple", time: "Hoje" },
          {
            title: "Clientes",
            description: `${normalizedClients.length || defaultClients.length} cadastros recentes.`,
            tone: "green",
            time: "Esta semana",
          },
        ]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar o dashboard.");
        setChartPoints(defaultChartPoints);
        setClients(defaultClients);
        setTickets(defaultTickets);
        setActivities(defaultActivities);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [status, chartRange, customRangeStart, customRangeEnd]);

  const chartRangeOptions = useMemo<{ key: ChartRange; label: string; count?: number }[]>(
    () => [
      { key: "7d", label: "7 dias", count: 7 },
      { key: "15d", label: "15 dias", count: 15 },
      { key: "30d", label: "30 dias", count: 30 },
      { key: "60d", label: "60 dias", count: 60 },
      { key: "90d", label: "90 dias", count: 90 },
      { key: "all", label: "Todo" },
      { key: "custom", label: "Personalizado" },
    ],
    []
  );

  const filteredPoints = useMemo(() => {
    const range = chartRangeOptions.find((option) => option.key === chartRange);
    const count = range?.count ?? chartPoints.length;
    return chartPoints.slice(-count);
  }, [chartPoints, chartRange, chartRangeOptions]);

  const maxValue = useMemo(() => {
    const values = filteredPoints.flatMap((point) => {
      if (chartMetric === "scheduled") return [point.scheduled];
      if (chartMetric === "confirmed") return [point.confirmed];
      return [point.scheduled, point.confirmed];
    });
    return Math.max(1, ...values);
  }, [filteredPoints, chartMetric]);

  const totalScheduled = useMemo(() => filteredPoints.reduce((sum, point) => sum + point.scheduled, 0), [filteredPoints]);
  const totalConfirmed = useMemo(() => filteredPoints.reduce((sum, point) => sum + point.confirmed, 0), [filteredPoints]);
  const currency = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }), []);
  const chartWidth = CHART_DIMENSIONS.xEnd - CHART_DIMENSIONS.xStart;
  const chartHeight = CHART_DIMENSIONS.yEnd - CHART_DIMENSIONS.yStart;
  const pieTotal = totalScheduled + totalConfirmed || 1;
  const activeRangeLabel = chartRangeOptions.find((option) => option.key === chartRange)?.label ?? "período";
  const customRangeLabel = useMemo(() => {
    if (!customRangeStart || !customRangeEnd) return "Personalizado";
    const start = new Date(`${customRangeStart}T00:00:00`);
    const end = new Date(`${customRangeEnd}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Personalizado";
    return `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`;
  }, [customRangeStart, customRangeEnd]);
  const rangeSummaryLabel =
    chartRange === "custom" ? customRangeLabel : chartRange === "all" ? "Todo" : activeRangeLabel;
  const chartTypeOptions = [
    { key: "line" as const, label: "Linhas" },
    { key: "candlestick" as const, label: "Velas" },
    { key: "pie" as const, label: "Pizza" },
  ];
  const chartMetricOptions = [
    { key: "both" as const, label: "Todos" },
    { key: "scheduled" as const, label: "Agendados" },
    { key: "confirmed" as const, label: "Confirmados" },
  ];

  if (status !== "authorized") {
    return <div className={styles.loading}>Carregando painel…</div>;
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.pageTop}>
        <div>
          <p className={styles.pageBreadcrumb}>Dashboard / Biblioteca</p>
          <h1 className={styles.pageTitle}>Dashboard inicial</h1>
        </div>
        <button type="button" className={styles.proButton}>
          Upgrade para Pro
        </button>
      </div>

      <div className={styles.heroCards}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Gráfico dos agendamentos</p>
              <h2>Período {rangeSummaryLabel}</h2>
            </div>
            <div className={styles.chartTypeToggle} role="tablist" aria-label="Tipo de gráfico">
              {chartTypeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.chartTypeButton} ${chartType === option.key ? styles.chartTypeActive : ""}`}
                  onClick={() => setChartType(option.key)}
                  role="tab"
                  aria-selected={chartType === option.key}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>
          <div className={styles.chartControls}>
            <div className={styles.chartFilters}>
              <label className={styles.chartSelect}>
                Período
                <select value={chartRange} onChange={(event) => setChartRange(event.target.value as ChartRange)}>
                  {chartRangeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.chartSelect}>
                Métrica
                <select value={chartMetric} onChange={(event) => setChartMetric(event.target.value as ChartMetric)}>
                  {chartMetricOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {chartRange === "custom" ? (
              <div className={styles.chartCustomRange}>
                <label className={styles.chartSelect}>
                  Data inicial
                  <input
                    type="date"
                    value={customRangeStart}
                    max={customRangeEnd}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomRangeStart(value);
                      if (customRangeEnd && value && value > customRangeEnd) {
                        setCustomRangeEnd(value);
                      }
                    }}
                  />
                </label>
                <label className={styles.chartSelect}>
                  Data final
                  <input
                    type="date"
                    value={customRangeEnd}
                    min={customRangeStart}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCustomRangeEnd(value);
                      if (customRangeStart && value && value < customRangeStart) {
                        setCustomRangeStart(value);
                      }
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className={styles.chartArea}>
            <div className={styles.chartMeta}>
              {chartType === "pie" ? (
                <span>
                  {activeSlice ? (
                    <>
                      {activeSlice === "scheduled" ? "Agendados" : "Confirmados"}:{" "}
                      {activeSlice === "scheduled" ? totalScheduled : totalConfirmed}
                    </>
                  ) : (
                    <>
                      Total do período: {totalScheduled} agendados · {totalConfirmed} confirmados
                    </>
                  )}
                </span>
              ) : activePoint !== null && filteredPoints[activePoint] ? (
                <span>
                  Dia {filteredPoints[activePoint].label}: {filteredPoints[activePoint].scheduled} agendados ·{" "}
                  {filteredPoints[activePoint].confirmed} confirmados
                </span>
              ) : (
                <span>
                  Total do período: {totalScheduled} agendados · {totalConfirmed} confirmados · Clique em um ponto para detalhar
                </span>
              )}
            </div>
            <svg
              viewBox={`0 0 ${CHART_DIMENSIONS.width} ${CHART_DIMENSIONS.height}`}
              role="img"
              aria-label="Gráfico de agendamentos"
              onMouseLeave={() => {
                setActivePoint(null);
                setActiveSlice(null);
              }}
            >
              <defs>
                <linearGradient id="line-scheduled" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#8be7ff" />
                  <stop offset="100%" stopColor="#42bfff" />
                </linearGradient>
                <linearGradient id="line-confirmed" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#9b8cff" />
                  <stop offset="100%" stopColor="#6a5bff" />
                </linearGradient>
                <linearGradient id="area-scheduled" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6ad4ff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6ad4ff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="area-confirmed" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7d6bff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#7d6bff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="candle-up" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8be7ff" />
                  <stop offset="100%" stopColor="#4fd1ff" />
                </linearGradient>
                <linearGradient id="candle-down" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#9b8cff" />
                  <stop offset="100%" stopColor="#6a5bff" />
                </linearGradient>
              </defs>
              {chartType !== "pie" ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => {
                    const y = CHART_DIMENSIONS.yEnd - (index * chartHeight) / 4;
                    const valueLabel = Math.round((maxValue * index) / 4);
                    return (
                      <g key={index}>
                        <line
                          x1={CHART_DIMENSIONS.xStart}
                          x2={CHART_DIMENSIONS.xEnd}
                          y1={y}
                          y2={y}
                          stroke="#e5ecf6"
                          strokeWidth="1"
                        />
                        <text x="20" y={y + 4} fill="#7a86a2" fontSize="12">
                          {valueLabel}
                        </text>
                      </g>
                    );
                  })}
                  {chartType === "line" ? (
                    <>
                      {chartMetric !== "confirmed" ? (
                        <path d={buildAreaPath(filteredPoints, maxValue, "scheduled")} fill="url(#area-scheduled)" />
                      ) : null}
                      {chartMetric !== "scheduled" ? (
                        <path d={buildAreaPath(filteredPoints, maxValue, "confirmed")} fill="url(#area-confirmed)" />
                      ) : null}
                      {chartMetric !== "confirmed" ? (
                        <polyline
                          fill="none"
                          stroke="url(#line-scheduled)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          points={buildPolyline(filteredPoints, maxValue, "scheduled")}
                        />
                      ) : null}
                      {chartMetric !== "scheduled" ? (
                        <polyline
                          fill="none"
                          stroke="url(#line-confirmed)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          points={buildPolyline(filteredPoints, maxValue, "confirmed")}
                        />
                      ) : null}
                      {filteredPoints.map((point, index) => {
                        const x = CHART_DIMENSIONS.xStart + (index / Math.max(filteredPoints.length - 1, 1)) * chartWidth;
                        const scheduledY = CHART_DIMENSIONS.yEnd - (point.scheduled / maxValue) * chartHeight;
                        const confirmedY = CHART_DIMENSIONS.yEnd - (point.confirmed / maxValue) * chartHeight;
                        return (
                          <g key={point.label}>
                            {chartMetric !== "confirmed" ? (
                              <circle
                                cx={x}
                                cy={scheduledY}
                                r={activePoint === index ? "7" : "5"}
                                fill="#6ad4ff"
                                stroke="#ffffff"
                                strokeWidth="2.5"
                                className={styles.chartPoint}
                                onMouseEnter={() => setActivePoint(index)}
                                onClick={() => setActivePoint(index)}
                              />
                            ) : null}
                            {chartMetric !== "scheduled" ? (
                              <circle
                                cx={x}
                                cy={confirmedY}
                                r={activePoint === index ? "7" : "5"}
                                fill="#7d6bff"
                                stroke="#ffffff"
                                strokeWidth="2.5"
                                className={styles.chartPoint}
                                onMouseEnter={() => setActivePoint(index)}
                                onClick={() => setActivePoint(index)}
                              />
                            ) : null}
                          </g>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {filteredPoints.map((point, index) => {
                        const x = CHART_DIMENSIONS.xStart + (index / Math.max(filteredPoints.length - 1, 1)) * chartWidth;
                        const high = Math.max(point.scheduled, point.confirmed);
                        const low = Math.min(point.scheduled, point.confirmed);
                        const highY = CHART_DIMENSIONS.yEnd - (high / maxValue) * chartHeight;
                        const lowY = CHART_DIMENSIONS.yEnd - (low / maxValue) * chartHeight;
                        const bodyHeight = Math.max(6, Math.abs(highY - lowY));
                        const bodyY = Math.min(highY, lowY);
                        const isUp = point.scheduled >= point.confirmed;
                        return (
                          <g
                            key={point.label}
                            className={styles.candleGroup}
                            onMouseEnter={() => setActivePoint(index)}
                            onClick={() => setActivePoint(index)}
                          >
                            <line x1={x} x2={x} y1={highY} y2={lowY} stroke="#64748b" strokeWidth="3" />
                            <rect
                              x={x - 9}
                              y={bodyY}
                              width="18"
                              height={bodyHeight}
                              rx="6"
                              fill={isUp ? "url(#candle-up)" : "url(#candle-down)"}
                              stroke={isUp ? "#38bdf8" : "#7c7cff"}
                              strokeWidth="1.5"
                            />
                          </g>
                        );
                      })}
                    </>
                  )}
                  {filteredPoints.map((point, index) => {
                    const x = CHART_DIMENSIONS.xStart + (index / Math.max(filteredPoints.length - 1, 1)) * chartWidth;
                    return (
                      <text key={point.label} x={x} y={CHART_DIMENSIONS.yEnd + 18} textAnchor="middle" fill="#7a86a2" fontSize="12">
                        {point.label}
                      </text>
                    );
                  })}
                </>
              ) : (
                <>
                  {(() => {
                    const centerX = CHART_DIMENSIONS.width / 2;
                    const centerY = CHART_DIMENSIONS.height / 2;
                    const radius = 110;
                    const scheduledAngle = (totalScheduled / pieTotal) * Math.PI * 2;
                    const confirmedAngle = (totalConfirmed / pieTotal) * Math.PI * 2;
                    const scheduledEnd = scheduledAngle;
                    const confirmedEnd = scheduledEnd + confirmedAngle;

                    const describeArc = (startAngle: number, endAngle: number) => {
                      const x1 = centerX + radius * Math.cos(startAngle);
                      const y1 = centerY + radius * Math.sin(startAngle);
                      const x2 = centerX + radius * Math.cos(endAngle);
                      const y2 = centerY + radius * Math.sin(endAngle);
                      const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
                      return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                    };

                    return (
                      <>
                        <path
                          d={describeArc(0, scheduledEnd)}
                          fill="#6ad4ff"
                          onMouseEnter={() => setActiveSlice("scheduled")}
                          opacity={activeSlice && activeSlice !== "scheduled" ? 0.5 : 1}
                        />
                        <path
                          d={describeArc(scheduledEnd, confirmedEnd)}
                          fill="#7d6bff"
                          onMouseEnter={() => setActiveSlice("confirmed")}
                          opacity={activeSlice && activeSlice !== "confirmed" ? 0.5 : 1}
                        />
                        <circle cx={centerX} cy={centerY} r="52" fill="#ffffff" />
                        <text x={centerX} y={centerY - 6} textAnchor="middle" fontSize="14" fill="#64748b">
                          Total
                        </text>
                        <text x={centerX} y={centerY + 16} textAnchor="middle" fontSize="18" fill="#0f172a" fontWeight="700">
                          {totalScheduled + totalConfirmed}
                        </text>
                      </>
                    );
                  })()}
                </>
              )}
            </svg>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotBlue}`} aria-hidden />
                Agendados
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotPurple}`} aria-hidden />
                Confirmados
              </span>
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.feedCard}`}>
          <header className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>Atividades</p>
              <h2>Atualizações recentes</h2>
            </div>
          </header>
          <div className={styles.feedList}>
            {activities.map((item) => (
              <div key={item.title} className={styles.feedItem}>
                <span className={`${styles.feedIcon} ${styles[`tone-${item.tone}`]}`} aria-hidden />
                <div className={styles.feedCopy}>
                  <p className={styles.feedTitle}>{item.title}</p>
                  <p className={styles.feedDesc}>{item.description}</p>
                </div>
                <span className={styles.feedTime}>{item.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Clientes</p>
            <h2>Base recente</h2>
          </div>
          <button type="button" className={styles.filterButton}>
            Mensal ▾
          </button>
        </header>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Clientes</th>
                <th>Tickets</th>
                <th>Receita</th>
                <th>E-mail</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className={styles.clientCell}>
                      <span className={styles.avatarSmall} aria-hidden>
                        {client.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className={styles.clientName}>{client.name}</p>
                        <p className={styles.clientEmail}>{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{client.tickets}</td>
                  <td className={styles.valueCell}>{currency.format(client.value)}</td>
                  <td className={styles.mutedCell}>{client.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <p className={styles.cardEyebrow}>Tickets recentes</p>
            <h2>Chat de suporte</h2>
          </div>
        </header>
        <div className={styles.ticketList}>
          {tickets.map((ticket) => (
            <div key={ticket.id} className={styles.ticketItem}>
              <div className={styles.ticketAvatar} aria-hidden>
                {ticket.customer.slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.ticketCopy}>
                <p className={styles.ticketName}>{ticket.customer}</p>
                <p className={styles.ticketExcerpt}>{ticket.excerpt}</p>
              </div>
              <div className={styles.ticketMeta}>
                <span className={`${styles.status} ${styles[`status-${ticket.status}`]}`}>
                  {ticket.status === "approved" ? "Aprovado" : ticket.status === "rejected" ? "Rejeitado" : "Pendente"}
                </span>
                <span className={styles.ticketDate}>{ticket.date}</span>
              </div>
            </div>
          ))}
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {loading ? <div className={styles.loading}>Carregando dados do dashboard…</div> : null}
      </section>
    </div>
  );
}
