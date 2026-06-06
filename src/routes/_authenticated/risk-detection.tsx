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
import { ShieldAlert, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/risk-detection")({ component: RiskPage });

const TYPES = ["readmission", "critical_patient", "surgery_risk", "billing_risk", "insurance_risk"];
const LEVELS = ["low", "medium", "high", "critical"];

function RiskPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", risk_type: TYPES[0], risk_level: "medium", score: "0.6", recommendation: "" });

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("risk_assessments").select("*, patients(full_name, uhid)").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  async function save() {
    if (!f.patient_id) return toast.error("Patient required");
    await insertRow("risk_assessments", { ...f, score: +f.score });
    toast.success("Risk recorded"); setOpen(false); load();
  }

  const cols: Col<any>[] = [
    { header: "Patient", cell: (r) => <div><div className="font-medium">{r.patients?.full_name}</div><div className="text-xs text-muted-foreground">{r.patients?.uhid}</div></div> },
    { header: "Type", cell: (r) => <Badge variant="outline">{r.risk_type}</Badge> },
    { header: "Level", cell: (r) => <Badge variant={r.risk_level === "critical" || r.risk_level === "high" ? "destructive" : "secondary"}>{r.risk_level}</Badge> },
    { header: "Score", cell: (r) => Number(r.score ?? 0).toFixed(2) },
    { header: "Recommendation", cell: (r) => <span className="text-xs">{r.recommendation || "—"}</span> },
    { header: "Status", cell: (r) => <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldAlert} title="AI Risk Detection" subtitle="Automatic identification of clinical, financial and operational risks." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Log Risk</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Risk Assessment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={f.risk_type} onValueChange={(v) => setF({ ...f, risk_type: v })}>
                    <SelectTrigger /><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Level</Label>
                  <Select value={f.risk_level} onValueChange={(v) => setF({ ...f, risk_level: v })}>
                    <SelectTrigger /><SelectContent>{LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Score (0-1)</Label><Input type="number" step="0.1" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></div>
              <div><Label>Recommendation</Label><Textarea value={f.recommendation} onChange={(e) => setF({ ...f, recommendation: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <SimpleTable rows={rows} columns={cols} empty="No risk assessments yet." />
    </div>
  );
}
