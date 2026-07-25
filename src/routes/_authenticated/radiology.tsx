import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan, Plus, FileText, Activity, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";

export const Route = createFileRoute("/_authenticated/radiology")({ component: RadiologyPage });

const MODALITIES = ["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography", "ECG", "Echo", "TMT"];
const PRIORITIES = ["routine", "urgent", "emergency"];

type TestMaster = { id: string; name: string; modality: string; body_part: string | null; price: number };
type ReportTemplate = { id: string; name: string; modality: string; body_part: string | null; findings: string | null; impression: string | null };

function RadiologyPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [tests, setTests] = useState<TestMaster[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [reportFor, setReportFor] = useState<any>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = () => {
    supabase.from("radiology_orders" as any).select("*, patients(full_name, uhid), doctors(name), radiology_reports(*)")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setOrders(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
    supabase.from("doctors").select("id, name").order("name").then(({ data }) => setDoctors(data ?? []));
    supabase.from("radiology_test_master" as any).select("id, name, modality, body_part, price").eq("active", true).order("name").then(({ data }) => setTests((data ?? []) as any));
    supabase.from("radiology_report_templates" as any).select("id, name, modality, body_part, findings, impression").order("name").then(({ data }) => setTemplates((data ?? []) as any));
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
        <NewOrderDialog open={open} setOpen={setOpen} patients={patients} doctors={doctors} tests={tests} onCreated={load} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Pending Scans" value={stats.pending} icon={Activity} />
        <StatCard label="Completed Scans" value={stats.completed} icon={Scan} />
        <StatCard label="Reports Pending" value={stats.reportsPending} icon={FileText} />
        <StatCard label="Reports Done" value={stats.reportsDone} icon={FileText} />
        <StatCard label="Revenue Today" value={inr(stats.revenue)} icon={Activity} />
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]"><Label className="text-xs">Search</Label><SearchBox value={q} onChange={setQ} placeholder="Name, UHID, investigation, modality…" /></div>
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
          {(q || from || to) && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Reset</Button>}
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        {["all", "pending", "completed"].map((tab) => {
          const ql = q.toLowerCase();
          const fromT = from ? new Date(from).getTime() : 0;
          const toT = to ? new Date(to).getTime() + 86400000 : Infinity;
          const filtered = orders
            .filter((o) => tab === "all" || (tab === "pending" ? ["pending", "scheduled"].includes(o.status) : o.status === "completed"))
            .filter((o) => {
              const t = new Date(o.created_at).getTime();
              if (t < fromT || t > toT) return false;
              if (!ql) return true;
              return (
                o.patients?.full_name?.toLowerCase().includes(ql) ||
                o.patients?.uhid?.toLowerCase().includes(ql) ||
                o.investigation?.toLowerCase().includes(ql) ||
                o.modality?.toLowerCase().includes(ql)
              );
            })
            .sort((a, b) => (a.priority === "urgent" || a.priority === "emergency" ? -1 : 0) - (b.priority === "urgent" || b.priority === "emergency" ? -1 : 0));
          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0 divide-y">
                  {filtered.map((o) => (
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
                  {filtered.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No radiology orders match.</div>}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <ReportDialog order={reportFor} templates={templates} onClose={() => { setReportFor(null); load(); }} />
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

type OrderRow = { test_master_id: string; modality: string; investigation: string; amount: string };
const EMPTY_ROW: OrderRow = { test_master_id: "", modality: "X-Ray", investigation: "", amount: "" };

function NewOrderDialog({ open, setOpen, patients, doctors, tests, onCreated }: any) {
  const [patient_id, setPatient_id] = useState("");
  const [doctor_id, setDoctor_id] = useState("");
  const [priority, setPriority] = useState("routine");
  const [instructions, setInstructions] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([{ ...EMPTY_ROW }]);

  const reset = () => {
    setPatient_id(""); setDoctor_id(""); setPriority("routine"); setInstructions("");
    setRows([{ ...EMPTY_ROW }]);
  };

  const setRow = (i: number, patch: Partial<OrderRow>) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const pickTest = (i: number, testId: string) => {
    const t = tests.find((x: TestMaster) => x.id === testId);
    if (!t) { setRow(i, { test_master_id: "" }); return; }
    setRow(i, {
      test_master_id: t.id,
      modality: t.modality,
      investigation: t.body_part ? `${t.name} — ${t.body_part}` : t.name,
      amount: String(t.price ?? ""),
    });
  };

  const submit = async () => {
    if (!patient_id) { toast.error("Select patient"); return; }
    const valid = rows.filter((r) => r.investigation.trim());
    if (valid.length === 0) { toast.error("Add at least one test"); return; }
    const payload = valid.map((r) => ({
      patient_id, doctor_id: doctor_id || null, modality: r.modality,
      investigation: r.investigation, priority, instructions: instructions || null,
      amount: Number(r.amount) || 0,
    }));
    const { error } = await supabase.from("radiology_orders" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} order${payload.length > 1 ? "s" : ""} created`);
    setOpen(false); reset(); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Order</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New Radiology Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient</Label>
              <Select value={patient_id} onValueChange={setPatient_id}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Referring Doctor</Label>
              <Select value={doctor_id} onValueChange={setDoctor_id}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Tests ({rows.length})</Label>
              <Button type="button" size="sm" variant="outline" onClick={addRow}><Plus className="size-3.5 mr-1" />Add Test</Button>
            </div>
            <datalist id="rad-test-master">
              {tests.map((t: TestMaster) => (
                <option key={t.id} value={t.body_part ? `${t.name} — ${t.body_part}` : t.name} data-id={t.id}>
                  {t.modality} · ₹{t.price}
                </option>
              ))}
            </datalist>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <Label className="text-xs">Test (pick from master)</Label>}
                  <Select value={r.test_master_id} onValueChange={(v) => pickTest(i, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Search master…" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {tests.length === 0 && <div className="p-2 text-xs text-muted-foreground">No tests. Add via Settings.</div>}
                      {tests.map((t: TestMaster) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.body_part ? ` — ${t.body_part}` : ""} · {t.modality} · ₹{t.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Modality</Label>}
                  <Select value={r.modality} onValueChange={(v) => setRow(i, { modality: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  {i === 0 && <Label className="text-xs">Investigation</Label>}
                  <Input className="h-9" value={r.investigation} onChange={(e) => setRow(i, { investigation: e.target.value })} placeholder="e.g., Chest PA View" />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">₹</Label>}
                  <Input className="h-9" type="number" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                </div>
                <div className="col-span-1">
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeRow(i)} disabled={rows.length === 1} title="Remove">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-right text-sm text-muted-foreground pt-1">
              Total: <span className="font-semibold text-foreground">{inr(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}</span>
            </div>
          </div>

          <div><Label>Clinical Instructions</Label><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Create {rows.filter((r) => r.investigation.trim()).length || ""} Order{rows.filter((r) => r.investigation.trim()).length !== 1 ? "s" : ""}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ order, templates, onClose }: { order: any; templates: ReportTemplate[]; onClose: () => void }) {
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    if (order?.radiology_reports?.[0]) {
      setFindings(order.radiology_reports[0].findings ?? "");
      setImpression(order.radiology_reports[0].impression ?? "");
      setTemplateId(order.radiology_reports[0].template_key ?? "");
    } else { setFindings(""); setImpression(""); setTemplateId(""); }
  }, [order]);

  const matchingTemplates = useMemo(() => {
    if (!order) return [] as ReportTemplate[];
    const mod = (order.modality ?? "").toLowerCase();
    const matches = templates.filter((t) => t.modality.toLowerCase() === mod);
    return matches.length > 0 ? matches : templates;
  }, [order, templates]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setFindings(t.findings ?? "");
      setImpression(t.impression ?? "");
      toast.success(`Loaded template: ${t.name}`);
    }
  };

  const save = async (status: "draft" | "finalized") => {
    const existing = order.radiology_reports?.[0];
    const payload: any = { order_id: order.id, template_key: templateId || null, findings, impression, status, finalized_at: status === "finalized" ? new Date().toISOString() : null };
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
          <div>
            <Label>Quick Template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder={matchingTemplates.length ? "Pick a template to auto-fill" : "No templates configured"} /></SelectTrigger>
              <SelectContent className="max-h-64">
                {matchingTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}{t.body_part ? ` — ${t.body_part}` : ""} · {t.modality}</SelectItem>
                ))}
                {matchingTemplates.length === 0 && <div className="p-2 text-xs text-muted-foreground">Add templates in Radiology settings.</div>}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Selecting a template auto-fills Findings & Impression — you can edit before saving.</p>
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
