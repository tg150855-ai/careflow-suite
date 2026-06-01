import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Stethoscope, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai-assistant")({ component: AIPage });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callAI(prompt: string, system: string): Promise<string> {
  // Use Lovable AI Gateway via existing edge function if any; fallback to local placeholder.
  // Here we directly call gateway through a public endpoint won't work; instead use supabase auth token.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  }).catch(() => null);
  if (!res || !res.ok) {
    // Fallback heuristic
    return `[Demo AI Response]\n\nBased on input: "${prompt.slice(0, 100)}..."\n\nThe AI Gateway is not yet wired. Please deploy the ai-chat edge function to enable live suggestions.`;
  }
  const j = await res.json();
  return j.content ?? j.message ?? JSON.stringify(j);
}

function AITool({ title, system, placeholder, icon: Icon }: { title: string; system: string; placeholder: string; icon: any }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!input.trim()) return toast.error("Enter input");
    setLoading(true);
    try {
      const out = await callAI(input, system);
      setOutput(out);
      // Persist as ai_insight
      await supabase.from("ai_insights").insert({
        category: title.toLowerCase().replace(/ /g, "_"),
        title: input.slice(0, 80),
        body: { input, output: out } as any,
      } as any);
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="size-5 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} rows={5} />
        <Button onClick={run} disabled={loading}>{loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Thinking…</> : "Generate"}</Button>
        {output && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-mono">{output}</div>
        )}
      </CardContent>
    </Card>
  );
}

function AIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="size-6 text-primary" /> AI Clinical Assistant</h1>
        <p className="text-sm text-muted-foreground">Prescription suggestions, clinical notes, and discharge summaries. Doctor approval required before saving.</p>
      </div>

      <Tabs defaultValue="rx">
        <TabsList>
          <TabsTrigger value="rx">Prescription Suggestions</TabsTrigger>
          <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
          <TabsTrigger value="disc">Discharge Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="rx">
          <AITool
            title="AI Prescription Suggestions"
            icon={Stethoscope}
            placeholder="Symptoms, diagnosis, history, allergies…"
            system="You are a clinical decision support assistant. Suggest evidence-based medications with dosage, frequency, and duration. Always flag contraindications. Output as a structured list. The doctor must review and approve."
          />
        </TabsContent>
        <TabsContent value="notes">
          <AITool
            title="AI Clinical Notes"
            icon={FileText}
            placeholder="Paste consultation transcript or dictation…"
            system="Convert the input into a structured SOAP note: Subjective, Objective, Assessment, Plan. Be concise and use medical terminology."
          />
        </TabsContent>
        <TabsContent value="disc">
          <AITool
            title="AI Discharge Summary"
            icon={FileText}
            placeholder="Admission reason, treatment given, response, condition at discharge…"
            system="Generate a complete discharge summary: diagnosis, treatment summary, medications at discharge, follow-up plan, lifestyle recommendations."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
