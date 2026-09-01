import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictate } from "@/components/voice-dictate";
import { mergeSpeechTranscript } from "@/components/doctor-dictate";

export function MicButton({
  onAppend,
  size = "sm",
  label = "Dictate",
}: {
  onAppend: (chunk: string) => void;
  size?: "sm" | "icon";
  label?: string;
  langOverride?: string;
}) {
  return <VoiceDictate onTranscript={onAppend} label={label} size={size} />;
}

export function DictateTextarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const appendChunk = (chunk: string) => {
    if (!chunk.trim()) return;
    if (chunk.startsWith("\n") || /^[,.:;?]/.test(chunk)) {
      onChange(value ? value.replace(/\s+$/, "") + chunk : chunk);
    } else {
      onChange(mergeSpeechTranscript(value, chunk));
    }
  };

  const id = useMemo(() => `dict-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <VoiceDictate onTranscript={appendChunk} label="Dictate" size="sm" />
      </div>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
