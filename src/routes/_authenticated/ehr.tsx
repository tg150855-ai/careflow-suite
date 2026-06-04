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
import { Badge } from "@/components/ui/badge";
import { Share2, Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ehr")({ component: EHRPage });

function EHRPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ patient_id: "", record_type: "summary", external_facility: "", payload: "{}" });

  const load = () =>
    (supabase.from("ehr_records" as any) as any).select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).limit(200)
      .then(({ data }: any) => setRecords(data ?? []));

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    let payload: any = {};
    try { payload = JSON.parse(form.payload || "{}"); } catch { return toast.error("Invalid JSON payload"); }
    const { error } = await (supabase.from("ehr_records" as any) as any).insert({ ...form, payload, shared_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("EHR record shared");
    setOpen(false); load();
  };

  const exportRecord = (r: any) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ehr-${r.id}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Share2 className="size-6 text-primary" /> Patient EHR</h1>
          <p className="text-sm text-muted-foreground">Patient-controlled health record sharing across facilities.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Share record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Share EHR Record</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>External facility</Label><Input value={form.external_facility} onChange={(e) => setForm({ ...form, external_facility: e.target.value })} /></div>
              <div><Label>Record type</Label>
                <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["summary","prescription","lab","imaging","discharge"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Payload (JSON)</Label><Textarea rows={5} value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.patient_id}>Share</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {records.map((r) => (
          <Card key={r.id}><CardContent className="pt-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{r.patients?.full_name} <span className="text-xs text-muted-foreground">({r.patients?.uhid})</span></div>
              <div className="text-xs text-muted-foreground">→ {r.external_facility || "—"} · {format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{r.record_type}</Badge>
              <Button variant="ghost" size="sm" onClick={() => exportRecord(r)}><Download className="size-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
        {records.length === 0 && <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">No shared records yet.</CardContent></Card>}
      </div>
    </div>
  );
}
