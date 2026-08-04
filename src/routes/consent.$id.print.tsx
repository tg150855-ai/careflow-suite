import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { PrintHeader, PrintFooter } from "@/components/print-header";

export const Route = createFileRoute("/consent/$id/print")({ component: PrintConsent });

function PrintConsent() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["consent-print", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consent_forms")
        .select("*, patients(full_name, uhid, mobile, dob, gender, address), doctors(name, specialization)")
        .eq("id", id).maybeSingle();
      return data;
    },
  });

  if (!data) return <div className="p-6 text-sm">Loading…</div>;
  const c: any = data;
  const p = c.patients;
  const age = p?.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-3xl mx-auto p-10 print:p-6">
        <div className="flex justify-between items-start mb-6 print:hidden">
          <h1 className="text-xl font-semibold">{c.form_type}</h1>
          <Button onClick={() => window.print()}><Printer className="size-4 mr-2" />Print</Button>
        </div>

        <PrintHeader title={c.form_type} timestamp={c.created_at} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <Field label="Patient" value={p?.full_name} />
          <Field label="UHID" value={p?.uhid} />
          <Field label="Age / Gender" value={`${age} / ${p?.gender ?? "—"}`} />
          <Field label="Mobile" value={p?.mobile} />
          <Field label="Department" value={c.department} />
          <Field label="Doctor" value={c.doctors?.name ? `Dr. ${c.doctors.name}` : "—"} />
          <Field label="Diagnosis" value={c.diagnosis} />
          <Field label="Procedure" value={c.procedure} />
        </div>

        <div className="text-sm whitespace-pre-wrap leading-relaxed mb-10">{c.content}</div>

        <div className="grid grid-cols-3 gap-6 mt-16 text-sm">
          <SignBlock label="Patient / Guardian" name={p?.full_name} img={c.patient_signature} />
          <SignBlock label={`Witness${c.witness_relation ? ` (${c.witness_relation})` : ""}`} name={c.witness_name} img={c.witness_signature} />
          <SignBlock label="Doctor" name={c.doctors?.name ? `Dr. ${c.doctors.name}` : ""} img={c.doctor_signature} />
        </div>

        <div className="mt-6 text-xs text-gray-600">
          Signed on: {c.signed_at ? format(new Date(c.signed_at), "dd MMM yyyy, p") : "—"}
        </div>

        <PrintFooter />
      </div>
      <style>{`@media print { body { background: white; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return <div><span className="font-medium">{label}:</span> {value ?? "—"}</div>;
}

function SignBlock({ label, name, img }: { label: string; name?: string | null; img?: string | null }) {
  return (
    <div>
      <div className="h-20 border-b flex items-end justify-center">
        {img ? <img src={img} alt={label} className="max-h-20 object-contain" /> : null}
      </div>
      <div className="mt-1 text-xs font-medium">{label}</div>
      <div className="text-xs text-gray-600">{name ?? ""}</div>
    </div>
  );
}
