import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/discharge/$id/print")({ component: PrintDischarge });

function PrintDischarge() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["discharge", id],
    queryFn: async () => {
      const { data: ds } = await supabase.from("discharge_summaries").select("*, admissions(*, patients(*), doctors(name, specialization), wards(name), beds(bed_number))").eq("id", id).single();
      const { data: meds } = await supabase.from("discharge_medications").select("*").eq("discharge_id", id).order("position");
      return { ds, meds: meds ?? [] };
    },
  });

  if (!data?.ds) return <div className="p-6 text-sm">Loading…</div>;
  const ds: any = data.ds;
  const adm = ds.admissions;
  const p = adm?.patients;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto p-10 print:p-6">
        <div className="flex justify-between items-start mb-6 print:hidden">
          <h1 className="text-xl font-semibold">Discharge summary</h1>
          <Button onClick={() => window.print()}><Printer className="size-4 mr-2" />Print</Button>
        </div>

        <div className="border-b-2 border-black pb-4 mb-6">
          <h2 className="text-2xl font-bold text-center">SBG Arogya Plus</h2>
          <div className="text-center text-sm">Discharge Summary</div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <Field label="Patient" value={p?.full_name} />
          <Field label="UHID" value={p?.uhid} />
          <Field label="Age / Gender" value={`${p?.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—"} / ${p?.gender}`} />
          <Field label="Mobile" value={p?.mobile} />
          <Field label="Admission #" value={adm?.admission_no} />
          <Field label="Treating doctor" value={`Dr. ${adm?.doctors?.name}${adm?.doctors?.specialization ? " (" + adm.doctors.specialization + ")" : ""}`} />
          <Field label="Admitted" value={adm?.admitted_at ? format(new Date(adm.admitted_at), "dd MMM yyyy, p") : "—"} />
          <Field label="Discharged" value={ds.discharge_date ? format(new Date(ds.discharge_date), "dd MMM yyyy, p") : "—"} />
          <Field label="Ward / Bed" value={`${adm?.wards?.name ?? "—"} / ${adm?.beds?.bed_number ?? "—"}`} />
          <Field label="Condition" value={ds.condition_at_discharge} />
        </div>

        <Section title="Final diagnosis" value={ds.final_diagnosis} />
        <Section title="Procedures performed" value={ds.procedures_performed} />
        <Section title="Hospital course" value={ds.hospital_course} />

        {data.meds.length > 0 && (
          <div className="mb-5">
            <h3 className="font-bold border-b mb-2">Medicines at discharge</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-1">Medicine</th><th className="text-left">Dose</th><th className="text-left">Duration</th><th className="text-left">Instructions</th></tr></thead>
              <tbody>{data.meds.map((m: any) => (
                <tr key={m.id} className="border-b border-dashed"><td className="py-1">{m.medicine_name}</td><td>{m.dosage}</td><td>{m.duration}</td><td>{m.instructions}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <Section title="Follow-up instructions" value={ds.follow_up_instructions} extra={ds.follow_up_date ? `Date: ${format(new Date(ds.follow_up_date), "dd MMM yyyy")}` : undefined} />
        <Section title="Advice" value={ds.advice} />

        <div className="mt-12 flex justify-between text-sm">
          <div>Patient signature</div>
          <div>Dr. {adm?.doctors?.name}</div>
        </div>
      </div>
      <style>{`@media print { body { background: white; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return <div><span className="font-medium">{label}:</span> {value ?? "—"}</div>;
}
function Section({ title, value, extra }: { title: string; value?: string | null; extra?: string }) {
  if (!value && !extra) return null;
  return (
    <div className="mb-4">
      <h3 className="font-bold border-b mb-1">{title}</h3>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
      {extra && <div className="text-sm text-gray-700 mt-1">{extra}</div>}
    </div>
  );
}
