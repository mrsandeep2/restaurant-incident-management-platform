import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "@/lib/authz";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,created_at,status,reviewed_at,rejection_reason")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const map: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (map[r.user_id] ||= []).push(r.role as string);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: map[p.id] ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "manager", "staff"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);
    const { data: prev } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user_id).maybeSingle();
    await supabase.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor: userId,
      action: prev ? "role_changed" : "role_assigned",
      target_user: data.user_id,
      details: { from: prev?.role ?? null, to: data.role },
    });
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      full_name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "manager", "staff"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);
    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        rejection_reason: null,
      })
      .eq("id", data.user_id);
    if (profErr) throw new Error(profErr.message);
    await supabase.from("user_roles").delete().eq("user_id", data.user_id);
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);
    await supabase.from("audit_logs").insert([
      { actor: userId, action: "user_approved", target_user: data.user_id, details: { role: data.role } },
      { actor: userId, action: "role_assigned", target_user: data.user_id, details: { to: data.role } },
    ]);
    await supabase.from("notifications").insert({
      user_id: data.user_id,
      type: "account_approved",
      title: "Account approved",
      body: `You're in. Assigned role: ${data.role}.`,
    });
    return { ok: true };
  });

export const rejectUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);
    const { error } = await supabase
      .from("profiles")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        rejection_reason: data.reason ?? null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await supabase.from("user_roles").delete().eq("user_id", data.user_id);
    await supabase.from("audit_logs").insert({
      actor: userId,
      action: "user_rejected",
      target_user: data.user_id,
      details: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(
      new Set([...(data ?? []).map((r) => r.actor), ...(data ?? []).map((r) => r.target_user)].filter(Boolean)),
    ) as string[];
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((row) => ({
      ...row,
      actor_profile: row.actor ? map.get(row.actor) ?? null : null,
      target_profile: row.target_user ? map.get(row.target_user) ?? null : null,
    }));
  });

/** Public — called right after sign-in to verify a user is allowed to access the app. */
export const checkAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("status,rejection_reason")
      .eq("id", userId)
      .maybeSingle();
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const status = profile?.status ?? "pending";
    const hasRole = (roles ?? []).length > 0;
    return {
      status,
      hasRole,
      rejection_reason: profile?.rejection_reason ?? null,
      allowed: status === "approved" && hasRole,
    };
  });