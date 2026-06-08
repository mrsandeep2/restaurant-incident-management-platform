import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "staff";

/**
 * Server-side role check. Throws if the authenticated user does not hold
 * any of the allowed roles. Use inside `createServerFn` handlers after
 * `requireSupabaseAuth` middleware has populated context.
 */
export async function assertRole(
  supabase: SupabaseClient,
  userId: string,
  allowed: AppRole[],
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error("Forbidden: insufficient permissions");
  }
}