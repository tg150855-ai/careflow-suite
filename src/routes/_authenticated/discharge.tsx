import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Search, Download, FileText, Users, Clock, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp } from "@/lib/share";
import { toast } from "sonner";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/discharge")({ component: DischargeModule });

function DischargeModule() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rawQ, setRawQ] = useState("");
  const [q, setQ] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<"all" | "with" | "without">("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(rawQ), 300);
    return () => clearTimeout(t);
  }, [rawQ]);

  const { data: rows = [] } = useQuery({
    queryKey: ["discharge-module", from, to],
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const res = await supabase
        .from("admissions")
        .select(
          "id, admission_no, admitted_at, discharged_at, reason, patients(id, full_name, uhid, mobile), doctors(name), beds(bed_number), wards(name), discharge_summaries(id, final_diagnosis, follow_up_date, condition_at_discharge)",
        )
        .eq("status", "discharged")
        .gte("discharged_at", fromIso)
        .lte("discharged_at", toIso)
        .order("discharged_at", { ascending: false });
      return res.data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((a: any) => {
      const ds = Array.isArray(a.discharge_summaries) ? a.discharge_summaries[0] : a.discharge_summaries;
      if (summaryFilter === "with" && !ds?.id) return false;
      if (summaryFilter === "without" && ds?.id) return false;
      if (!t) return true;
      return (
        a.patients?.full_name?.toLowerCase().includes(t) ||
        a.patients?.uhid?.toLowerCase().includes(t) ||
        a.patients?.mobile?.toLowerCase().includes(t) ||
        a.admission_no?.toLowerCase().includes(t) ||
        a.doctors?.name?.toLowerCase().includes(t)
      );
    });
  }, [rows, q, summaryFilter]);

  const stats = useMemo(() => {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    let todayC = 0, monthC = 0, pending = 0;
    rows.forEach((a: any) => {
      const d = a.discharged_at ? new Date(a.discharged_at) : null;
      if (d && d >= today0) todayC++;
      if (d && d >= monthStart) monthC++;
      const ds = Array.isArray(a.discharge_summaries) ? a.discharge_summaries[0] : a.discharge_summaries;
      if (!ds?.id) pending++;
    });
    return { total: rows.length, today: todayC, month: monthC, pending };
  }, [rows]);

  const cards = [
    { label: "Total in range", value: stats.total, icon: Users, hint: `${format(new Date(from), "dd MMM")} → ${format(new Date(to), "dd MMM")}` },
    { label: "Today", value: stats.today, icon: Clock, hint: "Discharged today" },
    { label: "This month", value: stats.month, icon: CheckCircle2, hint: "Since 1st" },
    { label: "Pending summary", value: stats.pending, icon: FileText, hint: "No discharge summary saved" },
  ];

  const exportRows = () =>
    exportXlsx(
      filtered.map((a: any) => {
        const ds = Array.isArray(a.discharge_summaries) ? a.discharge_summaries[0] : a.discharge_summaries;
        const stay = a.discharged_at ? differenceInDays(new Date(a.discharged_at), new Date(a.admitted_at)) + 1 : 0;
        return {
          "Admission #": a.admission_no,
          Patient: a.patients?.full_name ?? "",
          UHID: a.patients?.uhid ?? "",
          Mobile: a.patients?.mobile ?? "",
          Admitted: format(new Date(a.admitted_at), "dd MMM yyyy"),
          Discharged: a.discharged_at ? format(new Date(a.discharged_at), "dd MMM yyyy") : "",
          "Stay (days)": stay,
          Doctor: a.doctors?.name ?? "",
          Ward: a.wards?.name ?? "",
          Bed: a.beds?.bed_number ?? "",
          Condition: ds?.condition_at_discharge ?? "",
          "Final Diagnosis": ds?.final_diagnosis ?? "",
          "Summary?": ds?.id ? "Yes" : "No",
        };
      }),
      `Discharge_Export_${format(new Date(), "dd-MM-yyyy")}`,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
            <LogOut className="size-7 text-primary" /> Discharge
          </h1>
          <p className="text-muted-foreground mt-1">Manage discharged patients, summaries, and follow-ups.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-6">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <c.icon className="size-5" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
            <div className="text-sm font-medium mt-1">{c.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="font-semibold">Discharged patients</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground text-sm">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            <Button size="sm" variant="outline" onClick={() => { const d = new Date().toISOString().slice(0, 10); setFrom(d); setTo(d); }}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => { setFrom(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)); setTo(today); }}>Week</Button>
            <Button size="sm" variant="outline" onClick={() => { setFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)); setTo(today); }}>Month</Button>
            <Select value={summaryFilter} onValueChange={(v: any) => setSummaryFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All summaries</SelectItem>
                <SelectItem value="with">With summary</SelectItem>
                <SelectItem value="without">Missing summary</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={rawQ} onChange={(e) => setRawQ(e.target.value)} placeholder="Search name, UHID, adm #, mobile, doctor" className="pl-9" />
            </div>
            <Button size="sm" variant="outline" onClick={exportRows}><Download className="size-4 mr-1" />Export</Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-6 py-2.5">Admission #</th>
                <th className="text-left font-medium py-2.5">Patient</th>
                <th className="text-left font-medium py-2.5">Discharged</th>
                <th className="text-left font-medium py-2.5">Stay</th>
                <th className="text-left font-medium py-2.5">Doctor</th>
                <th className="text-left font-medium py-2.5">Diagnosis</th>
                <th className="text-left font-medium py-2.5">Summary</th>
                <th className="text-right font-medium px-6 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a: any) => {
                const ds = Array.isArray(a.discharge_summaries) ? a.discharge_summaries[0] : a.discharge_summaries;
                const stay = a.discharged_at ? differenceInDays(new Date(a.discharged_at), new Date(a.admitted_at)) + 1 : 0;
                return (
                  <tr key={a.id} className="hover:bg-surface-muted/60">
                    <td className="px-6 py-3 font-mono text-xs">{a.admission_no}</td>
                    <td className="py-3">
                      <div className="font-medium">{a.patients?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{a.patients?.uhid}</div>
                    </td>
                    <td className="py-3 text-muted-foreground">{a.discharged_at ? format(new Date(a.discharged_at), "dd MMM yyyy") : "—"}</td>
                    <td className="py-3"><Badge variant="secondary">{stay}d</Badge></td>
                    <td className="py-3">{a.doctors?.name ?? "—"}</td>
                    <td className="py-3 max-w-xs truncate text-muted-foreground">{ds?.final_diagnosis ?? a.reason ?? "—"}</td>
                    <td className="py-3">
                      {ds?.id ? <Badge variant="default">Saved</Badge> : <Badge variant="outline">Missing</Badge>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {ds?.id && (
                          <Button asChild size="sm" variant="ghost">
                            <a href={`/discharge/${ds.id}/print`} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/ipd/$id" params={{ id: a.id }}>Open</Link>
                        </Button>
                        <RecordActions
                          size="icon"
                          onEdit={() => navigate({ to: "/ipd/$id/discharge", params: { id: a.id } })}
                          onPrint={() => {
                            if (ds?.id) window.open(`/discharge/${ds.id}/print`, "_blank");
                            else toast.error("No discharge summary saved yet");
                          }}
                          onWhatsApp={() => {
                            const url = ds?.id ? `${window.location.origin}/discharge/${ds.id}/print` : undefined;
                            const msg = [
                              `*Discharge Summary*`,
                              `Patient: ${a.patients?.full_name ?? "—"} (${a.patients?.uhid ?? "—"})`,
                              `Admission: ${a.admission_no}`,
                              `Admitted: ${format(new Date(a.admitted_at), "dd MMM yyyy")}`,
                              a.discharged_at && `Discharged: ${format(new Date(a.discharged_at), "dd MMM yyyy")}`,
                              `Stay: ${stay} day(s)`,
                              ds?.condition_at_discharge && `Condition: ${ds.condition_at_discharge}`,
                              ds?.final_diagnosis && `Diagnosis: ${ds.final_diagnosis}`,
                              ds?.follow_up_date && `Follow-up: ${format(new Date(ds.follow_up_date), "dd MMM yyyy")}`,
                            ].filter(Boolean).join("\n");
                            shareOnWhatsApp(msg, url, a.patients?.mobile ?? undefined);
                          }}
                          deleteLabel={`discharge ${a.admission_no}`}
                          onDelete={async () => {
                            if (ds?.id) await supabase.from("discharge_summaries").delete().eq("id", ds.id);
                            await supabase.from("admissions").update({ status: "active", discharged_at: null }).eq("id", a.id);
                            toast.success("Discharge reverted — admission back to active");
                            qc.invalidateQueries({ queryKey: ["discharge-module"] });
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No discharges in range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
