import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, Mail, MapPin, AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/patients/$id")({ component: PatientProfile });

function PatientProfile() {
  const { id } = Route.useParams();
  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => (await supabase.from("patients").select("*").eq("id", id).single()).data,
  });

  const { data: bundle } = useQuery({
    queryKey: ["patient-bundle", id],
    queryFn: async () => {
      const [appts, visits, bills, sales, labs] = await Promise.all([
        supabase.from("appointments").select("id, scheduled_at, status, doctors(name)").eq("patient_id", id).order("scheduled_at", { ascending: false }).limit(50),
        supabase.from("opd_visits").select("id, diagnosis, chief_complaints, created_at, doctors(name)").eq("patient_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("bills").select("id, bill_no, total, paid, pending, status, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("pharmacy_sales").select("id, invoice_no, total, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("lab_orders").select("id, order_no, status, total_amount, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      return { appts: appts.data ?? [], visits: visits.data ?? [], bills: bills.data ?? [], sales: sales.data ?? [], labs: labs.data ?? [] };
    },
  });

  if (!patient) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/patients"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            <Badge variant="secondary" className="font-mono">{patient.uhid}</Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{patient.gender} · {patient.blood_group ?? "Blood group N/A"} · {patient.mobile}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/billing/new"><Plus className="size-4 mr-2" />Bill</Link></Button>
          <Button asChild><Link to="/laboratory/new"><Plus className="size-4 mr-2" />Lab order</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="opd">OPD History</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
          <TabsTrigger value="lab">Lab Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-6 space-y-4 lg:col-span-1">
              <h2 className="font-semibold">Contact</h2>
              <InfoRow icon={Phone} text={patient.mobile} />
              {patient.email && <InfoRow icon={Mail} text={patient.email} />}
              {(patient.address_line || patient.city) && <InfoRow icon={MapPin} text={[patient.address_line, patient.city, patient.state, patient.pincode].filter(Boolean).join(", ")} />}
              {(patient.allergies || patient.chronic_diseases) && (
                <div className="pt-4 border-t space-y-3">
                  {patient.allergies && <div className="flex gap-2 text-sm"><AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" /><div><div className="font-medium">Allergies</div><div className="text-muted-foreground text-xs">{patient.allergies}</div></div></div>}
                  {patient.chronic_diseases && <div className="text-sm"><div className="font-medium">Chronic</div><div className="text-muted-foreground text-xs">{patient.chronic_diseases}</div></div>}
                </div>
              )}
            </Card>
            <Card className="p-6 lg:col-span-2">
              <h2 className="font-semibold mb-4">Activity summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Appointments" value={bundle?.appts.length ?? 0} />
                <Stat label="OPD visits" value={bundle?.visits.length ?? 0} />
                <Stat label="Bills" value={bundle?.bills.length ?? 0} />
                <Stat label="Pharmacy" value={bundle?.sales.length ?? 0} />
                <Stat label="Lab orders" value={bundle?.labs.length ?? 0} />
                <Stat label="Outstanding" value={inr((bundle?.bills ?? []).reduce((s: number, b: any) => s + Number(b.pending), 0))} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-5"><Card><List rows={bundle?.appts ?? []} render={(a: any) => ({ primary: a.doctors?.name ?? "Doctor", secondary: format(new Date(a.scheduled_at), "dd MMM yyyy · HH:mm"), badge: a.status })} empty="No appointments." /></Card></TabsContent>
        <TabsContent value="opd" className="mt-5"><Card><List rows={bundle?.visits ?? []} render={(v: any) => ({ primary: v.diagnosis || v.chief_complaints || "Consultation", secondary: `${v.doctors?.name ?? ""} · ${format(new Date(v.created_at), "dd MMM yyyy")}`, href: null })} empty="No OPD visits." /></Card></TabsContent>
        <TabsContent value="bills" className="mt-5"><Card><List rows={bundle?.bills ?? []} render={(b: any) => ({ primary: b.bill_no, secondary: format(new Date(b.created_at), "dd MMM yyyy"), value: inr(b.total), badge: b.status, link: { to: "/billing/$id", params: { id: b.id } } })} empty="No bills." /></Card></TabsContent>
        <TabsContent value="pharmacy" className="mt-5"><Card><List rows={bundle?.sales ?? []} render={(s: any) => ({ primary: s.invoice_no, secondary: format(new Date(s.created_at), "dd MMM yyyy"), value: inr(s.total) })} empty="No pharmacy purchases." /></Card></TabsContent>
        <TabsContent value="lab" className="mt-5"><Card><List rows={bundle?.labs ?? []} render={(l: any) => ({ primary: l.order_no, secondary: format(new Date(l.created_at), "dd MMM yyyy"), value: inr(l.total_amount), badge: l.status, link: { to: "/laboratory/$id", params: { id: l.id } } })} empty="No lab orders." /></Card></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="p-4 rounded-xl bg-surface-muted"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold tabular-nums mt-1">{value}</div></div>;
}

function List({ rows, render, empty }: { rows: any[]; render: (r: any) => { primary: string; secondary?: string; value?: string; badge?: string; link?: any }; empty: string }) {
  if (rows.length === 0) return <div className="p-12 text-sm text-muted-foreground text-center">{empty}</div>;
  return (
    <div className="divide-y">
      {rows.map((r) => {
        const d = render(r);
        const content = (
          <div className="flex items-center justify-between p-4 hover:bg-surface-muted">
            <div className="min-w-0"><div className="text-sm font-medium truncate">{d.primary}</div>{d.secondary && <div className="text-xs text-muted-foreground truncate">{d.secondary}</div>}</div>
            <div className="flex items-center gap-3 shrink-0">
              {d.value && <div className="text-sm tabular-nums">{d.value}</div>}
              {d.badge && <Badge variant="outline" className="text-[10px] capitalize">{d.badge.replace("_"," ")}</Badge>}
            </div>
          </div>
        );
        return d.link ? <Link key={r.id} {...d.link}>{content}</Link> : <div key={r.id}>{content}</div>;
      })}
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex items-start gap-2 text-sm"><Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" /><span>{text}</span></div>;
}
