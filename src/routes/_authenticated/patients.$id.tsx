import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/patients/$id")({ component: PatientProfile });

function PatientProfile() {
  const { id } = Route.useParams();
  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["patient-visits", id],
    queryFn: async () => {
      const { data } = await supabase.from("opd_visits").select("id, diagnosis, created_at, doctors(name)").eq("patient_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!patient) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/patients"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            <Badge variant="secondary" className="font-mono">{patient.uhid}</Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{patient.gender} · {patient.blood_group ?? "Blood group N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 space-y-4 lg:col-span-1">
          <h2 className="font-semibold">Contact</h2>
          <InfoRow icon={Phone} text={patient.mobile} />
          {patient.email && <InfoRow icon={Mail} text={patient.email} />}
          {(patient.address_line || patient.city) && (
            <InfoRow icon={MapPin} text={[patient.address_line, patient.city, patient.state, patient.pincode].filter(Boolean).join(", ")} />
          )}
          {(patient.allergies || patient.chronic_diseases) && (
            <div className="pt-4 border-t space-y-2">
              {patient.allergies && (
                <div className="flex gap-2 text-sm"><AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" /><div><div className="font-medium">Allergies</div><div className="text-muted-foreground text-xs">{patient.allergies}</div></div></div>
              )}
              {patient.chronic_diseases && (
                <div className="text-sm"><div className="font-medium">Chronic</div><div className="text-muted-foreground text-xs">{patient.chronic_diseases}</div></div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Visit history</h2>
          {visits.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No previous visits.</div>
          ) : (
            <div className="space-y-3">
              {visits.map((v: any) => (
                <div key={v.id} className="flex items-start gap-4 p-3 rounded-xl border">
                  <div className="size-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{v.diagnosis || "Consultation"}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy")}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{v.doctors?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex items-start gap-2 text-sm"><Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" /><span>{text}</span></div>;
}
