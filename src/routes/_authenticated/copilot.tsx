import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Mic, MicOff, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/copilot")({ component: CopilotPage });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUB_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Msg = { role: "user" | "assistant"; content: string };

const QUICK = [
  "Summarize today's hospital operations",
  "List critical ICU patients",
  "Suggest revenue improvements",
  "Draft a discharge summary template",
];

function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hello! I'm your Hospital Copilot. Ask me anything about patients, operations, revenue, or clinical workflows." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim()) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    let assistantSoFar = "";
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/copilot-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PUB_KEY}` },
        body: JSON.stringify({ messages: newMsgs }),
      }).catch(() => null);
      if (!res || !res.ok || !res.body) {
        assistantSoFar = `I'd help with: "${text}". The Copilot streaming function is being configured. Meanwhile, you can use Quick Commands or check the live dashboards.`;
        setMessages([...newMsgs, { role: "assistant", content: assistantSoFar }]);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        setMessages([...newMsgs, { role: "assistant", content: "" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") break;
            try {
              const p = JSON.parse(j);
              const c = p.choices?.[0]?.delta?.content;
              if (c) { assistantSoFar += c; setMessages((prev) => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: assistantSoFar } : m)); }
            } catch {}
          }
        }
      }
      // persist
      const userRes = await supabase.auth.getUser();
      if (userRes.data.user) {
        const finalMsgs = [...newMsgs, { role: "assistant" as const, content: assistantSoFar }];
        if (convId) {
          await supabase.from("ai_conversations" as any).update({ messages: finalMsgs, updated_at: new Date().toISOString() }).eq("id", convId);
        } else {
          const { data } = await supabase.from("ai_conversations" as any).insert({ user_id: userRes.data.user.id, title: text.slice(0, 60), messages: finalMsgs } as any).select().single();
          if (data) setConvId((data as any).id);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Voice not supported in this browser");
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = new SR(); r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onend = () => setListening(false);
    r.start(); recRef.current = r; setListening(true);
  }

  function newChat() { setMessages([{ role: "assistant", content: "New conversation started. How can I help?" }]); setConvId(null); }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="size-6 text-primary" /> Hospital Copilot</h1>
          <p className="text-sm text-muted-foreground">Context-aware AI for clinical, operational and revenue insights.</p>
        </div>
        <Button variant="outline" onClick={newChat}><Plus className="size-4 mr-2" />New Chat</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Badge key={q} variant="secondary" className="cursor-pointer hover:bg-primary/10" onClick={() => send(q)}>{q}</Badge>
        ))}
      </div>

      <Card className="h-[60vh] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content || (loading && i === messages.length - 1 ? <Loader2 className="size-4 animate-spin" /> : "")}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </CardContent>
        <div className="border-t p-3 flex gap-2">
          <Button variant="outline" size="icon" onClick={toggleMic}>{listening ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}</Button>
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && send(input)} placeholder="Ask the Copilot…" />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button>
        </div>
      </Card>
    </div>
  );
}
