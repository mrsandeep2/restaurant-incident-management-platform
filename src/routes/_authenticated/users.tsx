import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Check, X, Search, ShieldCheck, Clock, XCircle } from "lucide-react";
import {
  listUsers,
  setUserRole,
  approveUser,
  rejectUser,
} from "@/lib/users.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { cn } from "@/lib/utils";

type Role = "admin" | "manager" | "staff";
type Status = "pending" | "approved" | "rejected";

export const Route = createFileRoute("/_authenticated/users")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <UsersPage />
    </RoleGate>
  ),
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const roleFn = useServerFn(setUserRole);
  const approveFn = useServerFn(approveUser);
  const rejectFn = useServerFn(rejectUser);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listFn(),
  });

  const [tab, setTab] = useState<Status>("pending");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  };

  const setRoleM = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => roleFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Role updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const approveM = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => approveFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("User approved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rejectM = useMutation({
    mutationFn: (v: { user_id: string; reason?: string }) => rejectFn({ data: v }),
    onSuccess: () => { invalidate(); toast.success("User rejected"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const buckets = useMemo(() => {
    const get = (s: Status) =>
      users
        .filter((u) => ((u.status ?? "pending") as Status) === s)
        .filter((u) =>
          query
            ? (u.full_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
              (u.email ?? "").toLowerCase().includes(query.toLowerCase())
            : true,
        )
        .filter((u) =>
          s === "approved" && roleFilter !== "all" ? u.roles[0] === roleFilter : true,
        );
    return { pending: get("pending"), approved: get("approved"), rejected: get("rejected") };
  }, [users, query, roleFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-4xl">
          Approval <span className="italic text-terracotta">center</span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Approve registrations, assign roles, and manage your team.
        </p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={Clock} label="Pending review" value={buckets.pending.length} tone="amber" />
        <StatTile icon={ShieldCheck} label="Approved" value={buckets.approved.length} tone="sage" />
        <StatTile icon={XCircle} label="Rejected" value={buckets.rejected.length} tone="terracotta" />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
          {tab === "approved" && (
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="pending">
              Pending <Badge variant="outline" className="ml-2">{buckets.pending.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved <Badge variant="outline" className="ml-2">{buckets.approved.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected <Badge variant="outline" className="ml-2">{buckets.rejected.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <UserList
              loading={isLoading}
              users={buckets.pending}
              renderActions={(u) => (
                <PendingActions
                  onApprove={(role) => approveM.mutate({ user_id: u.id, role })}
                  onReject={(reason) => rejectM.mutate({ user_id: u.id, reason })}
                  user={u}
                />
              )}
              emptyText="No pending registrations. You're all caught up."
            />
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            <UserList
              loading={isLoading}
              users={buckets.approved}
              renderActions={(u) => (
                <Select
                  value={(u.roles[0] as Role) ?? "staff"}
                  onValueChange={(v) => setRoleM.mutate({ user_id: u.id, role: v as Role })}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
              emptyText="No approved users match your filters."
            />
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            <UserList
              loading={isLoading}
              users={buckets.rejected}
              renderActions={(u) => (
                <PendingActions
                  onApprove={(role) => approveM.mutate({ user_id: u.id, role })}
                  onReject={() => {}}
                  user={u}
                  approveOnly
                />
              )}
              emptyText="No rejected accounts."
              showReason
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "amber" | "sage" | "terracotta";
}) {
  const toneClass =
    tone === "amber" ? "bg-accent/15 text-terracotta"
    : tone === "sage" ? "bg-sage/15 text-sage"
    : "bg-terracotta/15 text-terracotta";
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4">
      <span className={cn("grid h-10 w-10 place-items-center rounded-xl", toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-serif text-3xl">{value}</div>
      </div>
    </div>
  );
}

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  status?: string | null;
  rejection_reason?: string | null;
  roles: string[];
};

function UserList({
  users,
  loading,
  renderActions,
  emptyText,
  showReason,
}: {
  users: UserRow[];
  loading: boolean;
  renderActions: (u: UserRow) => React.ReactNode;
  emptyText: string;
  showReason?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (users.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card/40">
      {users.map((u) => (
        <motion.li
          key={u.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 p-4"
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-background text-sm font-medium uppercase">
            {(u.full_name ?? u.email ?? "?").slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{u.full_name ?? "Unnamed"}</div>
            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Registered {format(new Date(u.created_at), "MMM d, yyyy")}</span>
              <StatusBadge status={(u.status ?? "pending") as Status} />
              {u.roles[0] && (
                <Badge variant="outline" className="capitalize">{u.roles[0]}</Badge>
              )}
            </div>
            {showReason && u.rejection_reason && (
              <div className="mt-1 text-xs text-terracotta">Reason: {u.rejection_reason}</div>
            )}
          </div>
          <div>{renderActions(u)}</div>
        </motion.li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "bg-accent/20 text-terracotta",
    approved: "bg-sage/20 text-sage",
    rejected: "bg-terracotta/20 text-terracotta",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", map[status])}>{status}</span>;
}

function PendingActions({
  user,
  onApprove,
  onReject,
  approveOnly,
}: {
  user: UserRow;
  onApprove: (role: Role) => void;
  onReject: (reason?: string) => void;
  approveOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [role, setRole] = useState<Role>("staff");
  const [reason, setReason] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="gradient-accent border-0 text-accent-foreground"
        onClick={() => setOpen(true)}
      >
        <Check className="h-4 w-4" /> Approve
      </Button>
      {!approveOnly && (
        <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
          <X className="h-4 w-4" /> Reject
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Approve & assign role</DialogTitle>
            <DialogDescription>
              Grant {user.full_name ?? user.email} access to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff — report incidents</SelectItem>
                <SelectItem value="manager">Manager — workflow & analytics</SelectItem>
                <SelectItem value="admin">Admin — full system access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="gradient-accent border-0 text-accent-foreground"
              onClick={() => { onApprove(role); setOpen(false); }}
            >
              Approve user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Reject account</DialogTitle>
            <DialogDescription>
              They'll see this reason when they try to sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onReject(reason || undefined); setRejectOpen(false); }}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}