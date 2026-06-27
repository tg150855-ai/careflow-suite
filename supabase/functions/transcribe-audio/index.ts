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
      const raw = await r.text().catch(() => "");
      let friendly = `Transcription failed (${r.status})`;
      if (r.status === 402) friendly = "AI credits exhausted. Please top up Lovable AI credits to use voice dictation.";
      else if (r.status === 429) friendly = "Voice service is rate-limited. Please try again in a moment.";
      else if (r.status >= 500) friendly = "Voice service temporarily unavailable. Please try again.";
      // Always return 200 so supabase.functions.invoke surfaces the JSON instead of a generic non-2xx error.
      return new Response(JSON.stringify({ error: friendly, code: r.status, details: raw.slice(0, 500) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
