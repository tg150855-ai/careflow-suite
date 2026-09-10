import { useCallback, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsSuperAdmin } from "@/lib/use-super-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Paperclip, Upload, Download, Trash2, MessageCircle, FileText, FileImage, FileType2,
  Video, Camera, Play, Loader2, Eye, ExternalLink,
} from "lucide-react";
import { shareOnWhatsApp } from "@/lib/share";
import { MediaCaptureModal } from "@/components/opd/media-capture-modal";

const BUCKET = "patient-documents";
const MAX_MB = 50; // Increased to 50MB to support short OPD videos
const DEPARTMENTS = ["OPD", "IPD", "Emergency", "Lab", "Radiology", "Pharmacy", "OT", "General", "Other"];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.doc,.docx,application/pdf,image/*,video/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type PatientDoc = {
  id: string;
  patient_id: string;
  department: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

function isImageType(type?: string | null, name?: string) {
  const t = (type ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  return t.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n);
}

function isVideoType(type?: string | null, name?: string) {
  const t = (type ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  return t.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv)$/i.test(n);
}

function fileIcon(type?: string | null, name?: string) {
  if (isImageType(type, name)) return FileImage;
  if (isVideoType(type, name)) return Video;
  const t = (type ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (t === "application/pdf" || n.endsWith(".pdf")) return FileType2;
  return FileText;
}

function humanSize(n?: number | null) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Inline media thumbnail / preview renderer with signed URL caching
function MediaThumbnail({ doc }: { doc: PatientDoc }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = isImageType(doc.file_type, doc.file_name);
  const isVid = isVideoType(doc.file_type, doc.file_name);

  useEffect(() => {
    let active = true;
    if (isImg || isVid) {
      supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600).then(({ data }) => {
        if (active && data?.signedUrl) {
          setUrl(data.signedUrl);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [doc.storage_path, isImg, isVid]);

  if (isImg && url) {
    return (
      <div className="size-12 rounded-lg overflow-hidden border bg-muted shrink-0 relative group">
        <img src={url} alt={doc.file_name} className="size-full object-cover" />
      </div>
    );
  }

  if (isVid && url) {
    return (
      <div className="size-12 rounded-lg overflow-hidden border bg-black text-white shrink-0 relative flex items-center justify-center">
        <video src={url} className="size-full object-cover" preload="metadata" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <Play className="size-4 text-white fill-white" />
        </div>
      </div>
    );
  }

  const Icon = fileIcon(doc.file_type, doc.file_name);
  return (
    <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <Icon className="size-5" />
    </div>
  );
}

export function PatientAttachments({
  patientId,
  patient,
  defaultDepartment = "OPD",
  compact = false,
}: {
  patientId: string;
  patient?: { full_name?: string | null; uhid?: string | null; mobile?: string | null } | null;
  defaultDepartment?: string;
  compact?: boolean;
}) {
  const { user, profile } = useAuth();
  const canDelete = useIsSuperAdmin();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [department, setDepartment] = useState(defaultDepartment);
  const [description, setDescription] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PatientDoc | null>(null);

  // Capture modal states
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [captureDefaultMode, setCaptureDefaultMode] = useState<"photo" | "video">("photo");

  // Media preview modal (for viewing photo or playing video)
  const [viewingDoc, setViewingDoc] = useState<PatientDoc | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["patient-documents", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PatientDoc[];
    },
  });

  const uploadFiles = useCallback(
    async (files: File[] | FileList | null) => {
      if (!files) return;
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setUploading(true);
      try {
        for (const file of fileList) {
          if (file.size > MAX_MB * 1024 * 1024) {
            toast.error(`${file.name} exceeds ${MAX_MB}MB limit`);
            continue;
          }
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${patientId}/${Date.now()}_${safe}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
          if (upErr) throw upErr;

          const { error: insErr } = await (supabase as any).from("patient_documents").insert({
            patient_id: patientId,
            department,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            storage_path: path,
            description: description || null,
            uploaded_by: user?.id ?? null,
            uploaded_by_name: profile?.full_name ?? user?.email ?? null,
          });
          if (insErr) throw insErr;
        }

        toast.success(fileList.length === 1 ? "Uploaded successfully" : `${fileList.length} files uploaded`);
        setDescription("");
        qc.invalidateQueries({ queryKey: ["patient-documents"] });
        qc.invalidateQueries({ queryKey: ["patient-documents-index"] });
        qc.invalidateQueries({ queryKey: ["patient-documents-stats"] });
      } catch (err: any) {
        console.error("[PatientAttachments upload]", err);
        toast.error(err.message ?? "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
      }
    },
    [patientId, department, description, user, profile, qc]
  );

  const openPreview = async (doc: PatientDoc) => {
    setViewingDoc(doc);
    setLoadingPreview(true);
    setViewingUrl(null);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600);
      if (error || !data) throw error || new Error("Failed to get preview URL");
      setViewingUrl(data.signedUrl);
    } catch (err: any) {
      toast.error("Could not load preview");
      setViewingDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  async function download(doc: PatientDoc) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function share(doc: PatientDoc) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60 * 60 * 24);
    const text = `Document/Media from hospital: ${doc.file_name}`;
    shareOnWhatsApp(text, data?.signedUrl ?? undefined, patient?.mobile ?? undefined);
  }

  async function confirmDelete() {
    const doc = pendingDelete;
    if (!doc) return;
    try {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await (supabase as any).from("patient_documents").delete().eq("id", doc.id);
      if (error) throw error;
      toast.success("Attachment deleted");
      qc.invalidateQueries({ queryKey: ["patient-documents"] });
      qc.invalidateQueries({ queryKey: ["patient-documents-index"] });
      qc.invalidateQueries({ queryKey: ["patient-documents-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">OPD Photos, Videos & Documents</h3>
            <Badge variant="secondary" className="rounded-full">{docs.length}</Badge>
          </div>
        </div>
      )}

      {/* Upload & Camera Action Box */}
      <div className="rounded-xl border border-dashed p-3.5 space-y-3 bg-muted/20">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Clinical note / Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs"
              placeholder="e.g. Skin lesion photo, swelling video, endoscopy clip, blood report"
            />
          </div>
        </div>

        {/* Action buttons: Camera, Video & File upload */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Hidden standard file picker */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />

          {/* Hidden mobile camera capture fallback */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />

          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setCaptureDefaultMode("photo");
              setCaptureModalOpen(true);
            }}
            disabled={uploading}
            className="h-8 text-xs"
          >
            <Camera className="size-3.5 mr-1.5" />
            Take Photo
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCaptureDefaultMode("video");
              setCaptureModalOpen(true);
            }}
            disabled={uploading}
            className="h-8 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Video className="size-3.5 mr-1.5" />
            Record Video
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs"
          >
            {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
            Upload Media / File
          </Button>

          <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
            Images (JPG/PNG), Videos (MP4/WebM), Docs · max {MAX_MB}MB
          </span>
        </div>
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading media…</div>
      ) : docs.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-lg">
          No photos, videos, or documents uploaded yet for this patient.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {docs.map((d) => {
            const isImg = isImageType(d.file_type, d.file_name);
            const isVid = isVideoType(d.file_type, d.file_name);

            return (
              <div
                key={d.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border bg-card hover:bg-muted/30 transition shadow-sm"
              >
                {/* Thumbnail / Clickable preview */}
                <button
                  type="button"
                  onClick={() => openPreview(d)}
                  className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  title="Click to preview"
                >
                  <MediaThumbnail doc={d} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPreview(d)}
                      className="text-sm font-medium truncate text-left hover:underline focus:outline-none"
                    >
                      {d.file_name || "—"}
                    </button>
                    {isImg && <Badge variant="outline" className="text-[9px] px-1 py-0 text-blue-600">PHOTO</Badge>}
                    {isVid && <Badge variant="outline" className="text-[9px] px-1 py-0 text-rose-600">VIDEO</Badge>}
                  </div>

                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    <Badge variant="outline" className="mr-1.5 text-[10px] py-0 px-1">{d.department || "OPD"}</Badge>
                    {humanSize(d.file_size)} · {format(new Date(d.created_at), "dd MMM yyyy HH:mm")}
                  </div>

                  {d.description ? (
                    <div className="text-[11px] text-foreground/80 truncate mt-0.5 font-sans">
                      {d.description}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => openPreview(d)}
                    title="View preview"
                  >
                    <Eye className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => download(d)}
                    title="Download"
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-emerald-600"
                    onClick={() => share(d)}
                    title="Share on WhatsApp"
                  >
                    <MessageCircle className="size-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() => setPendingDelete(d)}
                      title="Delete (Admin)"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Camera & Video Capture Modal */}
      <MediaCaptureModal
        open={captureModalOpen}
        onOpenChange={setCaptureModalOpen}
        defaultMode={captureDefaultMode}
        onMediaCaptured={(file) => {
          uploadFiles([file]);
        }}
      />

      {/* Media Viewer / Player Modal */}
      <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
        <DialogContent className="max-w-3xl p-4 sm:p-6 bg-card">
          <DialogHeader className="pb-2 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-semibold truncate pr-4">
              {viewingDoc?.file_name}
            </DialogTitle>
            {viewingUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => window.open(viewingUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-3.5 mr-1.5" /> Full Screen
              </Button>
            )}
          </DialogHeader>

          <div className="py-2 flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden rounded-xl bg-black/90">
            {loadingPreview ? (
              <div className="text-white text-xs flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading preview…
              </div>
            ) : isImageType(viewingDoc?.file_type, viewingDoc?.file_name) && viewingUrl ? (
              <img
                src={viewingUrl}
                alt={viewingDoc?.file_name}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
            ) : isVideoType(viewingDoc?.file_type, viewingDoc?.file_name) && viewingUrl ? (
              <video
                src={viewingUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[65vh] w-full object-contain rounded-lg"
              />
            ) : viewingUrl ? (
              <div className="text-center p-8 text-white space-y-3">
                <FileText className="size-12 mx-auto text-primary" />
                <p className="text-sm">Document preview</p>
                <Button size="sm" onClick={() => window.open(viewingUrl, "_blank")}>
                  Open Document
                </Button>
              </div>
            ) : null}
          </div>

          {viewingDoc?.description && (
            <div className="text-xs text-muted-foreground p-2 rounded-lg bg-muted">
              <b>Clinical Note:</b> {viewingDoc.description}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document or media?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <b>{pendingDelete?.file_name}</b> from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
