import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Users, CalendarDays, Stethoscope, Activity, TrendingUp, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const iso = startOfDay.toISOString();
      const [patients, todayAppts, todayOpd, upcoming] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("scheduled_at", iso),
        supabase.from("opd_visits").select("*", { count: "exact", head: true }).gte("created_at", iso),
        supabase.from("appointments").select("id, scheduled_at, status, patients(full_name, uhid), doctors(name)").gte("scheduled_at", iso).order("scheduled_at").limit(8),
      ]);
      return {
        totalPatients: patients.count ?? 0,
        todayAppts: todayAppts.count ?? 0,
        todayOpd: todayOpd.count ?? 0,
        pending: (upcoming.data ?? []).filter((a) => a.status === "booked" || a.status === "waiting").length,
        upcoming: upcoming.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Today's OPD", value: stats?.todayOpd ?? 0, icon: Stethoscope, color: "primary", growth: "+12%" },
    { label: "Today's Appointments", value: stats?.todayAppts ?? 0, icon: CalendarDays, color: "accent", growth: "+8%" },
    { label: "Total Patients", value: stats?.totalPatients ?? 0, icon: Users, color: "primary", growth: "+3%" },
    { label: "Pending Queue", value: stats?.pending ?? 0, icon: Activity, color: "warning", growth: "live" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Good {greeting()}</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening at your hospital today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6 hover:shadow-card transition-shadow border-border/60">
              <div className="flex items-start justify-between">
                <div className={`size-11 rounded-2xl flex items-center justify-center bg-${c.color}/10 text-${c.color}`}
                     style={{
                       background: c.color === "primary" ? "color-mix(in oklch, var(--primary) 12%, transparent)"
                                  : c.color === "accent" ? "color-mix(in oklch, var(--accent) 14%, transparent)"
                                  : "color-mix(in oklch, var(--warning) 18%, transparent)",
                       color: c.color === "primary" ? "var(--primary)"
                            : c.color === "accent" ? "var(--accent)"
                            : "var(--warning-foreground)",
                     }}>
                  <c.icon className="size-5" />
                </div>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <TrendingUp className="size-3" /> {c.growth}
                </span>
              </div>
              <div className="mt-5">
                <div className="text-3xl font-semibold tracking-tight">{c.value.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Today's appointment queue</h2>
            <a href="/appointments" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              View all <ArrowUpRight className="size-3" />
            </a>
          </div>
          {stats?.upcoming.length === 0 ? (
            <EmptyState text="No appointments scheduled for today" />
          ) : (
            <div className="divide-y">
              {stats?.upcoming.map((a: any) => (
                <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                      {(a.patients?.full_name ?? "?").slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.patients?.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.patients?.uhid} · {a.doctors?.name}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.status.replace("_"," ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-5">Quick actions</h2>
          <div className="space-y-2.5">
            <ActionLink href="/patients/new" label="Register new patient" />
            <ActionLink href="/appointments" label="Book appointment" />
            <ActionLink href="/opd" label="Start OPD consultation" />
            <ActionLink href="/reports" label="Generate report" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary-soft/40 transition-all group">
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-10">{text}</div>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
