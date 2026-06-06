import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Home, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/remote-care")({ component: RemotePage });

const PROGRAMS = ["home_care", "chronic_disease", "post_surgery"];

function RemotePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", program_type: PROGRAMS[0], medication_compliance: "0.8", followup_status: "on_track", notes: "", hr: "", bp: "", spo2: "" });

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("remote_monitoring").select("*, patients(full_name, uhid)").order("recorded_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  async function save() {
    if (!f.patient_id) return toast.error("Patient required");
    const vitals: any = {};
    if (f.hr) vitals.heart_rate = +f.hr;
    if (f.bp) vitals.bp = f.bp;
    if (f.spo2) vitals.spo2 = +f.spo2;
    const alert = (vitals.spo2 && vitals.spo2 < 92) || (vitals.heart_rate && (vitals.heart_rate < 50 || vitals.heart_rate > 120));
    await insertRow("remote_monitoring", { patient_id: f.patient_id, program_type: f.program_type, medication_compliance: +f.medication_compliance, followup_status: f.followup_status, notes: f.notes, vitals, alert });
    toast.success("Saved"); setOpen(false); load();
  }

  const cols: Col<any>[] = [
    { header: "Patient", cell: (r) => <div><div className="font-medium">{r.patients?.full_name}</div><div className="text-xs text-muted-foreground">{r.patients?.uhid}</div></div> },
    { header: "Program", cell: (r) => <Badge variant="outline">{r.program_type}</Badge> },
    { header: "Compliance", cell: (r) => <Badge variant={r.medication_compliance < 0.7 ? "destructive" : "secondary"}>{Math.round((r.medication_compliance ?? 0) * 100)}%</Badge> },
    { header: "Follow-up", cell: (r) => r.followup_status },
    { header: "Alert", cell: (r) => r.alert ? <Badge variant="destructive">Alert</Badge> : <Badge variant="secondary">OK</Badge> },
    { header: "Recorded", cell: (r) => format(new Date(r.recorded_at), "dd MMM HH:mm") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={Home} title="Remote Care Monitoring" subtitle="Home care, chronic disease and post-surgery patient tracking." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Log Reading</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Remote Care Reading</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Program</Label>
                <Select value={f.program_type} onValueChange={(v) => setF({ ...f, program_type: v })}>
                  <SelectTrigger /><SelectContent>{PROGRAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>HR</Label><Input type="number" value={f.hr} onChange={(e) => setF({ ...f, hr: e.target.value })} /></div>
                <div><Label>BP</Label><Input value={f.bp} onChange={(e) => setF({ ...f, bp: e.target.value })} placeholder="120/80" /></div>
                <div><Label>SpO₂</Label><Input type="number" value={f.spo2} onChange={(e) => setF({ ...f, spo2: e.target.value })} /></div>
              </div>
              <div><Label>Compliance (0-1)</Label><Input type="number" step="0.1" value={f.medication_compliance} onChange={(e) => setF({ ...f, medication_compliance: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <SimpleTable rows={rows} columns={cols} empty="No remote monitoring records yet." />
    </div>
  );
}
