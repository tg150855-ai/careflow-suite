import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/voice-hmis")({ component: VoicePage });

const COMMANDS: { match: RegExp; action: (nav: any) => void; label: string }[] = [
  { match: /admissions|admits/i, action: (n) => n({ to: "/ipd" }), label: "Show today's admissions" },
  { match: /discharge/i, action: (n) => n({ to: "/ipd" }), label: "Create discharge summary" },
  { match: /patient history|patient record/i, action: (n) => n({ to: "/patients" }), label: "Open patient history" },
  { match: /icu|critical/i, action: (n) => n({ to: "/icu" }), label: "Open ICU" },
  { match: /pharmacy/i, action: (n) => n({ to: "/pharmacy" }), label: "Open pharmacy" },
  { match: /lab/i, action: (n) => n({ to: "/laboratory" }), label: "Open laboratory" },
  { match: /appointment/i, action: (n) => n({ to: "/appointments" }), label: "Open appointments" },
  { match: /reports?|analytics/i, action: (n) => n({ to: "/bi" }), label: "Open reports" },
];

function VoicePage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const recRef = useRef<any>(null);
  const navigate = useNavigate();

  function speak(text: string) {
    try { const u = new SpeechSynthesisUtterance(text); speechSynthesis.speak(u); } catch {}
  }

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Voice not supported");
    const r = new SR(); r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join(" ");
      setTranscript(t);
      const final = e.results[e.results.length - 1].isFinal;
      if (final) {
        const cmd = COMMANDS.find((c) => c.match.test(t));
        if (cmd) { speak(`Opening ${cmd.label}`); cmd.action(navigate); setHistory((h) => [t, ...h].slice(0, 10)); setTranscript(""); }
      }
    };
    r.onend = () => setListening(false);
    r.start(); recRef.current = r; setListening(true);
  }
  function stop() { recRef.current?.stop(); setListening(false); }

  return (
    <div className="space-y-6">
      <PageHeader icon={Volume2} title="Voice-Driven HMIS" subtitle="Hands-free dictation and command routing for doctors, nurses and admins." />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={listening ? stop : start} variant={listening ? "destructive" : "default"}>
              {listening ? <><MicOff className="size-4 mr-2" />Stop</> : <><Mic className="size-4 mr-2" />Start Listening</>}
            </Button>
            {listening && <Badge variant="secondary" className="animate-pulse">Listening…</Badge>}
          </div>
          <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} placeholder="Live transcript appears here. You can also type." />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="font-semibold mb-3">Quick Voice Commands</div>
            <ul className="space-y-2 text-sm">{COMMANDS.map((c) => <li key={c.label} className="flex gap-2"><Badge variant="outline">{c.label}</Badge></li>)}</ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="font-semibold mb-3">Recent Commands</div>
            {history.length === 0 ? <div className="text-sm text-muted-foreground">No commands yet.</div> :
              <ul className="space-y-2 text-sm">{history.map((h, i) => <li key={i} className="truncate p-2 rounded bg-muted/40">{h}</li>)}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
