import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Props = { onTranscript: (text: string) => void; disabled?: boolean; label?: string };

type LangKey = "auto" | "en-IN" | "hi-IN";
const LANG_STORAGE_KEY = "medicore.voice.lang";

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function resolveLang(pref: LangKey): string {
  if (pref !== "auto") return pref;
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (/^hi/i.test(nav)) return "hi-IN";
  if (/^en/i.test(nav)) return nav || "en-IN";
  return "en-IN";
}

export function VoiceDictate({ onTranscript, disabled, label = "Dictate" }: Props) {
  const [recording, setRecording] = useState(false);
  const [lang, setLang] = useState<LangKey>(() => {
    if (typeof window === "undefined") return "auto";
    return (localStorage.getItem(LANG_STORAGE_KEY) as LangKey) || "auto";
  });
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const supported = !!getSR();

  useEffect(() => {
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
  }, [lang]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  const start = () => {
    const SR = getSR();
    if (!SR) { toast.error("Voice input not supported. Use Chrome for best results."); return; }
    try {
      const rec = new SR();
      rec.lang = resolveLang(lang);
      rec.continuous = true;
      rec.interimResults = true;
      finalRef.current = "";
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current += (finalRef.current ? " " : "") + t.trim();
          else interim += t;
        }
        const text = (finalRef.current + " " + interim).trim();
        if (text) onTranscript(text);
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
  const stop = () => { try { recRef.current?.stop(); } catch {} setRecording(false); };

  if (!supported) return null;

  return (
    <div className="inline-flex items-center gap-1">
      {recording ? (
        <Button type="button" size="sm" variant="destructive" onClick={stop}>
          <Square className="size-3.5 mr-1.5" />Stop
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={start}>
          <Mic className="size-3.5 mr-1.5" />{label}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {lang === "auto" ? "Auto" : lang === "hi-IN" ? "हिं" : "EN"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuLabel className="text-[10px] uppercase">Language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLang("auto")}>Auto-detect</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLang("en-IN")}>English (en-IN)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLang("hi-IN")}>Hindi (हिंदी)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
