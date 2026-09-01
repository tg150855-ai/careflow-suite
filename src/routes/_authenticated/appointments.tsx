import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useEffect } from "react";
import { Plus, Calendar, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { fetchUnifiedDoctors, formatDoctorLabel } from "@/lib/doctors";
import { useMyHospital } from "@/lib/use-my-hospital";

export const Route = createFileRoute("/_authenticated/appointments")({ component: Appointments });

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-primary/10 text-primary",
  checked_in: "bg-accent/15 text-accent-foreground",
  waiting: "bg-warning/15 text-warning-foreground",
  completed: "bg-success/15 text-success-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function Appointments() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const qc = useQueryClient();

  const { data: appts = [] } = useQuery({
    queryKey: ["appts", date],
    queryFn: async () => {
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T23:59:59").toISOString();
      const { data } = await supabase.from("appointments")
        .select("id, scheduled_at, status, token_no, notes, patients(id, full_name, uhid, mobile), doctors(id, name, specialization)")
        .gte("scheduled_at", start).lte("scheduled_at", end)
        .order("scheduled_at");
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["appts"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground mt-1">{appts.length} scheduled · {format(new Date(date), "EEEE, dd MMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 h-10" />
          <BookDialog onCreated={() => qc.invalidateQueries({ queryKey: ["appts"] })} defaultDate={date} />
        </div>
      </div>

      <Card>
        {appts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Calendar className="size-5 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">No appointments on this date.</p>
          </div>
        ) : (
          <div className="divide-y">
            {appts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 p-4 hover:bg-surface-muted transition-colors">
                <div className="w-16 text-center shrink-0">
                  <div className="text-lg font-semibold tabular-nums">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                  {a.token_no && <div className="text-[10px] uppercase text-muted-foreground">#{a.token_no}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.patients?.full_name} <span className="text-xs text-muted-foreground font-mono ml-1">{a.patients?.uhid}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{a.doctors?.name} · {a.doctors?.specialization}</div>
                </div>
                <Badge className={`${STATUS_COLORS[a.status]} capitalize border-0`}>{a.status.replace("_"," ")}</Badge>
                <Select value={a.status} onValueChange={(v) => setStatus(a.id, v)}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["booked","checked_in","waiting","completed","cancelled"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function getNextSlot(dateStr: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  if (dateStr === today) {
    const now = new Date();
    const minutes = now.getMinutes();
    const rounded = Math.ceil((minutes + 5) / 15) * 15;
    now.setMinutes(rounded, 0, 0);
    return format(now, "HH:mm");
  }
  return "10:00";
}

function isPastBooking(dateStr: string, timeStr: string): boolean {
  if (!dateStr || !timeStr) return false;
  const sched = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(sched.getTime())) return false;
  const now = new Date();
  now.setMinutes(now.getMinutes() - 2);
  return sched < now;
}

function BookDialog({ onCreated, defaultDate }: { onCreated: () => void; defaultDate: string }) {
  const { user } = useAuth();
  const { hospital } = useMyHospital();
  const hospitalId = hospital?.id ?? null;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const initialDate = defaultDate && defaultDate >= todayStr ? defaultDate : todayStr;

  const [open, setOpen] = useState(false);
  const [patientQ, setPatientQ] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [bookDate, setBookDate] = useState(initialDate);
  const [time, setTime] = useState(() => getNextSlot(initialDate));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isPast = useMemo(() => isPastBooking(bookDate, time), [bookDate, time]);

  useEffect(() => {
    if (open) {
      const targetDate = defaultDate && defaultDate >= todayStr ? defaultDate : todayStr;
      setBookDate(targetDate);
      setTime(getNextSlot(targetDate));
    }
  }, [open, defaultDate, todayStr]);

  const { data: patients = [] } = useQuery({
    queryKey: ["patient-search", patientQ],
    queryFn: async () => {
      if (patientQ.length < 2) return [];
      const { data } = await supabase.from("patients").select("id, full_name, uhid, mobile").or(`full_name.ilike.%${patientQ}%,mobile.ilike.%${patientQ}%,uhid.ilike.%${patientQ}%`).limit(8);
      return data ?? [];
    },
    enabled: open,
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors", hospitalId],
    queryFn: () => fetchUnifiedDoctors(hospitalId),
    enabled: open,
  });

  async function book() {
    if (!patientId || !doctorId || !time) return toast.error("Patient, doctor and time required");
    if (isPast) {
      return toast.error("Cannot book appointment for a past date or time", {
        description: "Please select a future time slot.",
      });
    }
    setSaving(true);
    const scheduled_at = new Date(`${bookDate}T${time}:00`).toISOString();
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId, doctor_id: doctorId, scheduled_at, notes: notes || null, created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment booked successfully");
    setOpen(false);
    setPatientId(""); setPatientQ(""); setNotes("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-2" />Book appointment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Book appointment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Patient</Label>
            <Input value={patientQ} onChange={(e) => { setPatientQ(e.target.value); setPatientId(""); }} placeholder="Search by name, mobile, UHID" />
            {patientId && (
              <div className="text-xs text-success-foreground bg-success/10 rounded-lg px-2 py-1.5 mt-1">
                Selected: {patients.find((p) => p.id === patientId)?.full_name}
              </div>
            )}
            {!patientId && patients.length > 0 && (
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {patients.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPatientId(p.id)} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {formatDoctorLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input
                type="date"
                min={todayStr}
                value={bookDate}
                onChange={(e) => {
                  const d = e.target.value;
                  setBookDate(d);
                  if (d === todayStr && isPastBooking(d, time)) {
                    setTime(getNextSlot(d));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>

            {isPast && (
              <div className="col-span-2 text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg font-medium">
                <AlertCircle className="size-4 shrink-0" />
                Selected date/time is in the past. Please choose a future time slot.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Chief complaint" />
          </div>

          <Button onClick={book} className="w-full" size="lg" disabled={saving || isPast}>
            {saving ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
