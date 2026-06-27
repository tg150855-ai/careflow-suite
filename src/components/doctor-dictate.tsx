import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Pause, Play, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "append" | "replace";
type State = "idle" | "recording" | "paused" | "uploading" | "error";

type Props = {
  /** Called with the final transcript. The component itself does NOT mutate state — the parent decides append/replace based on `mode`. */
  onTranscript: (text: string, mode: Mode) => void;
  /** Optional language hint forwarded to the transcription model. */
  language?: "auto" | "en" | "hi";
  /** Optional contextual prompt (medical vocabulary boost). */
  contextPrompt?: string;
  /** Default insertion mode. */
  defaultMode?: Mode;
  /** Hide the mode selector and force a single mode. */
  lockMode?: Mode;
  disabled?: boolean;
  size?: "sm" | "icon";
  title?: string;
};

const MEDICAL_PROMPT =
  "Indian clinical consultation. Common medicines: paracetamol, azithromycin, amoxicillin, pantoprazole, metformin, amlodipine, atorvastatin. Tests: CBC, LFT, KFT, RFT, ECG, USG, MRI, chest X-ray. Frequencies: OD, BD, TDS, QID, HS, SOS. Hindi/English code-switching is expected.";

export function DoctorDictate({
  onTranscript,
  language = "auto",
  contextPrompt,
  defaultMode = "append",
  lockMode,
  disabled,
  size = "sm",
  title = "Dictate",
}: Props) {
  const [state, setState] = useState<State>("idle");
  const [mode, setMode] = useState<Mode>(lockMode ?? defaultMode);
  const [lang, setLang] = useState<"auto" | "en" | "hi">(language);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const lastBlob = useRef<Blob | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
    streamRef.current = null;
    recRef.current = null;
    tickRef.current = null;
  }

  function startTimer() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  }
  function stopTimer() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) {
        stream.getTracks().forEach((t) => t.stop());
        setState("error");
        return toast.error("Browser cannot record a supported audio format.");
      }
      chunks.current = [];
      lastBlob.current = null;
      setElapsed(0);
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        stopTimer();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        if (blob.size < 1024) {
          setState("idle");
          return toast.error("No speech detected — please try again.");
        }
        lastBlob.current = blob;
        await transcribe(blob);
      };
      recRef.current = rec;
      rec.start();
      setState("recording");
      startTimer();
    } catch (err: any) {
      setState("error");
      const msg = String(err?.name ?? "");
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        toast.error("Microphone permission denied. Allow mic access in your browser.");
      } else if (msg.includes("NotFound")) {
        toast.error("No microphone detected on this device.");
      } else {
        toast.error("Could not start recording.");
      }
    }
  }

  function pause() {
    try {
      if (recRef.current?.state === "recording") {
        recRef.current.pause();
        stopTimer();
        setState("paused");
      }
    } catch {}
  }
  function resume() {
    try {
      if (recRef.current?.state === "paused") {
        recRef.current.resume();
        startTimer();
        setState("recording");
      }
    } catch {}
  }
  function stop() {
    try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch {}
  }
  async function retry() {
    if (!lastBlob.current) return start();
    await transcribe(lastBlob.current);
  }

  async function transcribe(blob: Blob) {
    setState("uploading");
    try {
      const fd = new FormData();
      const ext = blob.type.startsWith("audio/mp4") ? "mp4" : "webm";
      fd.append("file", blob, `recording.${ext}`);
      if (lang !== "auto") fd.append("language", lang);
      const promptText = [contextPrompt, MEDICAL_PROMPT].filter(Boolean).join(" ");
      if (promptText) fd.append("prompt", promptText);

      const { data, error } = await supabase.functions.invoke("transcribe-audio", { body: fd });
      if (error) throw error;
      if (data?.error) {
        setState("error");
        return toast.error(String(data.error));
      }
      const text = String(data?.text ?? "").trim();
      if (!text) {
        setState("idle");
        return toast.error("No speech detected in the recording.");
      }
      onTranscript(text, mode);
      toast.success("Transcribed");
      setState("idle");
    } catch (e: any) {
      setState("error");
      const msg = e?.message ?? "Transcription failed";
      if (/network|fetch/i.test(msg)) toast.error("Network error — check connection and retry.");
      else toast.error(msg);
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const btnSize = size === "icon" ? "icon" : "sm";

  if (state === "uploading") {
    return (
      <Button type="button" size={btnSize} variant="outline" disabled className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        {size !== "icon" && <span className="text-xs">Processing…</span>}
      </Button>
    );
  }

  if (state === "recording" || state === "paused") {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive">
          <span className={`size-1.5 rounded-full bg-destructive ${state === "recording" ? "animate-pulse" : "opacity-50"}`} />
          {state === "recording" ? "Listening" : "Paused"} · {fmt(elapsed)}
        </span>
        {state === "recording" ? (
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={pause} title="Pause">
            <Pause className="size-3.5" />
          </Button>
        ) : (
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={resume} title="Resume">
            <Play className="size-3.5" />
          </Button>
        )}
        <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={stop} title="Stop & transcribe">
          <Square className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        size={btnSize}
        variant="outline"
        disabled={disabled}
        onClick={start}
        title={title}
        className="gap-1.5"
      >
        <Mic className="size-3.5" />
        {size !== "icon" && <span className="text-xs">{title}</span>}
      </Button>
      {state === "error" && lastBlob.current && (
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={retry} title="Retry transcription">
          <RotateCcw className="size-3.5" />
        </Button>
      )}
      {!lockMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {mode}·{lang}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => setMode("append")}>Append (default)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode("replace")}>Replace field</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("auto")}>Language: Auto</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("en")}>Language: English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("hi")}>Language: Hindi / Hinglish</DropdownMenuItem>
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

  // medicine name = first 1-3 words before strength/digit, fallback first 4 words
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
