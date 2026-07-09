import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsSuperAdmin } from "@/lib/use-super-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Paperclip, Upload, Download, Trash2, MessageCircle, FileText, FileImage, FileType2, Loader2,
} from "lucide-react";
import { shareOnWhatsApp } from "@/lib/share";

const BUCKET = "patient-documents";
const MAX_MB = 10;
const DEPARTMENTS = ["OPD", "IPD", "Emergency", "Lab", "Radiology", "Pharmacy", "OT", "General", "Other"];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

function fileIcon(type?: string | null, name?: string) {
  const t = (type ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(n)) return FileImage;
  if (t === "application/pdf" || n.endsWith(".pdf")) return FileType2;
  return FileText;
}

function humanSize(n?: number | null) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
  const [uploading, setUploading] = useState(false);
  const [department, setDepartment] = useState(defaultDepartment);
  const [description, setDescription] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PatientDoc | null>(null);

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

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (file.size > MAX_MB * 1024 * 1024) {
            toast.error(`${file.name} exceeds ${MAX_MB}MB`);
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
        toast.success("Attachment uploaded");
        setDescription("");
        qc.invalidateQueries({ queryKey: ["patient-documents"] });
        qc.invalidateQueries({ queryKey: ["patient-documents-index"] });
        qc.invalidateQueries({ queryKey: ["patient-documents-stats"] });
      } catch (err: any) {
        toast.error(err.message ?? "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [patientId, department, description, user, profile, qc],
  );

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
    const text = `Document from hospital: ${doc.file_name}`;
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
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Attachments</h3>
          <Badge variant="secondary" className="ml-auto rounded-full">{docs.length}</Badge>
        </div>
      )}

      <div className="rounded-lg border border-dashed p-3 space-y-2 bg-surface-muted/30">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" placeholder="e.g. Blood test report" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
            Upload files
          </Button>
          <span className="text-[11px] text-muted-foreground">PDF, JPG, PNG, DOCX · max {MAX_MB}MB each</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-lg">No attachments yet.</div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {docs.map((d) => {
            const Icon = fileIcon(d.file_type, d.file_name);
            return (
              <div key={d.id} className="flex items-center gap-3 p-2.5">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{d.file_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    <Badge variant="outline" className="mr-1.5 text-[10px] py-0 px-1.5">{d.department || "—"}</Badge>
                    {humanSize(d.file_size)} · {format(new Date(d.created_at), "dd MMM yyyy HH:mm")} · {d.uploaded_by_name ?? "—"}
                  </div>
                  {d.description ? <div className="text-[11px] text-muted-foreground truncate">{d.description}</div> : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => download(d)} title="Download">
                    <Download className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8 text-emerald-600" onClick={() => share(d)} title="Share on WhatsApp">
                    <MessageCircle className="size-3.5" />
                  </Button>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setPendingDelete(d)} title="Delete (Admin)">
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <b>{pendingDelete?.file_name}</b>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
