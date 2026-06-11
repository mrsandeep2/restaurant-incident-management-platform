import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: unknown
) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const payload: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };

  if (responseSchema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error: ${res.status}. Details: ${errText}`);
  }

  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid response structure from Gemini API");
  }
  return text;
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
      "You are an operations expert for restaurants. Analyze the incident and respond as STRICT JSON with keys: summary (1-2 sentence neutral summary), category, severity, suggestions (array of 3 short actionable resolution steps).";
    const schema = {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING" },
        category: {
          type: "STRING",
          enum: ["pos", "delivery", "inventory", "kitchen", "customer", "staff", "hygiene", "safety", "payment", "other"]
        },
        severity: {
          type: "STRING",
          enum: ["low", "medium", "high", "critical"]
        },
        suggestions: {
          type: "ARRAY",
          items: { type: "STRING" }
        }
      },
      required: ["summary", "category", "severity", "suggestions"]
    };

    const raw = await callGemini(
      sys,
      `Title: ${data.title}\n\nDescription: ${data.description}`,
      schema
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
    const text = await callGemini(sys, sample);
    return { insights: text };
  });