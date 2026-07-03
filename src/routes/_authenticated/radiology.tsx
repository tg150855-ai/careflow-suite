import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan, Plus, FileText, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { RecordActions } from "@/components/common/record-actions";

export const Route = createFileRoute("/_authenticated/radiology")({ component: RadiologyPage });

const MODALITIES = ["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography", "ECG", "Echo", "TMT"];
const PRIORITIES = ["routine", "urgent", "emergency"];
const TEMPLATES: Record<string, string> = {
  "xray-chest": "X-Ray Chest:\nLungs: Clear.\nHeart: Normal size.\nMediastinum: Unremarkable.\nBony thorax: Intact.",
  "ct-brain": "CT Brain:\nNo acute hemorrhage.\nVentricles normal.\nNo midline shift.\nNo focal lesion.",
  "ct-abdomen": "CT Abdomen:\nLiver, spleen, pancreas normal.\nNo free fluid.\nBowel unremarkable.",
  "mri-spine": "MRI Spine:\nVertebral alignment maintained.\nNo disc herniation.\nCord signal normal.",
  "us-abdomen": "Ultrasound Abdomen:\nLiver normal echotexture.\nGB no calculi.\nKidneys normal.\nNo ascites.",
};

function RadiologyPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [reportFor, setReportFor] = useState<any>(null);

  const load = () => {
    supabase.from("radiology_orders" as any).select("*, patients(full_name, uhid), doctors(name), radiology_reports(*)")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setOrders(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
    supabase.from("doctors").select("id, name").order("name").then(({ data }) => setDoctors(data ?? []));
  }, []);

  const stats = {
    pending: orders.filter((o) => o.status === "pending" || o.status === "scheduled").length,
    completed: orders.filter((o) => o.status === "completed").length,
    reportsPending: orders.filter((o) => o.status === "completed" && (!o.radiology_reports?.length || o.radiology_reports?.[0]?.status === "draft")).length,
    reportsDone: orders.filter((o) => o.radiology_reports?.[0]?.status === "finalized").length,
    revenue: orders.filter((o) => format(new Date(o.created_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")).reduce((s, o) => s + Number(o.amount || 0), 0),
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "completed") patch.performed_at = new Date().toISOString();
    await supabase.from("radiology_orders" as any).update(patch).eq("id", id);
    toast.success("Updated");
    load();
  };

  const removeOrder = async (id: string) => {
    const { error } = await supabase.from("radiology_orders" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const printOrder = (o: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Radiology Order</title><style>body{font-family:system-ui;padding:24px;max-width:640px;margin:auto}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}td:first-child{color:#666;width:40%}</style></head><body>
      <h1>Radiology Order</h1>
      <table><tbody>
        <tr><td>Patient</td><td>${o.patients?.full_name ?? ""} (${o.patients?.uhid ?? ""})</td></tr>
        <tr><td>Doctor</td><td>${o.doctors?.name ?? "—"}</td></tr>
        <tr><td>Modality</td><td>${o.modality}</td></tr>
        <tr><td>Investigation</td><td>${o.investigation}</td></tr>
        <tr><td>Priority</td><td>${o.priority}</td></tr>
        <tr><td>Status</td><td>${o.status}</td></tr>
        <tr><td>Amount</td><td>${inr(Number(o.amount || 0))}</td></tr>
        <tr><td>Ordered</td><td>${format(new Date(o.created_at), "dd MMM yyyy HH:mm")}</td></tr>
      </tbody></table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const whatsAppOrder = async (o: any) => {
    const { data: p } = await supabase.from("patients").select("mobile").eq("id", o.patient_id).maybeSingle();
    const msg = `Radiology Order\nPatient: ${o.patients?.full_name} (${o.patients?.uhid})\n${o.modality} - ${o.investigation}\nStatus: ${o.status}\nAmount: ${inr(Number(o.amount || 0))}`;
    const phone = (p?.mobile ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Scan className="size-6 text-primary" /> Radiology / RIS</h1>
          <p className="text-sm text-muted-foreground">Orders, scheduling, reporting and PACS workflow.</p>
        </div>
        <NewOrderDialog open={open} setOpen={setOpen} patients={patients} doctors={doctors} onCreated={load} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Pending Scans" value={stats.pending} icon={Activity} />
        <StatCard label="Completed Scans" value={stats.completed} icon={Scan} />
        <StatCard label="Reports Pending" value={stats.reportsPending} icon={FileText} />
        <StatCard label="Reports Done" value={stats.reportsDone} icon={FileText} />
        <StatCard label="Revenue Today" value={inr(stats.revenue)} icon={Activity} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        {["all", "pending", "completed"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0 divide-y">
                {orders.filter((o) => tab === "all" || (tab === "pending" ? ["pending", "scheduled"].includes(o.status) : o.status === "completed")).map((o) => (
                  <div key={o.id} className="p-4 flex items-center gap-3 hover:bg-surface-muted">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{o.investigation} <span className="text-muted-foreground font-normal">· {o.modality}</span></div>
                      <div className="text-xs text-muted-foreground">{o.patients?.full_name} ({o.patients?.uhid}) · {o.doctors?.name ?? "—"} · {format(new Date(o.created_at), "dd MMM HH:mm")}</div>
                    </div>
                    <Badge variant={o.priority === "emergency" ? "destructive" : o.priority === "urgent" ? "default" : "outline"} className="capitalize">{o.priority}</Badge>
                    <Badge variant="outline" className="capitalize">{o.status}</Badge>
                    {o.status !== "completed" && <Button size="sm" variant="outline" onClick={() => updateStatus(o.id, "completed")}>Mark Done</Button>}
                    {o.status === "completed" && <Button size="sm" onClick={() => setReportFor(o)}>Report</Button>}
                    <RecordActions
                      onPrint={() => printOrder(o)}
                      onWhatsApp={() => whatsAppOrder(o)}
                      onDelete={() => removeOrder(o.id)}
                      deleteLabel="this radiology order"
                    />
                  </div>
                ))}
                {orders.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No radiology orders yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ReportDialog order={reportFor} onClose={() => { setReportFor(null); load(); }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <Card><CardContent className="pt-5">
      <div className="flex items-center justify-between">
        <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums mt-1">{value}</div></div>
        <Icon className="size-5 text-muted-foreground" />
      </div>
    </CardContent></Card>
  );
}

function NewOrderDialog({ open, setOpen, patients, doctors, onCreated }: any) {
  const [form, setForm] = useState({ patient_id: "", doctor_id: "", modality: "X-Ray", investigation: "", priority: "routine", instructions: "", amount: "" });
  const submit = async () => {
    if (!form.patient_id || !form.investigation) { toast.error("Patient and investigation required"); return; }
    const { error } = await supabase.from("radiology_orders" as any).insert({
      patient_id: form.patient_id, doctor_id: form.doctor_id || null, modality: form.modality,
      investigation: form.investigation, priority: form.priority, instructions: form.instructions || null,
      amount: Number(form.amount) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Order created"); setOpen(false); onCreated();
    setForm({ patient_id: "", doctor_id: "", modality: "X-Ray", investigation: "", priority: "routine", instructions: "", amount: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Order</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Radiology Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Modality</Label>
              <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Investigation</Label><Input value={form.investigation} onChange={(e) => setForm({ ...form, investigation: e.target.value })} placeholder="e.g., Chest PA View" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Doctor</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div><Label>Instructions</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ order, onClose }: any) {
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [template, setTemplate] = useState("");

  useEffect(() => {
    if (order?.radiology_reports?.[0]) {
      setFindings(order.radiology_reports[0].findings ?? "");
      setImpression(order.radiology_reports[0].impression ?? "");
    } else { setFindings(""); setImpression(""); }
  }, [order]);

  const applyTemplate = (key: string) => { setTemplate(key); setFindings(TEMPLATES[key] ?? ""); };

  const save = async (status: "draft" | "finalized") => {
    const existing = order.radiology_reports?.[0];
    const payload: any = { order_id: order.id, template_key: template || null, findings, impression, status, finalized_at: status === "finalized" ? new Date().toISOString() : null };
    const op = existing ? supabase.from("radiology_reports" as any).update(payload).eq("id", existing.id) : supabase.from("radiology_reports" as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(status === "finalized" ? "Report finalized" : "Draft saved");
    onClose();
  };

  if (!order) return null;
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Report — {order.investigation} ({order.modality})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Template</Label>
            <Select value={template} onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
              <SelectContent>{Object.keys(TEMPLATES).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Findings</Label><Textarea rows={8} value={findings} onChange={(e) => setFindings(e.target.value)} /></div>
          <div><Label>Impression</Label><Textarea rows={3} value={impression} onChange={(e) => setImpression(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => save("draft")}>Save Draft</Button>
          <Button onClick={() => save("finalized")}>Finalize Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
