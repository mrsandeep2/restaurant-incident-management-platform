import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getDashboard } from "@/lib/incidents.functions";
import { CATEGORIES, SEVERITY } from "@/lib/incident-meta";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: () => (
    <RoleGate allow={["admin", "manager"]}>
      <AnalyticsPage />
    </RoleGate>
  ),
});

const C = ["#c45c3a", "#7d9b76", "#d4a574", "#5e80a8", "#a04b3a", "#5d8a8a"];

function AnalyticsPage() {
  const fn = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  const cats = data.byCategory.map((c) => ({ ...c, label: CATEGORIES[c.name as keyof typeof CATEGORIES]?.label ?? c.name }));
  const sev = data.bySeverity.map((s) => ({ ...s, label: SEVERITY[s.name as keyof typeof SEVERITY]?.label ?? s.name }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Analytics</h1>
        <p className="mt-1 text-muted-foreground">A deep look at incident flow and resolution.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total" value={data.total} />
        <Stat label="Resolution rate" value={data.total ? `${Math.round((data.resolved / data.total) * 100)}%` : "—"} />
        <Stat label="Avg resolution" value={data.avgHours ? `${data.avgHours.toFixed(1)}h` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monthly volume">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="var(--terracotta)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="By category">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cats} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="label" fontSize={11} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="var(--sage)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Severity distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sev} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {sev.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Status mix">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[{ name: "Open", value: data.open }, { name: "Resolved", value: data.resolved }, { name: "Critical", value: data.critical }]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="var(--gold)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-4xl">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}