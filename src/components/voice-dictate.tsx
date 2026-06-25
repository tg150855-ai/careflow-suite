import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = { onTranscript: (text: string) => void; disabled?: boolean; label?: string };

export function VoiceDictate({ onTranscript, disabled, label = "Dictate" }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) { stream.getTracks().forEach((t) => t.stop()); return toast.error("Browser cannot record a supported audio format."); }
      chunks.current = [];
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        if (blob.size < 1024) { setState("idle"); return toast.error("Recording too short, please try again."); }
        setState("uploading");
        try {
          const fd = new FormData();
          fd.append("file", blob, `recording.${mimeType === "audio/mp4" ? "mp4" : "webm"}`);
          const { data, error } = await supabase.functions.invoke("transcribe-audio", { body: fd });
          if (error) throw error;
          if (data?.text) onTranscript(String(data.text));
          else toast.error("No transcript returned.");
        } catch (e: any) {
          toast.error(e.message ?? "Transcription failed");
        } finally { setState("idle"); }
      };
      recRef.current = rec;
      rec.start();
      setState("recording");
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stop = () => recRef.current?.state === "recording" && recRef.current.stop();

  if (state === "uploading") {
    return <Button type="button" size="sm" variant="outline" disabled><Loader2 className="size-3.5 mr-1.5 animate-spin" />Transcribing…</Button>;
  }
  if (state === "recording") {
    return <Button type="button" size="sm" variant="destructive" onClick={stop}><Square className="size-3.5 mr-1.5" />Stop</Button>;
  }
  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={start}>
      <Mic className="size-3.5 mr-1.5" />{label}
    </Button>
  );
}
