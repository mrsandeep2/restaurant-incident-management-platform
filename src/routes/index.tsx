import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldAlert,
  Sparkles,
  LineChart,
  Bell,
  Camera,
  Store as StoreIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentry — Premium Restaurant Incident Reporting" },
      { name: "description", content: "Sentry helps restaurant teams capture, triage, and resolve operational incidents with AI assistance and beautiful analytics." },
      { property: "og:title", content: "Sentry — Restaurant Incident Reporting" },
      { property: "og:description", content: "Capture, triage, and resolve restaurant incidents in one elegant SaaS." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-accent text-accent-foreground shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl">Sentry</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth" search={{}}>
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button className="gradient-accent text-accent-foreground border-0">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-terracotta" />
            Built for QSR operations teams
          </span>
          <h1 className="mt-6 font-serif text-5xl leading-tight tracking-tight md:text-7xl">
            Every incident,<br />
            <span className="italic text-terracotta">resolved</span> with care.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Sentry is the calm, premium command center for restaurant
            operations — capture POS, delivery, kitchen, and customer
            incidents and resolve them with AI-assisted triage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="gradient-accent text-accent-foreground border-0">
                Start reporting <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth" search={{}}>
              <Button size="lg" variant="outline">Sign in</Button>
            </Link>
          </div>
        </motion.div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Camera, title: "Submit in seconds", body: "Floating-label form, attachments, and AI auto-tagging keep front-of-house fast." },
            { icon: LineChart, title: "See the whole floor", body: "Real-time dashboard, severity heatmaps, and resolution-time analytics across stores." },
            { icon: Bell, title: "Never miss a critical", body: "Status timeline, manager assignments, and instant notifications when things escalate." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <f.icon className="h-6 w-6 text-terracotta" />
              <h3 className="mt-4 font-serif text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <StoreIcon className="h-4 w-4" /> Multi-store ready • AI-assisted • Mobile first
        </div>
      </main>
    </div>
  );
}
