import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "append" | "replace";
type LangKey = "auto" | "en-IN" | "hi-IN" | "mr-IN";

type Props = {
  onTranscript: (text: string, mode: Mode) => void;
  language?: "auto" | "en" | "hi";
  contextPrompt?: string;
  defaultMode?: Mode;
  lockMode?: Mode;
  disabled?: boolean;
  size?: "sm" | "icon";
  title?: string;
};

const LANG_STORAGE_KEY = "medicore.voice.lang";

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function resolveLang(pref: LangKey): string {
  if (pref !== "auto") return pref;
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (/^mr/i.test(nav)) return "mr-IN";
  if (/^hi/i.test(nav)) return "hi-IN";
  if (/^en/i.test(nav)) return nav || "en-IN";
  return "en-IN";
}

export function cleanConsecutiveDuplicates(text: string): string {
  if (!text) return "";
  const tokens = text.split(/(\s+)/);
  const words: string[] = [];
  const resultTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^\s+$/.test(tok)) {
      resultTokens.push(tok);
      continue;
    }
    const cleanTok = tok.toLowerCase().replace(/[.,!?;:]/g, "").trim();
    const prevCleanTok = words.length > 0 ? words[words.length - 1] : "";

    if (cleanTok && cleanTok === prevCleanTok) {
      if (resultTokens.length > 0 && /^\s+$/.test(resultTokens[resultTokens.length - 1])) {
        resultTokens.pop();
      }
      continue;
    }
    words.push(cleanTok);
    resultTokens.push(tok);
  }
  return resultTokens.join("").trim();
}

export function mergeSpeechTranscript(existing: string, incoming: string): string {
  const cleanIncoming = cleanConsecutiveDuplicates(incoming.trim());
  if (!existing || !existing.trim()) return cleanIncoming;
  if (!cleanIncoming) return existing;

  const existingTrimmed = existing.trim();
  const existingWords = existingTrimmed.split(/\s+/);
  const incomingWords = cleanIncoming.split(/\s+/);

  const normalize = (w: string) => w.toLowerCase().replace(/[.,!?;:]/g, "").trim();
  const normExisting = existingWords.map(normalize);
  const normIncoming = incomingWords.map(normalize);

  const maxOverlap = Math.min(existingWords.length, incomingWords.length, 12);
  let overlapLen = 0;

  for (let len = maxOverlap; len >= 1; len--) {
    let match = true;
    for (let i = 0; i < len; i++) {
      const eWord = normExisting[normExisting.length - len + i];
      const iWord = normIncoming[i];
      if (eWord !== iWord || !eWord) {
        match = false;
        break;
      }
    }
    if (match) {
      overlapLen = len;
      break;
    }
  }

  if (overlapLen > 0) {
    const remainingIncoming = incomingWords.slice(overlapLen).join(" ");
    if (!remainingIncoming) return existingTrimmed;
    return `${existingTrimmed} ${remainingIncoming}`;
  }

  // Check if incoming text is already fully contained in the recent words of existing text
  const tailSlice = normExisting.slice(-15).join(" ");
  const incomingNorm = normIncoming.join(" ");
  if (tailSlice.includes(incomingNorm) && incomingNorm.length > 0) {
    return existingTrimmed;
  }

  return `${existingTrimmed} ${cleanIncoming}`;
}

export function DoctorDictate({
  onTranscript,
  language,
  defaultMode = "append",
  lockMode,
  disabled,
  size = "sm",
  title = "Dictate",
}: Props) {
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<Mode>(lockMode ?? defaultMode);
  const initialLang: LangKey =
    language === "en"
      ? "en-IN"
      : language === "hi"
      ? "hi-IN"
      : ((typeof window !== "undefined" && (localStorage.getItem(LANG_STORAGE_KEY) as LangKey)) || "auto");
  const [lang, setLang] = useState<LangKey>(initialLang);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const isRecordingRef = useRef(false);
  const lastFinalIndexRef = useRef<number>(-1);
  const recentEmissionsRef = useRef<{ text: string; time: number }[]>([]);
  const supported = !!getSR();

  useEffect(() => {
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
  }, [lang]);
  useEffect(() => () => { isRecordingRef.current = false; try { recRef.current?.stop(); } catch {} }, []);

  const start = () => {
    const SR = getSR();
    if (!SR) { toast.error("Voice input not supported. Use Chrome for best results."); return; }
    try {
      const rec = new SR();
      rec.lang = resolveLang(lang);
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      finalRef.current = "";
      recentEmissionsRef.current = [];
      lastFinalIndexRef.current = -1;
      isRecordingRef.current = true;

      rec.onresult = (e: any) => {
        let delta = "";
        const startIndex = e.resultIndex ?? 0;
        for (let i = startIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal && i > lastFinalIndexRef.current) {
            const t = (res[0]?.transcript || "").trim();
            if (t) {
              delta += (delta ? " " : "") + t;
              lastFinalIndexRef.current = i;
            }
          }
        }
        if (!delta) return;

        delta = cleanConsecutiveDuplicates(delta);
        if (!delta) return;

        const now = Date.now();
        recentEmissionsRef.current = recentEmissionsRef.current.filter((item) => now - item.time < 4000);
        const cleanDelta = delta.toLowerCase().replace(/[.,!?;:]/g, "").trim();
        const isDupe = recentEmissionsRef.current.some((item) => {
          const prevClean = item.text.toLowerCase().replace(/[.,!?;:]/g, "").trim();
          return prevClean === cleanDelta || prevClean.endsWith(cleanDelta);
        });

        if (isDupe) return;
        recentEmissionsRef.current.push({ text: delta, time: now });

        finalRef.current = mergeSpeechTranscript(finalRef.current, delta);
        if (mode === "replace") {
          onTranscript(finalRef.current, "replace");
        } else {
          onTranscript(delta, "append");
        }
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") toast.error("Microphone permission denied.");
        else if (e.error !== "aborted" && e.error !== "no-speech") toast.error(`Voice error: ${e.error}`);
        isRecordingRef.current = false;
        setRecording(false);
      };
      rec.onend = () => {
        if (isRecordingRef.current) {
          lastFinalIndexRef.current = -1;
          try {
            rec.start();
          } catch {
            isRecordingRef.current = false;
            setRecording(false);
          }
        } else {
          setRecording(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start voice input.");
      isRecordingRef.current = false;
      setRecording(false);
    }
  };
  const stop = () => {
    isRecordingRef.current = false;
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  };

  if (!supported) return null;

  const btnSize = size === "icon" ? "icon" : "sm";

  return (
    <div className="inline-flex items-center gap-1">
      {recording ? (
        <Button type="button" size={btnSize} variant="destructive" onClick={stop} title="Stop dictation">
          <Square className="size-3.5" />
          {size !== "icon" && <span className="text-xs ml-1.5">Stop</span>}
        </Button>
      ) : (
        <Button type="button" size={btnSize} variant="outline" disabled={disabled} onClick={start} title={title} className="gap-1.5">
          <Mic className="size-3.5" />
          {size !== "icon" && <span className="text-xs">{title}</span>}
        </Button>
      )}
      {!lockMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {mode}·{lang === "auto" ? "Auto" : lang === "hi-IN" ? "हिं" : lang === "mr-IN" ? "मरा" : "EN"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuLabel className="text-[10px] uppercase">Insertion</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setMode("append")}>Append</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode("replace")}>Replace field</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase">Language</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setLang("auto")}>Auto-detect</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("en-IN")}>English (en-IN)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("hi-IN")}>Hindi (हिंदी) — supports Hinglish</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("mr-IN")}>Marathi (मराठी)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/* ---------- parsing helpers (lightweight, best-effort) ---------- */

export type ParsedMed = {
  medicine_name: string;
  strength: string;
  frequency: string;
  food_instruction: string;
  duration_days: string;
  quantity: string;
  instructions: string;
  route: string;
};

const FREQ_MAP: Record<string, string> = {
  "once daily": "OD", "once a day": "OD", "od": "OD",
  "twice daily": "BD", "twice a day": "BD", "bd": "BD", "bid": "BD",
  "thrice daily": "TDS", "three times daily": "TDS", "three times a day": "TDS", "tds": "TDS", "tid": "TDS",
  "four times daily": "QID", "four times a day": "QID", "qid": "QID",
  "at bedtime": "HS", "bedtime": "HS", "hs": "HS",
  "as needed": "SOS", "sos": "SOS", "prn": "SOS",
};

export function parseMedicationLine(line: string): ParsedMed {
  const raw = line.trim().replace(/[.;]+$/, "");
  const lower = " " + raw.toLowerCase() + " ";

  const strengthMatch = raw.match(/\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|%))\b/i);
  const durationMatch = lower.match(/for\s+(\d+)\s*(day|days|week|weeks)/);
  let durationDays = "";
  if (durationMatch) {
    const n = parseInt(durationMatch[1], 10);
    durationDays = durationMatch[2].startsWith("week") ? String(n * 7) : String(n);
  }

  let frequency = "";
  for (const [k, v] of Object.entries(FREQ_MAP)) {
    if (lower.includes(` ${k} `)) { frequency = v; break; }
  }

  let food = "";
  if (/after\s+(food|meal)/i.test(raw)) food = "After food";
  else if (/before\s+(food|meal)/i.test(raw)) food = "Before food";
  else if (/with\s+(food|meal)/i.test(raw)) food = "With food";

  let name = raw;
  if (strengthMatch && strengthMatch.index !== undefined) {
    name = raw.slice(0, strengthMatch.index).trim();
  } else {
    name = raw.split(/\s+/).slice(0, 3).join(" ");
  }
  name = name.replace(/[,;].*$/, "").trim();

  return {
    medicine_name: name || raw,
    strength: strengthMatch?.[1] ?? "",
    frequency,
    food_instruction: food,
    duration_days: durationDays,
    quantity: "",
    instructions: "",
    route: "Oral",
  };
}

export function splitDictationToLines(text: string): string[] {
  return text
    .split(/(?:\n|\.|;|,\s*(?=[A-Z]))/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
