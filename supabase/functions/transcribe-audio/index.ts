import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 256) {
      return new Response(JSON.stringify({ error: "Recording is empty or too short." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    const mime = (file.type || "audio/webm").split(";")[0];
    const ext = ({ "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav" } as Record<string, string>)[mime] ?? "webm";
    upstream.append("file", file, `recording.${ext}`);
    const language = form.get("language");
    if (typeof language === "string" && language.trim()) upstream.append("language", language.trim());
    const prompt = form.get("prompt");
    if (typeof prompt === "string" && prompt.trim()) upstream.append("prompt", prompt.trim());

    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      body: upstream,
    });

    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Transcription failed (${r.status}): ${msg}` }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    return new Response(JSON.stringify({ text: data.text ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
