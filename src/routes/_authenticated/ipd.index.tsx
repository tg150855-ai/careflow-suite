import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BedDouble, Plus, UserPlus, Activity, LogOut, Search, FileBarChart, Settings, Download } from "lucide-react";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { useState, useMemo } from "react";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp } from "@/lib/share";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/ipd/")({ component: IPDDashboard });

function IPDDashboard() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "discharged">("active");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data } = useQuery({
    queryKey: ["ipd-dashboard"],
    queryFn: async () => {
      const [active, todayCount, beds, dischToday] = await Promise.all([
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
        admissionsToday: todayCount.count ?? 0,
        dischargesToday: dischToday.count ?? 0,
        bedStats,
        occupancy: total ? Math.round((bedStats.occupied / total) * 100) : 0,
      };
    },
  });

  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: discharged = [] } = useQuery({
    queryKey: ["ipd-discharged", from, to],
    enabled: tab === "discharged",
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const res = await supabase
        .from("admissions")
        .select("id, admission_no, admitted_at, discharged_at, reason, patients(full_name, uhid, mobile), doctors(name), beds(bed_number), wards(name), discharge_summaries(id, final_diagnosis, follow_up_date)")
        .eq("status", "discharged")
        .gte("discharged_at", fromIso)
        .lte("discharged_at", toIso)
        .order("discharged_at", { ascending: false });
      return res.data ?? [];
    },
  });

  const matchQ = (a: any) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      a.patients?.full_name?.toLowerCase().includes(t) ||
      a.patients?.uhid?.toLowerCase().includes(t) ||
      a.admission_no?.toLowerCase().includes(t) ||
      a.beds?.bed_number?.toLowerCase().includes(t)
    );
  };
  const filteredActive = (data?.admissions ?? []).filter(matchQ);
  const filteredDischarged = discharged.filter(matchQ);

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
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="ghost" size="lg"><Link to="/ipd/reports"><FileBarChart className="size-4 mr-2" />Reports</Link></Button>
          <Button asChild variant="ghost" size="lg"><Link to="/ipd/settings"><Settings className="size-4 mr-2" />Settings</Link></Button>
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
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="discharged">Discharged</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 flex-wrap">
              {tab === "discharged" && (
                <>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                  <span className="text-muted-foreground text-sm">→</span>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                </>
              )}
              <div className="relative w-64">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, UHID or bed" className="pl-9" />
              </div>
            </div>
          </div>

          <TabsContent value="active" className="mt-0">
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
                  {filteredActive.map((a: any) => {
                    const days = differenceInDays(new Date(), new Date(a.admitted_at)) + 1;
                    return (
                      <tr key={a.id} className="hover:bg-surface-muted/60">
                        <td className="px-6 py-3 font-mono text-xs">{a.admission_no}</td>
                        <td className="py-3">
                          <div className="font-medium">{a.patients?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{a.patients?.uhid ?? "—"}</div>
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{a.beds?.bed_number ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{a.wards?.name ?? "—"}</div>
                        </td>
                        <td className="py-3">{a.doctors?.name ?? "—"}</td>
                        <td className="py-3"><Badge variant="secondary">{days}d</Badge></td>
                        <td className="py-3 max-w-xs truncate text-muted-foreground">{a.reason ?? a.initial_diagnosis ?? "—"}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button asChild size="sm" variant="ghost"><Link to="/ipd/$id" params={{ id: a.id }}>Open</Link></Button>
                            <RecordActions
                              size="icon"
                              onEdit={() => navigate({ to: "/ipd/$id", params: { id: a.id } })}
                              onPrint={() => window.open(`/ipd/${a.id}`, "_blank")}
                              onWhatsApp={() => {
                                const msg = [
                                  `*IPD Admission* — ${a.patients?.full_name ?? "—"} (${a.patients?.uhid ?? "—"})`,
                                  `Admission: ${a.admission_no}`,
                                  `Admitted: ${format(new Date(a.admitted_at), "dd MMM yyyy")}`,
                                  `Bed: ${a.beds?.bed_number ?? "—"} · Ward: ${a.wards?.name ?? "—"}`,
                                  `Doctor: ${a.doctors?.name ?? "—"}`,
                                  a.reason && `Reason: ${a.reason}`,
                                ].filter(Boolean).join("\n");
                                shareOnWhatsApp(msg, undefined, a.patients?.mobile ?? undefined);
                              }}
                              deleteLabel={`admission ${a.admission_no}`}
                              onDelete={async () => {
                                const { error } = await supabase.from("admissions").delete().eq("id", a.id);
                                if (error) { toast.error(error.message); return; }
                                toast.success("Admission deleted");
                                qc.invalidateQueries({ queryKey: ["ipd-dashboard"] });
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredActive.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No active admissions.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="discharged" className="mt-0">
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="text-left font-medium px-6 py-2.5">Admission #</th>
                    <th className="text-left font-medium py-2.5">Patient</th>
                    <th className="text-left font-medium py-2.5">Admitted</th>
                    <th className="text-left font-medium py-2.5">Discharged</th>
                    <th className="text-left font-medium py-2.5">Stay</th>
                    <th className="text-left font-medium py-2.5">Doctor</th>
                    <th className="text-right font-medium px-6 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDischarged.map((a: any) => {
                    const stay = a.discharged_at ? differenceInDays(new Date(a.discharged_at), new Date(a.admitted_at)) + 1 : 0;
                    return (
                      <tr key={a.id} className="hover:bg-surface-muted/60">
                        <td className="px-6 py-3 font-mono text-xs">{a.admission_no}</td>
                        <td className="py-3">
                          <div className="font-medium">{a.patients?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{a.patients?.uhid}</div>
                        </td>
                        <td className="py-3 text-muted-foreground">{format(new Date(a.admitted_at), "dd MMM yyyy")}</td>
                        <td className="py-3 text-muted-foreground">{a.discharged_at ? format(new Date(a.discharged_at), "dd MMM yyyy") : "—"}</td>
                        <td className="py-3"><Badge variant="secondary">{stay}d</Badge></td>
                        <td className="py-3">{a.doctors?.name}</td>
                        <td className="px-6 py-3 text-right">
                          {(() => {
                            const ds = Array.isArray(a.discharge_summaries) ? a.discharge_summaries[0] : a.discharge_summaries;
                            return (
                              <RecordActions
                                size="icon"
                                onEdit={() => navigate({ to: "/ipd/$id/discharge", params: { id: a.id } })}
                                onPrint={() => {
                                  if (ds?.id) window.open(`/discharge/${ds.id}/print`, "_blank");
                                  else toast.error("No discharge summary saved yet");
                                }}
                                onWhatsApp={() => {
                                  const lines = [
                                    `*Discharge* — ${a.patients?.full_name} (${a.patients?.uhid})`,
                                    `Admission: ${a.admission_no}`,
                                    `Admitted: ${format(new Date(a.admitted_at), "dd MMM yyyy")}`,
                                    a.discharged_at && `Discharged: ${format(new Date(a.discharged_at), "dd MMM yyyy")}`,
                                    `Stay: ${stay} day(s)`,
                                    ds?.final_diagnosis && `Diagnosis: ${ds.final_diagnosis}`,
                                    ds?.follow_up_date && `Follow-up: ${format(new Date(ds.follow_up_date), "dd MMM yyyy")}`,
                                  ].filter(Boolean).join("\n");
                                  const url = ds?.id ? `${window.location.origin}/discharge/${ds.id}/print` : undefined;
                                  shareOnWhatsApp(lines, url, a.patients?.mobile ?? undefined);
                                }}
                                deleteLabel={`discharge ${a.admission_no}`}
                                onDelete={async () => {
                                  if (ds?.id) await supabase.from("discharge_summaries").delete().eq("id", ds.id);
                                  await supabase.from("admissions").update({ status: "active", discharged_at: null }).eq("id", a.id);
                                  toast.success("Discharge reverted — admission set back to active");
                                  qc.invalidateQueries({ queryKey: ["ipd-discharged"] });
                                  qc.invalidateQueries({ queryKey: ["ipd-dashboard"] });
                                }}
                              />
                            );
                          })()}
                          <Button asChild size="sm" variant="ghost" className="ml-1"><Link to="/ipd/$id" params={{ id: a.id }}>Open</Link></Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDischarged.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No discharges in range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
