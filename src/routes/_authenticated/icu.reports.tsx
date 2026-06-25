import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, MessageCircle, FileBarChart } from "lucide-react";
import { format, startOfDay, startOfMonth, startOfYear } from "date-fns";

export const Route = createFileRoute("/_authenticated/icu/reports")({ component: ICUReports });

function ICUReports() {
  const [range, setRange] = useState<"day" | "month" | "year">("day");
  const [from] = useState(() => new Date());
  const start =
    range === "day" ? startOfDay(from) : range === "month" ? startOfMonth(from) : startOfYear(from);

  const { data } = useQuery({
    queryKey: ["icu-reports", range],
    queryFn: async () => {
      const [adm, vents, procs, bills] = await Promise.all([
        supabase
          .from("admissions")
          .select("id, admission_no, admitted_at, discharged_at, status, icu_status, patients(full_name, uhid), doctors(name), beds(bed_number), wards(name, type)")
          .gte("admitted_at", start.toISOString()),
        (supabase as any).from("icu_ventilator_records").select("*, patients(full_name)").gte("start_date", start.toISOString()),
        (supabase as any).from("icu_procedures").select("*, patients(full_name)").gte("performed_at", start.toISOString()),
        (supabase as any).from("bills").select("id, total, paid, pending, admission_id, created_at, status").gte("created_at", start.toISOString()),
      ]);
      const icuAdm = (adm.data ?? []).filter((a: any) => a.wards?.type === "icu" || a.icu_status === "critical" || a.icu_status === "ventilator");
      return {
        admissions: icuAdm,
        ventilators: vents.data ?? [],
        procedures: procs.data ?? [],
        bills: bills.data ?? [],
      };
    },
  });

  const census = (data?.admissions ?? []).length;
  const ventCount = (data?.ventilators ?? []).length;
  const procCount = (data?.procedures ?? []).length;
  const totalRevenue = (data?.bills ?? []).reduce((s: number, b: any) => s + Number(b.paid ?? 0), 0);
  const pending = (data?.bills ?? []).reduce((s: number, b: any) => s + Number(b.pending ?? 0), 0);

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileBarChart className="size-6 text-primary" /> ICU Reports
          </h1>
          <p className="text-sm text-muted-foreground">Census, ventilator, procedures and billing reports.</p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" />
            Print
          </Button>
          <Button asChild variant="ghost">
            <Link to="/icu">
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="ICU census" value={census} />
        <KPI label="Ventilator records" value={ventCount} />
        <KPI label="Procedures" value={procCount} />
        <KPI label="Revenue collected" value={`₹${totalRevenue.toLocaleString()}`} />
        <KPI label="Pending dues" value={`₹${pending.toLocaleString()}`} />
      </div>

      <ReportCard
        title="ICU Census report"
        rows={(data?.admissions ?? []).map((a: any) => ({
          admission_no: a.admission_no,
          patient: a.patients?.full_name,
          uhid: a.patients?.uhid,
          doctor: a.doctors?.name,
          bed: a.beds?.bed_number,
          ward: a.wards?.name,
          icu_status: a.icu_status,
          admitted_at: a.admitted_at ? format(new Date(a.admitted_at), "dd MMM yy HH:mm") : "",
          discharged_at: a.discharged_at ? format(new Date(a.discharged_at), "dd MMM yy HH:mm") : "",
        }))}
        onExport={(rows) => exportCSV(rows, `icu-census-${range}.csv`)}
      />

      <ReportCard
        title="Ventilator report"
        rows={(data?.ventilators ?? []).map((v: any) => ({
          patient: v.patients?.full_name,
          type: v.vent_type,
          mode: v.mode,
          fio2: v.fio2,
          peep: v.peep,
          status: v.status,
          start: v.start_date ? format(new Date(v.start_date), "dd MMM yy HH:mm") : "",
          end: v.end_date ? format(new Date(v.end_date), "dd MMM yy HH:mm") : "",
        }))}
        onExport={(rows) => exportCSV(rows, `icu-ventilator-${range}.csv`)}
      />

      <ReportCard
        title="Procedures report"
        rows={(data?.procedures ?? []).map((p: any) => ({
          patient: p.patients?.full_name,
          procedure: p.procedure_type,
          charges: p.charges,
          performed_at: p.performed_at ? format(new Date(p.performed_at), "dd MMM yy HH:mm") : "",
        }))}
        onExport={(rows) => exportCSV(rows, `icu-procedures-${range}.csv`)}
      />

      <ReportCard
        title="Billing report"
        rows={(data?.bills ?? []).map((b: any) => ({
          bill_id: b.id,
          admission_id: b.admission_id,
          total: b.total,
          paid: b.paid,
          pending: b.pending,
          status: b.status,
          created_at: b.created_at ? format(new Date(b.created_at), "dd MMM yy") : "",
        }))}
        onExport={(rows) => exportCSV(rows, `icu-billing-${range}.csv`)}
      />
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

function ReportCard({ title, rows, onExport }: { title: string; rows: any[]; onExport: (rows: any[]) => void }) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const waLink = `https://wa.me/?text=${encodeURIComponent(`${title} (${rows.length} records)`)}`;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="font-semibold">{title}</div>
        <Badge variant="secondary">{rows.length}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onExport(rows)} disabled={!rows.length}>
            <Download className="size-3.5 mr-1.5" />
            CSV
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={waLink} target="_blank" rel="noreferrer">
              <MessageCircle className="size-3.5 mr-1.5" />
              WhatsApp
            </a>
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No records.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="text-left px-3 py-2 capitalize">
                    {h.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i} className="border-t">
                  {headers.map((h) => (
                    <td key={h} className="px-3 py-2">
                      {String(r[h] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
