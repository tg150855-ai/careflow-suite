import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { format } from "date-fns";
import { Printer, Heart } from "lucide-react";

export const Route = createFileRoute("/prescriptions/$id/print")({ component: PrintRx });

function PrintRx() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["rx-print", id],
    queryFn: async () => {
      const { data: rx } = await supabase.from("prescriptions").select("id, created_at, opd_visit_id").eq("id", id).single();
      if (!rx) return null;
      const [visitRes, itemsRes] = await Promise.all([
        supabase.from("opd_visits").select("*, patients(full_name, uhid, gender, dob, mobile), doctors(name, specialization)").eq("id", rx.opd_visit_id).single(),
        supabase.from("prescription_items").select("*").eq("prescription_id", id).order("position"),
      ]);
      return { rx, visit: visitRes.data, items: itemsRes.data ?? [] };
    },
  });

  useEffect(() => { if (data) setTimeout(() => window.print(), 400); }, [data]);

  if (!data?.visit) return <div className="p-12">Loading...</div>;
  const v = data.visit as any;

  return (
    <div className="min-h-screen bg-white text-black p-10 max-w-3xl mx-auto font-sans">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()}><Printer className="size-4 mr-2" />Print</Button>
      </div>

      <header className="flex items-start justify-between pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-xl bg-black text-white flex items-center justify-center"><Heart className="size-6" /></div>
          <div>
            <div className="text-xl font-bold">SBG Arogya Plus</div>
            <div className="text-xs">Multi-Specialty · 24×7 Emergency · +91 80000 00000</div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold">{v.doctors?.name}</div>
          <div>{v.doctors?.specialization}</div>
        </div>
      </header>

      <h1 className="sr-only">Medical Prescription for {v.patients?.full_name}</h1>

      <section aria-labelledby="rx-patient-heading" className="grid grid-cols-2 gap-4 py-4 text-sm border-b">
        <h2 id="rx-patient-heading" className="sr-only col-span-2">Patient details</h2>
        <div><span className="text-gray-500 text-xs uppercase">Patient: </span>{v.patients?.full_name}</div>
        <div><span className="text-gray-500 text-xs uppercase">UHID: </span>{v.patients?.uhid}</div>
        <div><span className="text-gray-500 text-xs uppercase">Gender: </span><span className="capitalize">{v.patients?.gender}</span></div>
        <div><span className="text-gray-500 text-xs uppercase">Date: </span>{format(new Date(data.rx.created_at), "dd MMM yyyy")}</div>
      </section>

      {v.diagnosis && (
        <section className="py-4 border-b">
          <h2 className="text-xs uppercase text-gray-500 mb-1 font-normal">Diagnosis</h2>
          <div className="text-sm">{v.diagnosis}</div>
        </section>
      )}

      <section aria-labelledby="rx-medicines-heading" className="py-4">
        <h2 id="rx-medicines-heading" className="sr-only">Prescribed medicines</h2>
        <div aria-hidden="true" className="text-2xl font-serif italic mb-3">℞</div>
        <ol className="space-y-3">
          {data.items.map((it: any, i: number) => (
            <li key={it.id} className="border-b border-dashed pb-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{i + 1}. {it.medicine_name}</span>
                {it.duration_days && <span className="text-xs">{it.duration_days} days</span>}
              </div>
              <div className="text-xs text-gray-700 mt-0.5">{[it.dosage, it.timing, it.food_instruction].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ol>
      </section>

      {v.notes && (
        <section className="py-3 border-t text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1 font-normal">Advice</h2>
          <div>{v.notes}</div>
        </section>
      )}

      <footer className="mt-12 pt-8 flex justify-between items-end text-xs">
        <div>
          {v.follow_up_date && <div>Follow-up: {format(new Date(v.follow_up_date), "dd MMM yyyy")}</div>}
        </div>
        <div className="text-right">
          <div className="border-t border-black pt-1 px-6 inline-block">Doctor signature</div>
        </div>
      </footer>
    </div>
  );
}
