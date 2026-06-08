import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { listAuditLogs } from "@/lib/users.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/_authenticated/audit")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <AuditPage />
    </RoleGate>
  ),
});

const ACTION_LABEL: Record<string, string> = {
  user_registered: "User registered",
  user_approved: "User approved",
  user_rejected: "User rejected",
  role_assigned: "Role assigned",
  role_changed: "Role changed",
};

function AuditPage() {
  const fn = useServerFn(listAuditLogs);
  const { data = [], isLoading } = useQuery({ queryKey: ["audit"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl">
          Audit <span className="italic text-terracotta">log</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Every approval, rejection and role change — on the record.
        </p>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((row) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {ACTION_LABEL[row.action] ?? row.action.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(row.created_at), "MMM d, yyyy · HH:mm")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">
                      {row.actor_profile?.full_name ?? row.actor_profile?.email ?? "System"}
                    </span>
                    {row.target_profile && (
                      <>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">
                          {row.target_profile.full_name ?? row.target_profile.email}
                        </span>
                      </>
                    )}
                  </div>
                  {row.details && Object.keys(row.details as object).length > 0 && (
                    <pre className="mt-1 truncate text-[11px] text-muted-foreground">
                      {JSON.stringify(row.details)}
                    </pre>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}