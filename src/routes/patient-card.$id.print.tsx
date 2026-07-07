import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { useHospitalProfile } from "@/components/print-header";

export const Route = createFileRoute("/patient-card/$id/print")({ component: PrintCard });

function PrintCard() {
  const { id } = Route.useParams();
  const { data: hospital } = useHospitalProfile();
  const { data } = useQuery({
    queryKey: ["patient-card", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("patients")
        .select("uhid, full_name, gender, dob, mobile, blood_group, address_line, city, state, emergency_contact_name, emergency_contact_mobile, photo_url, created_at")
        .eq("id", id)
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400);
  }, [data]);

  if (!data) return <div className="p-12">Loading...</div>;
  const p = data as any;
  const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : null;

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-2xl mx-auto font-sans">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={() => window.print()}>
          <Printer className="size-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="border-2 border-black rounded-lg p-6 space-y-4">
        <header className="flex items-center justify-between pb-3 border-b border-black">
          <div className="flex items-center gap-3">
            {hospital?.logo_url && (
              <img src={hospital.logo_url} alt={hospital.hospital_name} style={{ maxHeight: 48, maxWidth: 100, objectFit: "contain" }} />
            )}
            <div>
              <div className="font-bold text-lg leading-tight">{hospital?.hospital_name}</div>
              <div className="text-xs">Patient Identification Card</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs">UHID</div>
            <div className="font-mono font-bold text-lg">{p.uhid}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            {p.photo_url ? (
              <img src={p.photo_url} alt={p.full_name} className="size-32 object-cover border border-black rounded" />
            ) : (
              <div className="size-32 border border-black rounded flex items-center justify-center text-3xl font-bold">
                {String(p.full_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="col-span-2 space-y-1.5 text-sm">
            <Row k="Name" v={p.full_name} />
            <Row k="Gender" v={p.gender} />
            <Row k="Age" v={age != null ? `${age} yrs` : "—"} />
            <Row k="Mobile" v={p.mobile} />
            <Row k="Blood group" v={p.blood_group ?? "—"} />
            <Row k="Address" v={[p.address_line, p.city, p.state].filter(Boolean).join(", ") || "—"} />
            <Row k="Emergency" v={p.emergency_contact_name ? `${p.emergency_contact_name} · ${p.emergency_contact_mobile ?? ""}` : "—"} />
          </div>
        </div>

        <footer className="pt-3 border-t border-black text-[10px] flex justify-between">
          <span>Issued: {new Date(p.created_at).toLocaleDateString()}</span>
          <span>Present this card at every visit</span>
        </footer>
      </div>

      <style>{`@media print { .no-print { display: none !important; } @page { size: A5; margin: 10mm; } }`}</style>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 text-xs uppercase tracking-wide opacity-70">{k}</span>
      <span className="flex-1 font-medium">{String(v ?? "—")}</span>
    </div>
  );
}
