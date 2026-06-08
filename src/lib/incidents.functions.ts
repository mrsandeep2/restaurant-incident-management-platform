import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categoryEnum = z.enum([
  "pos","delivery","inventory","kitchen","customer","staff","hygiene","safety","payment","other",
]);
const severityEnum = z.enum(["low","medium","high","critical"]);
const statusEnum = z.enum(["open","under_review","in_progress","escalated","resolved","closed"]);

export const createIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(3).max(140),
      description: z.string().min(10).max(4000),
      category: categoryEnum,
      severity: severityEnum,
      store_id: z.string().uuid().nullable().optional(),
      occurred_at: z.string().datetime().optional(),
      contact_phone: z.string().max(40).nullable().optional(),
      contact_email: z.string().email().max(255).nullable().optional(),
      ai_summary: z.string().max(1000).nullable().optional(),
      attachments: z.array(z.object({
        path: z.string(),
        name: z.string(),
        mime: z.string(),
        size: z.number(),
      })).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { attachments, ...rest } = data;
    const { data: row, error } = await supabase
      .from("incidents")
      .insert({ ...rest, reported_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (attachments?.length) {
      const { error: aErr } = await supabase.from("incident_attachments").insert(
        attachments.map((a) => ({ ...a, incident_id: row.id, uploaded_by: userId })),
      );
      if (aErr) throw new Error(aErr.message);
    }

    await supabase.from("incident_events").insert({
      incident_id: row.id,
      actor: userId,
      kind: "created",
      to_status: row.status,
      body: "Incident reported",
    });

    return { id: row.id as string };
  });

export const listIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      search: z.string().optional(),
      category: categoryEnum.optional(),
      severity: severityEnum.optional(),
      status: statusEnum.optional(),
      storeId: z.string().uuid().optional(),
      mineOnly: z.boolean().optional(),
      limit: z.number().min(1).max(200).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("incidents")
      .select("id,title,description,category,severity,status,store_id,occurred_at,reported_by,created_at,resolved_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.category) q = q.eq("category", data.category);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.status) q = q.eq("status", data.status);
    if (data.storeId) q = q.eq("store_id", data.storeId);
    if (data.mineOnly) q = q.eq("reported_by", userId);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [incident, attachments, events] = await Promise.all([
      supabase.from("incidents").select("*").eq("id", data.id).single(),
      supabase.from("incident_attachments").select("*").eq("incident_id", data.id),
      supabase.from("incident_events").select("*").eq("incident_id", data.id).order("created_at"),
    ]);
    if (incident.error) throw new Error(incident.error.message);

    const reporterIds = Array.from(
      new Set([
        incident.data.reported_by,
        ...(events.data ?? []).map((e) => e.actor).filter(Boolean),
      ].filter(Boolean) as string[]),
    );
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (reporterIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", reporterIds);
      profiles = Object.fromEntries((ps ?? []).map((p) => [p.id, p]));
    }

    const signed: Array<{ path: string; name: string | null; mime: string | null; url: string }> = [];
    for (const a of attachments.data ?? []) {
      const { data: s } = await supabase.storage
        .from("incident-attachments")
        .createSignedUrl(a.path, 60 * 60);
      signed.push({ path: a.path, name: a.name, mime: a.mime, url: s?.signedUrl ?? "" });
    }

    return {
      incident: incident.data,
      attachments: signed,
      events: events.data ?? [],
      profiles,
    };
  });

export const updateIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: statusEnum,
      resolution_notes: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { status: typeof data.status; resolution_notes?: string } = {
      status: data.status,
    };
    if (data.resolution_notes) patch.resolution_notes = data.resolution_notes;
    const { error } = await supabase.from("incidents").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addIncidentComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("incident_events").insert({
      incident_id: data.id,
      actor: userId,
      kind: "comment",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: incidents, error } = await supabase
      .from("incidents")
      .select("id,status,severity,category,store_id,created_at,resolved_at");
    if (error) throw new Error(error.message);
    const rows = incidents ?? [];
    const total = rows.length;
    const open = rows.filter((r) => !["resolved", "closed"].includes(r.status)).length;
    const critical = rows.filter((r) => r.severity === "critical").length;
    const resolved = rows.filter((r) => r.status === "resolved" || r.status === "closed").length;
    const resolvedRows = rows.filter((r) => r.resolved_at);
    const avgHours = resolvedRows.length
      ? resolvedRows.reduce((acc, r) => {
          const diff =
            new Date(r.resolved_at as string).getTime() -
            new Date(r.created_at).getTime();
          return acc + diff / 3600000;
        }, 0) / resolvedRows.length
      : 0;

    const byCategory = Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, value }));

    const bySeverity = Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.severity] = (acc[r.severity] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, value }));

    // Monthly trend (last 6 months)
    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleString("en", { month: "short" }),
        count: 0,
      });
    }
    for (const r of rows) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key);
      if (m) m.count++;
    }

    const recent = rows.slice(0, 5);
    return {
      total,
      open,
      critical,
      resolved,
      avgHours,
      byCategory,
      bySeverity,
      monthly: months,
      recent,
    };
  });