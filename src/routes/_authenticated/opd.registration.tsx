import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { ensureOpdAppointment } from "@/lib/opd-queue";
import { PatientForm, type PatientSubmission } from "@/components/patient-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, UserPlus, Phone, IdCard, CalendarPlus, PlayCircle,
  Stethoscope, Loader2, ChevronRight, History, ListChecks, Download,
  MessageCircle, Printer, Eye, ArrowRight, Trash2, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { PatientAttachments } from "@/components/patient-attachments";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp } from "@/lib/share";
import { useIsSuperAdmin } from "@/lib/use-super-admin";
import { useMyHospital } from "@/lib/use-my-hospital";

export const Route = createFileRoute("/_authenticated/opd/registration")({
  component: OpdRegistration,
});

/* ────────────────────────────── Main Layout ────────────────────────────── */

function OpdRegistration() {
  const [tab, setTab] = useState<"new" | "existing" | "list">("new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OPD Registration</h1>
        <p className="text-sm text-muted-foreground">Register new patients, search existing records, and manage the OPD daily queue.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="new" className="gap-2"><UserPlus className="size-4" /> New Patient</TabsTrigger>
          <TabsTrigger value="existing" className="gap-2"><Search className="size-4" /> Quick Search</TabsTrigger>
          <TabsTrigger value="list" className="gap-2"><ListChecks className="size-4" /> OPD List</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <NewPatientPanel onRegistered={() => setTab("list")} />
        </TabsContent>

        <TabsContent value="existing" className="mt-4">
          <ExistingPatientPanel />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <OpdListPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ────────────────────────────── New Patient ────────────────────────────── */

function NewPatientPanel({ onRegistered }: { onRegistered: () => void }) {
  const { user, hasAnyRole } = useAuth();
  const { hospital } = useMyHospital();
  const hospitalId = hospital?.id ?? null;
  const navigate = useNavigate();
  const canConsult = hasAnyRole(["doctor", "admin", "super_admin"]);

  const { data: insuranceCompanies = [] } = useQuery({
    queryKey: ["insurance-companies", "opd-registration"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insurance_companies")
        .select("id, name, policy_type")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onSubmit(payload: PatientSubmission, action?: string) {
    const mobile = String(payload.patient.mobile ?? "").trim();
    if (mobile) {
      const { data: dup } = await (supabase as any)
        .from("patients")
        .select("id, uhid, full_name")
        .eq("mobile", mobile)
        .limit(1)
        .maybeSingle();
      if (dup) {
        toast.error(`Mobile already registered to ${dup.full_name} (${dup.uhid})`);
        return;
      }
    }

    const { data, error } = await (supabase as any)
      .from("patients")
      .insert({
        ...payload.patient,
        ...(hospitalId ? { hospital_id: hospitalId } : {}),
        created_by: user?.id,
      })
      .select("id, uhid")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }

    if (payload.insurance) {
      const { error: insErr } = await (supabase as any)
        .from("patient_insurance")
        .insert({
          ...payload.insurance,
          ...(hospitalId ? { hospital_id: hospitalId } : {}),
          patient_id: data.id,
        });
      if (insErr) toast.warning(`Patient saved, insurance not saved: ${insErr.message}`);
    }

    await (supabase as any).from("emr_records").insert({
      patient_id: data.id,
      ...(hospitalId ? { hospital_id: hospitalId } : {}),
      record_type: "registration",
      title: "Patient registered (OPD)",
      summary: `UHID ${data.uhid} created via OPD registration`,
      department: "OPD",
      event_date: new Date().toISOString(),
      data: { uhid: data.uhid, by: user?.id ?? null },
    });

    await logAudit({
      action: "create",
      entity: "patients",
      entityId: data.id,
      after: payload.patient,
    });

    // Automatically enqueue patient for today's OPD visit so they appear on the OPD list and queue immediately
    let createdApptId: string | null = null;
    try {
      const { appointmentId } = await ensureOpdAppointment({ patientId: data.id, createdBy: user?.id });
      createdApptId = appointmentId;
    } catch (e: any) {
      console.warn("[opd-registration] ensureOpdAppointment fallback:", e?.message);
    }

    toast.success(`Patient registered & added to OPD queue · ${data.uhid}`);

    switch (action) {
      case "appointment":
        navigate({ to: "/appointments", search: { patientId: data.id } as any });
        return;
      case "queue":
        if (createdApptId) {
          navigate({ to: "/opd/consultation", search: { appt: createdApptId } as any });
        } else {
          onRegistered();
        }
        return;
      case "consult":
        if (createdApptId) {
          navigate({ to: "/opd/$appointmentId", params: { appointmentId: createdApptId } });
        } else {
          navigate({ to: "/patients/$id", params: { id: data.id } });
        }
        return;
      case "another":
        onRegistered();
        return;
      default:
        // Default action from OPD registration: switch to OPD List or consultation
        if (createdApptId) {
          navigate({ to: "/opd/$appointmentId", params: { appointmentId: createdApptId } });
        } else {
          navigate({ to: "/patients/$id", params: { id: data.id } });
        }
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-surface-muted/40">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IdCard className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium">Register a new OPD patient</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              A UHID is generated automatically. Mobile number is checked against existing records to avoid duplicates.
            </p>
          </div>
        </div>
      </Card>

      <PatientForm
        insuranceCompanies={insuranceCompanies}
        submitLabel="Save patient"
        actions={[
          { value: "appointment", label: "Save & book appointment", variant: "outline" },
          { value: "queue", label: "Save & add to OPD queue", variant: "outline" },
          ...(canConsult
            ? [{ value: "consult" as const, label: "Save & start consultation", variant: "outline" as const }]
            : []),
          { value: "another", label: "Save & register another", variant: "secondary" },
        ]}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/* ────────────────────────────── Existing Patient ────────────────────────────── */

function ExistingPatientPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const term = query.trim();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["opd-reg-search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const { data, error } = await (supabase as any)
        .from("patients")
        .select("id, uhid, full_name, mobile, gender, dob, blood_group, city, created_at")
        .or(`full_name.ilike.${like},mobile.ilike.${like},uhid.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = useMemo(
    () => results.find((p: any) => p.id === selectedId) ?? null,
    [results, selectedId],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Search */}
      <Card className="lg:col-span-2 p-0 overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mobile or UHID…"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {term.length < 2
              ? "Type at least 2 characters to search."
              : isFetching
                ? "Searching…"
                : `${results.length} match${results.length === 1 ? "" : "es"}`}
          </p>
        </div>

        <div className="max-h-[32rem] overflow-y-auto divide-y divide-border">
          {term.length >= 2 && !isFetching && results.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No patient found.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/opd/registration">
                  <UserPlus className="size-4" /> Register new
                </Link>
              </Button>
            </div>
          )}
          {results.map((p: any) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${
                  active ? "bg-primary/10" : "hover:bg-surface-muted"
                }`}
              >
                <div className="size-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium shrink-0">
                  {initials(p.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.uhid} · {p.mobile}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {isFetching && (
            <div className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>
      </Card>

      {/* Detail / actions */}
      <div className="lg:col-span-3">
        {selected ? (
          <PatientDetail patient={selected} />
        ) : (
          <Card className="p-10 text-center">
            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Search and select a patient to view options.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function PatientDetail({ patient }: { patient: any }) {
  const { data: lastVisit } = useQuery({
    queryKey: ["opd-reg-last-visit", patient.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("appointments")
        .select("id, scheduled_at, status, doctors(name, specialization)")
        .eq("patient_id", patient.id)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
          {initials(patient.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{patient.full_name}</h2>
            <Badge variant="secondary">{patient.uhid}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" /> {patient.mobile}
            </span>
            <span>·</span>
            <span className="capitalize">{patient.gender}</span>
            {patient.dob && (
              <>
                <span>·</span>
                <span>{ageFromDob(patient.dob)} yrs</span>
              </>
            )}
            {patient.blood_group && (
              <>
                <span>·</span>
                <span>{patient.blood_group}</span>
              </>
            )}
            {patient.city && (
              <>
                <span>·</span>
                <span>{patient.city}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {lastVisit && (
        <div className="rounded-xl border border-border bg-surface-muted/40 p-3 flex items-center gap-3">
          <History className="size-4 text-muted-foreground shrink-0" />
          <div className="text-sm min-w-0 flex-1">
            <div className="truncate">
              Last visit{" "}
              <span className="font-medium">
                {format(new Date(lastVisit.scheduled_at), "dd MMM yyyy, HH:mm")}
              </span>{" "}
              with {lastVisit.doctors?.name ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {lastVisit.doctors?.specialization ?? ""} · {lastVisit.status}
            </div>
          </div>
        </div>
      )}

      <PatientDetailActions patient={patient} />

      <div className="pt-2 border-t">
        <PatientAttachments patientId={patient.id} patient={patient} defaultDepartment="OPD" />
      </div>
    </Card>
  );
}

function PatientDetailActions({ patient }: { patient: any }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function addToQueue() {
    setBusy(true);
    try {
      const { appointmentId } = await ensureOpdAppointment({ patientId: patient.id, createdBy: user?.id });
      toast.success("Added to OPD waiting queue");
      navigate({ to: "/opd/consultation", search: { appt: appointmentId } as any });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add to queue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Button asChild>
        <Link to="/appointments" search={{ patientId: patient.id } as any}>
          <CalendarPlus className="size-4" /> Book OPD appointment
        </Link>
      </Button>
      <Button variant="secondary" onClick={addToQueue} disabled={busy}>
        <PlayCircle className="size-4" /> {busy ? "Adding…" : "Add to OPD queue"}
      </Button>
      <Button asChild variant="outline">
        <Link to="/patients/$id" params={{ id: patient.id }}>
          <Stethoscope className="size-4" /> Open patient record
        </Link>
      </Button>
      <Button asChild variant="ghost">
        <Link to="/patients/$id" params={{ id: patient.id }}>
          Edit details
        </Link>
      </Button>
    </div>
  );
}

/* ─────────────────────── OPD list (with From-To filter + export) ─────────────────────── */

function toIsoDayStart(s: string) {
  if (!s) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const parts = s.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}
function toIsoDayEnd(s: string) {
  if (!s) {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }
  const parts = s.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function todayStr() { return format(new Date(), "yyyy-MM-dd"); }

type QuickRange = "today" | "yesterday" | "week" | "month" | "custom";

function OpdListPanel() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [quick, setQuick] = useState<QuickRange>("today");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [doctorId, setDoctorId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const isAdmin = useIsSuperAdmin();

  // Realtime subscription for LAN and local updates
  useEffect(() => {
    const channel = supabase
      .channel("opd-list-realtime-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-list-panel"] });
        qc.invalidateQueries({ queryKey: ["opd-dash-appts"] });
        qc.invalidateQueries({ queryKey: ["opd-dash-active-queue"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-list-panel"] });
        qc.invalidateQueries({ queryKey: ["opd-dash-active-queue"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-list-panel"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-list-panel"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  function applyQuick(q: QuickRange) {
    setQuick(q);
    const now = new Date();
    if (q === "today") { const t = todayStr(); setFrom(t); setTo(t); }
    else if (q === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const s = format(y, "yyyy-MM-dd"); setFrom(s); setTo(s);
    } else if (q === "week") {
      const s = new Date(now); s.setDate(s.getDate() - 6);
      setFrom(format(s, "yyyy-MM-dd")); setTo(todayStr());
    } else if (q === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(format(s, "yyyy-MM-dd")); setTo(todayStr());
    }
  }

  const { data: rows = [], isFetching, isError, error, refetch } = useQuery({
    queryKey: ["opd-list-panel", from, to],
    queryFn: async () => {
      const startIso = toIsoDayStart(from);
      const endIso = toIsoDayEnd(to);

      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("id, token_no, scheduled_at, status, notes, patient_id, doctor_id, patients(id, uhid, full_name, mobile, gender, dob), doctors(id, name, specialization)")
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso)
        .order("scheduled_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[opd-list-panel] error fetching appointments:", error);
        throw error;
      }

      const list = data ?? [];
      if (list.length === 0) return [];

      // Fetch bills for patient IDs present in the list
      const patientIds = Array.from(new Set(list.map((r: any) => r.patient_id).filter(Boolean)));
      const billsMap: Record<string, any> = {};

      if (patientIds.length > 0) {
        try {
          const { data: billsData } = await (supabase as any)
            .from("bills")
            .select("id, bill_no, total, paid, pending, status, patient_id, created_at")
            .in("patient_id", patientIds)
            .order("created_at", { ascending: false });

          if (billsData) {
            for (const b of billsData) {
              if (b.patient_id && !billsMap[b.patient_id]) {
                billsMap[b.patient_id] = b;
              }
            }
          }
        } catch (err) {
          console.warn("[opd-list-panel] could not fetch bills:", err);
        }
      }

      return list.map((r: any) => ({
        ...r,
        bills: billsMap[r.patient_id] ? [billsMap[r.patient_id]] : [],
      }));
    },
    refetchInterval: 10000,
  });

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows as any[]) if (r.doctor_id && r.doctors?.name) map.set(r.doctor_id, r.doctors.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows as any[]).filter((r) => {
      if (doctorId !== "all" && r.doctor_id !== doctorId) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.patients?.full_name?.toLowerCase().includes(s) ||
        r.patients?.uhid?.toLowerCase().includes(s) ||
        r.patients?.mobile?.toLowerCase().includes(s) ||
        (r.token_no !== null && String(r.token_no).includes(s)) ||
        r.doctors?.name?.toLowerCase().includes(s));
    });
  }, [rows, search, doctorId, statusFilter]);

  async function removeVisit(r: any) {
    if (!window.confirm(`Delete OPD visit of ${r.patients?.full_name ?? "patient"}? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("appointments").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entity: "appointments", entityId: r.id, before: r });
    toast.success("OPD visit deleted");
    refetch();
  }


  const summary = useMemo(() => {
    const total = filtered.length;
    let billed = 0, pending = 0;
    for (const r of filtered) {
      const bill = (r.bills?.[0] ?? r.bills) as any;
      if (bill) {
        if (Number(bill.pending ?? 0) === 0 && Number(bill.total ?? 0) > 0) billed++;
        else pending++;
      } else pending++;
    }
    return { total, billed, pending };
  }, [filtered]);

  function ageYears(dob?: string | null) {
    if (!dob) return "—";
    try { return String(new Date().getFullYear() - new Date(dob).getFullYear()); } catch { return "—"; }
  }
  function billStatusLabel(r: any) {
    const bill = (r.bills?.[0] ?? r.bills) as any;
    if (!bill) return "No bill";
    return bill.status === "paid" ? "Paid" : bill.status === "partial" ? "Partial" : "Pending";
  }
  function consultationStatusLabel(r: any) {
    return r.status === "completed" ? "Completed"
      : r.status === "in_consultation" ? "In consult"
      : r.status === "cancelled" ? "Cancelled" : "Waiting";
  }

  function onExport() {
    const rowsOut = filtered.map((r: any) => ({
      Token: r.token_no ?? "—",
      Patient: r.patients?.full_name ?? "—",
      UHID: r.patients?.uhid ?? "—",
      Mobile: r.patients?.mobile ?? "—",
      "Age/Gender": `${ageYears(r.patients?.dob)}/${r.patients?.gender ?? "—"}`,
      Doctor: r.doctors?.name ?? "—",
      "Visit Date/Time": format(new Date(r.scheduled_at), "dd MMM yyyy HH:mm"),
      Consultation: consultationStatusLabel(r),
      Billing: billStatusLabel(r),
    }));
    exportXlsx(rowsOut, `OPD_Patients_${from}_to_${to}`);
  }

  function whatsapp(r: any) {
    const phone = r.patients?.mobile;
    if (!phone) return toast.info("Patient has no mobile number");
    shareOnWhatsApp(`Dear ${r.patients?.full_name}, this is a message from your OPD visit on ${format(new Date(r.scheduled_at), "dd MMM yyyy")}.`, undefined, phone);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">From</div>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setQuick("custom"); }} className="h-9 w-[150px]" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">To</div>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setQuick("custom"); }} className="h-9 w-[150px]" />
          </div>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => { applyQuick("today"); }}>Reset</Button>
          <div className="mx-2 h-6 w-px bg-border" />
          {(["today", "yesterday", "week", "month"] as QuickRange[]).map((q) => (
            <Button key={q} size="sm" variant={quick === q ? "default" : "outline"} onClick={() => applyQuick(q)}>
              {q === "today" ? "Today" : q === "yesterday" ? "Yesterday" : q === "week" ? "This Week" : "This Month"}
            </Button>
          ))}
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All doctors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctorOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="in_consultation">In consultation</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">

            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name / UHID / mobile / doctor" className="h-9 pl-8 w-[260px]" />
            </div>
            <Button size="sm" variant="outline" onClick={onExport}><Download className="size-3.5 mr-1" />Export</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing <b>{summary.total}</b> patient{summary.total === 1 ? "" : "s"} from <b>{from}</b> to <b>{to}</b> · Billed: <b>{summary.billed}</b> · Pending: <b>{summary.pending}</b>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Token</th>
                <th className="text-left px-3 py-2">Patient</th>
                <th className="text-left px-3 py-2">UHID</th>
                <th className="text-left px-3 py-2">Mobile</th>
                <th className="text-left px-3 py-2">Age/Sex</th>
                <th className="text-left px-3 py-2">Doctor</th>
                <th className="text-left px-3 py-2">Visit</th>
                <th className="text-left px-3 py-2">Consult</th>
                <th className="text-left px-3 py-2">Billing</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10 text-muted-foreground text-sm">
                  {isFetching ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin text-primary" /> Loading OPD visits…
                    </div>
                  ) : isError ? (
                    <div className="space-y-2 text-destructive">
                      <div>Failed to load OPD visits.</div>
                      <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
                    </div>
                  ) : (
                    "No OPD patients found in this date range."
                  )}
                </td></tr>
              )}
              {filtered.map((r: any) => {
                const bill = (r.bills?.[0] ?? r.bills) as any;
                const consultLabel = consultationStatusLabel(r);
                const billLabel = billStatusLabel(r);
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">#{r.token_no ?? "—"}</td>
                    <td className="px-3 py-2 font-medium truncate max-w-[200px]">{r.patients?.full_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.patients?.uhid ?? "—"}</td>
                    <td className="px-3 py-2">{r.patients?.mobile ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{ageYears(r.patients?.dob)}/{r.patients?.gender ?? "—"}</td>
                    <td className="px-3 py-2 truncate max-w-[160px]">{r.doctors?.name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{format(new Date(r.scheduled_at), "dd MMM HH:mm")}</td>
                    <td className="px-3 py-2"><Badge variant={consultLabel === "Completed" ? "default" : "secondary"} className="text-[10px]">{consultLabel}</Badge></td>
                    <td className="px-3 py-2"><Badge variant={billLabel === "Paid" ? "default" : billLabel === "Partial" ? "secondary" : "outline"} className="text-[10px]">{billLabel}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5 justify-end">
                        <Button asChild size="icon" variant="ghost" className="size-7" title="Open consultation">
                          <Link to="/opd/$appointmentId" params={{ appointmentId: r.id }}><Eye className="size-3.5" /></Link>
                        </Button>
                        {bill?.id && (
                          <Button asChild size="icon" variant="ghost" className="size-7" title="Print bill">
                            <a href={`/billing/${bill.id}`} target="_blank" rel="noreferrer"><Printer className="size-3.5" /></a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="size-7" title="WhatsApp patient" onClick={() => whatsapp(r)}>
                          <MessageCircle className="size-3.5" />
                        </Button>
                        <Button asChild size="icon" variant="ghost" className="size-7" title="Edit patient details">
                          <Link to="/patients/$id" params={{ id: r.patient_id }}><Pencil className="size-3.5" /></Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" className="size-7" title="Open patient record">

                          <Link to="/patients/$id" params={{ id: r.patient_id }}><ArrowRight className="size-3.5" /></Link>
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Delete OPD visit" onClick={() => removeVisit(r)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>

                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────── utils ────────────────────────────── */

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ageFromDob(dob: string) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}
