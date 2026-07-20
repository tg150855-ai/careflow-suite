import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ModuleActionBar } from "@/components/common/action-bar";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { exportCsv, exportXlsx, printPage, downloadAsPdf } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { RecordActions } from "@/components/common/record-actions";

export const Route = createFileRoute("/_authenticated/dialysis")({ component: DialysisPage });

type StatusFilter = "all" | "scheduled" | "in_progress" | "completed" | "cancelled";

function DialysisPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const { range, preset, setPreset } = useDateRange("month");

  const load = () => {
    supabase.from("dialysis_sessions" as any).select("*, patients(full_name, uhid, mobile), doctors(name)")
      .order("session_date", { ascending: false }).limit(500)
      .then(({ data }) => setSessions(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
    supabase.from("doctors").select("id, name").order("name").then(({ data }) => setDoctors(data ?? []));
  }, []);

  const update = async (id: string, patch: any) => {
    await supabase.from("dialysis_sessions" as any).update(patch).eq("id", id);
    load();
  };

  const inRange = (d?: string | null) => {
    if (!d || preset === "all") return true;
    const t = new Date(d).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  };

  const filtered = useMemo(() => sessions.filter((s) => {
    if (statusF !== "all" && s.status !== statusF) return false;
    if (!inRange(s.session_date)) return false;
    if (search) {
      const hay = `${s.patients?.full_name ?? ""} ${s.patients?.uhid ?? ""} ${s.machine_no ?? ""} ${s.doctors?.name ?? ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [sessions, search, statusF, range, preset]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  function exportRows(kind: "csv" | "xlsx") {
    const rows = filtered.map((s) => ({
      date: s.session_date, patient: s.patients?.full_name, uhid: s.patients?.uhid,
      doctor: s.doctors?.name, machine: s.machine_no, status: s.status,
      pre_weight: s.pre_weight, post_weight: s.post_weight, duration_min: s.duration_min,
    }));
    const name = `dialysis-${format(new Date(), "yyyyMMdd")}`;
    kind === "csv" ? exportCsv(rows, name) : exportXlsx(rows, name);
  }

  function whatsappSummary() {
    const txt = `Dialysis Summary (${format(new Date(), "dd MMM yyyy")})\nToday: ${sessions.filter((s) => s.session_date === todayKey).length} · In progress: ${sessions.filter((s) => s.status === "in_progress").length} · Completed: ${sessions.filter((s) => s.status === "completed").length}`;
    shareOnWhatsApp(txt);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="size-6 text-primary" /> Dialysis Center</h1>
        <p className="text-sm text-muted-foreground">Scheduling, session tracking and dialysis summaries.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's Sessions" value={sessions.filter((s) => s.session_date === todayKey).length} />
        <StatCard label="Scheduled" value={sessions.filter((s) => s.status === "scheduled").length} />
        <StatCard label="In Progress" value={sessions.filter((s) => s.status === "in_progress").length} />
        <StatCard label="Completed" value={sessions.filter((s) => s.status === "completed").length} />
      </div>

      <ModuleActionBar
        leading={<SearchBox value={search} onChange={setSearch} placeholder="Search patient, UHID, machine, doctor…" />}
        onExport={() => exportRows("csv")}
        onPrint={printPage}
        onDownloadReport={() => downloadAsPdf("Dialysis Report")}
        onWhatsAppShare={whatsappSummary}
        extra={<DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={statusF} onValueChange={(v) => setStatusF(v as StatusFilter)}>
          <TabsList className="h-8">
            {(["all", "scheduled", "in_progress", "completed", "cancelled"] as StatusFilter[]).map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs h-7 px-3 capitalize">{s.replace("_", " ")}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportRows("xlsx")}>Excel</Button>
          <NewSessionDialog patients={patients} doctors={doctors} onCreated={load} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {filtered.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.patients?.full_name} <span className="text-muted-foreground text-xs">({s.patients?.uhid})</span></div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(s.session_date), "dd MMM yyyy")} · Machine {s.machine_no ?? "—"} · Dr. {s.doctors?.name ?? "—"}
                  {s.duration_min ? ` · ${s.duration_min} min` : ""}
                </div>
                {s.follow_up_at && (
                  <div className="text-xs text-primary mt-0.5">
                    Follow-up: {format(new Date(s.follow_up_at), "dd MMM yyyy")}
                    {s.follow_up_notes ? ` — ${s.follow_up_notes}` : ""}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="capitalize">{s.status.replace("_", " ")}</Badge>
              {s.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => update(s.id, { status: "in_progress", start_time: new Date().toISOString() })}>Start</Button>}
              {s.status === "in_progress" && <Button size="sm" onClick={() => {
                const end = new Date();
                const start = s.start_time ? new Date(s.start_time) : end;
                const min = Math.round((end.getTime() - start.getTime()) / 60000);
                update(s.id, { status: "completed", end_time: end.toISOString(), duration_min: min });
              }}>Complete</Button>}
              <RecordActions
                size="icon"
                deleteLabel={`dialysis session for ${s.patients?.full_name ?? "patient"}`}
                onWhatsApp={() => shareOnWhatsApp(
                  summarizeRecord("Dialysis Session", {
                    Patient: s.patients?.full_name,
                    UHID: s.patients?.uhid,
                    Date: format(new Date(s.session_date), "dd MMM yyyy"),
                    Machine: s.machine_no ?? "—",
                    Doctor: s.doctors?.name ?? "—",
                    Status: s.status.replace("_", " "),
                  }),
                  undefined,
                  s.patients?.mobile,
                )}
                onDelete={async () => { await supabase.from("dialysis_sessions" as any).delete().eq("id", s.id); toast.success("Deleted"); load(); }}
              />
            </div>
          ))}
          {filtered.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No dialysis sessions match.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums mt-1">{value}</div></CardContent></Card>;
}

function NewSessionDialog({ patients, doctors, onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", doctor_id: "", machine_no: "DM-01", session_date: format(new Date(), "yyyy-MM-dd"), pre_weight: "", notes: "", follow_up_at: "", follow_up_notes: "" });
  const submit = async () => {
    if (!f.patient_id) return toast.error("Patient required");
    const { error } = await supabase.from("dialysis_sessions" as any).insert({
      patient_id: f.patient_id, doctor_id: f.doctor_id || null, machine_no: f.machine_no,
      session_date: f.session_date, pre_weight: f.pre_weight ? Number(f.pre_weight) : null, notes: f.notes || null,
      follow_up_at: f.follow_up_at ? new Date(f.follow_up_at).toISOString() : null,
      follow_up_notes: f.follow_up_notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Scheduled"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-2" />Schedule Session</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Dialysis Session</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Doctor</Label>
              <Select value={f.doctor_id} onValueChange={(v) => setF({ ...f, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Machine</Label><Input value={f.machine_no} onChange={(e) => setF({ ...f, machine_no: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={f.session_date} onChange={(e) => setF({ ...f, session_date: e.target.value })} /></div>
            <div><Label>Pre Weight (kg)</Label><Input type="number" step="0.1" value={f.pre_weight} onChange={(e) => setF({ ...f, pre_weight: e.target.value })} /></div>
            <div><Label>Follow-up Date</Label><Input type="date" value={f.follow_up_at} onChange={(e) => setF({ ...f, follow_up_at: e.target.value })} /></div>
            <div className="col-span-2"><Label>Follow-up Notes</Label><Input value={f.follow_up_notes} onChange={(e) => setF({ ...f, follow_up_notes: e.target.value })} placeholder="Optional notes for the follow-up visit" /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

