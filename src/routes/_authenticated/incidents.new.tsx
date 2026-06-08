import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Upload, X, Wand2 } from "lucide-react";
import { z } from "zod";
import { createIncident } from "@/lib/incidents.functions";
import { aiAnalyzeIncident } from "@/lib/ai.functions";
import { listStores } from "@/lib/stores.functions";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  SEVERITY,
  SEVERITY_KEYS,
  type IncidentCategory,
  type Severity,
} from "@/lib/incident-meta";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/incidents/new")({
  component: NewIncidentPage,
});

const schema = z.object({
  title: z.string().min(3, "Add a short title").max(140),
  description: z.string().min(10, "Describe what happened").max(4000),
  category: z.enum(CATEGORY_KEYS as [IncidentCategory, ...IncidentCategory[]]),
  severity: z.enum(SEVERITY_KEYS as [Severity, ...Severity[]]),
});

type FileEntry = { file: File; path?: string };

function NewIncidentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createIncident);
  const aiFn = useServerFn(aiAnalyzeIncident);
  const storesFn = useServerFn(listStores);
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => storesFn() });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("pos");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [storeId, setStoreId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const aiMutation = useMutation({
    mutationFn: () => aiFn({ data: { title, description } }),
    onSuccess: (res) => {
      setAiSummary(res.summary);
      setAiSuggestions(res.suggestions ?? []);
      if (CATEGORY_KEYS.includes(res.category as IncidentCategory)) {
        setCategory(res.category as IncidentCategory);
      }
      if (SEVERITY_KEYS.includes(res.severity as Severity)) {
        setSeverity(res.severity as Severity);
      }
      toast.success("AI analysis ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI failed"),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ title, description, category, severity });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      // Upload files first
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const uploaded: { path: string; name: string; mime: string; size: number }[] = [];
      for (const fe of files) {
        const ext = fe.file.name.split(".").pop() ?? "bin";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("incident-attachments")
          .upload(path, fe.file, { contentType: fe.file.type });
        if (upErr) throw new Error(upErr.message);
        uploaded.push({ path, name: fe.file.name, mime: fe.file.type, size: fe.file.size });
      }

      const res = await createFn({
        data: {
          title,
          description,
          category,
          severity,
          store_id: storeId || null,
          contact_phone: phone || null,
          contact_email: email || null,
          ai_summary: aiSummary,
          attachments: uploaded,
        },
      });
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Incident reported");
      navigate({ to: "/incidents/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const added = Array.from(list).slice(0, 10 - files.length).map((file) => ({ file }));
    setFiles((p) => [...p, ...added]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Report an incident</h1>
        <p className="mt-1 text-muted-foreground">Tell us what happened — AI will help triage.</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          submitMutation.mutate();
        }}
        className="glass space-y-6 rounded-3xl p-6 md:p-8"
      >
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. POS terminal frozen during lunch" maxLength={140} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, when, and what's the impact?"
            rows={5}
            maxLength={4000}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{description.length}/4000</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={aiMutation.isPending || description.length < 10 || title.length < 3}
              onClick={() => aiMutation.mutate()}
              className="gap-2 text-terracotta hover:text-terracotta"
            >
              {aiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Analyze with AI
            </Button>
          </div>
        </div>

        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4 text-sm"
          >
            <div className="flex items-center gap-2 text-terracotta">
              <Sparkles className="h-4 w-4" /> <span className="font-medium">AI summary</span>
            </div>
            <p className="mt-2 text-foreground/80">{aiSummary}</p>
            {aiSuggestions.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-foreground/80">
                {aiSuggestions.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-terracotta">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_KEYS.map((k) => {
                  const c = CATEGORIES[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <c.icon className={`h-4 w-4 ${c.tone}`} /> {c.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_KEYS.map((k) => {
                const s = SEVERITY[k];
                const active = severity === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSeverity(k)}
                    className={`rounded-full px-3 py-1.5 text-xs transition ring-1 ${active ? `${s.bg} ${s.text} ${s.ring}` : "ring-border text-muted-foreground hover:bg-accent/10"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-1">
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="No store" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contact phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Evidence</Label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/40 p-8 text-center transition hover:border-terracotta/40 hover:bg-terracotta/5">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Click to attach images, screenshots, PDFs</span>
            <span className="text-xs text-muted-foreground">Up to 10 files</span>
            <input type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={onPickFiles} />
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {files.map((fe, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                  {fe.file.type.startsWith("image/") ? (
                    <img src={URL.createObjectURL(fe.file)} alt="" className="h-24 w-full object-cover" />
                  ) : (
                    <div className="grid h-24 place-items-center text-xs text-muted-foreground">{fe.file.name}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80 text-foreground opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/incidents" })}>Cancel</Button>
          <Button type="submit" disabled={submitMutation.isPending} className="gradient-accent text-accent-foreground border-0">
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit incident
          </Button>
        </div>
      </motion.form>
    </div>
  );
}