import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { PatientForm, type PatientSubmission } from "@/components/patient-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, UserPlus, Phone, IdCard, CalendarPlus, PlayCircle,
  Stethoscope, Loader2, ChevronRight, History,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd/registration")({
  component: OpdRegistration,
});

function OpdRegistration() {
  const [tab, setTab] = useState("new");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="new" className="gap-2">
          <UserPlus className="size-4" /> New Patient
        </TabsTrigger>
        <TabsTrigger value="existing" className="gap-2">
          <Search className="size-4" /> Existing Patient
        </TabsTrigger>
      </TabsList>

      <TabsContent value="new" className="m-0">
        <NewPatientPanel onRegistered={() => setTab("existing")} />
      </TabsContent>

      <TabsContent value="existing" className="m-0">
        <ExistingPatientPanel />
      </TabsContent>
    </Tabs>
  );
}

/* ────────────────────────────── New Patient ────────────────────────────── */

function NewPatientPanel({ onRegistered }: { onRegistered: () => void }) {
  const { user, hasAnyRole } = useAuth();
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
      .insert({ ...payload.patient, created_by: user?.id })
      .select("id, uhid")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }

    if (payload.insurance) {
      const { error: insErr } = await (supabase as any)
        .from("patient_insurance")
        .insert({ ...payload.insurance, patient_id: data.id });
      if (insErr) toast.warning(`Patient saved, insurance not saved: ${insErr.message}`);
    }

    await (supabase as any).from("emr_records").insert({
      patient_id: data.id,
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

    toast.success(`Patient registered · ${data.uhid}`);

    switch (action) {
      case "appointment":
        navigate({ to: "/appointments", search: { patientId: data.id } as any });
        return;
      case "consult":
        navigate({ to: "/opd", search: { patientId: data.id } as any });
        return;
      case "another":
        onRegistered();
        return;
      default:
        navigate({ to: "/patients/$id", params: { id: data.id } });
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

      <div className="grid sm:grid-cols-2 gap-3">
        <Button asChild>
          <Link to="/appointments" search={{ patientId: patient.id } as any}>
            <CalendarPlus className="size-4" /> Book OPD appointment
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/opd" search={{ patientId: patient.id } as any}>
            <PlayCircle className="size-4" /> Add to OPD queue
          </Link>
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
    </Card>
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
