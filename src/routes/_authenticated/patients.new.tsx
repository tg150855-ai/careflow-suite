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
  const { user } = useAuth();
  const navigate = useNavigate();
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

  async function onSubmit(payload: PatientSubmission) {
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
      if (insuranceError) toast.warning(`Patient saved, insurance not saved: ${insuranceError.message}`);
    }
    await logAudit({ action: "create", entity: "patients", entityId: data.id, after: payload.patient });
    toast.success(`Patient registered · ${data.uhid}`);
    navigate({ to: "/patients/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/patients"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New patient registration</h1>
          <p className="text-sm text-muted-foreground">UHID is generated automatically.</p>
        </div>
      </div>

      <PatientForm
        insuranceCompanies={insuranceCompanies}
        submitLabel="Register patient"
        onSubmit={onSubmit}
        onCancel={() => navigate({ to: "/patients" })}
      />
    </div>
  );
}
