import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Printer, MessageCircle } from "lucide-react";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/prescriptions/$id/print")({ component: PrintRx });

function unpackNotes(notes: string | null) {
  if (!notes) return { strength: "", route: "", quantity: "", instructions: "" };
  try {
    const j = JSON.parse(notes);
    return { strength: j.s ?? "", route: j.r ?? "", quantity: j.q ?? "", instructions: j.i ?? "" };
  } catch { return { strength: "", route: "", quantity: "", instructions: notes }; }
}

function PrintRx() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["rx-print", id],
    queryFn: async () => {
      const { data: rx } = await supabase.from("prescriptions").select("id, created_at, opd_visit_id").eq("id", id).single();
      if (!rx) return null;
      const [visitRes, itemsRes] = await Promise.all([
        supabase.from("opd_visits").select("*, patients(full_name, uhid, gender, dob, mobile, address_line, city), doctors(name, specialization)").eq("id", rx.opd_visit_id).single(),
        supabase.from("prescription_items").select("*").eq("prescription_id", id).order("position"),
      ]);
      const { data: bill } = await supabase.from("bills").select("id, bill_no, total").eq("opd_visit_id", rx.opd_visit_id).maybeSingle();
      let investigations: any[] = []; let procedures: any[] = [];
      if (bill) {
        const { data: bi } = await supabase.from("bill_items").select("category, description").eq("bill_id", bill.id).order("position");
        investigations = (bi ?? []).filter((i: any) => i.category === "Lab");
        procedures = (bi ?? []).filter((i: any) => i.category === "Procedure");
      }
      return { rx, visit: visitRes.data, items: itemsRes.data ?? [], investigations, procedures, bill };
    },
  });

  useEffect(() => { if (data) setTimeout(() => window.print(), 400); }, [data]);

  const qrUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const verify = `${window.location.origin}/prescriptions/${id}/print`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(verify)}`;
  }, [id]);

  if (!data?.visit) return <div className="p-12">Loading...</div>;
  const v = data.visit as any;

  function whatsApp() {
    const mobile = v.patients?.mobile?.replace(/\D/g, "") ?? "";
    const url = `${window.location.origin}/prescriptions/${id}/print`;
    const msg = `Hello ${v.patients?.full_name}, your prescription from Dr ${v.doctors?.name} is ready: ${url}`;
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const vit = v.vitals ?? {};
  const vitalsSummary = [
    vit.bp && `BP ${vit.bp}`, vit.pulse && `PR ${vit.pulse}`, vit.temp && `Temp ${vit.temp}`,
    vit.spo2 && `SpO₂ ${vit.spo2}`, vit.weight && `Wt ${vit.weight}kg`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-white text-black p-10 max-w-3xl mx-auto font-sans">
      <div className="no-print flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={whatsApp}><MessageCircle className="size-4 mr-2" />WhatsApp</Button>
        <Button onClick={() => window.print()}><Printer className="size-4 mr-2" />Print</Button>
      </div>

      <PrintHeader
        title="Prescription"
        timestamp={data.rx.created_at}
        rightSlot={
          <div>
            <div className="font-semibold">{v.doctors?.name}</div>
            <div className="text-gray-600">{v.doctors?.specialization}</div>
          </div>
        }
      />


      <h1 className="sr-only">Medical Prescription for {v.patients?.full_name}</h1>

      <section className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-sm border-b">
        <div><span className="text-gray-500 text-xs uppercase">Patient: </span>{v.patients?.full_name}</div>
        <div><span className="text-gray-500 text-xs uppercase">UHID: </span>{v.patients?.uhid}</div>
        <div><span className="text-gray-500 text-xs uppercase">Gender: </span><span className="capitalize">{v.patients?.gender}</span></div>
        <div><span className="text-gray-500 text-xs uppercase">Date: </span>{format(new Date(data.rx.created_at), "dd MMM yyyy")}</div>
        <div><span className="text-gray-500 text-xs uppercase">Mobile: </span>{v.patients?.mobile}</div>
        {data.bill?.bill_no && <div><span className="text-gray-500 text-xs uppercase">Invoice: </span>{data.bill.bill_no}</div>}
      </section>

      {vitalsSummary && (
        <section className="py-2 text-xs border-b">
          <span className="text-gray-500 uppercase mr-2">Vitals:</span>{vitalsSummary}
        </section>
      )}

      {v.chief_complaints && (
        <section className="py-3 border-b text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1">Chief complaints</h2>
          <div>{v.chief_complaints}</div>
        </section>
      )}

      {v.diagnosis && (
        <section className="py-3 border-b text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1">Diagnosis</h2>
          <div>{v.diagnosis}</div>
        </section>
      )}

      {data.items.length > 0 && (
        <section className="py-4 border-b">
          <div aria-hidden="true" className="text-2xl font-serif italic mb-3">℞</div>
          <ol className="space-y-3">
            {data.items.map((it: any, i: number) => {
              const meta = unpackNotes(it.notes);
              return (
                <li key={it.id} className="border-b border-dashed pb-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{i + 1}. {it.medicine_name}{meta.strength && ` — ${meta.strength}`}</span>
                    {it.duration_days && <span className="text-xs">{it.duration_days} days{meta.quantity && ` · Qty ${meta.quantity}`}</span>}
                  </div>
                  <div className="text-xs text-gray-700 mt-0.5">{[meta.route, it.dosage, it.food_instruction].filter(Boolean).join(" · ")}</div>
                  {meta.instructions && <div className="text-xs italic text-gray-600 mt-0.5">{meta.instructions}</div>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {data.investigations.length > 0 && (
        <section className="py-3 border-b text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1">Investigations advised</h2>
          <ul className="list-disc list-inside space-y-0.5">
            {data.investigations.map((i: any, k: number) => <li key={k}>{i.description}</li>)}
          </ul>
        </section>
      )}

      {data.procedures.length > 0 && (
        <section className="py-3 border-b text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1">Procedures</h2>
          <ul className="list-disc list-inside space-y-0.5">
            {data.procedures.map((i: any, k: number) => <li key={k}>{i.description}</li>)}
          </ul>
        </section>
      )}

      {v.notes && (
        <section className="py-3 border-b text-sm">
          <h2 className="text-xs uppercase text-gray-500 mb-1">Advice</h2>
          <div>{v.notes}</div>
        </section>
      )}

      <footer className="mt-10 pt-6 flex justify-between items-end text-xs">
        <div className="flex items-end gap-3">
          {qrUrl && <img src={qrUrl} alt="QR verify" width={90} height={90} />}
          <div>
            {v.follow_up_date && <div>Follow-up: {format(new Date(v.follow_up_date), "dd MMM yyyy")}</div>}
            <div className="text-gray-500 mt-1">Scan to view digital copy</div>
          </div>
        </div>
        <div className="text-right">
          <div className="border-t border-black pt-1 px-6 inline-block">{v.doctors?.name}</div>
          <div className="text-[10px] text-gray-500">Doctor signature</div>
        </div>
      </footer>

      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>
    </div>
  );
}
