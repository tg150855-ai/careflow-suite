import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/patient-safety")({ component: PSPage });

const TYPES = ["fall_risk","allergy","critical_lab","high_risk","drug_interaction","wandering"];
const SEV = ["low","medium","high","critical"];

function PSPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ patient_id: "", alert_type: "fall_risk", severity: "medium", message: "" });

  const load = () => (supabase.from("patient_safety_alerts" as any) as any).select("*, patients(full_name, uhid)").eq("active", true).order("created_at", { ascending: false })
    .then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    const { error } = await (supabase.from("patient_safety_alerts" as any) as any).insert(form);
    if (error) return toast.error(error.message);
    toast.success("Alert created"); setOpen(false); load();
  };

  const resolve = async (id: string) => {
    await (supabase.from("patient_safety_alerts" as any) as any).update({ active: false, resolved_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldAlert className="size-6 text-primary" /> Patient Safety</h1>
          <p className="text-sm text-muted-foreground">Active alerts: fall risk, allergies, critical labs, high-risk flags.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New alert</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Patient Safety Alert</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.alert_type} onValueChange={(v) => setForm({ ...form, alert_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Message</Label><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.patient_id || !form.message}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Patient", cell: (r) => <span>{r.patients?.full_name} <span className="text-xs text-muted-foreground">{r.patients?.uhid}</span></span> },
          { header: "Type", cell: (r) => <Badge variant="outline">{r.alert_type?.replace(/_/g, " ")}</Badge> },
          { header: "Severity", cell: (r) => <Badge variant={r.severity === "critical" || r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge> },
          { header: "Message", cell: (r) => <span className="text-xs">{r.message}</span> },
          { header: "Action", cell: (r) => <Button size="sm" variant="ghost" onClick={() => resolve(r.id)}>Resolve</Button> },
        ]}
      />
    </div>
  );
}
