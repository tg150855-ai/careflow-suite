import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Play, CheckCircle2, Activity, FileText, Receipt, Mic } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { VoiceDictate } from "@/components/voice-dictate";
import { PriorityBadge, StatusBadge } from "./ot.index";

export const Route = createFileRoute("/_authenticated/ot/$id")({ component: OtDetail });

const STATUS_FLOW = ["scheduled", "pre_op", "in_progress", "recovery", "completed"];

function OtDetail() {
  const { id } = useParams({ from: "/_authenticated/ot/$id" });
  const qc = useQueryClient();

  const { data: s } = useQuery({
    queryKey: ["ot-detail", id],
    queryFn: async () => (await (supabase as any).from("surgeries")
      .select("*, patients(full_name, uhid, mobile, dob, gender), ot_rooms(name), primary:primary_surgeon_id(name), assistant:assistant_surgeon_id(name), anesthetist:anesthetist_id(name)")
      .eq("id", id).maybeSingle()).data,
  });

  const { data: notes } = useQuery({
    queryKey: ["ot-notes", id],
    queryFn: async () => (await (supabase as any).from("surgery_notes").select("*").eq("surgery_id", id).maybeSingle()).data,
  });

  async function setStatus(status: string) {
    const patch: any = { status };
    if (status === "in_progress" && !s?.actual_start) patch.actual_start = new Date().toISOString();
    if (status === "completed") patch.actual_end = new Date().toISOString();
    const { error } = await (supabase as any).from("surgeries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${status.replace("_", " ")}`);
    if (status === "completed") await syncBillToIPD();
    qc.invalidateQueries({ queryKey: ["ot-detail", id] });
  }

  async function syncBillToIPD() {
    if (!s?.admission_id) { toast.message("No IPD admission linked — charges saved on surgery only."); return; }
    const items = [
      { category: "OT", description: `OT Charge — ${s.procedure_name}`, quantity: 1, unit_price: Number(s.ot_charge ?? 0), amount: Number(s.ot_charge ?? 0) },
      { category: "OT", description: `Surgeon Fee — ${s.procedure_name}`, quantity: 1, unit_price: Number(s.surgeon_charge ?? 0), amount: Number(s.surgeon_charge ?? 0) },
      { category: "OT", description: `Assistant Fee — ${s.procedure_name}`, quantity: 1, unit_price: Number(s.assistant_charge ?? 0), amount: Number(s.assistant_charge ?? 0) },
      { category: "OT", description: `Anesthesia — ${s.procedure_name}`, quantity: 1, unit_price: Number(s.anesthesia_charge ?? 0), amount: Number(s.anesthesia_charge ?? 0) },
      { category: "OT", description: `Consumables — ${s.procedure_name}`, quantity: 1, unit_price: Number(s.consumables_charge ?? 0), amount: Number(s.consumables_charge ?? 0) },
    ].filter((i) => i.amount > 0);
    if (items.length === 0) { toast.message("No OT charges to push."); return; }

    // Find or create draft IPD bill for this admission
    let { data: bill } = await (supabase as any).from("bills")
      .select("id, subtotal, total, pending")
      .eq("admission_id", s.admission_id).in("status", ["draft", "partial"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const user = (await supabase.auth.getUser()).data.user;
    if (!bill) {
      const { data: created, error } = await (supabase as any).from("bills").insert({
        patient_id: s.patient_id, admission_id: s.admission_id, doctor_id: s.primary_surgeon_id,
        subtotal: 0, discount: 0, gst: 0, total: 0, paid: 0, pending: 0, status: "draft", created_by: user?.id,
      }).select().single();
      if (error) return toast.error(error.message);
      bill = created;
    }
    const itemRows = items.map((i, idx) => ({ ...i, bill_id: bill.id, position: idx + 1 }));
    const { error: itemErr } = await (supabase as any).from("bill_items").insert(itemRows);
    if (itemErr) return toast.error(itemErr.message);
    const addTotal = items.reduce((acc, i) => acc + i.amount, 0);
    const newSubtotal = Number(bill.subtotal ?? 0) + addTotal;
    const newTotal = Number(bill.total ?? 0) + addTotal;
    const newPending = Number(bill.pending ?? 0) + addTotal;
    await (supabase as any).from("bills").update({ subtotal: newSubtotal, total: newTotal, pending: newPending }).eq("id", bill.id);
    await (supabase as any).from("surgeries").update({ billed: true }).eq("id", id);
    toast.success(`OT charges (${inr(addTotal)}) added to IPD bill.`);
  }

  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/ot/schedule"><ArrowLeft className="size-4" /> Back</Link></Button>
      </div>
      <Card>
        <CardContent className="p-4 grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Surgery</div>
            <div className="font-mono text-sm">{s.surgery_no}</div>
            <div className="font-medium">{s.procedure_name}</div>
            <div className="flex gap-2 mt-1"><PriorityBadge p={s.priority} /><StatusBadge s={s.status} /></div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Patient</div>
            <div className="font-medium">{s.patients?.full_name}</div>
            <div className="text-xs text-muted-foreground">{s.patients?.uhid} · {s.patients?.gender}</div>
            {s.admission_id ? <Badge variant="secondary" className="mt-1">IPD Linked</Badge> : <Badge variant="outline" className="mt-1">No IPD link</Badge>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Team & Room</div>
            <div className="text-sm">Surgeon: {s.primary?.name ?? "—"}</div>
            <div className="text-sm">Assistant: {s.assistant?.name ?? "—"}</div>
            <div className="text-sm">Anesthetist: {s.anesthetist?.name ?? "—"}</div>
            <div className="text-sm">OT: {s.ot_rooms?.name ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4" /> Workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {STATUS_FLOW.map((st, idx) => {
              const reached = STATUS_FLOW.indexOf(s.status) >= idx;
              return (
                <div key={st} className="flex items-center gap-2">
                  <Badge variant={reached ? "default" : "outline"} className="capitalize">{st.replace("_", " ")}</Badge>
                  {idx < STATUS_FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-3 grid md:grid-cols-2 gap-1">
            <div>Scheduled: {s.scheduled_start ? format(new Date(s.scheduled_start), "dd MMM yyyy HH:mm") : "—"} → {s.scheduled_end ? format(new Date(s.scheduled_end), "HH:mm") : "—"}</div>
            <div>Actual: {s.actual_start ? format(new Date(s.actual_start), "dd MMM HH:mm") : "—"} → {s.actual_end ? format(new Date(s.actual_end), "HH:mm") : "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {s.status === "scheduled" && <Button size="sm" onClick={() => setStatus("pre_op")}>Move to Pre-Op</Button>}
            {s.status === "pre_op" && <Button size="sm" onClick={() => setStatus("in_progress")}><Play className="size-3" /> Start Surgery</Button>}
            {s.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => setStatus("in_progress")}><Play className="size-3" /> Start Surgery</Button>}
            {s.status === "in_progress" && <Button size="sm" onClick={() => setStatus("recovery")}>Move to Recovery</Button>}
            {s.status === "recovery" && <Button size="sm" onClick={() => setStatus("completed")}><CheckCircle2 className="size-3" /> Complete & Bill</Button>}
            {s.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => setStatus("completed")}><CheckCircle2 className="size-3" /> Complete & Bill</Button>}
            {s.status === "completed" && !s.billed && <Button size="sm" variant="outline" onClick={syncBillToIPD}><Receipt className="size-3" /> Push to IPD Bill</Button>}
            {s.billed && <Badge variant="secondary">Charges synced to IPD</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes"><FileText className="size-4 mr-1" /> Operation Notes</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="size-4 mr-1" /> Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="notes"><NotesEditor surgeryId={id} initial={notes} /></TabsContent>
        <TabsContent value="billing"><BillingSummary s={s} /></TabsContent>
      </Tabs>
    </div>
  );
}

function NotesEditor({ surgeryId, initial }: { surgeryId: string; initial: any }) {
  const qc = useQueryClient();
  const [n, setN] = useState({
    diagnosis: "", procedure_performed: "", findings: "", complications: "", notes: "", blood_loss_ml: 0, implants_used: "",
  });
  useEffect(() => {
    if (initial) setN({
      diagnosis: initial.diagnosis ?? "", procedure_performed: initial.procedure_performed ?? "",
      findings: initial.findings ?? "", complications: initial.complications ?? "",
      notes: initial.notes ?? initial.remarks ?? "",
      blood_loss_ml: Number(initial.blood_loss_ml ?? 0), implants_used: initial.implants_used ?? "",
    });
  }, [initial]);

  async function save() {
    const user = (await supabase.auth.getUser()).data.user;
    if (initial?.id) {
      const { error } = await (supabase as any).from("surgery_notes").update(n).eq("id", initial.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("surgery_notes").insert({ ...n, surgery_id: surgeryId, created_by: user?.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Operation notes saved");
    qc.invalidateQueries({ queryKey: ["ot-notes", surgeryId] });
  }

  const Field = ({ label, value, onChange, rows = 2 }: any) => (
    <div>
      <div className="flex items-center justify-between"><Label>{label}</Label>
        <VoiceDictate label={`Dictate ${label}`} onTranscript={(t) => onChange((value ? value + " " : "") + t)} />
      </div>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <Card><CardContent className="p-4 grid md:grid-cols-2 gap-4">
      <Field label="Diagnosis" value={n.diagnosis} onChange={(v: string) => setN({ ...n, diagnosis: v })} />
      <Field label="Procedure Performed" value={n.procedure_performed} onChange={(v: string) => setN({ ...n, procedure_performed: v })} />
      <Field label="Findings" value={n.findings} onChange={(v: string) => setN({ ...n, findings: v })} rows={3} />
      <Field label="Complications" value={n.complications} onChange={(v: string) => setN({ ...n, complications: v })} rows={3} />
      <div className="md:col-span-2"><Field label="Notes / Remarks" value={n.notes} onChange={(v: string) => setN({ ...n, notes: v })} rows={3} /></div>
      <div><Label>Blood Loss (ml)</Label><Input type="number" value={n.blood_loss_ml} onChange={(e) => setN({ ...n, blood_loss_ml: +e.target.value })} /></div>
      <div><Label>Implants Used</Label><Input value={n.implants_used} onChange={(e) => setN({ ...n, implants_used: e.target.value })} /></div>
      <div className="md:col-span-2 flex justify-end gap-2"><Button onClick={save}><Save className="size-4" /> Save Notes</Button></div>
    </CardContent></Card>
  );
}

function BillingSummary({ s }: { s: any }) {
  const total = Number(s.ot_charge ?? 0) + Number(s.surgeon_charge ?? 0) + Number(s.assistant_charge ?? 0) + Number(s.anesthesia_charge ?? 0) + Number(s.consumables_charge ?? 0);
  const Row = ({ l, v }: any) => <div className="flex justify-between py-1.5 border-b last:border-0"><span className="text-sm text-muted-foreground">{l}</span><span className="font-medium">{inr(v)}</span></div>;
  return (
    <Card><CardContent className="p-4">
      <Row l="OT Room Charge" v={s.ot_charge} />
      <Row l="Surgeon Fee" v={s.surgeon_charge} />
      <Row l="Assistant Surgeon Fee" v={s.assistant_charge} />
      <Row l="Anesthesia Charge" v={s.anesthesia_charge} />
      <Row l="Consumables" v={s.consumables_charge} />
      <div className="flex justify-between mt-3 pt-3 border-t"><span className="font-semibold">Total OT Charges</span><span className="text-lg font-semibold">{inr(total)}</span></div>
      <div className="text-xs text-muted-foreground mt-3">
        {s.admission_id ? (s.billed ? "✓ Already synced to IPD Billing." : "Click 'Complete & Bill' or 'Push to IPD Bill' to add these charges to the linked IPD admission's bill.") : "No IPD admission linked. Charges are tracked here only."}
      </div>
    </CardContent></Card>
  );
}
