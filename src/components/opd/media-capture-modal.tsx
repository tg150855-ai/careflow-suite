import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Video, Square, RotateCcw, Check, FlipHorizontal, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MediaCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "photo" | "video";
  onMediaCaptured: (file: File) => void;
}

export function MediaCaptureModal({
  open,
  onOpenChange,
  defaultMode = "photo",
  onMediaCaptured,
}: MediaCaptureModalProps) {
  const [mode, setMode] = useState<"photo" | "video">(defaultMode);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Photo state
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Video state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Reset states on open/mode switch
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      clearCaptured();
      initCamera();
    } else {
      stopCamera();
      clearCaptured();
    }
    return () => {
      stopCamera();
    };
  }, [open, defaultMode]);

  // List cameras
  const initCamera = async (deviceId?: string) => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        audio: mode === "video",
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }

      // Enumerate devices if not done
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevs);
      if (videoDevs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (err: any) {
      console.error("[MediaCapture] Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera and microphone access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(err.message || "Failed to initialize camera.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const switchCamera = async () => {
    if (devices.length < 2) {
      toast.info("Only one camera detected on this device.");
      return;
    }
    const currIdx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIdx = (currIdx + 1) % devices.length;
    const nextDev = devices[nextIdx];
    setSelectedDeviceId(nextDev.deviceId);
    await initCamera(nextDev.deviceId);
  };

  const clearCaptured = () => {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setRecordedVideoUrl(null);
    recordedChunksRef.current = [];
    setRecordingSeconds(0);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to capture image");
          return;
        }
        setCapturedBlob(blob);
        setCapturedPhotoUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92
    );
  };

  const startRecording = () => {
    if (!stream) {
      toast.error("Camera stream unavailable");
      return;
    }
    clearCaptured();
    recordedChunksRef.current = [];

    // Choose supported MIME type
    const mimeTypes = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
    let selectedMime = "";
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    try {
      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = selectedMime || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: finalType });
        setCapturedBlob(blob);
        setRecordedVideoUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 180) { // Limit to 3 minutes for medical safety & file size
            stopRecording();
            toast.info("Maximum clinical video duration reached (3 min).");
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("[MediaCapture] Record error:", err);
      toast.error("Failed to start recording: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleRetake = () => {
    clearCaptured();
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleConfirm = () => {
    if (!capturedBlob) return;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");

    if (mode === "photo") {
      const file = new File([capturedBlob], `OPD_Photo_${timestamp}.jpg`, { type: "image/jpeg" });
      onMediaCaptured(file);
    } else {
      const ext = capturedBlob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([capturedBlob], `OPD_Video_${timestamp}.${ext}`, { type: capturedBlob.type });
      onMediaCaptured(file);
    }

    onOpenChange(false);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 sm:p-6 bg-card">
        <DialogHeader className="pb-2 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {mode === "photo" ? <Camera className="size-4 text-primary" /> : <Video className="size-4 text-primary" />}
            {mode === "photo" ? "Take OPD Photo" : "Record OPD Video"}
          </DialogTitle>
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                if (isRecording) return;
                setMode("photo");
                clearCaptured();
                initCamera(selectedDeviceId);
              }}
              disabled={isRecording}
              className={`px-3 py-1 rounded-md transition font-medium ${
                mode === "photo" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Photo
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRecording) return;
                setMode("video");
                clearCaptured();
                initCamera(selectedDeviceId);
              }}
              disabled={isRecording}
              className={`px-3 py-1 rounded-md transition font-medium ${
                mode === "video" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Video
            </button>
          </div>
        </DialogHeader>

        {/* Viewfinder / Preview Area */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border">
          {cameraError ? (
            <div className="text-center p-6 space-y-3">
              <AlertCircle className="size-8 text-destructive mx-auto" />
              <p className="text-xs text-muted-foreground max-w-sm">{cameraError}</p>
              <Button size="sm" variant="outline" onClick={() => initCamera()}>
                Retry Camera
              </Button>
            </div>
          ) : capturedPhotoUrl ? (
            <img src={capturedPhotoUrl} alt="Captured preview" className="w-full h-full object-contain" />
          ) : recordedVideoUrl ? (
            <video src={recordedVideoUrl} controls autoPlay className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlays */}
              {isRecording && (
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs font-mono px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                  <span className="size-2 rounded-full bg-white animate-ping" />
                  REC {formatTimer(recordingSeconds)}
                </div>
              )}
              {devices.length > 1 && !isRecording && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-3 right-3 size-8 rounded-full bg-black/50 hover:bg-black/75 text-white border-0"
                  onClick={switchCamera}
                  title="Switch Camera"
                >
                  <FlipHorizontal className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Controls footer */}
        <div className="flex items-center justify-between pt-2">
          {capturedPhotoUrl || recordedVideoUrl ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRetake}>
                <RotateCcw className="size-3.5 mr-1.5" /> Retake
              </Button>
              <Button size="sm" onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Check className="size-3.5 mr-1.5" /> Use & Upload
              </Button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center gap-3">
              {mode === "photo" ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={takePhoto}
                  disabled={!stream}
                  className="rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2"
                >
                  <Camera className="size-5" /> Snap Photo
                </Button>
              ) : isRecording ? (
                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  onClick={stopRecording}
                  className="rounded-full px-6 font-semibold flex items-center gap-2 animate-pulse"
                >
                  <Square className="size-5 fill-current" /> Stop Recording ({formatTimer(recordingSeconds)})
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={startRecording}
                  disabled={!stream}
                  className="rounded-full px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2"
                >
                  <Video className="size-5" /> Start Recording
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
