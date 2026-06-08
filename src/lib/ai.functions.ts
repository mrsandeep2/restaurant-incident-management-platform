import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(messages: Array<{ role: string; content: string }>, response_format?: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, messages, response_format }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted — please top up.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content as string;
}

export const aiAnalyzeIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sys =
      "You are an operations expert for restaurants. Analyze the incident and respond as STRICT JSON with keys: summary (1-2 sentence neutral summary), category (one of: pos, delivery, inventory, kitchen, customer, staff, hygiene, safety, payment, other), severity (one of: low, medium, high, critical), suggestions (array of 3 short actionable resolution steps). No prose outside JSON.";
    const raw = await callAI(
      [
        { role: "system", content: sys },
        { role: "user", content: `Title: ${data.title}\n\nDescription: ${data.description}` },
      ],
      { type: "json_object" },
    );
    try {
      const json = JSON.parse(raw);
      return json as {
        summary: string;
        category: string;
        severity: string;
        suggestions: string[];
      };
    } catch {
      return { summary: raw, category: "other", severity: "medium", suggestions: [] };
    }
  });

export const aiInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: incidents } = await context.supabase
      .from("incidents")
      .select("title,category,severity,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!incidents?.length) return { insights: "Not enough data yet — submit a few incidents to unlock AI insights." };
    const sample = incidents.map((i) =>
      `- [${i.severity}/${i.category}/${i.status}] ${i.title}`,
    ).join("\n");
    const sys =
      "You are an operations analyst. Given recent restaurant incidents, output 3-5 sharp insights (markdown bullet list, <120 words total) covering recurring problems, risk hotspots, and one priority action.";
    const text = await callAI([
      { role: "system", content: sys },
      { role: "user", content: sample },
    ]);
    return { insights: text };
  });