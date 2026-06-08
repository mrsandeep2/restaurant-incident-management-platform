import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Plus,
  Download,
  X,
} from "lucide-react";
import Papa from "papaparse";
import { listIncidents } from "@/lib/incidents.functions";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  SEVERITY,
  SEVERITY_KEYS,
  STATUS,
  STATUS_ORDER,
  type IncidentCategory,
  type IncidentStatus,
  type Severity,
} from "@/lib/incident-meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityPill, StatusPill } from "@/components/severity-pill";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/incidents/")({
  component: IncidentsPage,
});

function IncidentsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IncidentCategory | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [mine, setMine] = useState(false);

  const listFn = useServerFn(listIncidents);
  const { data, isLoading } = useQuery({
    queryKey: ["incidents", { search, category, severity, status, mine }],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          category: category || undefined,
          severity: severity || undefined,
          status: status || undefined,
          mineOnly: mine || undefined,
        },
      }),
  });

  const incidents = data ?? [];
  const activeFilters = [category, severity, status].filter(Boolean).length + (mine ? 1 : 0);

  function resetFilters() {
    setCategory("");
    setSeverity("");
    setStatus("");
    setMine(false);
  }

  function exportCsv() {
    const csv = Papa.unparse(
      incidents.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        severity: i.severity,
        status: i.status,
        created_at: i.created_at,
        resolved_at: i.resolved_at,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">Incidents</h1>
          <p className="mt-1 text-muted-foreground">{incidents.length} total · live view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!incidents.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Link to="/incidents/new">
            <Button className="gradient-accent text-accent-foreground border-0">
              <Plus className="h-4 w-4" /> New
            </Button>
          </Link>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or description…"
            className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilters > 0 && (
                <span className="rounded-full bg-terracotta px-1.5 text-[10px] text-accent-foreground">
                  {activeFilters}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Filter incidents</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <FilterGroup
                label="Category"
                options={CATEGORY_KEYS.map((k) => ({ value: k, label: CATEGORIES[k].label }))}
                value={category}
                onChange={(v) => setCategory(v as IncidentCategory | "")}
              />
              <FilterGroup
                label="Severity"
                options={SEVERITY_KEYS.map((k) => ({ value: k, label: SEVERITY[k].label }))}
                value={severity}
                onChange={(v) => setSeverity(v as Severity | "")}
              />
              <FilterGroup
                label="Status"
                options={STATUS_ORDER.map((k) => ({ value: k, label: STATUS[k].label }))}
                value={status}
                onChange={(v) => setStatus(v as IncidentStatus | "")}
              />
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <Label>Only mine</Label>
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => setMine(e.target.checked)}
                  className="h-4 w-4 accent-[var(--terracotta)]"
                />
              </div>
              <Button variant="outline" className="w-full" onClick={resetFilters}>
                <X className="h-4 w-4" /> Reset filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-16 text-center">
            <p className="font-serif text-2xl">Nothing on the wire</p>
            <p className="mt-2 text-sm text-muted-foreground">When incidents come in, they'll appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {incidents.map((i, idx) => {
              const cat = CATEGORIES[i.category as IncidentCategory];
              return (
                <motion.li
                  key={i.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                >
                  <Link
                    to="/incidents/$id"
                    params={{ id: i.id }}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/5 md:px-5"
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card ${cat?.tone}`}>
                      {cat ? <cat.icon className="h-5 w-5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{cat?.label} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</div>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <SeverityPill value={i.severity as Severity} />
                      <StatusPill value={i.status as IncidentStatus} />
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-full border px-3 py-1 text-xs transition ${value === "" ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border text-muted-foreground hover:bg-accent/10"}`}
        >
          All
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={`rounded-full border px-3 py-1 text-xs transition ${value === o.value ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border text-muted-foreground hover:bg-accent/10"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}