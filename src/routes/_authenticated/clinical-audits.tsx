import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/clinical-audits")({ component: CAPage });

const TYPES = ["prescription","documentation","clinical_protocol","surgery","handwashing","medication_reconciliation"];

function CAPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ audit_type: "prescription", scope: "", auditor: "", sample_size: "", compliance_pct: "", findings: "", recommendations: "" });

  const load = () => (supabase.from("clinical_audits" as any) as any).select("*").order("audit_date", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await (supabase.from("clinical_audits" as any) as any).insert({
      ...form,
      sample_size: form.sample_size ? parseInt(form.sample_size) : null,
      compliance_pct: form.compliance_pct ? parseFloat(form.compliance_pct) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Audit recorded"); setOpen(false); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ClipboardCheck className="size-6 text-primary" /> Clinical Audits</h1>
          <p className="text-sm text-muted-foreground">Prescription, documentation, protocol & surgery audits.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New audit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Clinical Audit</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.audit_type} onValueChange={(v) => setForm({ ...form, audit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Auditor</Label><Input value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} /></div>
              <div className="col-span-2"><Label>Scope</Label><Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} /></div>
              <div><Label>Sample size</Label><Input type="number" value={form.sample_size} onChange={(e) => setForm({ ...form, sample_size: e.target.value })} /></div>
              <div><Label>Compliance %</Label><Input type="number" value={form.compliance_pct} onChange={(e) => setForm({ ...form, compliance_pct: e.target.value })} /></div>
              <div className="col-span-2"><Label>Findings</Label><Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} /></div>
              <div className="col-span-2"><Label>Recommendations</Label><Textarea value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Type", cell: (r) => <Badge variant="outline">{r.audit_type?.replace(/_/g, " ")}</Badge> },
          { header: "Scope", cell: (r) => <span className="text-xs">{r.scope}</span> },
          { header: "Date", cell: (r) => r.audit_date },
          { header: "Sample", cell: (r) => r.sample_size ?? "—" },
          { header: "Compliance", cell: (r) => <Badge variant={r.compliance_pct >= 90 ? "default" : r.compliance_pct >= 70 ? "secondary" : "destructive"}>{r.compliance_pct ?? "—"}%</Badge> },
          { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
