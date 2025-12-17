"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/db";

import { useAdminGuard } from "../useAdminGuard";
import styles from "../adminHome.module.css";

type ChartPoint = { label: string; scheduled: number; confirmed: number };
type ActivityItem = { title: string; description: string; tone: "blue" | "green" | "orange" | "purple"; time: string };
type ClientRow = { id: string; name: string; email: string; tickets: number; value: number };
type TicketItem = { id: string; customer: string; excerpt: string; status: "pending" | "approved" | "rejected"; date: string };

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

function buildPolyline(points: ChartPoint[], maxValue: number, key: "scheduled" | "confirmed") {
  if (!points.length || !maxValue) return "";

  return points
    .map((point, index) => {
      const x = 60 + (index / Math.max(points.length - 1, 1)) * 610;
      const value = Math.max(0, point[key]);
      const y = 240 - (value / maxValue) * 200;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function AdminDashboardPage() {
  const { status } = useAdminGuard({ allowedRoles: ["admin", "adminsuper", "adminmaster"] });
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>(defaultChartPoints);
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

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      try {
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

        const buckets = Array.from({ length: 8 }).map((_, index) => {
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

        setChartPoints(
          normalizedPoints.every((point) => point.scheduled === 0 && point.confirmed === 0)
            ? defaultChartPoints
            : normalizedPoints
        );
        setClients(normalizedClients.length > 0 ? normalizedClients : defaultClients);
        setTickets(normalizedTickets.length > 0 ? normalizedTickets : defaultTickets);
        setActivities([
          {
            title: "Agendamentos",
            description: `${(appointmentsData ?? []).length} agendamentos nos últimos 8 dias.`,
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
  }, [status]);

  const maxValue = useMemo(() => Math.max(...chartPoints.flatMap((point) => [point.scheduled, point.confirmed, 1])), [chartPoints]);
  const currency = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }), []);

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
              <h2>Últimos 8 dias</h2>
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotBlue}`} aria-hidden />
                Agendados
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotPurple}`} aria-hidden />
                Confirmados
              </span>
            </div>
          </header>
          <div className={styles.chartArea}>
            <svg viewBox="0 0 700 280" role="img" aria-label="Gráfico de agendamentos">
              {Array.from({ length: 5 }).map((_, index) => {
                const y = 240 - (index * 200) / 4;
                const valueLabel = Math.round((maxValue * index) / 4);
                return (
                  <g key={index}>
                    <line x1="60" x2="670" y1={y} y2={y} stroke="#e5ecf6" strokeWidth="1" />
                    <text x="20" y={y + 4} fill="#7a86a2" fontSize="12">
                      {valueLabel}
                    </text>
                  </g>
                );
              })}
              <polyline
                fill="none"
                stroke="#6ad4ff"
                strokeWidth="3"
                strokeLinecap="round"
                points={buildPolyline(chartPoints, maxValue, "scheduled")}
              />
              <polyline
                fill="none"
                stroke="#7d6bff"
                strokeWidth="3"
                strokeLinecap="round"
                points={buildPolyline(chartPoints, maxValue, "confirmed")}
              />
              {chartPoints.map((point, index) => {
                const x = 60 + (index / Math.max(chartPoints.length - 1, 1)) * 610;
                return (
                  <text key={point.label} x={x} y={258} textAnchor="middle" fill="#7a86a2" fontSize="12">
                    {point.label}
                  </text>
                );
              })}
            </svg>
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
