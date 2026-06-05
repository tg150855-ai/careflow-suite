import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Plus, History, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listRows, insertRow } from "@/lib/saas-crud";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({ component: DocsPage });

const CATEGORIES = ["patient_record", "insurance", "consent_form", "radiology", "lab_report", "discharge", "general"];

function DocsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", category: "general", file_url: "", access_level: "staff", patient_id: "", tags: "" });

  async function load() {
    setRows(await listRows("documents", { order: "created_at" }));
    setLogs(await listRows("document_access_logs", { order: "created_at", limit: 50 }));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      const payload: any = { ...f, uploaded_by: user?.id, tags: f.tags ? f.tags.split(",").map((t) => t.trim()) : [] };
      if (!payload.patient_id) delete payload.patient_id;
      await insertRow("documents", payload);
      toast.success("Document uploaded");
      setOpen(false);
      setF({ title: "", description: "", category: "general", file_url: "", access_level: "staff", patient_id: "", tags: "" });
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function logAccess(docId: string) {
    await (supabase as any).from("document_access_logs").insert({ document_id: docId, user_id: user?.id, action: "view" });
    load();
  }

  return (
    <div>
      <PageHeader icon={FileText} title="Document Management" subtitle="Patient records, insurance, consent forms, radiology files — versioned & audited"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Upload Document</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Access Level</Label>
                    <Select value={f.access_level} onValueChange={(v) => setF({ ...f, access_level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff Only</SelectItem>
                        <SelectItem value="restricted">Restricted</SelectItem>
                        <SelectItem value="patient">Patient Visible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>File URL</Label><Input value={f.file_url} onChange={(e) => setF({ ...f, file_url: e.target.value })} placeholder="https://..." /></div>
                <div><Label>Patient UUID (optional)</Label><Input value={f.patient_id} onChange={(e) => setF({ ...f, patient_id: e.target.value })} /></div>
                <div><Label>Tags (comma-separated)</Label><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} disabled={!f.title || !f.file_url}>Upload</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Tabs defaultValue="docs">
        <TabsList><TabsTrigger value="docs">Documents</TabsTrigger><TabsTrigger value="audit"><History className="size-4 mr-1" /> Audit Trail</TabsTrigger></TabsList>
        <TabsContent value="docs">
          <SimpleTable rows={rows} empty="No documents yet." columns={[
            { header: "Title", cell: (r) => <span className="font-medium">{r.title}</span> },
            { header: "Category", cell: (r) => <Badge variant="outline">{r.category.replace("_"," ")}</Badge> },
            { header: "Access", cell: (r) => <Badge>{r.access_level}</Badge> },
            { header: "Version", cell: (r) => `v${r.version}` },
            { header: "Uploaded", cell: (r) => new Date(r.created_at).toLocaleDateString() },
            { header: "Actions", cell: (r) => (
              <Button size="sm" variant="ghost" onClick={() => { logAccess(r.id); window.open(r.file_url, "_blank"); }}>
                <Eye className="size-4 mr-1" /> Open
              </Button>
            ) },
          ]} />
        </TabsContent>
        <TabsContent value="audit">
          <SimpleTable rows={logs} empty="No access events yet." columns={[
            { header: "Document", cell: (r) => r.document_id.slice(0, 8) },
            { header: "Action", cell: (r) => <Badge variant="outline">{r.action}</Badge> },
            { header: "User", cell: (r) => r.user_id?.slice(0, 8) ?? "—" },
            { header: "At", cell: (r) => new Date(r.created_at).toLocaleString() },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
