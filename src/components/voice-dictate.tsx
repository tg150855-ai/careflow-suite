import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Square,
  Volume2,
  AlertCircle,
  Play,
  RotateCcw,
  Check,
  Languages,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const SPEECH_LANGUAGES = [
  { code: "en-IN", label: "English (India)", short: "EN" },
  { code: "hi-IN", label: "हिंदी (Hindi)", short: "हिं" },
  { code: "mr-IN", label: "मराठी (Marathi)", short: "मरा" },
  { code: "gu-IN", label: "ગુજરાતી (Gujarati)", short: "ગુ" },
  { code: "ta-IN", label: "தமிழ் (Tamil)", short: "த" },
  { code: "te-IN", label: "తెలుగు (Telugu)", short: "తె" },
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)", short: "ಕ" },
  { code: "ml-IN", label: "മലയാളം (Malayalam)", short: "മ" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", short: "ਪੰ" },
  { code: "bn-IN", label: "বাংলা (Bengali)", short: "বা" },
  { code: "en-US", label: "English (US)", short: "US" },
];

const LANG_STORAGE_KEY = "medicore.voice.lang";

function getSpeechRecognitionClass(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    (window as any).mozSpeechRecognition ||
    (window as any).msSpeechRecognition ||
    null
  );
}

// Inline formatting commands
const VOICE_COMMANDS: { re: RegExp; out: string }[] = [
  { re: /^(new line|newline|nayi line|नई लाइन|नवीन ओळ)$/i, out: "\n" },
  { re: /^(next paragraph|new paragraph|नया पैराग्राफ|नवीन परिच्छेद)$/i, out: "\n\n" },
  { re: /^(comma|कॉमा|स्वल्पविराम)$/i, out: ", " },
  { re: /^(full stop|period|फुल स्टॉप|पूर्णविराम)$/i, out: ". " },
  { re: /^(colon|कोलन)$/i, out: ": " },
  { re: /^(semicolon)$/i, out: "; " },
  { re: /^(question mark|प्रश्न चिन्ह)$/i, out: "? " },
  { re: /^(bullet|bullet point|बुलेट)$/i, out: "\n• " },
  { re: /^(number one|number 1|एक नंबर)$/i, out: "\n1. " },
  { re: /^(number two|number 2|दो नंबर)$/i, out: "\n2. " },
];

export function applyVoiceFormatting(rawText: string): string {
  const tokens = rawText.split(/\s+/).filter(Boolean);
  let out = "";
  for (const tok of tokens) {
    const bare = tok.replace(/[.,]$/, "");
    const matched = VOICE_COMMANDS.find((c) => c.re.test(bare));
    if (matched) {
      out = out.replace(/\s+$/, "") + matched.out;
      continue;
    }
    out += (out && !/[\n•\s]$/.test(out) ? " " : "") + tok;
  }
  return out;
}

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "icon" | "default";
};

export function VoiceDictate({
  onTranscript,
  disabled,
  label = "Dictate",
  size = "sm",
}: Props) {
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [lang, setLang] = useState<string>(() => {
    if (typeof window === "undefined") return "en-IN";
    return localStorage.getItem(LANG_STORAGE_KEY) || "en-IN";
  });
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const lastFinalIndexRef = useRef<number>(-1);
  const recentEmissionsRef = useRef<{ text: string; time: number }[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  function cleanupAudio() {
    isRecordingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {}
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setInterimText("");
  }

  async function checkMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release tracks immediately
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow microphone access in browser address bar.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        toast.error("No microphone found. Please connect a microphone or headset.");
      } else {
        toast.error(`Microphone access error: ${err.message}`);
      }
      return false;
    }
  }

  async function startRecording() {
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) return;

    const SpeechClass = getSpeechRecognitionClass();

    if (SpeechClass && !offlineFallback) {
      try {
        const recognition = new SpeechClass();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        lastFinalIndexRef.current = -1;
        isRecordingRef.current = true;

        recognition.onresult = (e: any) => {
          let newFinalText = "";
          let currentInterim = "";

          // Process all results from resultIndex to length, but guard against already processed indices (crucial for Android tablets & iPads)
          for (let i = 0; i < e.results.length; i++) {
            const res = e.results[i];
            const transcript = (res[0]?.transcript || "").trim();
            if (!transcript) continue;

            if (res.isFinal) {
              if (i > lastFinalIndexRef.current) {
                newFinalText += (newFinalText ? " " : "") + transcript;
                lastFinalIndexRef.current = i;
              }
            } else {
              if (i > lastFinalIndexRef.current) {
                currentInterim += (currentInterim ? " " : "") + transcript;
              }
            }
          }

          if (currentInterim) {
            setInterimText(currentInterim);
          }

          if (newFinalText.trim()) {
            const formatted = applyVoiceFormatting(newFinalText.trim());
            const now = Date.now();

            // Clear emissions older than 3 seconds
            recentEmissionsRef.current = recentEmissionsRef.current.filter((item) => now - item.time < 3000);

            // Deduplicate across mobile restart events
            const cleanNew = formatted.trim().toLowerCase().replace(/[.,!?;:]/g, "");
            const isDupe = recentEmissionsRef.current.some((item) => {
              const cleanPrev = item.text.trim().toLowerCase().replace(/[.,!?;:]/g, "");
              return cleanPrev === cleanNew;
            });

            if (!isDupe && formatted.trim()) {
              recentEmissionsRef.current.push({ text: formatted.trim(), time: now });
              onTranscript(formatted);
              setInterimText("");
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("[VoiceDictate] Speech error:", e.error);
          if (e.error === "network") {
            // Web speech offline fallback
            toast.info("Offline mode: Switching to audio dictation recording.");
            setOfflineFallback(true);
            stopRecording();
            startMediaRecording();
            return;
          }
          if (e.error === "not-allowed") {
            toast.error("Microphone access blocked. Enable permissions.");
            stopRecording();
          } else if (e.error !== "no-speech" && e.error !== "aborted") {
            toast.error(`Speech recognition: ${e.error}`);
            stopRecording();
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            // On mobile / tablet, WebSpeech continuous mode stops automatically after brief pauses.
            // Reset index tracker for new instance session so upcoming words are captured without duplicating previous ones.
            lastFinalIndexRef.current = -1;
            try {
              recognition.start();
            } catch {
              isRecordingRef.current = false;
              setRecording(false);
              setInterimText("");
            }
          } else {
            setRecording(false);
            setInterimText("");
          }
        };

        recRef.current = recognition;
        recognition.start();
        setRecording(true);
        startTimer();
        toast.info("Listening... Speak into microphone.");
        return;
      } catch (err: any) {
        console.warn("[VoiceDictate] WebSpeech init error:", err);
      }
    }

    // Fallback to MediaRecorder
    startMediaRecording();
  }

  async function startMediaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        toast.success("Voice recording captured.");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      isRecordingRef.current = true;
      setRecording(true);
      startTimer();
      toast.info("Recording voice notes... Speak now.");
    } catch (err: any) {
      toast.error(`Recording failed: ${err?.message}`);
      isRecordingRef.current = false;
      setRecording(false);
    }
  }

  function startTimer() {
    setRecordingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }

  function stopRecording() {
    isRecordingRef.current = false;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      recRef.current?.stop();
    } catch {}
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    setInterimText("");
  }

  const shortLang = SPEECH_LANGUAGES.find((l) => l.code === lang)?.short ?? "EN";
  const formattedTime = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {recording ? (
        <div className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg px-2.5 py-1 text-xs animate-pulse">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          </span>
          <span className="font-mono font-semibold">{formattedTime}</span>
          {interimText && (
            <span className="text-[11px] text-muted-foreground italic truncate max-w-[120px]">
              "{interimText}"
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-xs ml-1"
            onClick={stopRecording}
          >
            <Square className="size-3 mr-1 fill-current" /> Stop
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size={size === "icon" ? "icon" : "sm"}
          variant="outline"
          disabled={disabled}
          onClick={startRecording}
          className="h-8 gap-1.5 border-primary/40 hover:bg-primary/5 hover:border-primary text-xs"
          title="Click to speak and dictate notes into field"
        >
          <Mic className="size-3.5 text-primary shrink-0" />
          {size !== "icon" && <span>{label}</span>}
        </Button>
      )}

      {/* Language selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-[11px] font-medium uppercase text-muted-foreground hover:text-foreground"
            title="Speech Recognition Language"
          >
            <Languages className="size-3 mr-1" />
            {shortLang}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto text-xs w-48">
          <DropdownMenuLabel className="text-[10px] uppercase">Speech Language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SPEECH_LANGUAGES.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => {
                setLang(l.code);
                toast.info(`Language set to ${l.label}`);
              }}
              className="flex items-center justify-between"
            >
              <span>{l.label}</span>
              {lang === l.code && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
