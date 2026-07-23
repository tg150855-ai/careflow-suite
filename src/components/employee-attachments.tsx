import { useCallback, useMemo, useRef, useState } from "react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Paperclip, Upload, Download, Trash2, MessageCircle, FileText, FileImage, FileType2,
  Loader2, Printer, Eye, Camera, Search,
} from "lucide-react";
import { shareOnWhatsApp } from "@/lib/share";

const BUCKET = "employee-documents";
const MAX_MB = 10;
export const EMP_DOC_CATEGORIES = [
  "Aadhaar", "PAN", "Resume", "Offer Letter", "Joining Letter",
  "Experience Certificate", "Educational Certificates", "Salary Documents",
  "ID Card", "Other Documents",
];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type EmployeeDoc = {
  id: string;
  employee_id: string;
  doc_type: string;
  doc_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  notes: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  created_at: string;
};

function fileIcon(type?: string | null, name?: string | null) {
  const t = (type ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(n)) return FileImage;
  if (t === "application/pdf" || n.endsWith(".pdf")) return FileType2;
  return FileText;
}
function humanSize(n?: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeAttachments({
  employeeId,
  employee,
  defaultCategory = "Other Documents",
}: {
  employeeId: string;
  employee?: { full_name?: string | null; employee_no?: string | null; phone?: string | null } | null;
  defaultCategory?: string;
}) {
  const { user, profile } = useAuth();
  const canDelete = useIsSuperAdmin();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [description, setDescription] = useState("");
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<EmployeeDoc | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["employee-documents", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmployeeDoc[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (filterCat !== "all" && d.doc_type !== filterCat) return false;
      if (!s) return true;
      return [d.file_name, d.doc_type, d.description, d.notes, d.uploaded_by_name]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s));
    });
  }, [docs, q, filterCat]);

  const upload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) {
          toast.error(`${file.name} exceeds ${MAX_MB}MB`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${employeeId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined, upsert: false,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await (supabase as any).from("employee_documents").insert({
          employee_id: employeeId,
          doc_type: category,
          storage_path: path,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size,
          description: description || null,
          uploaded_by: user?.id ?? null,
          uploaded_by_name: profile?.full_name ?? user?.email ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success("Document uploaded");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["employee-documents"] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }, [employeeId, category, description, user, profile, qc]);

  async function signed(doc: EmployeeDoc, ttl = 60) {
    if (!doc.storage_path) return doc.doc_url;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, ttl);
    return data?.signedUrl ?? null;
  }
  async function open(doc: EmployeeDoc) {
    const url = await signed(doc, 120);
    if (!url) return toast.error("Could not open document");
    window.open(url, "_blank", "noopener,noreferrer");
  }
  async function download(doc: EmployeeDoc) { open(doc); }
  async function print(doc: EmployeeDoc) {
    const url = await signed(doc, 120);
    if (!url) return toast.error("Could not open document");
    const w = window.open(url, "_blank");
    setTimeout(() => { try { w?.print(); } catch {} }, 800);
  }
  async function share(doc: EmployeeDoc) {
    const url = await signed(doc, 60 * 60 * 24);
    shareOnWhatsApp(`${doc.doc_type} — ${doc.file_name ?? "document"}`, url ?? undefined, employee?.phone ?? undefined);
  }
  async function confirmDelete() {
    const doc = pendingDelete;
    if (!doc) return;
    try {
      if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await (supabase as any).from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["employee-documents"] });
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Employee Documents</h3>
        <Badge variant="secondary" className="ml-auto rounded-full">{docs.length}</Badge>
      </div>

      <div className="rounded-lg border border-dashed p-3 space-y-2 bg-surface-muted/30">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{EMP_DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" placeholder="e.g. Aadhaar front + back" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
            Upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={uploading}>
            <Camera className="size-3.5 mr-1.5" /> Scan / Camera
          </Button>
          <span className="text-[11px] text-muted-foreground">PDF, JPG, PNG, DOCX · max {MAX_MB}MB each</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EMP_DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-lg">No documents.</div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {filtered.map((d) => {
            const Icon = fileIcon(d.file_type, d.file_name);
            return (
              <div key={d.id} className="flex items-center gap-3 p-2.5">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{d.file_name || d.doc_type}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    <Badge variant="outline" className="mr-1.5 text-[10px] py-0 px-1.5">{d.doc_type}</Badge>
                    {humanSize(d.file_size)} · {format(new Date(d.created_at ?? d.uploaded_at), "dd MMM yyyy HH:mm")} · {d.uploaded_by_name ?? "—"}
                  </div>
                  {(d.description || d.notes) ? <div className="text-[11px] text-muted-foreground truncate">{d.description ?? d.notes}</div> : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => open(d)} title="Preview"><Eye className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => download(d)} title="Download"><Download className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => print(d)} title="Print"><Printer className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-emerald-600" onClick={() => share(d)} title="Share on WhatsApp"><MessageCircle className="size-3.5" /></Button>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setPendingDelete(d)} title="Delete (Admin)"><Trash2 className="size-3.5" /></Button>
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
              This will permanently remove <b>{pendingDelete?.file_name ?? pendingDelete?.doc_type}</b>. This action cannot be undone.
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
