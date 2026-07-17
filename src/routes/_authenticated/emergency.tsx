import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Siren, Plus, Activity, AlertOctagon, Clock, Pencil, User,
  Download, FileSpreadsheet, Printer, RefreshCw, Upload,
} from "lucide-react";
import { DataImportDialog } from "@/components/data-import-dialog";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { logAudit } from "@/lib/audit";
import { BRAND } from "@/components/brand";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/_authenticated/emergency")({ component: EmergencyPage });

type ER = {
  id: string; emergency_no: string; full_name: string; mobile: string | null; gender: string | null;
  approx_age: number | null; emergency_type: string | null; triage: string | null; status: string;
  arrival_time: string; patient_id: string | null; attending_doctor_id: string | null; notes: string | null;
  chief_complaint: string | null;
  patients?: { id: string; uhid: string } | null;
};

const triageColor: Record<string, string> = {
  red: "bg-destructive text-destructive-foreground",
  orange: "bg-warning text-warning-foreground",
  yellow: "bg-yellow-200 text-yellow-900",
  green: "bg-success/20 text-success",
};

const STATUS_OPTIONS = ["waiting", "in_treatment", "admitted", "discharged"] as const;

function EmergencyPage() {
  const qc = useQueryClient();
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [triageF, setTriageF] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [editing, setEditing] = useState<ER | null>(null);
  const [form, setForm] = useState({ full_name: "", mobile: "", gender: "male", approx_age: 30, emergency_type: "trauma", chief_complaint: "", triage: "yellow" });

  const applyDates = () => { setAppliedFrom(fromDate); setAppliedTo(toDate); };
  const resetDates = () => { setFromDate(""); setToDate(""); setAppliedFrom(""); setAppliedTo(""); };

  // Load doctors once
  useMemo(() => {
    (async () => {
      const { data } = await supabase.from("doctors").select("id, name").order("name");
      setDoctors(data ?? []);
    })();
  }, []);

  const buildBaseQuery = () => {
    // NOTE: no schema FK exists between emergency_cases.patient_id and patients,
    // so we intentionally avoid PostgREST relational embedding and hydrate
    // patient UHIDs in a second call below.
    let query = (supabase as any)
      .from("emergency_cases")
      .select("*");
    if (status !== "all") query = query.eq("status", status);
    if (triageF !== "all") query = query.eq("triage", triageF);
    if (appliedFrom) query = query.gte("arrival_time", new Date(appliedFrom).toISOString());
    if (appliedTo) {
      const end = new Date(appliedTo); end.setHours(23, 59, 59, 999);
      query = query.lte("arrival_time", end.toISOString());
    }
    return query;
  };

  const { data: cases = [], isFetching, refetch, error } = useQuery({
    queryKey: ["emergency_cases", status, triageF, appliedFrom, appliedTo],
    queryFn: async () => {
      const { data, error } = await buildBaseQuery()
        .order("arrival_time", { ascending: false })
        .limit(500);
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[emergency] load failed", error);
        throw error;
      }
      const rows = (data ?? []) as ER[];
      const ids = Array.from(new Set(rows.map(r => r.patient_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: pats } = await supabase.from("patients").select("id, uhid").in("id", ids);
        const map = new Map((pats ?? []).map((p: any) => [p.id, p]));
        rows.forEach(r => { if (r.patient_id && map.has(r.patient_id)) r.patients = map.get(r.patient_id) as any; });
      }
      return rows;
    },
  });

  if (error) {
    // surface once
    // toast.error handles dedupe internally
    toast.error((error as any)?.message ?? "Failed to load emergency cases");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.full_name, c.emergency_no, c.mobile, c.patients?.uhid, c.emergency_type, c.chief_complaint]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [cases, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["emergency_cases"] });
    qc.invalidateQueries({ queryKey: ["patients-dash"] });
    qc.invalidateQueries({ queryKey: ["patients"] });
  };

  /** Find patient by mobile or create a new one, return patient id. */
  async function linkOrCreatePatient(payload: { full_name: string; mobile: string; gender: string; approx_age: number }) {
    const mobile = payload.mobile?.trim();
    if (mobile) {
      const { data } = await supabase.from("patients").select("id").eq("mobile", mobile).limit(1).maybeSingle();
      if (data?.id) return data.id as string;
    }
    const dob = payload.approx_age
      ? new Date(new Date().getFullYear() - payload.approx_age, 0, 1).toISOString().slice(0, 10)
      : null;
    const user = (await supabase.auth.getUser()).data.user;
    const { data: newP, error } = await (supabase as any)
      .from("patients")
      .insert({
        full_name: payload.full_name,
        mobile: mobile || null,
        gender: payload.gender,
        dob,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("Auto-create patient failed:", error.message);
      return null;
    }
    return newP?.id ?? null;
  }

  async function submit() {
    if (!form.full_name.trim()) return toast.error("Name required");
    const user = (await supabase.auth.getUser()).data.user;
    const patient_id = await linkOrCreatePatient(form);
    const { data: inserted, error } = await (supabase as any)
      .from("emergency_cases")
      .insert({ ...form, patient_id, created_by: user?.id } as any)
      .select("id, emergency_no")
      .single();
    if (error) return toast.error(error.message);
    await logAudit({ action: "create", entity: "emergency_cases", entityId: inserted?.id, after: { ...form, patient_id } });
    toast.success(`Emergency registered · ${inserted?.emergency_no ?? ""}`);
    setOpen(false);
    setForm({ full_name: "", mobile: "", gender: "male", approx_age: 30, emergency_type: "trauma", chief_complaint: "", triage: "yellow" });
    invalidate();
  }

  async function updateStatus(id: string, newStatus: string) {
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "in_treatment") patch.treatment_start = new Date().toISOString();
    if (newStatus === "discharged" || newStatus === "admitted") patch.treatment_end = new Date().toISOString();
    const { error } = await (supabase as any).from("emergency_cases").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "emergency_cases", entityId: id, after: patch });
    invalidate();
  }

  async function saveEdit() {
    if (!editing) return;
    const patch: Record<string, unknown> = {
      triage: editing.triage,
      emergency_type: editing.emergency_type,
      status: editing.status,
      attending_doctor_id: editing.attending_doctor_id || null,
      notes: editing.notes,
      arrival_time: editing.arrival_time,
    };
    const { error } = await (supabase as any).from("emergency_cases").update(patch).eq("id", editing.id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "emergency_cases", entityId: editing.id, after: patch });
    toast.success("Emergency updated");
    setEditing(null);
    invalidate();
  }

  async function removeCase(c: ER) {
    const { error } = await (supabase as any).from("emergency_cases").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entity: "emergency_cases", entityId: c.id, before: c });
    toast.success("Deleted");
    invalidate();
  }

  async function getHospitalName(): Promise<string> {
    try {
      const { data } = await (supabase as any)
        .from("hospital_settings")
        .select("hospital_name")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      return data?.hospital_name || BRAND.name;
    } catch { return BRAND.name; }
  }

  function mapRow(c: ER) {
    return {
      "Emergency ID": c.emergency_no ?? "—",
      UHID: c.patients?.uhid ?? "—",
      "Patient Name": c.full_name ?? "—",
      Mobile: c.mobile ?? "—",
      Gender: c.gender ?? "—",
      Age: c.approx_age ?? "—",
      Triage: (c.triage ?? "—").toUpperCase(),
      Type: c.emergency_type ?? "—",
      "Chief Complaint": c.chief_complaint ?? "—",
      "Arrival Time": c.arrival_time ? format(new Date(c.arrival_time), "dd-MM-yyyy HH:mm") : "—",
      Status: c.status ?? "—",
    };
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadCsv() {
    const hospital = await getHospitalName();
    const rows = filtered.map(mapRow);
    if (!rows.length) return toast.error("No records to export");
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [esc(hospital), headers.join(","), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(","))];
    triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `Emergency_Export_${format(new Date(), "dd-MM-yyyy")}.csv`);
    logAudit({ action: "export", entity: "emergency_cases", after: { format: "csv", count: rows.length } });
    toast.success(`Exported ${rows.length} cases`);
  }

  async function downloadXlsx() {
    const hospital = await getHospitalName();
    const rows = filtered.map(mapRow);
    if (!rows.length) return toast.error("No records to export");
    const headers = Object.keys(rows[0]);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Emergency");
    ws.mergeCells(1, 1, 1, headers.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = hospital;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center" };
    ws.addRow(headers).font = { bold: true };
    for (const r of rows) ws.addRow(headers.map((h) => (r as any)[h]));
    ws.columns.forEach((c, i) => { c.width = Math.max(12, (headers[i]?.length ?? 10) + 4); });
    const buf = await wb.xlsx.writeBuffer();
    triggerDownload(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Emergency_Export_${format(new Date(), "dd-MM-yyyy")}.xlsx`,
    );
    logAudit({ action: "export", entity: "emergency_cases", after: { format: "xlsx", count: rows.length } });
    toast.success(`Exported ${rows.length} cases`);
  }

  async function downloadPdf() {
    const hospital = await getHospitalName();
    const rows = filtered.map(mapRow);
    if (!rows.length) return toast.error("No records to export");
    const headers = Object.keys(rows[0]);
    const w = window.open("", "_blank"); if (!w) return;
    const style = `body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:18px;margin:0 0 4px}h2{font-size:12px;color:#555;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}`;
    w.document.write(`<html><head><title>Emergency Report — ${format(new Date(), "dd-MM-yyyy")}</title><style>${style}</style></head><body>
      <h1>${hospital}</h1>
      <h2>Emergency Cases Report · Generated ${format(new Date(), "dd MMM yyyy HH:mm")} · ${rows.length} records</h2>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${String((r as any)[h] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
    logAudit({ action: "export", entity: "emergency_cases", after: { format: "pdf", count: rows.length } });
  }

  function printCase(c: ER) {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<pre style="font-family:sans-serif;padding:24px;white-space:pre-wrap">Emergency Case Slip
ER No: ${c.emergency_no}
Patient: ${c.full_name}
UHID: ${c.patients?.uhid ?? "—"}
Gender/Age: ${c.gender ?? "—"}, ${c.approx_age ?? "—"}y
Mobile: ${c.mobile ?? "—"}
Triage: ${(c.triage ?? "").toUpperCase()}
Type: ${c.emergency_type ?? "—"}
Chief Complaint: ${c.chief_complaint ?? "—"}
Arrival: ${format(new Date(c.arrival_time), "dd MMM yyyy HH:mm")}
Status: ${c.status}</pre>`);
    w.document.close(); w.focus(); w.print();
  }

  const waiting = cases.filter((c) => c.status === "waiting").length;
  const critical = cases.filter((c) => c.triage === "red" && c.status !== "discharged").length;
  const active = cases.filter((c) => ["waiting", "in_treatment"].includes(c.status)).length;
  const todayCount = cases.filter((c) => new Date(c.arrival_time).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Siren className="size-6 text-destructive" /> Emergency & Casualty</h1>
          <p className="text-sm text-muted-foreground">Fast-track registration and triage. {filtered.length} of {cases.length} shown.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="size-4 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={downloadXlsx}><FileSpreadsheet className="size-4 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}><Printer className="size-4 mr-1.5" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="size-4 mr-1.5" />Import</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-destructive hover:bg-destructive/90"><Plus className="size-4" /> Quick Register</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Emergency Registration</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                <div><Label>Age</Label><Input type="number" value={form.approx_age} onChange={(e) => setForm({ ...form, approx_age: Number(e.target.value) })} /></div>
                <div><Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Triage</Label>
                  <Select value={form.triage} onValueChange={(v) => setForm({ ...form, triage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red — Critical</SelectItem>
                      <SelectItem value="orange">Orange — Urgent</SelectItem>
                      <SelectItem value="yellow">Yellow — Semi-Urgent</SelectItem>
                      <SelectItem value="green">Green — Stable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Emergency Type</Label><Input value={form.emergency_type} onChange={(e) => setForm({ ...form, emergency_type: e.target.value })} placeholder="trauma / cardiac / poisoning ..." /></div>
                <div className="col-span-2"><Label>Chief Complaint</Label><Input value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Register</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Clock />} label="Waiting" value={waiting} />
        <Stat icon={<AlertOctagon />} label="Critical (Red)" value={critical} />
        <Stat icon={<Activity />} label="Active Cases" value={active} />
        <Stat icon={<Siren />} label="Today Total" value={todayCount} />
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center gap-3">
          <CardTitle className="text-base">Active Casualty Board</CardTitle>
          <div className="flex flex-wrap gap-2 md:ml-auto items-end">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36" />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={applyDates}>Apply</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={resetDates}>Reset</Button>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={triageF} onValueChange={setTriageF}>
              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Triage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triage</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="orange">Orange</SelectItem>
                <SelectItem value="yellow">Yellow</SelectItem>
                <SelectItem value="green">Green</SelectItem>
              </SelectContent>
            </Select>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search name, ER no, UHID, complaint..."
              className="w-full md:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ER No</TableHead><TableHead>Patient</TableHead><TableHead>Triage</TableHead><TableHead>Type</TableHead><TableHead>Arrival</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{isFetching ? "Loading…" : cases.length === 0 ? "No emergency cases" : "No matches for current filters"}</TableCell></TableRow>}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.emergency_no}</TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1.5">
                      {c.full_name || "—"}
                      {c.patients?.id && (
                        <Link
                          to="/patients/$id"
                          params={{ id: c.patients.id }}
                          title="View patient profile"
                          className="text-primary hover:text-primary/80"
                        >
                          <User className="size-3.5" />
                        </Link>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.gender ?? "—"}, {c.approx_age ?? "—"}y
                      {c.patients?.uhid ? ` · ${c.patients.uhid}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{c.triage && <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${triageColor[c.triage]}`}>{c.triage}</span>}</TableCell>
                  <TableCell className="text-sm">{c.emergency_type ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDistanceToNow(new Date(c.arrival_time), { addSuffix: true })}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.status === "waiting" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "in_treatment")}>Treat</Button>}
                      {c.status === "in_treatment" && <>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "admitted")}>Admit</Button>
                        <Button size="sm" onClick={() => updateStatus(c.id, "discharged")}>Discharge</Button>
                      </>}
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...c })} title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      <RecordActions
                        size="sm"
                        deleteLabel={`emergency case ${c.emergency_no}`}
                        onPrint={() => printCase(c)}
                        onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Emergency Case", {
                          ER: c.emergency_no,
                          Patient: c.full_name,
                          UHID: c.patients?.uhid,
                          Triage: (c.triage ?? "").toUpperCase(),
                          Type: c.emergency_type ?? "—",
                          Status: c.status,
                          Arrival: format(new Date(c.arrival_time), "dd MMM HH:mm"),
                        }), undefined, c.mobile ?? undefined)}
                        onDelete={() => removeCase(c)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Emergency — {editing?.emergency_no}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Triage</Label>
                <Select value={editing.triage ?? ""} onValueChange={(v) => setEditing({ ...editing, triage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red — Critical</SelectItem>
                    <SelectItem value="orange">Orange — Urgent</SelectItem>
                    <SelectItem value="yellow">Yellow — Semi-Urgent</SelectItem>
                    <SelectItem value="green">Green — Stable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="in_treatment">In treatment</SelectItem>
                    <SelectItem value="admitted">Admitted</SelectItem>
                    <SelectItem value="discharged">Discharged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Type</Label>
                <Input value={editing.emergency_type ?? ""} onChange={(e) => setEditing({ ...editing, emergency_type: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Attending Doctor</Label>
                <Select value={editing.attending_doctor_id ?? "__none"} onValueChange={(v) => setEditing({ ...editing, attending_doctor_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {doctors.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Arrival Time</Label>
                <Input
                  type="datetime-local"
                  value={editing.arrival_time ? new Date(editing.arrival_time).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, arrival_time: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DataImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Emergency Cases"
        templateName="Emergency_Import_Template"
        helperText="Duplicates checked by mobile — matching patients are reused; new mobiles create a patient record with auto UHID."
        columns={[
          { key: "Patient Name", required: true, example: "Ramesh Kumar" },
          { key: "Mobile", example: "9876543210" },
          { key: "Gender", example: "male" },
          { key: "Age", aliases: ["Approx Age"], example: "42" },
          { key: "Triage", example: "yellow" },
          { key: "Type", aliases: ["Emergency Type"], example: "trauma" },
          { key: "Arrival Date", aliases: ["Arrival Time"], example: "2025-01-15 10:30" },
          { key: "Complaint", aliases: ["Chief Complaint"], example: "chest pain" },
          { key: "Status", example: "waiting" },
        ]}
        onImport={async (rows) => {
          const user = (await supabase.auth.getUser()).data.user;
          let inserted = 0, skipped = 0, failed = 0;
          for (const r of rows) {
            try {
              const pid = await linkOrCreatePatient({
                full_name: r["Patient Name"],
                mobile: r["Mobile"] ?? "",
                gender: (r["Gender"] || "other").toLowerCase(),
                approx_age: Number(r["Age"]) || 0,
              });
              const arrival = r["Arrival Date"] ? new Date(r["Arrival Date"]) : new Date();
              const triage = (r["Triage"] || "yellow").toLowerCase();
              const validTriage = ["red", "orange", "yellow", "green"].includes(triage) ? triage : "yellow";
              const statusVal = (r["Status"] || "waiting").toLowerCase().replace(/\s+/g, "_");
              const validStatus = ["waiting", "in_treatment", "admitted", "discharged"].includes(statusVal) ? statusVal : "waiting";
              const { error } = await (supabase as any).from("emergency_cases").insert({
                full_name: r["Patient Name"],
                mobile: r["Mobile"] || null,
                gender: (r["Gender"] || "other").toLowerCase(),
                approx_age: Number(r["Age"]) || null,
                emergency_type: r["Type"] || null,
                chief_complaint: r["Complaint"] || null,
                triage: validTriage,
                status: validStatus,
                arrival_time: isNaN(arrival.getTime()) ? new Date().toISOString() : arrival.toISOString(),
                patient_id: pid,
                created_by: user?.id,
              });
              if (error) { failed++; console.warn("[er-import]", error.message); } else inserted++;
            } catch (e) { failed++; console.warn("[er-import]", e); }
          }
          await logAudit({ action: "import", entity: "emergency_cases", after: { inserted, skipped, failed } });
          invalidate();
          return { inserted, skipped, failed };
        }}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-5 flex items-center gap-3">
      <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </CardContent></Card>
  );
}
