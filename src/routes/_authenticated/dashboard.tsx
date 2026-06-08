import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Timer,
  ArrowUpRight,
} from "lucide-react";
import { getDashboard } from "@/lib/incidents.functions";
import { aiInsights } from "@/lib/ai.functions";
import { CATEGORIES, SEVERITY, STATUS } from "@/lib/incident-meta";
import { CountUp } from "@/components/count-up";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["#c45c3a", "#7d9b76", "#d4a574", "#5e80a8", "#a04b3a"];

function DashboardPage() {
  const dashFn = useServerFn(getDashboard);
  const insightsFn = useServerFn(aiInsights);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashFn() });
  const { data: ai } = useQuery({ queryKey: ["ai-insights"], queryFn: () => insightsFn() });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: "Total incidents", value: data.total, icon: Activity, tone: "text-foreground" },
    { label: "Open", value: data.open, icon: Timer, tone: "text-chart-4" },
    { label: "Critical", value: data.critical, icon: AlertOctagon, tone: "text-destructive" },
    { label: "Resolved", value: data.resolved, icon: CheckCircle2, tone: "text-sage" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Good day at the pass</h1>
          <p className="mt-1 text-muted-foreground">Here's how operations look right now.</p>
        </div>
        <Link to="/incidents/new">
          <Button className="gradient-accent text-accent-foreground border-0">
            Report incident <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</span>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </div>
            <div className={`mt-3 font-serif text-5xl ${k.tone}`}>
              <CountUp value={k.value} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Monthly trend</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--terracotta)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
          <h2 className="font-serif text-2xl">By severity</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.bySeverity} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {data.bySeverity.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {data.bySeverity.map((s, i) => (
              <span key={s.name} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {SEVERITY[s.name as keyof typeof SEVERITY]?.label ?? s.name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-serif text-2xl">Recent activity</h2>
          {data.recent.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No incidents yet — report your first one.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {data.recent.map((r) => {
                const cat = CATEGORIES[r.category as keyof typeof CATEGORIES];
                const sev = SEVERITY[r.severity as keyof typeof SEVERITY];
                const st = STATUS[r.status as keyof typeof STATUS];
                return (
                  <Link
                    key={r.id}
                    to="/incidents/$id"
                    params={{ id: r.id }}
                    className="flex items-center gap-3 py-3 transition hover:bg-accent/5"
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-card ${cat?.tone}`}>
                      {cat ? <cat.icon className="h-5 w-5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{cat?.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.bg} ${st.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">AI insights</h2>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-terracotta">Beta</span>
          </div>
          <div className="mt-4 whitespace-pre-wrap text-sm text-foreground/80">
            {ai?.insights ?? "Analyzing your operations…"}
          </div>
          <div className="mt-6 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Avg resolution time:{" "}
            <span className="font-medium text-foreground">
              {data.avgHours ? `${data.avgHours.toFixed(1)}h` : "—"}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}