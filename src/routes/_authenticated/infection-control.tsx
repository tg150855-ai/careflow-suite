import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bug, Plus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/infection-control")({ component: ICPage });

function ICPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ patient_id: "", infection_type: "", is_hai: false, isolation_required: false, isolation_type: "", antibiotic: "", onset_date: "", notes: "" });

  const load = () => (supabase.from("infection_control" as any) as any).select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    const { error } = await (supabase.from("infection_control" as any) as any).insert({ ...form, patient_id: form.patient_id || null });
    if (error) return toast.error(error.message);
    toast.success("Recorded"); setOpen(false); load();
  };

  const haiCount = rows.filter((r) => r.is_hai).length;
  const isolated = rows.filter((r) => r.isolation_required && !r.resolved_date).length;
  const active = rows.filter((r) => !r.resolved_date).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Bug className="size-6 text-primary" /> Infection Control</h1>
          <p className="text-sm text-muted-foreground">HAI surveillance, isolation cases & antibiotic stewardship.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Log case</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Infection Case</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Infection type</Label><Input value={form.infection_type} onChange={(e) => setForm({ ...form, infection_type: e.target.value })} /></div>
                <div><Label>Onset date</Label><Input type="date" value={form.onset_date} onChange={(e) => setForm({ ...form, onset_date: e.target.value })} /></div>
                <div><Label>Antibiotic</Label><Input value={form.antibiotic} onChange={(e) => setForm({ ...form, antibiotic: e.target.value })} /></div>
                <div><Label>Isolation type</Label><Input value={form.isolation_type} onChange={(e) => setForm({ ...form, isolation_type: e.target.value })} /></div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_hai} onCheckedChange={(v) => setForm({ ...form, is_hai: v })} /> Hospital-acquired</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.isolation_required} onCheckedChange={(v) => setForm({ ...form, isolation_required: v })} /> Isolation required</label>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.infection_type}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Active cases</div><div className="text-2xl font-bold">{active}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">HAI total</div><div className="text-2xl font-bold text-warning-foreground">{haiCount}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">In isolation</div><div className="text-2xl font-bold">{isolated}</div></CardContent></Card>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Patient", cell: (r) => <div>{r.patients?.full_name ?? "—"} <span className="text-xs text-muted-foreground">{r.patients?.uhid}</span></div> },
          { header: "Infection", cell: (r) => r.infection_type },
          { header: "HAI", cell: (r) => r.is_hai ? <Badge variant="destructive">HAI</Badge> : <Badge variant="outline">CAI</Badge> },
          { header: "Antibiotic", cell: (r) => <span className="text-xs">{r.antibiotic || "—"}</span> },
          { header: "Status", cell: (r) => r.resolved_date ? <Badge>Resolved</Badge> : <Badge variant="secondary">Active</Badge> },
        ]}
      />
    </div>
  );
}
