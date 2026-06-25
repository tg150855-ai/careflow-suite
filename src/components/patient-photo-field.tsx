import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Upload, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "patient-photos";

export function patientPhotoPublicUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadBlob(blob: Blob, ext: string): Promise<string> {
  const filename = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filename, blob, {
    contentType: blob.type || `image/${ext}`,
    upsert: false,
  });
  if (error) throw error;
  return filename;
}

export function PatientPhotoField({
  value,
  onChange,
  initials = "PT",
}: {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  initials?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const url = patientPhotoPublicUrl(value);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = await uploadBlob(file, ext);
      onChange(path);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    // best-effort cleanup; ignore errors (file might already be gone or shared)
    if (!/^https?:\/\//i.test(value)) {
      await supabase.storage.from(BUCKET).remove([value]).catch(() => {});
    }
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Patient photo
      </Label>
      <div className="flex items-center gap-4">
        <Avatar className="size-20 border">
          {url ? <AvatarImage src={url} alt="patient" /> : null}
          <AvatarFallback className="text-base">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="size-4 mr-2" /> Camera
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={handleRemove}
            >
              <X className="size-4 mr-2" /> Remove
            </Button>
          )}
        </div>
      </div>
      {cameraOpen && (
        <CameraDialog
          onClose={() => setCameraOpen(false)}
          onCapture={async (blob) => {
            setCameraOpen(false);
            setUploading(true);
            try {
              const path = await uploadBlob(blob, "jpg");
              onChange(path);
              toast.success("Photo captured");
            } catch (e: any) {
              toast.error(e.message || "Upload failed");
            } finally {
              setUploading(false);
            }
          }}
        />
      )}
    </div>
  );
}

function CameraDialog({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message || "Unable to access camera");
      }
    }
    start();
    return () => {
      active = false;
      setStream((curr) => {
        curr?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capture patient photo</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="space-y-3">
            <div className="bg-black rounded-lg overflow-hidden aspect-square flex items-center justify-center">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              >
                <RotateCcw className="size-4 mr-2" /> Flip
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={capture} disabled={!stream}>
                  <Camera className="size-4 mr-2" /> Capture
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
