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
import { Lightbulb, Plus, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/cdss")({ component: CDSSPage });

const TYPES = ["drug_interaction","allergy_alert","duplicate_therapy","dose_warning","clinical_recommendation"];

function CDSSPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<any>({ patient_id: "", alert_type: "drug_interaction", severity: "warning", trigger_source: "", message: "", recommendation: "" });

  const load = () => (supabase.from("clinical_alerts" as any) as any).select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    const { error } = await (supabase.from("clinical_alerts" as any) as any).insert({ ...form, patient_id: form.patient_id || null });
    if (error) return toast.error(error.message);
    toast.success("Alert created"); setOpen(false); load();
  };

  const acknowledge = async (id: string, overrideReason?: string) => {
    await (supabase.from("clinical_alerts" as any) as any).update({
      acknowledged: true, acknowledged_by: user?.id, acknowledged_at: new Date().toISOString(),
      override_reason: overrideReason ?? null,
    }).eq("id", id);
    setOverride(null); setReason(""); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Lightbulb className="size-6 text-primary" /> Clinical Decision Support</h1>
          <p className="text-sm text-muted-foreground">Drug interactions, allergies, duplicate therapy & clinical recommendations. Doctor must acknowledge.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add alert</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>CDSS Alert</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient (optional)</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
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
                    <SelectContent>{["info","warning","critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Trigger source</Label><Input value={form.trigger_source} onChange={(e) => setForm({ ...form, trigger_source: e.target.value })} placeholder="prescription, lab, etc" /></div>
              <div><Label>Message</Label><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
              <div><Label>Recommendation</Label><Textarea value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.message}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Patient", cell: (r) => r.patients ? <span>{r.patients.full_name} <span className="text-xs text-muted-foreground">{r.patients.uhid}</span></span> : <span className="text-xs text-muted-foreground">—</span> },
          { header: "Type", cell: (r) => <Badge variant="outline">{r.alert_type?.replace(/_/g, " ")}</Badge> },
          { header: "Severity", cell: (r) => <Badge variant={r.severity === "critical" ? "destructive" : r.severity === "warning" ? "secondary" : "outline"}>{r.severity}</Badge> },
          { header: "Message", cell: (r) => <div className="text-xs"><div>{r.message}</div>{r.recommendation && <div className="text-muted-foreground italic">→ {r.recommendation}</div>}</div> },
          { header: "Status", cell: (r) => r.acknowledged
            ? <Badge>Ack {r.acknowledged_at ? format(new Date(r.acknowledged_at), "dd MMM HH:mm") : ""}</Badge>
            : <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => acknowledge(r.id)}><Check className="size-3 mr-1" /> Acknowledge</Button>
                <Button size="sm" variant="ghost" onClick={() => setOverride(r)}>Override</Button>
              </div> },
        ]}
      />

      <Dialog open={!!override} onOpenChange={(v) => !v && setOverride(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override alert</DialogTitle></DialogHeader>
          <Label>Clinical reason for override</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter><Button onClick={() => acknowledge(override.id, reason)} disabled={!reason.trim()}>Confirm override</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
