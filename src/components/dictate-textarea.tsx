import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ---------------- languages ---------------- */

export const SPEECH_LANGS: { code: string; label: string; short: string }[] = [
  { code: "en-IN", label: "English (India)", short: "EN" },
  { code: "hi-IN", label: "हिंदी / Hindi", short: "हिं" },
  { code: "mr-IN", label: "मराठी / Marathi", short: "मरा" },
  { code: "gu-IN", label: "ગુજરાતી / Gujarati", short: "ગુ" },
  { code: "ta-IN", label: "தமிழ் / Tamil", short: "த" },
  { code: "te-IN", label: "తెలుగు / Telugu", short: "తె" },
  { code: "kn-IN", label: "ಕನ್ನಡ / Kannada", short: "ಕ" },
  { code: "ml-IN", label: "മലയാളം / Malayalam", short: "മ" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ / Punjabi", short: "ਪੰ" },
  { code: "bn-IN", label: "বাংলা / Bengali", short: "বা" },
  { code: "or-IN", label: "ଓଡ଼ିଆ / Odia", short: "ଓ" },
  { code: "ur-IN", label: "اردو / Urdu", short: "اُر" },
  { code: "en-US", label: "English (US)", short: "US" },
];

const LANG_STORAGE_KEY = "medicore.voice.lang";

/** Maps the hospital's UI language setting to a speech-recognition locale. */
const UI_TO_SPEECH: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export function useHospitalSpeechLang() {
  const { data } = useQuery({
    queryKey: ["hospital-settings", "default-language"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hospital_settings").select("default_language")
        .eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle();
      return (data?.default_language as string) ?? "en";
    },
  });
  return UI_TO_SPEECH[data ?? "en"] ?? "en-IN";
}

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/* ---------------- voice commands ---------------- */

const COMMANDS: { re: RegExp; out: string }[] = [
  { re: /^(new line|newline|nayi line|नई लाइन|नवीन ओळ)$/i, out: "\n" },
  { re: /^(next paragraph|new paragraph|नया पैराग्राफ|नवीन परिच्छेद)$/i, out: "\n\n" },
  { re: /^(comma|कॉमा|स्वल्पविराम)$/i, out: ", " },
  { re: /^(full stop|period|फुल स्टॉप|पूर्णविराम)$/i, out: ". " },
  { re: /^(colon|कोलन)$/i, out: ": " },
  { re: /^(semicolon)$/i, out: "; " },
  { re: /^(question mark)$/i, out: "? " },
  { re: /^(bullet|bullet point|बुलेट)$/i, out: "\n• " },
  { re: /^(number|numbered|नंबर)$/i, out: "\n1. " },
];

/** Applies inline voice-format commands to a finalized speech segment. */
export function applyVoiceCommands(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  let out = "";
  for (const tok of tokens) {
    const bare = tok.replace(/[.,]$/, "");
    const cmd = COMMANDS.find((c) => c.re.test(bare));
    if (cmd) { out = out.replace(/\s+$/, "") + cmd.out; continue; }
    out += (out && !/[\n•\s]$/.test(out) ? " " : "") + tok;
  }
  return out;
}

/* ---------------- mic button ---------------- */

export function MicButton({
  onAppend, langOverride, size = "sm",
}: { onAppend: (chunk: string) => void; langOverride?: string; size?: "sm" | "icon" }) {
  const hospitalLang = useHospitalSpeechLang();
  const [lang, setLang] = useState<string>(() => {
    if (typeof window === "undefined") return "auto";
    return localStorage.getItem(LANG_STORAGE_KEY) || "auto";
  });
  const [recording, setRecording] = useState(false);
  const recRef = useRef<any>(null);
  const supported = !!getSR();
  const effective = langOverride || (lang === "auto" ? hospitalLang : lang);

  useEffect(() => { try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ } }, [lang]);
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  const start = () => {
    const SR = getSR();
    if (!SR) { toast.error("Voice input not supported. Use Chrome for best results."); return; }
    try {
      const rec = new SR();
      rec.lang = effective;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let delta = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const t = (e.results[i][0].transcript || "").trim();
            if (t) delta += (delta ? " " : "") + t;
          }
        }
        if (delta) onAppend(applyVoiceCommands(delta));
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") toast.error("Microphone permission denied.");
        else if (e.error !== "aborted" && e.error !== "no-speech") toast.error(`Voice error: ${e.error}`);
        setRecording(false);
      };
      rec.onend = () => setRecording(false);
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start voice input.");
    }
  };
  const stop = () => { try { recRef.current?.stop(); } catch { /* ignore */ } setRecording(false); };

  if (!supported) return null;
  const shortLabel = SPEECH_LANGS.find((l) => l.code === effective)?.short ?? "EN";

  return (
    <div className="inline-flex items-center gap-1">
      {recording ? (
        <Button type="button" size={size} variant="destructive" onClick={stop} title="Stop dictation">
          <Square className="size-3.5" />{size !== "icon" && <span className="ml-1.5 text-xs">Stop</span>}
        </Button>
      ) : (
        <Button type="button" size={size} variant="outline" onClick={start} title="Dictate">
          <Mic className="size-3.5" />{size !== "icon" && <span className="ml-1.5 text-xs">Dictate</span>}
        </Button>
      )}
      {!langOverride && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {lang === "auto" ? `Auto·${shortLabel}` : shortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-auto text-xs">
            <DropdownMenuLabel className="text-[10px] uppercase">Dictation language</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setLang("auto")}>Follow hospital setting</DropdownMenuItem>
            <DropdownMenuSeparator />
            {SPEECH_LANGS.map((l) => (
              <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)}>{l.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/* ---------------- labelled textarea with dictation ---------------- */

export function DictateTextarea({
  label, value, onChange, rows = 3, placeholder, hint, className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const append = (chunk: string) => {
    onChange(
      value
        ? value.replace(/\s+$/, "") + (chunk.startsWith("\n") || /^[,.:;?]/.test(chunk) ? "" : " ") + chunk
        : chunk,
    );
  };
  const id = useMemo(() => `dict-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <div className={"space-y-1 " + (className ?? "")}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label htmlFor={id}>{label}</Label>
        <MicButton onAppend={append} />
      </div>
      <Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
