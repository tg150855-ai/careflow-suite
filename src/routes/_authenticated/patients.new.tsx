import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PatientForm, type PatientSubmission } from "@/components/patient-form";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/patients/new")({ component: NewPatient });

function NewPatient() {
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const canConsult = hasAnyRole(["doctor", "admin", "super_admin"]);

  const { data: insuranceCompanies = [] } = useQuery({
    queryKey: ["insurance-companies", "patient-form"],
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
    // Duplicate mobile pre-check
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
      const { error: insuranceError } = await (supabase as any)
        .from("patient_insurance")
        .insert({ ...payload.insurance, patient_id: data.id });
      if (insuranceError)
        toast.warning(`Patient saved, insurance not saved: ${insuranceError.message}`);
    }

    // Seed EMR / timeline registration entry
    await (supabase as any).from("emr_records").insert({
      patient_id: data.id,
      record_type: "registration",
      title: "Patient registered",
      summary: `UHID ${data.uhid} created`,
      department: "Reception",
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
      case "print":
        if (typeof window !== "undefined") {
          window.open(`/patient-card/${data.id}/print`, "_blank");
        }
        navigate({ to: "/patients/$id", params: { id: data.id } });
        return;
      default:
        navigate({ to: "/patients/$id", params: { id: data.id } });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/patients">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New patient registration</h1>
          <p className="text-sm text-muted-foreground">UHID is generated automatically.</p>
        </div>
      </div>

      <PatientForm
        insuranceCompanies={insuranceCompanies}
        submitLabel="Save patient"
        actions={[
          { value: "appointment", label: "Save & book appointment", variant: "outline" },
          ...(canConsult
            ? [{ value: "consult" as const, label: "Save & start consultation", variant: "outline" as const }]
            : []),
          { value: "print", label: "Save & print card", variant: "secondary" },
        ]}
        onSubmit={onSubmit}
        onCancel={() => navigate({ to: "/patients" })}
      />
    </div>
  );
}
