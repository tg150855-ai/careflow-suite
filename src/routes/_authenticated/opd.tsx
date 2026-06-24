import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, Users, Clock, CheckCircle2, Activity,
  IndianRupee, AlertCircle, UserPlus, CalendarPlus, PlayCircle,
} from "lucide-react";
import { format } from "date-fns";
import { OpdSubNav } from "@/components/opd-sub-nav";

export const Route = createFileRoute("/_authenticated/opd")({ component: OpdLayout });

function OpdLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/opd";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">OPD</h1>
          <p className="text-muted-foreground mt-1">Outpatient department — dashboard, registration, queue, consultation & billing.</p>
        </div>
      </div>
      <OpdSubNav />
      {isIndex ? <OpdDashboard /> : <Outlet />}
    </div>
  );
}

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function endOfToday() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}

function OpdDashboard() {
  const qc = useQueryClient();
  const today = startOfToday();
  const endToday = endOfToday();

  const { data: appts = [] } = useQuery({
    queryKey: ["opd-dash-appts", today.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, token_no, patients(full_name, uhid), doctors(id, name, specialization)")
        .gte("scheduled_at", today.toISOString())
        .lte("scheduled_at", endToday.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("opd-dashboard-workflow")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-dash-appts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-dash-appts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => {
        qc.invalidateQueries({ queryKey: ["opd-dash-bills"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: billsToday = [] } = useQuery({
    queryKey: ["opd-dash-bills", today.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id, total, paid, status, created_at")
        .gte("created_at", today.toISOString())
        .lte("created_at", endToday.toISOString());
      return data ?? [];
    },
  });

  const waiting = appts.filter((a: any) => ["booked", "checked_in", "waiting"].includes(a.status));
  const inProgress = appts.filter((a: any) => a.status === "in_consultation");
  const completed = appts.filter((a: any) => a.status === "completed");
  const walkIns = 0;
  const scheduled = appts.length;

  const totalBilling = billsToday.reduce((s: number, b: any) => s + Number(b.total ?? 0), 0);
  const totalPaid = billsToday.reduce((s: number, b: any) => s + Number(b.paid ?? 0), 0);
  const pendingPayments = totalBilling - totalPaid;

  // Doctor-wise split of waiting/in-progress
  const byDoctor = new Map<string, { name: string; spec?: string; waiting: number; inProgress: number }>();
  for (const a of [...waiting, ...inProgress] as any[]) {
    const d = a.doctors;
    if (!d) continue;
    const cur = byDoctor.get(d.id) ?? { name: d.name, spec: d.specialization, waiting: 0, inProgress: 0 };
    if (a.status === "in_consultation") cur.inProgress++; else cur.waiting++;
    byDoctor.set(d.id, cur);
  }
  const doctorRows = Array.from(byDoctor.values()).sort((a, b) => (b.waiting + b.inProgress) - (a.waiting + a.inProgress));

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/opd/registration"><UserPlus className="size-4" />New Patient Registration</Link></Button>
        <Button asChild variant="secondary"><Link to="/opd/appointments"><CalendarPlus className="size-4" />Book Appointment</Link></Button>
        <Button asChild variant="outline"><Link to="/opd/consultation"><PlayCircle className="size-4" />Start Consultation</Link></Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Patients today" value={appts.length} icon={Users} tone="default" />
        <StatCard label="Waiting" value={waiting.length} icon={Clock} tone="warning" />
        <StatCard label="In consultation" value={inProgress.length} icon={Activity} tone="info" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Billing today" value={`₹${totalBilling.toLocaleString("en-IN")}`} icon={IndianRupee} tone="default" />
        <StatCard label="Pending payments" value={`₹${pendingPayments.toLocaleString("en-IN")}`} icon={AlertCircle} tone={pendingPayments > 0 ? "warning" : "default"} />
        <StatCard label="Scheduled" value={scheduled} icon={Stethoscope} tone="default" />
        <StatCard label="Walk-ins" value={walkIns} icon={UserPlus} tone="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live queue */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold">Live OPD Queue</h2>
              <p className="text-xs text-muted-foreground">{waiting.length + inProgress.length} patients in queue</p>
            </div>
            <Button asChild size="sm" variant="ghost"><Link to="/opd/appointments">View all</Link></Button>
          </div>
          {waiting.length + inProgress.length === 0 ? (
            <div className="p-12 text-center">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No patients in queue right now.</p>
              <Button asChild className="mt-4" size="sm"><Link to="/opd/appointments">Book or check-in</Link></Button>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
              {[...inProgress, ...waiting].map((a: any) => (
                <div key={a.id} className="flex items-center gap-4 p-3 hover:bg-surface-muted transition-colors">
                  <div className="w-14 text-center shrink-0">
                    <div className="text-base font-semibold tabular-nums">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.patients?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.patients?.uhid} · {a.doctors?.name}{a.doctors?.specialization ? ` (${a.doctors.specialization})` : ""}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                  <Button asChild size="sm" variant={a.status === "in_consultation" ? "default" : "outline"}>
                    <Link to="/opd/consultation" onClick={() => sessionStorage.setItem("opd-consultation-appointment-id", a.id)}>
                      {a.status === "in_consultation" ? "Resume" : "Start"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Doctor-wise split */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Doctor-wise queue</h2>
            <p className="text-xs text-muted-foreground">Active patients per doctor</p>
          </div>
          {doctorRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No active consultations.</div>
          ) : (
            <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
              {doctorRows.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    {d.spec ? <div className="text-xs text-muted-foreground truncate">{d.spec}</div> : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.inProgress > 0 ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        {d.inProgress} in-consult
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {d.waiting} waiting
                    </Badge>
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

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: any; tone: "default" | "warning" | "info" | "success" }) {
  const toneClasses: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value}</div>
        </div>
        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    in_consultation: { label: "In consult", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
    waiting: { label: "Waiting", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
    checked_in: { label: "Checked-in", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
    booked: { label: "Booked", cls: "bg-muted text-muted-foreground" },
    completed: { label: "Done", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="secondary" className={v.cls}>{v.label}</Badge>;
}
