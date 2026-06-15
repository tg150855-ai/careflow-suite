import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Plus,
  Stethoscope,
  Pill,
  FlaskConical,
  Scan,
  BedDouble,
  Activity,
  Receipt,
  FileText,
  Printer,
  HeartPulse,
  Calendar,
  Clock,
  ShieldAlert,
  Download,
  Filter,
  Pencil,
} from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { inr } from "@/lib/format";
import { PatientForm, type PatientSubmission } from "@/components/patient-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
  component: PatientWorkspace,
});

type TimelineEvent = {
  id: string;
  kind: string;
  at: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href?: { to: string; params?: any };
};

function PatientWorkspace() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (search.edit === "1") setEditOpen(true);
  }, [search.edit]);

  // Audit: opening a patient record
  useEffect(() => {
    logAudit({ action: "view", entity: "patients", entityId: id });
  }, [id]);

  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () =>
      (await supabase.from("patients").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: insuranceRows = [] } = useQuery({
    queryKey: ["patient-insurance", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("patient_insurance")
        .select("*")
        .eq("patient_id", id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: insuranceCompanies = [] } = useQuery({
    queryKey: ["insurance-companies", "patient-workspace"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("insurance_companies")
        .select("id, name, policy_type")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: bundle } = useQuery({
    queryKey: ["patient-workspace", id],
    queryFn: async () => {
      const sb = supabase as any;
      const [
        appts,
        visits,
        admissions,
        bills,
        payments,
        sales,
        labs,
        labResults,
        rx,
        rxItems,
        rad,
        radReports,
        surgeries,
        vitals,
        icu,
        icuAlerts,
        alerts,
        claims,
        docs,
        medsAdmin,
      ] = await Promise.all([
        sb
          .from("appointments")
          .select("id, scheduled_at, status, doctors(name)")
          .eq("patient_id", id)
          .order("scheduled_at", { ascending: false })
          .limit(100),
        sb
          .from("opd_visits")
          .select(
            "id, diagnosis, chief_complaints, symptoms, clinical_findings, notes, created_at, follow_up_date, doctors(name)",
          )
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("admissions")
          .select(
            "id, admission_no, admitted_at, discharged_at, reason, initial_diagnosis, status, is_emergency, doctors(name), wards(name), beds(bed_number)",
          )
          .eq("patient_id", id)
          .order("admitted_at", { ascending: false })
          .limit(50),
        sb
          .from("bills")
          .select("id, bill_no, total, paid, pending, status, created_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("payments")
          .select("id, bill_id, amount, method, paid_at, reference")
          .in("bill_id", [])
          .limit(1), // placeholder, refilled after bills load if needed
        sb
          .from("pharmacy_sales")
          .select("id, invoice_no, total, created_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("lab_orders")
          .select("id, order_no, status, total_amount, created_at, doctors(name)")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("lab_results")
          .select(
            "id, order_id, test_name, result_value, unit, reference_range, flag, report_url, result_entered_at, lab_orders!inner(patient_id, order_no)",
          )
          .eq("lab_orders.patient_id", id)
          .order("result_entered_at", { ascending: false })
          .limit(200),
        sb
          .from("prescriptions")
          .select(
            "id, created_at, opd_visit_id, opd_visits!inner(patient_id, doctors(name), diagnosis)",
          )
          .eq("opd_visits.patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("prescription_items")
          .select(
            "id, prescription_id, medicine_name, dosage, timing, food_instruction, duration_days, notes, prescriptions!inner(created_at, opd_visits!inner(patient_id, doctors(name)))",
          )
          .eq("prescriptions.opd_visits.patient_id", id)
          .limit(500),
        sb
          .from("radiology_orders")
          .select(
            "id, modality, investigation, priority, status, scheduled_at, performed_at, amount, doctors(name)",
          )
          .eq("patient_id", id)
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(100),
        sb
          .from("radiology_reports")
          .select(
            "id, order_id, findings, impression, status, finalized_at, radiology_orders!inner(patient_id, modality, investigation)",
          )
          .eq("radiology_orders.patient_id", id)
          .limit(100),
        sb
          .from("surgeries")
          .select(
            "id, surgery_no, procedure_name, procedure_code, priority, status, scheduled_start, actual_start, actual_end, notes, primary_surgeon_id",
          )
          .eq("patient_id", id)
          .order("scheduled_start", { ascending: false, nullsFirst: false })
          .limit(50),
        sb
          .from("vitals")
          .select("id, recorded_at, systolic, diastolic, pulse, temperature, oxygen, sugar, weight")
          .eq("patient_id", id)
          .order("recorded_at", { ascending: false })
          .limit(50),
        sb
          .from("icu_monitoring")
          .select(
            "id, recorded_at, heart_rate, bp_sys, bp_dia, spo2, temperature, resp_rate, on_ventilator, notes",
          )
          .eq("patient_id", id)
          .order("recorded_at", { ascending: false })
          .limit(100),
        sb
          .from("icu_alerts")
          .select("id, alert_type, severity, message, resolved, created_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("clinical_alerts")
          .select("id, alert_type, severity, message, recommendation, acknowledged, created_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("insurance_claims")
          .select("id, claim_no, claim_amount, approved_amount, status, submitted_at, settled_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("documents")
          .select("id, category, title, description, file_url, mime_type, access_level, created_at")
          .eq("patient_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("medication_administration")
          .select(
            "id, admission_id, medicine_name, dosage, route, scheduled_at, administered_at, status",
          )
          .eq("admission_id", null)
          .limit(1),
      ]);
      // backfill payments by bill ids
      const billIds = (bills.data ?? []).map((b: any) => b.id);
      let pays: any[] = [];
      if (billIds.length) {
        const { data } = await sb
          .from("payments")
          .select("id, bill_id, amount, method, paid_at, reference")
          .in("bill_id", billIds);
        pays = data ?? [];
      }
      // resolve surgeon names
      const surgeonIds = Array.from(
        new Set((surgeries.data ?? []).map((s: any) => s.primary_surgeon_id).filter(Boolean)),
      );
      let doctorMap: Record<string, string> = {};
      if (surgeonIds.length) {
        const { data } = await sb.from("doctors").select("id, name").in("id", surgeonIds);
        (data ?? []).forEach((d: any) => {
          doctorMap[d.id] = d.name;
        });
      }
      const surgeriesWithNames = (surgeries.data ?? []).map((s: any) => ({
        ...s,
        surgeon_name: doctorMap[s.primary_surgeon_id] ?? null,
      }));
      return {
        appts: appts.data ?? [],
        visits: visits.data ?? [],
        admissions: admissions.data ?? [],
        bills: bills.data ?? [],
        payments: pays,
        sales: sales.data ?? [],
        labs: labs.data ?? [],
        labResults: labResults.data ?? [],
        rx: rx.data ?? [],
        rxItems: rxItems.data ?? [],
        rad: rad.data ?? [],
        radReports: radReports.data ?? [],
        surgeries: surgeriesWithNames,
        vitals: vitals.data ?? [],
        icu: icu.data ?? [],
        icuAlerts: icuAlerts.data ?? [],
        alerts: alerts.data ?? [],
        claims: claims.data ?? [],
        docs: docs.data ?? [],
        medsAdmin: medsAdmin.data ?? [],
      };
    },
  });

  const status = useMemo(() => {
    if (!bundle) return { opd: false, ipd: false, icu: false, discharged: false };
    const activeAdm = bundle.admissions.find(
      (a: any) => a.status === "admitted" || !a.discharged_at,
    );
    const recentVisit =
      bundle.visits[0] &&
      Date.now() - new Date(bundle.visits[0].created_at).getTime() < 14 * 86400_000;
    const hasIcu =
      bundle.icu.length > 0 &&
      Date.now() - new Date(bundle.icu[0].recorded_at).getTime() < 7 * 86400_000;
    const discharged = !activeAdm && bundle.admissions.some((a: any) => a.discharged_at);
    return { opd: !!recentVisit, ipd: !!activeAdm, icu: hasIcu, discharged };
  }, [bundle]);

  async function savePatient(payload: PatientSubmission) {
    const before = patient;
    const { error } = await (supabase as any).from("patients").update(payload.patient).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    const currentInsurance = insuranceRows[0];
    if (payload.insurance) {
      const insurancePayload = { ...payload.insurance, patient_id: id };
      const result = currentInsurance
        ? await (supabase as any)
            .from("patient_insurance")
            .update(insurancePayload)
            .eq("id", currentInsurance.id)
        : await (supabase as any).from("patient_insurance").insert(insurancePayload);
      if (result.error)
        toast.warning(`Patient saved, insurance not saved: ${result.error.message}`);
    } else if (currentInsurance) {
      await (supabase as any)
        .from("patient_insurance")
        .update({ active: false })
        .eq("id", currentInsurance.id);
    }

    await logAudit({
      action: "update",
      entity: "patients",
      entityId: id,
      before,
      after: payload.patient,
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["patient", id] }),
      queryClient.invalidateQueries({ queryKey: ["patient-insurance", id] }),
      queryClient.invalidateQueries({ queryKey: ["patients"] }),
    ]);
    setEditOpen(false);
    toast.success("Patient record updated");
  }

  if (!patient)
    return <div className="p-8 text-sm text-muted-foreground">Loading patient workspace…</div>;

  const age = patient.dob ? differenceInYears(new Date(), new Date(patient.dob)) : null;
  const initials = (patient.full_name ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1">
          <Link to="/patients">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Card className="flex-1">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4 flex-wrap">
              <Avatar className="size-16 ring-2 ring-border">
                <AvatarImage src={patient.photo_url ?? undefined} alt={patient.full_name} />
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight truncate">
                    {patient.full_name}
                  </h1>
                  <Badge variant="secondary" className="font-mono">
                    {patient.uhid}
                  </Badge>
                  {status.icu && (
                    <Badge className="bg-destructive text-destructive-foreground">ICU</Badge>
                  )}
                  {status.ipd && <Badge className="bg-primary text-primary-foreground">IPD</Badge>}
                  {status.opd && !status.ipd && <Badge variant="outline">OPD</Badge>}
                  {status.discharged && !status.ipd && <Badge variant="outline">Discharged</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span className="capitalize">{patient.gender ?? "—"}</span>
                  {age !== null && <span>{age} yrs</span>}
                  <span>Blood: {patient.blood_group ?? "—"}</span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    {patient.mobile}
                  </span>
                  {patient.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" />
                      {patient.email}
                    </span>
                  )}
                  {patient.emergency_contact_name && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="size-3.5" />
                      ICE: {patient.emergency_contact_name}{" "}
                      {patient.emergency_contact_mobile && `(${patient.emergency_contact_mobile})`}
                    </span>
                  )}
                </div>
                {(patient.allergies || patient.chronic_diseases) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {patient.allergies && (
                      <Badge variant="outline" className="border-warning/40 text-warning">
                        <AlertTriangle className="size-3 mr-1" />
                        Allergy: {patient.allergies}
                      </Badge>
                    )}
                    {patient.chronic_diseases && (
                      <Badge variant="outline">Chronic: {patient.chronic_diseases}</Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Pencil className="size-4 mr-1.5" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit patient registration</DialogTitle>
                    </DialogHeader>
                    <PatientForm
                      initialPatient={patient}
                      initialInsurance={insuranceRows[0]}
                      insuranceCompanies={insuranceCompanies}
                      submitLabel="Save patient"
                      onSubmit={savePatient}
                      onCancel={() => setEditOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
                <Button asChild size="sm" variant="outline">
                  <Link to="/opd">
                    <Stethoscope className="size-4 mr-1.5" />
                    Consult
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/laboratory/new">
                    <FlaskConical className="size-4 mr-1.5" />
                    Lab
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/radiology">
                    <Scan className="size-4 mr-1.5" />
                    Imaging
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/ipd/new">
                    <BedDouble className="size-4 mr-1.5" />
                    Admit
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/billing/new">
                    <Plus className="size-4 mr-1.5" />
                    Bill
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    logAudit({ action: "print", entity: "patients", entityId: id });
                    window.print();
                  }}
                >
                  <Printer className="size-4 mr-1.5" />
                  Print
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="min-w-0 space-y-5">
          <Tabs defaultValue="summary">
            <ScrollArea className="w-full">
              <TabsList className="h-auto flex-wrap gap-1">
                <TabsTrigger value="summary">Clinical Summary</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="opd">OPD</TabsTrigger>
                <TabsTrigger value="ipd">IPD</TabsTrigger>
                <TabsTrigger value="rx">Prescriptions</TabsTrigger>
                <TabsTrigger value="lab">Laboratory</TabsTrigger>
                <TabsTrigger value="rad">Radiology</TabsTrigger>
                <TabsTrigger value="surg">Surgeries</TabsTrigger>
                <TabsTrigger value="icu">ICU</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="docs">Documents</TabsTrigger>
              </TabsList>
            </ScrollArea>

            <TabsContent value="summary" className="mt-4">
              <ClinicalSummary patient={patient} bundle={bundle} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <TimelineTab bundle={bundle} />
            </TabsContent>
            <TabsContent value="opd" className="mt-4">
              <OpdTab visits={bundle?.visits ?? []} />
            </TabsContent>
            <TabsContent value="ipd" className="mt-4">
              <IpdTab admissions={bundle?.admissions ?? []} />
            </TabsContent>
            <TabsContent value="rx" className="mt-4">
              <RxTab rx={bundle?.rx ?? []} items={bundle?.rxItems ?? []} />
            </TabsContent>
            <TabsContent value="lab" className="mt-4">
              <LabTab orders={bundle?.labs ?? []} results={bundle?.labResults ?? []} />
            </TabsContent>
            <TabsContent value="rad" className="mt-4">
              <RadTab orders={bundle?.rad ?? []} reports={bundle?.radReports ?? []} />
            </TabsContent>
            <TabsContent value="surg" className="mt-4">
              <SurgeryTab rows={bundle?.surgeries ?? []} />
            </TabsContent>
            <TabsContent value="icu" className="mt-4">
              <IcuTab monitoring={bundle?.icu ?? []} alerts={bundle?.icuAlerts ?? []} />
            </TabsContent>
            <TabsContent value="billing" className="mt-4">
              <BillingTab
                bills={bundle?.bills ?? []}
                payments={bundle?.payments ?? []}
                claims={bundle?.claims ?? []}
              />
            </TabsContent>
            <TabsContent value="docs" className="mt-4">
              <DocsTab docs={bundle?.docs ?? []} patientId={id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky snapshot */}
        <aside className="xl:sticky xl:top-4 self-start space-y-4">
          <SnapshotPanel patient={patient} bundle={bundle} />
        </aside>
      </div>
    </div>
  );
}

/* ============== Clinical Summary ============== */
function ClinicalSummary({ patient, bundle }: { patient: any; bundle: any }) {
  const lastVitals = bundle?.vitals?.[0];
  const activeRx = (bundle?.rxItems ?? []).slice(0, 8);
  const activeDx = (bundle?.visits ?? []).filter((v: any) => v.diagnosis).slice(0, 5);
  const criticalLabs = (bundle?.labResults ?? [])
    .filter((r: any) => r.flag && r.flag !== "normal")
    .slice(0, 6);
  const alerts = (bundle?.alerts ?? []).filter((a: any) => !a.acknowledged).slice(0, 6);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard
        title="Active Diagnoses"
        icon={Stethoscope}
        empty="No recent diagnoses recorded."
      >
        {activeDx.map((v: any) => (
          <Row
            key={v.id}
            primary={v.diagnosis}
            secondary={`${v.doctors?.name ?? ""} · ${format(new Date(v.created_at), "dd MMM yyyy")}`}
          />
        ))}
      </SummaryCard>

      <SummaryCard
        title="Allergies & Chronic"
        icon={AlertTriangle}
        empty="No allergies or chronic conditions on file."
      >
        {patient.allergies && (
          <Row primary="Allergy" secondary={patient.allergies} tone="warning" />
        )}
        {patient.chronic_diseases && <Row primary="Chronic" secondary={patient.chronic_diseases} />}
      </SummaryCard>

      <SummaryCard title="Current Medications" icon={Pill} empty="No active medications.">
        {activeRx.map((i: any) => (
          <Row
            key={i.id}
            primary={i.medicine_name}
            secondary={`${i.dosage ?? ""}  ${i.timing ?? ""} ${i.duration_days ? `· ${i.duration_days}d` : ""}`}
          />
        ))}
      </SummaryCard>

      <SummaryCard title="Recent Vitals" icon={HeartPulse} empty="No vitals recorded yet.">
        {lastVitals && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Vital
              label="BP"
              value={
                lastVitals.systolic && lastVitals.diastolic
                  ? `${lastVitals.systolic}/${lastVitals.diastolic}`
                  : "—"
              }
            />
            <Vital label="Pulse" value={lastVitals.pulse ?? "—"} />
            <Vital label="SpO₂" value={lastVitals.oxygen ? `${lastVitals.oxygen}%` : "—"} />
            <Vital
              label="Temp"
              value={lastVitals.temperature ? `${lastVitals.temperature}°` : "—"}
            />
            <Vital label="Sugar" value={lastVitals.sugar ?? "—"} />
            <Vital label="Wt" value={lastVitals.weight ? `${lastVitals.weight}kg` : "—"} />
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Critical Lab Values" icon={FlaskConical} empty="No abnormal lab values.">
        {criticalLabs.map((r: any) => (
          <Row
            key={r.id}
            primary={r.test_name}
            secondary={`${r.result_value} ${r.unit ?? ""} · ref ${r.reference_range ?? "—"}`}
            tone={r.flag === "critical" ? "danger" : "warning"}
          />
        ))}
      </SummaryCard>

      <SummaryCard title="Clinical Alerts" icon={ShieldAlert} empty="No open alerts.">
        {alerts.map((a: any) => (
          <Row
            key={a.id}
            primary={a.message}
            secondary={`${a.alert_type} · ${a.severity}`}
            tone={a.severity === "critical" ? "danger" : "warning"}
          />
        ))}
      </SummaryCard>
    </div>
  );
}

/* ============== Timeline ============== */
function TimelineTab({ bundle }: { bundle: any }) {
  const [kind, setKind] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const events: TimelineEvent[] = useMemo(() => {
    if (!bundle) return [];
    const out: TimelineEvent[] = [];
    bundle.visits.forEach((v: any) =>
      out.push({
        id: `v-${v.id}`,
        kind: "opd",
        at: v.created_at,
        title: v.diagnosis || v.chief_complaints || "OPD Consultation",
        subtitle: v.doctors?.name,
      }),
    );
    bundle.admissions.forEach((a: any) =>
      out.push({
        id: `a-${a.id}`,
        kind: "ipd",
        at: a.admitted_at,
        title: `Admitted · ${a.reason ?? a.initial_diagnosis ?? "IPD"}`,
        subtitle: `${a.wards?.name ?? ""} ${a.beds?.bed_number ? `· Bed ${a.beds.bed_number}` : ""}`,
        badge: a.status,
      }),
    );
    bundle.admissions
      .filter((a: any) => a.discharged_at)
      .forEach((a: any) =>
        out.push({
          id: `d-${a.id}`,
          kind: "ipd",
          at: a.discharged_at,
          title: `Discharged · ${a.admission_no}`,
          subtitle: a.doctors?.name,
        }),
      );
    bundle.surgeries.forEach((s: any) =>
      out.push({
        id: `s-${s.id}`,
        kind: "surgery",
        at: s.actual_start ?? s.scheduled_start ?? s.scheduled_end,
        title: `Surgery · ${s.procedure_name}`,
        subtitle: s.surgeon_name,
        badge: s.status,
      }),
    );
    bundle.labs.forEach((l: any) =>
      out.push({
        id: `l-${l.id}`,
        kind: "lab",
        at: l.created_at,
        title: `Lab order ${l.order_no}`,
        subtitle: l.doctors?.name,
        badge: l.status,
      }),
    );
    bundle.rad.forEach((r: any) =>
      out.push({
        id: `r-${r.id}`,
        kind: "radiology",
        at: r.scheduled_at ?? r.performed_at,
        title: `${r.modality} · ${r.investigation}`,
        subtitle: r.doctors?.name,
        badge: r.status,
      }),
    );
    bundle.rx.forEach((p: any) =>
      out.push({
        id: `p-${p.id}`,
        kind: "prescription",
        at: p.created_at,
        title: "Prescription issued",
        subtitle: p.opd_visits?.doctors?.name,
      }),
    );
    bundle.bills.forEach((b: any) =>
      out.push({
        id: `b-${b.id}`,
        kind: "billing",
        at: b.created_at,
        title: `Bill ${b.bill_no}`,
        subtitle: inr(b.total),
        badge: b.status,
      }),
    );
    return out
      .filter((e) => e.at)
      .filter((e) => kind === "all" || e.kind === kind)
      .filter((e) => !from || new Date(e.at) >= new Date(from))
      .filter((e) => !to || new Date(e.at) <= new Date(to + "T23:59:59"))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [bundle, kind, from, to]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="size-4" />
            Filter
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["all", "opd", "ipd", "surgery", "lab", "radiology", "prescription", "billing"].map(
                (k) => (
                  <SelectItem key={k} value={k} className="capitalize">
                    {k}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          <div className="text-xs text-muted-foreground ml-auto">{events.length} events</div>
        </div>

        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            No events match the filters.
          </div>
        ) : (
          <div className="relative pl-6 space-y-3 border-l-2 border-border ml-3">
            {events.map((e) => (
              <div key={e.id} className="relative">
                <div
                  className={`absolute -left-[31px] size-4 rounded-full ring-4 ring-background ${dotColor(e.kind)}`}
                />
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(e.at), "dd MMM yyyy · HH:mm")}
                      </div>
                      <div className="font-medium truncate">{e.title}</div>
                      {e.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">{e.subtitle}</div>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0">
                      {e.kind}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function dotColor(kind: string) {
  switch (kind) {
    case "opd":
      return "bg-primary";
    case "ipd":
      return "bg-blue-500";
    case "surgery":
      return "bg-destructive";
    case "lab":
      return "bg-emerald-500";
    case "radiology":
      return "bg-violet-500";
    case "prescription":
      return "bg-amber-500";
    case "billing":
      return "bg-muted-foreground";
    default:
      return "bg-primary";
  }
}

/* ============== Per-tab views ============== */
function OpdTab({ visits }: { visits: any[] }) {
  if (visits.length === 0) return <Empty msg="No OPD visits." />;
  return (
    <div className="space-y-3">
      {visits.map((v) => (
        <Card key={v.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-medium">{v.diagnosis || "Consultation"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {format(new Date(v.created_at), "dd MMM yyyy HH:mm")}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{v.doctors?.name ?? "—"}</div>
            {v.chief_complaints && <Detail label="Complaints" value={v.chief_complaints} />}
            {v.symptoms && <Detail label="Symptoms" value={v.symptoms} />}
            {v.clinical_findings && <Detail label="Findings" value={v.clinical_findings} />}
            {v.follow_up_date && (
              <Detail label="Follow-up" value={format(new Date(v.follow_up_date), "dd MMM yyyy")} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IpdTab({ admissions }: { admissions: any[] }) {
  if (admissions.length === 0) return <Empty msg="No admissions." />;
  return (
    <div className="space-y-3">
      {admissions.map((a) => (
        <Card key={a.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{a.admission_no}</span>
                <Badge variant="outline" className="capitalize">
                  {a.status}
                </Badge>
                {a.is_emergency && (
                  <Badge className="bg-destructive text-destructive-foreground">Emergency</Badge>
                )}
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/ipd/$id" params={{ id: a.id }}>
                  Open stay
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Detail label="Admitted" value={format(new Date(a.admitted_at), "dd MMM yyyy")} />
              <Detail
                label="Discharged"
                value={a.discharged_at ? format(new Date(a.discharged_at), "dd MMM yyyy") : "—"}
              />
              <Detail
                label="Ward / Bed"
                value={`${a.wards?.name ?? "—"}${a.beds?.bed_number ? ` · ${a.beds.bed_number}` : ""}`}
              />
              <Detail label="Doctor" value={a.doctors?.name ?? "—"} />
            </div>
            {(a.reason || a.initial_diagnosis) && (
              <Detail label="Reason" value={a.reason || a.initial_diagnosis} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RxTab({ rx, items }: { rx: any[]; items: any[] }) {
  const [q, setQ] = useState("");
  const byRx = useMemo(() => {
    const map = new Map<string, any[]>();
    items.forEach((i) => {
      const arr = map.get(i.prescription_id) ?? [];
      arr.push(i);
      map.set(i.prescription_id, arr);
    });
    return map;
  }, [items]);
  const filtered = rx.filter((p) => {
    if (!q) return true;
    const its = byRx.get(p.id) ?? [];
    return its.some((i) => i.medicine_name?.toLowerCase().includes(q.toLowerCase()));
  });
  if (rx.length === 0) return <Empty msg="No prescriptions." />;
  return (
    <div className="space-y-3">
      <Input
        placeholder="Search medicine…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      {filtered.map((p) => (
        <Card key={p.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <div className="font-medium">{p.opd_visits?.diagnosis ?? "Prescription"}</div>
                <div className="text-xs text-muted-foreground">
                  {p.opd_visits?.doctors?.name ?? ""} ·{" "}
                  {format(new Date(p.created_at), "dd MMM yyyy")}
                </div>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/prescriptions/$id/print" params={{ id: p.id }}>
                  <Printer className="size-3.5 mr-1" />
                  Print
                </Link>
              </Button>
            </div>
            <div className="rounded-md border divide-y">
              {(byRx.get(p.id) ?? []).map((i) => (
                <div key={i.id} className="grid grid-cols-12 gap-2 p-2 text-sm">
                  <div className="col-span-4 font-medium flex items-center gap-1.5">
                    <Pill className="size-3.5 text-primary" />
                    {i.medicine_name}
                  </div>
                  <div className="col-span-3 text-muted-foreground">{i.dosage}</div>
                  <div className="col-span-3 text-muted-foreground">
                    {i.timing} {i.food_instruction ? `· ${i.food_instruction}` : ""}
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">
                    {i.duration_days ? `${i.duration_days} days` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LabTab({ orders, results }: { orders: any[]; results: any[] }) {
  if (orders.length === 0 && results.length === 0) return <Empty msg="No lab orders." />;
  const byOrder = new Map<string, any[]>();
  results.forEach((r) => {
    const arr = byOrder.get(r.order_id) ?? [];
    arr.push(r);
    byOrder.set(r.order_id, arr);
  });
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Card key={o.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{o.order_no}</span>
                <Badge variant="outline" className="capitalize">
                  {o.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(o.created_at), "dd MMM yyyy")} · {inr(o.total_amount)}
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/laboratory/$id" params={{ id: o.id }}>
                    Open
                  </Link>
                </Button>
              </div>
            </div>
            {(byOrder.get(o.id) ?? []).length > 0 && (
              <div className="rounded-md border divide-y text-sm">
                {(byOrder.get(o.id) ?? []).map((r) => (
                  <div key={r.id} className="grid grid-cols-12 gap-2 p-2">
                    <div className="col-span-5 font-medium">{r.test_name}</div>
                    <div
                      className={`col-span-3 ${r.flag && r.flag !== "normal" ? "text-destructive font-semibold" : ""}`}
                    >
                      {r.result_value} {r.unit}
                    </div>
                    <div className="col-span-3 text-muted-foreground text-xs">
                      Ref: {r.reference_range ?? "—"}
                    </div>
                    <div className="col-span-1 text-right">
                      {r.report_url && (
                        <a
                          href={r.report_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary"
                        >
                          <Download className="size-3.5 inline" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RadTab({ orders, reports }: { orders: any[]; reports: any[] }) {
  if (orders.length === 0) return <Empty msg="No radiology orders." />;
  const repByOrder = new Map<string, any>();
  reports.forEach((r) => repByOrder.set(r.order_id, r));
  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const rep = repByOrder.get(o.id);
        return (
          <Card key={o.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{o.modality}</Badge>
                  <span className="font-medium">{o.investigation}</span>
                  <Badge variant="outline" className="capitalize">
                    {o.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.scheduled_at ? format(new Date(o.scheduled_at), "dd MMM yyyy HH:mm") : "—"}
                </div>
              </div>
              {rep && (
                <div className="rounded-md border p-3 text-sm space-y-1.5 bg-surface-muted">
                  {rep.findings && <Detail label="Findings" value={rep.findings} />}
                  {rep.impression && <Detail label="Impression" value={rep.impression} />}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SurgeryTab({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <Empty msg="No surgeries." />;
  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <Card key={s.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-medium">{s.procedure_name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.surgery_no} · {s.surgeon_name ?? "—"}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {s.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Detail
                label="Scheduled"
                value={
                  s.scheduled_start ? format(new Date(s.scheduled_start), "dd MMM HH:mm") : "—"
                }
              />
              <Detail
                label="Started"
                value={s.actual_start ? format(new Date(s.actual_start), "dd MMM HH:mm") : "—"}
              />
              <Detail
                label="Ended"
                value={s.actual_end ? format(new Date(s.actual_end), "dd MMM HH:mm") : "—"}
              />
              <Detail label="Priority" value={s.priority ?? "—"} />
            </div>
            {s.notes && <Detail label="Notes" value={s.notes} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IcuTab({ monitoring, alerts }: { monitoring: any[]; alerts: any[] }) {
  if (monitoring.length === 0 && alerts.length === 0) return <Empty msg="No ICU history." />;
  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="font-medium flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" />
              ICU Alerts
            </div>
            <div className="divide-y">
              {alerts.map((a) => (
                <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{a.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.alert_type} · {format(new Date(a.created_at), "dd MMM HH:mm")}
                    </div>
                  </div>
                  <Badge variant={a.resolved ? "outline" : "destructive"}>{a.severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-4">
          <div className="font-medium mb-2 flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Monitoring History
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="p-2">HR</th>
                  <th className="p-2">BP</th>
                  <th className="p-2">SpO₂</th>
                  <th className="p-2">Temp</th>
                  <th className="p-2">Resp</th>
                  <th className="p-2">Vent</th>
                </tr>
              </thead>
              <tbody>
                {monitoring.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2 text-xs">
                      {format(new Date(m.recorded_at), "dd MMM HH:mm")}
                    </td>
                    <td className="p-2 text-center tabular-nums">{m.heart_rate ?? "—"}</td>
                    <td className="p-2 text-center tabular-nums">
                      {m.bp_sys && m.bp_dia ? `${m.bp_sys}/${m.bp_dia}` : "—"}
                    </td>
                    <td className="p-2 text-center tabular-nums">{m.spo2 ?? "—"}</td>
                    <td className="p-2 text-center tabular-nums">{m.temperature ?? "—"}</td>
                    <td className="p-2 text-center tabular-nums">{m.resp_rate ?? "—"}</td>
                    <td className="p-2 text-center">
                      {m.on_ventilator ? (
                        <Badge className="bg-destructive text-destructive-foreground">Yes</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab({ bills, payments, claims }: { bills: any[]; payments: any[]; claims: any[] }) {
  const total = bills.reduce((s, b) => s + Number(b.total ?? 0), 0);
  const paid = bills.reduce((s, b) => s + Number(b.paid ?? 0), 0);
  const pending = bills.reduce((s, b) => s + Number(b.pending ?? 0), 0);
  const payByBill = new Map<string, any[]>();
  payments.forEach((p) => {
    const arr = payByBill.get(p.bill_id) ?? [];
    arr.push(p);
    payByBill.set(p.bill_id, arr);
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Billed" value={inr(total)} />
        <Stat label="Paid" value={inr(paid)} tone="success" />
        <Stat label="Pending" value={inr(pending)} tone="warning" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="font-medium mb-2 flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            Bills
          </div>
          {bills.length === 0 ? (
            <Empty msg="No bills." inline />
          ) : (
            <div className="divide-y">
              {bills.map((b) => (
                <Link
                  key={b.id}
                  to="/billing/$id"
                  params={{ id: b.id }}
                  className="flex items-center justify-between py-2.5 hover:bg-surface-muted px-2 rounded"
                >
                  <div>
                    <div className="font-mono text-sm">{b.bill_no}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy")} ·{" "}
                      {(payByBill.get(b.id) ?? []).length} payments
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm tabular-nums">{inr(b.total)}</div>
                    <Badge variant="outline" className="capitalize">
                      {b.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="font-medium mb-2">Insurance Claims</div>
            <div className="divide-y">
              {claims.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-mono">{c.claim_no}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.submitted_at ? format(new Date(c.submitted_at), "dd MMM yyyy") : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{inr(c.approved_amount ?? c.claim_amount)}</span>
                    <Badge variant="outline" className="capitalize">
                      {c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocsTab({ docs, patientId }: { docs: any[]; patientId: string }) {
  if (docs.length === 0) return <Empty msg="No documents uploaded." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {docs.map((d) => (
        <Card key={d.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.category} · {format(new Date(d.created_at), "dd MMM yyyy")}
                </div>
                {d.description && (
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {d.description}
                  </div>
                )}
              </div>
              {d.file_url && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    logAudit({
                      action: "view",
                      entity: "documents",
                      entityId: d.id,
                      after: { patient_id: patientId },
                    })
                  }
                >
                  <a href={d.file_url} target="_blank" rel="noreferrer">
                    <FileText className="size-3.5 mr-1" />
                    Open
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============== Snapshot Panel ============== */
function SnapshotPanel({ patient, bundle }: { patient: any; bundle: any }) {
  const v = bundle?.vitals?.[0];
  const lastDx = bundle?.visits?.find((x: any) => x.diagnosis);
  const lastLabAlert = bundle?.labResults?.find((r: any) => r.flag && r.flag !== "normal");
  const lastRad = bundle?.radReports?.[0];
  const meds = (bundle?.rxItems ?? []).slice(0, 4);
  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="font-semibold flex items-center gap-2">
          <HeartPulse className="size-4 text-primary" />
          Clinical Snapshot
        </div>
        <SnapBlock
          label="Latest Diagnosis"
          value={lastDx?.diagnosis}
          hint={
            lastDx
              ? `${lastDx.doctors?.name ?? ""} · ${format(new Date(lastDx.created_at), "dd MMM")}`
              : undefined
          }
        />
        <SnapBlock
          label="Last Vitals"
          value={
            v
              ? `BP ${v.systolic ?? "—"}/${v.diastolic ?? "—"} · HR ${v.pulse ?? "—"} · SpO₂ ${v.oxygen ?? "—"}%`
              : undefined
          }
          hint={v ? format(new Date(v.recorded_at), "dd MMM HH:mm") : undefined}
        />
        <div>
          <div className="text-xs text-muted-foreground uppercase mb-1">Current Medications</div>
          {meds.length === 0 ? (
            <div className="text-sm text-muted-foreground">None on file</div>
          ) : (
            <ul className="text-sm space-y-1">
              {meds.map((m: any) => (
                <li key={m.id} className="flex items-start gap-1.5">
                  <Pill className="size-3 text-primary mt-1" />
                  <span className="truncate">
                    {m.medicine_name}{" "}
                    <span className="text-xs text-muted-foreground">{m.dosage}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SnapBlock
          label="Last Lab Alert"
          tone={lastLabAlert ? "danger" : undefined}
          value={
            lastLabAlert
              ? `${lastLabAlert.test_name}: ${lastLabAlert.result_value} ${lastLabAlert.unit ?? ""}`
              : undefined
          }
          hint={
            lastLabAlert ? format(new Date(lastLabAlert.result_entered_at), "dd MMM") : undefined
          }
        />
        <SnapBlock
          label="Last Radiology"
          value={lastRad?.impression || lastRad?.findings}
          hint={
            lastRad?.finalized_at ? format(new Date(lastRad.finalized_at), "dd MMM") : undefined
          }
        />
        {(patient?.allergies || patient?.chronic_diseases) && (
          <div className="rounded-md bg-warning/10 border border-warning/30 p-2.5 text-xs">
            {patient.allergies && (
              <div>
                <b>Allergy:</b> {patient.allergies}
              </div>
            )}
            {patient.chronic_diseases && (
              <div className="mt-1">
                <b>Chronic:</b> {patient.chronic_diseases}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== Primitives ============== */
function SummaryCard({
  title,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  empty: string;
}) {
  const hasChildren = Array.isArray(children)
    ? children.flat().filter(Boolean).length > 0
    : !!children;
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="font-medium flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
        </div>
        {hasChildren ? (
          <div className="space-y-1.5">{children}</div>
        ) : (
          <div className="text-sm text-muted-foreground">{empty}</div>
        )}
      </CardContent>
    </Card>
  );
}
function Row({
  primary,
  secondary,
  tone,
}: {
  primary: string;
  secondary?: string;
  tone?: "warning" | "danger";
}) {
  const color = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="flex items-start justify-between gap-3 text-sm border-b last:border-0 pb-1.5 last:pb-0">
      <div className={`font-medium ${color}`}>{primary}</div>
      {secondary && (
        <div className="text-xs text-muted-foreground text-right max-w-[60%] truncate">
          {secondary}
        </div>
      )}
    </div>
  );
}
function Vital({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-surface-muted py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums text-sm mt-0.5">{value}</div>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground uppercase mr-2">{label}</span>
      <span>{value}</span>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: any; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-warning" : "";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function SnapBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value?: string | null;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase mb-0.5">{label}</div>
      <div className={`text-sm ${tone === "danger" ? "text-destructive font-medium" : ""}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="size-3" />
          {hint}
        </div>
      )}
    </div>
  );
}
function Empty({ msg, inline }: { msg: string; inline?: boolean }) {
  return (
    <div className={`text-sm text-muted-foreground text-center ${inline ? "py-4" : "py-10"}`}>
      {msg}
    </div>
  );
}
