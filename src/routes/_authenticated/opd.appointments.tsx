import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  CalendarPlus, CalendarDays, Search, Clock, Pencil, X, Stethoscope,
  FileText, IndianRupee, Activity, History, ChevronRight, User2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/opd/appointments")({
  component: OpdAppointments,
});

const STATUSES = ["booked", "checked_in", "waiting", "completed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_TONE: Record<Status, string> = {
  booked: "bg-muted text-muted-foreground",
  checked_in: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

function OpdAppointments() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [doctorId, setDoctorId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: doctors = [] } = useQuery({
    queryKey: ["opd-appts-doctors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, name, specialization")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["opd-appts", date],
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`).toISOString();
      const end = new Date(`${date}T23:59:59`).toISOString();
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, token_no, notes, doctor_id, patient_id, patients(id, full_name, uhid, mobile), doctors(id, name, specialization)"
        )
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (appts as any[]).filter((a) => {
      if (doctorId !== "all" && a.doctor_id !== doctorId) return false;
      if (status !== "all" && a.status !== status) return false;
      if (!q) return true;
      const blob = `${a.patients?.full_name ?? ""} ${a.patients?.uhid ?? ""} ${a.patients?.mobile ?? ""} ${a.doctors?.name ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [appts, doctorId, status, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appts.length };
    for (const s of STATUSES) c[s] = 0;
    for (const a of appts as any[]) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [appts]);

  const selected = useMemo(
    () => (filtered.find((a: any) => a.id === selectedId) ?? null) as any,
    [filtered, selectedId]
  );

  async function setApptStatus(id: string, next: Status) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: next as any })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["opd-appts"] });
    qc.invalidateQueries({ queryKey: ["opd-dash-appts"] });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <CalendarDays className="size-4 absolute left-3 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-9 w-44 h-10"
            />
          </div>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-52 h-10">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, UHID, mobile, doctor…"
              className="pl-9 h-10"
            />
          </div>
          <BookDialog
            defaultDate={date}
            doctors={doctors as any[]}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["opd-appts"] });
              qc.invalidateQueries({ queryKey: ["opd-dash-appts"] });
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <StatChip label="Total" value={counts.all} active={status === "all"} onClick={() => setStatus("all")} />
          {STATUSES.map((s) => (
            <StatChip
              key={s}
              label={s.replace("_", " ")}
              value={counts[s] ?? 0}
              tone={STATUS_TONE[s]}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          ))}
        </div>
      </Card>

      {/* Body */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* List */}
        <Card className="lg:col-span-3 p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <CalendarDays className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No appointments match the current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[calc(100vh-22rem)] overflow-y-auto">
              {filtered.map((a: any) => {
                const active = a.id === selectedId;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      active ? "bg-primary/5" : "hover:bg-surface-muted"
                    }`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <div className="w-14 text-center shrink-0">
                      <div className="text-base font-semibold tabular-nums">
                        {format(new Date(a.scheduled_at), "HH:mm")}
                      </div>
                      {a.token_no ? (
                        <div className="text-[10px] uppercase text-muted-foreground">
                          #{a.token_no}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.patients?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.patients?.uhid} · {a.doctors?.name}
                        {a.doctors?.specialization ? ` (${a.doctors.specialization})` : ""}
                      </div>
                    </div>
                    <Badge variant="secondary" className={`${STATUS_TONE[a.status as Status]} border-0 capitalize`}>
                      {a.status.replace("_", " ")}
                    </Badge>
                    <Select
                      value={a.status}
                      onValueChange={(v) => setApptStatus(a.id, v as Status)}
                    >
                      <SelectTrigger
                        className="w-32 h-8 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(a);
                      }}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Detail / timeline */}
        <div className="lg:col-span-2">
          {selected ? (
            <AppointmentDetail appointment={selected} onEdit={() => setEditing(selected)} />
          ) : (
            <Card className="p-10 text-center">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <User2 className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Select an appointment to view the patient timeline.
              </p>
            </Card>
          )}
        </div>
      </div>

      {editing && (
        <EditDialog
          appointment={editing}
          doctors={doctors as any[]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["opd-appts"] });
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Stat chip ─────────────────────── */
function StatChip({
  label, value, active, tone, onClick,
}: { label: string; value: number; active?: boolean; tone?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-muted"
      }`}
    >
      <span className={`inline-block size-1.5 rounded-full mr-1.5 align-middle ${tone ?? "bg-muted"}`} />
      {label} <span className="font-semibold tabular-nums ml-1">{value}</span>
    </button>
  );
}

/* ─────────────────────── Book dialog ─────────────────────── */
function BookDialog({
  defaultDate, doctors, onCreated,
}: { defaultDate: string; doctors: any[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [patientQ, setPatientQ] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ["opd-appts-patient-search", patientQ],
    enabled: open && patientQ.trim().length >= 2,
    queryFn: async () => {
      const like = `%${patientQ.trim()}%`;
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, uhid, mobile")
        .or(`full_name.ilike.${like},mobile.ilike.${like},uhid.ilike.${like}`)
        .limit(8);
      return data ?? [];
    },
  });

  function reset() {
    setPatientQ(""); setPatientId(""); setDoctorId("");
    setTime("10:00"); setNotes(""); setDate(defaultDate);
  }

  async function book() {
    if (!patientId || !doctorId || !time) {
      return toast.error("Patient, doctor and time are required");
    }
    setSaving(true);
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId,
      doctor_id: doctorId,
      scheduled_at,
      notes: notes || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment booked");
    reset();
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="ml-auto">
          <CalendarPlus className="size-4" /> Book appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Book OPD appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Patient</Label>
            <Input
              value={patientQ}
              onChange={(e) => { setPatientQ(e.target.value); setPatientId(""); }}
              placeholder="Search by name, mobile, UHID"
            />
            {patientId && (
              <div className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 rounded-lg px-2 py-1.5 mt-1">
                Selected: {(patients as any[]).find((p) => p.id === patientId)?.full_name}
              </div>
            )}
            {!patientId && (patients as any[]).length > 0 && (
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {(patients as any[]).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatientId(p.id)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm"
                  >
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.specialization ? ` · ${d.specialization}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Chief complaint / notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={book} disabled={saving}>
            {saving ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Edit dialog ─────────────────────── */
function EditDialog({
  appointment, doctors, onClose, onSaved,
}: { appointment: any; doctors: any[]; onClose: () => void; onSaved: () => void }) {
  const sched = new Date(appointment.scheduled_at);
  const [date, setDate] = useState(format(sched, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(sched, "HH:mm"));
  const [doctorId, setDoctorId] = useState<string>(appointment.doctor_id);
  const [status, setStatus] = useState<Status>(appointment.status);
  const [notes, setNotes] = useState<string>(appointment.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_at, doctor_id: doctorId, status: status as any, notes: notes || null })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment updated");
    onSaved();
  }

  async function cancel() {
    if (!confirm("Cancel this appointment?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" as any })
      .eq("id", appointment.id);
    if (error) return toast.error(error.message);
    toast.success("Appointment cancelled");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-muted/50 p-3 text-sm">
            <div className="font-medium">{appointment.patients?.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {appointment.patients?.uhid} · {appointment.patients?.mobile}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.specialization ? ` · ${d.specialization}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={cancel} className="text-rose-600">
            <X className="size-4" /> Cancel appointment
          </Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── Detail panel + timeline ─────────────────────── */
function AppointmentDetail({
  appointment, onEdit,
}: { appointment: any; onEdit: () => void }) {
  const patient = appointment.patients;
  const patientId = patient?.id;

  const { data: timeline = [], isFetching } = useQuery({
    queryKey: ["opd-patient-timeline", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const [apptsRes, visitsRes, billsRes, emrRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, scheduled_at, status, doctors(name)")
          .eq("patient_id", patientId)
          .order("scheduled_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("opd_visits")
          .select("id, created_at, chief_complaints, diagnosis, doctors(name)")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("bills")
          .select("id, bill_no, total, paid, status, created_at")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("emr_records")
          .select("id, event_date, record_type, title, summary, department")
          .eq("patient_id", patientId)
          .order("event_date", { ascending: false })
          .limit(20),
      ]);

      const items: TimelineItem[] = [];
      for (const a of (apptsRes.data ?? []) as any[]) {
        items.push({
          id: `appt-${a.id}`, kind: "appointment", date: a.scheduled_at,
          title: `Appointment · ${a.doctors?.name ?? "—"}`,
          subtitle: a.status.replace("_", " "), tone: "info",
        });
      }
      for (const v of (visitsRes.data ?? []) as any[]) {
        items.push({
          id: `visit-${v.id}`, kind: "visit", date: v.created_at,
          title: `OPD visit · ${v.doctors?.name ?? "—"}`,
          subtitle: v.diagnosis || v.chief_complaints || "Consultation recorded",
          tone: "primary",
        });
      }
      for (const b of (billsRes.data ?? []) as any[]) {
        items.push({
          id: `bill-${b.id}`, kind: "bill", date: b.created_at,
          title: `Bill ${b.bill_no} · ₹${Number(b.total ?? 0).toLocaleString("en-IN")}`,
          subtitle: `${b.status} · paid ₹${Number(b.paid ?? 0).toLocaleString("en-IN")}`,
          tone: "success",
        });
      }
      for (const e of (emrRes.data ?? []) as any[]) {
        items.push({
          id: `emr-${e.id}`, kind: "emr", date: e.event_date,
          title: e.title ?? e.record_type,
          subtitle: e.summary ?? e.department ?? "", tone: "muted",
        });
      }
      return items
        .filter((i) => i.date)
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 30);
    },
  });

  return (
    <Card className="p-5 space-y-5">
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
          {initials(patient?.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{patient?.full_name ?? "—"}</h3>
            <Badge variant="secondary">{patient?.uhid}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {patient?.mobile}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </div>

      {/* appointment summary */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <SummaryRow icon={Clock} label="Scheduled" value={format(new Date(appointment.scheduled_at), "dd MMM yyyy, HH:mm")} />
        <SummaryRow icon={Stethoscope} label="Doctor" value={appointment.doctors?.name ?? "—"} />
        <SummaryRow icon={Activity} label="Status" value={appointment.status.replace("_", " ")} capitalize />
        <SummaryRow icon={FileText} label="Notes" value={appointment.notes || "—"} />
      </div>

      <div className="flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <a href={`/opd/${appointment.id}`}>
            <Stethoscope className="size-4" /> Start / resume consultation
          </a>
        </Button>
      </div>

      {/* timeline */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Patient timeline</h4>
        </div>
        {isFetching ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : timeline.length === 0 ? (
          <div className="text-xs text-muted-foreground">No prior records.</div>
        ) : (
          <ol className="relative border-l border-border/70 ml-2 space-y-3 max-h-[24rem] overflow-y-auto pr-1">
            {timeline.map((t) => (
              <li key={t.id} className="pl-4 relative">
                <span
                  className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-2 ring-background ${toneDot(t.tone)}`}
                />
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    {t.subtitle ? (
                      <div className="text-xs text-muted-foreground line-clamp-2 capitalize">{t.subtitle}</div>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(t.date), { addSuffix: true })}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <a
        href={`/patients/${patientId}`}
        className="text-xs text-primary hover:underline inline-flex items-center"
      >
        Open full patient record <ChevronRight className="size-3" />
      </a>
    </Card>
  );
}

function SummaryRow({
  icon: Icon, label, value, capitalize,
}: { icon: any; label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </div>
      <div className={`text-sm mt-0.5 ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

type TimelineItem = {
  id: string;
  kind: "appointment" | "visit" | "bill" | "emr";
  date: string;
  title: string;
  subtitle?: string;
  tone: "primary" | "info" | "success" | "muted";
};

function toneDot(tone: TimelineItem["tone"]) {
  return {
    primary: "bg-primary",
    info: "bg-blue-500",
    success: "bg-emerald-500",
    muted: "bg-muted-foreground/40",
  }[tone];
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
