import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { getMe } from "@/lib/users.functions";
import { toast } from "sonner";

type Role = "admin" | "manager" | "staff";

/**
 * Client-side route gate. Renders children only if the current user holds
 * one of the allowed roles. Otherwise shows a "Forbidden" message and
 * bounces back to the dashboard. Server functions still enforce the same
 * check — this is a UX layer, not the security boundary.
 */
export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const meFn = useServerFn(getMe);
  const navigate = useNavigate();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
  });

  const roles = (me?.roles ?? []) as Role[];
  const allowed = roles.some((r) => allow.includes(r));

  useEffect(() => {
    if (!isLoading && me && !allowed) {
      toast.error("You don't have permission to view that page.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isLoading, me, allowed, navigate]);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
        Checking permissions…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto grid min-h-[40vh] max-w-md place-items-center text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-terracotta" />
          <h2 className="mt-4 font-serif text-2xl">Forbidden</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role doesn't have access to this area. Redirecting you back…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}