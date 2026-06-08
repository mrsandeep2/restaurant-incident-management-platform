import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Paperclip,
  Loader2,
  Send,
  MessageSquare,
  RefreshCcw,
} from "lucide-react";
import {
  getIncident,
  updateIncidentStatus,
  addIncidentComment,
} from "@/lib/incidents.functions";
import {
  CATEGORIES,
  STATUS,
  STATUS_ORDER,
  type IncidentCategory,
  type IncidentStatus,
  type Severity,
} from "@/lib/incident-meta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityPill, StatusPill } from "@/components/severity-pill";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/incidents/$id")({
  component: IncidentDetailPage,
});

function IncidentDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getIncident);
  const statusFn = useServerFn(updateIncidentStatus);
  const commentFn = useServerFn(addIncidentComment);

  const { data, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [comment, setComment] = useState("");

  const statusMutation = useMutation({
    mutationFn: (status: IncidentStatus) => statusFn({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const commentMutation = useMutation({
    mutationFn: () => commentFn({ data: { id, body: comment } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["incident", id] });
      toast.success("Comment added");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { incident, attachments, events, profiles } = data;
  const cat = CATEGORIES[incident.category as IncidentCategory];
  const reporter = profiles[incident.reported_by];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/incidents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All incidents
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-card ${cat?.tone}`}>
            {cat ? <cat.icon className="h-6 w-6" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{cat?.label}</span>
              <span>·</span>
              <span>{format(new Date(incident.created_at), "PP p")}</span>
            </div>
            <h1 className="mt-1 font-serif text-3xl">{incident.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeverityPill value={incident.severity as Severity} />
              <StatusPill value={incident.status as IncidentStatus} />
            </div>
          </div>
          <div className="w-full md:w-auto">
            <Select value={incident.status} onValueChange={(v) => statusMutation.mutate(v as IncidentStatus)}>
              <SelectTrigger className="min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((k) => (
                  <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status workflow */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {STATUS_ORDER.filter((s) => s !== "escalated").map((s, i, arr) => {
            const idx = STATUS_ORDER.indexOf(incident.status as IncidentStatus);
            const myIdx = STATUS_ORDER.indexOf(s);
            const past = myIdx <= idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-medium ring-2 transition ${past ? "bg-terracotta text-accent-foreground ring-terracotta" : "bg-card text-muted-foreground ring-border"}`}>
                  {i + 1}
                </span>
                <span className={`text-xs ${past ? "text-foreground" : "text-muted-foreground"}`}>{STATUS[s].label}</span>
                {i < arr.length - 1 && <span className={`h-px w-6 ${past ? "bg-terracotta" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Meta icon={Calendar} label="Occurred" value={format(new Date(incident.occurred_at), "PP p")} />
          <Meta icon={Phone} label="Contact" value={incident.contact_phone ?? "—"} />
          <Meta icon={Mail} label="Email" value={incident.contact_email ?? "—"} />
        </div>

        <div className="mt-6 rounded-2xl bg-muted/40 p-4">
          <p className="whitespace-pre-wrap text-sm">{incident.description}</p>
        </div>

        {incident.ai_summary && (
          <div className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-terracotta">AI summary</div>
            <p className="mt-1 text-foreground/80">{incident.ai_summary}</p>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Attachments
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {attachments.map((a) => (
                <a key={a.path} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-card transition hover:opacity-80">
                  {a.mime?.startsWith("image/") ? (
                    <img src={a.url} alt={a.name ?? ""} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="grid h-28 place-items-center p-2 text-center text-xs text-muted-foreground">{a.name}</div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <div className="glass rounded-3xl p-6 md:p-8">
        <h2 className="font-serif text-2xl">Timeline</h2>
        <ol className="mt-4 space-y-3">
          {events.map((e) => {
            const p = e.actor ? profiles[e.actor] : null;
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-card ring-1 ring-border">
                    {e.kind === "comment" ? (
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5 text-terracotta" />
                    )}
                  </span>
                  <span className="my-1 w-px flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-3">
                  <div className="text-xs text-muted-foreground">
                    {p?.full_name ?? p?.email ?? "Someone"} ·{" "}
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </div>
                  {e.kind === "status_change" && e.from_status && e.to_status && (
                    <div className="mt-1 text-sm">
                      Status: <span className="text-muted-foreground">{STATUS[e.from_status as IncidentStatus].label}</span>{" "}
                      → <span className="font-medium">{STATUS[e.to_status as IncidentStatus].label}</span>
                    </div>
                  )}
                  {e.body && <p className="mt-1 text-sm">{e.body}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-end gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={() => commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="gradient-accent text-accent-foreground border-0"
          >
            {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}