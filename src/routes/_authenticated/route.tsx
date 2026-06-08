import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ListChecks,
  Plus,
  BarChart3,
  Store,
  Users,
  Bell,
  LogOut,
  Menu,
  ShieldAlert,
  Settings,
  Sparkles,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/users.functions";
import { listNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const meFn = useServerFn(getMe);
  const navigate = useNavigate();
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const roles = me?.roles ?? [];
  const isManager = roles.includes("manager") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

  // Approval gate — sign out and bounce anyone who is not approved + role-assigned.
  useEffect(() => {
    if (meLoading || !me) return;
    const status = (me.profile as { status?: string } | null)?.status;
    const allowed = status === "approved" && roles.length > 0;
    if (!allowed) {
      (async () => {
        const reason = (me.profile as { rejection_reason?: string | null } | null)?.rejection_reason;
        await supabase.auth.signOut();
        if (status === "rejected") {
          toast.error(
            reason
              ? `Your account request has been rejected. Reason: ${reason}`
              : "Your account request has been rejected. Please contact an administrator.",
          );
        } else {
          toast.error("Your account is awaiting administrator approval.");
        }
        navigate({ to: "/auth", replace: true, search: {} });
      })();
    }
  }, [meLoading, me, roles.length, navigate]);

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/incidents", label: "Incidents", icon: ListChecks, show: true },
    { to: "/incidents/new", label: "Report", icon: Plus, show: true },
    { to: "/analytics", label: "Analytics", icon: BarChart3, show: isManager },
    { to: "/stores", label: "Stores", icon: Store, show: isAdmin },
    { to: "/users", label: "Users", icon: Users, show: isAdmin },
    { to: "/audit", label: "Audit log", icon: ShieldAlert, show: isAdmin },
    { to: "/settings", label: "Settings", icon: Settings, show: true },
  ].filter((i) => i.show);

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar/60 backdrop-blur lg:block">
        <SidebarContent nav={nav} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} userName={me?.profile?.full_name ?? me?.profile?.email ?? "You"} role={roles[0]} />
        <main className="flex-1 px-4 pb-12 pt-6 md:px-8">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
          <SidebarContent nav={nav} onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({
  nav,
  onNav,
}: {
  nav: { to: string; label: string; icon: typeof Plus }[];
  onNav?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" className="flex items-center gap-2 border-b border-border px-6 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl gradient-accent text-accent-foreground">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <span className="font-serif text-2xl">Sentry</span>
      </Link>
      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNav}
            activeOptions={{ exact: item.to === "/dashboard" }}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/75 transition hover:bg-accent/10 hover:text-foreground data-[status=active]:bg-accent/15 data-[status=active]:text-foreground"
          >
            <item.icon className="h-4 w-4 text-muted-foreground group-data-[status=active]:text-terracotta transition" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <Link to="/incidents/new" onClick={onNav}>
          <Button className="w-full gradient-accent text-accent-foreground border-0">
            <Sparkles className="h-4 w-4" /> New incident
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TopBar({ onMenu, userName, role }: { onMenu: () => void; userName: string; role?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 30000,
  });
  const unread = notifs.filter((n) => !n.read_at).length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      markFn({ data: { all: true } }).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
    }
  }, [open, markFn, qc]);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur md:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-right md:block">
          <div className="text-sm font-medium">{userName}</div>
          {role && <div className="text-xs capitalize text-muted-foreground">{role}</div>}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-medium text-accent-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Notifications</SheetTitle>
            </SheetHeader>
            <ScrollArea className="-mx-6 mt-4 h-[calc(100vh-8rem)] px-6">
              <AnimatePresence>
                {notifs.length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">You're all caught up.</p>
                )}
                <div className="space-y-2">
                  {notifs.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "rounded-xl border border-border p-3",
                        n.read_at ? "bg-card/50" : "bg-accent/10",
                      )}
                      onClick={() => {
                        if (n.incident_id) {
                          setOpen(false);
                          router.navigate({ to: "/incidents/$id", params: { id: n.incident_id } });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </Badge>
                      </div>
                      {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

