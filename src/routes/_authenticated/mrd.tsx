import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Archive, Plus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/mrd")({ component: MRDPage });

function MRDPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ patient_id: "", record_no: "", location: "", retention_until: "", notes: "" });

  const load = () => (supabase.from("medical_records_archive" as any) as any).select("*, patients(full_name, uhid)").order("archived_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    const { error } = await (supabase.from("medical_records_archive" as any) as any).insert(form);
    if (error) return toast.error(error.message);
    toast.success("Record archived"); setOpen(false); load();
  };
  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "destroyed") patch.destroyed_at = new Date().toISOString();
    await (supabase.from("medical_records_archive" as any) as any).update(patch).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Archive className="size-6 text-primary" /> Medical Records Department</h1>
          <p className="text-sm text-muted-foreground">Archival, retrieval requests, retention & destruction workflow.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Archive record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Archive Medical Record</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Record #</Label><Input value={form.record_no} onChange={(e) => setForm({ ...form, record_no: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div className="col-span-2"><Label>Retention until</Label><Input type="date" value={form.retention_until} onChange={(e) => setForm({ ...form, retention_until: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.patient_id}>Archive</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Record #", cell: (r) => <code className="text-xs">{r.record_no}</code> },
          { header: "Patient", cell: (r) => <>{r.patients?.full_name} <span className="text-xs text-muted-foreground">{r.patients?.uhid}</span></> },
          { header: "Location", cell: (r) => r.location },
          { header: "Retention", cell: (r) => <span className="text-xs">{r.retention_until ?? "—"}</span> },
          { header: "Status", cell: (r) => <Badge variant={r.status === "destroyed" ? "destructive" : "outline"}>{r.status}</Badge> },
          { header: "Action", cell: (r) => (
            <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
              <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{["archived","requested","retrieved","destroyed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          )},
        ]}
      />
    </div>
  );
}
