import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkAccountAccess } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signin" | "signup"; redirect?: string } => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "At least 6 characters"),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function googleSignIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (!result.redirected) navigate({ to: "/dashboard" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset email sent");
        setTab("signin");
        return;
      }
      const parsed = schema.safeParse({ email, password });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        // First-ever signup is bootstrapped as admin + approved by the DB trigger.
        // Everyone else must wait for admin approval.
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          const access = await checkAccountAccess();
          if (access.allowed) {
            toast.success("Welcome — you're the workspace admin.");
            navigate({ to: "/dashboard" });
          } else {
            await supabase.auth.signOut();
            toast.success(
              "Registration successful. Your account is pending administrator approval. You will be able to access the platform after approval.",
              { duration: 8000 },
            );
            setTab("signin");
          }
        } else {
          toast.success(
            "Registration successful. Your account is pending administrator approval. Please check your email to confirm, then wait for approval.",
            { duration: 8000 },
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const access = await checkAccountAccess();
        if (access.allowed) {
          navigate({ to: "/dashboard" });
        } else if (access.status === "rejected") {
          await supabase.auth.signOut();
          toast.error(
            access.rejection_reason
              ? `Your account request has been rejected. Reason: ${access.rejection_reason}`
              : "Your account request has been rejected. Please contact an administrator.",
            { duration: 8000 },
          );
        } else {
          await supabase.auth.signOut();
          toast.error("Your account is awaiting administrator approval.", { duration: 8000 });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-accent text-accent-foreground">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl">Sentry</span>
        </div>
        <div className="max-w-md">
          <h2 className="font-serif text-5xl leading-tight">
            Calm in the <span className="italic text-terracotta">chaos</span> of the dinner rush.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sentry gives restaurant operations a single, beautiful place to
            capture and resolve every incident — with AI that does the
            triage for you.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Sentry — restaurant operations, refined.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-md rounded-3xl p-8"
        >
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl gradient-accent text-accent-foreground">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <span className="font-serif text-2xl">Sentry</span>
          </div>
          <h1 className="font-serif text-3xl">
            {tab === "forgot" ? "Reset password" : tab === "signup" ? "Create account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "forgot" ? "Email a recovery link." : "Continue to your incident dashboard."}
          </p>

          {tab !== "forgot" && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" />
              <TabsContent value="signup" />
            </Tabs>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={googleSignIn}
            disabled={busy}
          >
            <GoogleIcon /> Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" />
            </div>
            {tab !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Password</Label>
                  <button type="button" onClick={() => setTab("forgot")} className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot?
                  </button>
                </div>
                <Input type="password" autoComplete={tab === "signup" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full gradient-accent text-accent-foreground border-0">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === "forgot" ? "Send recovery link" : tab === "signup" ? "Create account" : "Sign in"}
            </Button>
            {tab === "forgot" && (
              <button type="button" onClick={() => setTab("signin")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Back to sign in
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}