import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Calendar, Pill, FlaskConical, Receipt, Users } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/patient-portal")({ component: PortalPage });

function PortalPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null);
  const [data, setData] = useState({ appts: [] as any[], rx: [] as any[], labs: [] as any[], bills: [] as any[], family: [] as any[] });

  useEffect(() => {
    if (!user) return;
    const sb = supabase as any;
    sb.from("patient_portal_accounts").select("*, patients(*)").eq("user_id", user.id).maybeSingle().then(async ({ data: acc }: any) => {
      setAccount(acc);
      if (!acc?.patient_id) return;
      const pid = acc.patient_id;
      const [appts, rx, labs, bills, fam] = await Promise.all([
        sb.from("appointments").select("*, profiles!appointments_doctor_id_fkey(full_name)").eq("patient_id", pid).order("scheduled_at", { ascending: false }).limit(5),
        sb.from("prescriptions").select("*").eq("patient_id", pid).order("created_at", { ascending: false }).limit(5),
        sb.from("lab_orders").select("*").eq("patient_id", pid).order("created_at", { ascending: false }).limit(5),
        sb.from("bills").select("*").eq("patient_id", pid).order("created_at", { ascending: false }).limit(5),
        sb.from("patient_family_members").select("*, patients!patient_family_members_member_patient_id_fkey(full_name, uhid)").eq("primary_user_id", user.id),
      ]);
      setData({
        appts: appts.data ?? [], rx: rx.data ?? [], labs: labs.data ?? [], bills: bills.data ?? [], family: fam.data ?? [],
      });
    });
  }, [user]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <Heart className="size-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Welcome to Patient Portal</h1>
        <p className="text-sm text-muted-foreground mt-2">Your portal account is not linked yet. Please visit reception to link your medical record.</p>
      </div>
    );
  }

  const p = account.patients;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Heart className="size-6 text-primary" /> Hello, {p?.full_name}</h1>
        <p className="text-sm text-muted-foreground">UHID {p?.uhid}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Upcoming</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.appts.length}</div><div className="text-xs text-muted-foreground">appointments</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Prescriptions</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.rx.length}</div><div className="text-xs text-muted-foreground">recent</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Lab Reports</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{data.labs.length}</div><div className="text-xs text-muted-foreground">available</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Outstanding</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inr(data.bills.filter((b: any) => b.status !== "paid").reduce((a: number, b: any) => a + Number(b.net_amount || 0), 0))}</div>
            <div className="text-xs text-muted-foreground">due</div></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="size-4" /> Appointments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.appts.length === 0 && <div className="text-sm text-muted-foreground">No appointments.</div>}
            {data.appts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded border">
                <div>
                  <div className="font-medium text-sm">{a.profiles?.full_name ?? "Doctor"}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "dd MMM yyyy, HH:mm")}</div>
                </div>
                <Badge variant="outline" className="capitalize">{a.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Pill className="size-4" /> Prescriptions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.rx.length === 0 && <div className="text-sm text-muted-foreground">No prescriptions.</div>}
            {data.rx.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded border">
                <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy")}</div>
                <Badge variant="outline" className="capitalize">{r.status ?? "active"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="size-4" /> Lab Reports</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.labs.length === 0 && <div className="text-sm text-muted-foreground">No reports.</div>}
            {data.labs.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-2 rounded border">
                <div className="text-sm font-mono">{l.order_no}</div>
                <Badge variant="outline" className="capitalize">{l.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="size-4" /> Bills</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.bills.length === 0 && <div className="text-sm text-muted-foreground">No bills.</div>}
            {data.bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded border">
                <div>
                  <div className="text-sm font-mono">{b.bill_no}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(b.created_at), "dd MMM yyyy")}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{inr(b.net_amount)}</div>
                  <Badge variant={b.status === "paid" ? "default" : "outline"} className="capitalize">{b.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Family Members</CardTitle></CardHeader>
        <CardContent>
          {data.family.length === 0 ? (
            <div className="text-sm text-muted-foreground">No linked family members. Add at reception.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.family.map((f: any) => (
                <div key={f.id} className="p-3 rounded border">
                  <div className="font-medium">{f.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground">UHID {f.patients?.uhid} · {f.relationship}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
