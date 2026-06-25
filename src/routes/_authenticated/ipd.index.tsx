import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BedDouble, Plus, UserPlus, Activity, LogOut, Search, FileBarChart, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/ipd/")({ component: IPDDashboard });

function IPDDashboard() {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["ipd-dashboard"],
    queryFn: async () => {
      const [active, today, beds, dischToday] = await Promise.all([
        supabase
          .from("admissions")
          .select("id, admission_no, admitted_at, status, reason, initial_diagnosis, patients(full_name, uhid, mobile), doctors(name), beds(bed_number), wards(name, type)")
          .eq("status", "active")
          .order("admitted_at", { ascending: false }),
        supabase.from("admissions").select("id", { count: "exact", head: true }).gte("admitted_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from("beds").select("status"),
        supabase.from("admissions").select("id", { count: "exact", head: true }).eq("status", "discharged").gte("discharged_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      const bedStats = { available: 0, occupied: 0, cleaning: 0, reserved: 0, maintenance: 0 };
      (beds.data ?? []).forEach((b: any) => { bedStats[b.status as keyof typeof bedStats]++; });
      const total = (beds.data ?? []).length;
      return {
        admissions: active.data ?? [],
        admissionsToday: today.count ?? 0,
        dischargesToday: dischToday.count ?? 0,
        bedStats,
        occupancy: total ? Math.round((bedStats.occupied / total) * 100) : 0,
      };
    },
  });

  const filtered = (data?.admissions ?? []).filter((a: any) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      a.patients?.full_name?.toLowerCase().includes(t) ||
      a.patients?.uhid?.toLowerCase().includes(t) ||
      a.admission_no?.toLowerCase().includes(t) ||
      a.beds?.bed_number?.toLowerCase().includes(t)
    );
  });

  const cards = [
    { label: "Active admissions", value: data?.admissions.length ?? 0, icon: UserPlus, hint: "Currently in hospital" },
    { label: "Admissions today", value: data?.admissionsToday ?? 0, icon: Activity, hint: "Last 24 hours" },
    { label: "Discharges today", value: data?.dischargesToday ?? 0, icon: LogOut, hint: "Discharged today" },
    { label: "Occupancy", value: `${data?.occupancy ?? 0}%`, icon: BedDouble, hint: `${data?.bedStats.occupied ?? 0} / ${(data?.bedStats.available ?? 0) + (data?.bedStats.occupied ?? 0) + (data?.bedStats.cleaning ?? 0) + (data?.bedStats.reserved ?? 0) + (data?.bedStats.maintenance ?? 0)} beds` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">In-Patient Department</h1>
          <p className="text-muted-foreground mt-1">Admissions, beds and ward management</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg"><Link to="/ipd/beds"><BedDouble className="size-4 mr-2" />Bed map</Link></Button>
          <Button asChild size="lg"><Link to="/ipd/new"><Plus className="size-4 mr-2" />New admission</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6">
              <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4"><c.icon className="size-5" /></div>
              <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
              <div className="text-sm font-medium mt-1">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-semibold">Active admissions</h2>
          <div className="relative w-72">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, UHID or bed" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-6 py-2.5">Admission #</th>
                <th className="text-left font-medium py-2.5">Patient</th>
                <th className="text-left font-medium py-2.5">Bed / Ward</th>
                <th className="text-left font-medium py-2.5">Doctor</th>
                <th className="text-left font-medium py-2.5">Days</th>
                <th className="text-left font-medium py-2.5">Reason</th>
                <th className="text-right font-medium px-6 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a: any) => {
                const days = differenceInDays(new Date(), new Date(a.admitted_at)) + 1;
                return (
                  <tr key={a.id} className="hover:bg-surface-muted/60">
                    <td className="px-6 py-3 font-mono text-xs">{a.admission_no}</td>
                    <td className="py-3">
                      <div className="font-medium">{a.patients?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{a.patients?.uhid}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-medium">{a.beds?.bed_number ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.wards?.name}</div>
                    </td>
                    <td className="py-3">{a.doctors?.name}</td>
                    <td className="py-3"><Badge variant="secondary">{days}d</Badge></td>
                    <td className="py-3 max-w-xs truncate text-muted-foreground">{a.reason ?? a.initial_diagnosis ?? "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <Button asChild size="sm" variant="ghost"><Link to="/ipd/$id" params={{ id: a.id }}>Open</Link></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No active admissions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
