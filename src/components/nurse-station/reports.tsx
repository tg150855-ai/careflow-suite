import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, Share2, FileSpreadsheet } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { exportXlsx } from "@/lib/export";
import { NS_QK } from "./shared";

const REPORTS = ["Nursing Notes", "Medication Administration", "Shift Handover", "Vitals"];

export function NSReports() {
  const [report, setReport] = useState(REPORTS[0]);
  const [period, setPeriod] = useState<"day" | "month" | "year">("day");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [wardId, setWardId] = useState("all");

  const { data: wards = [] } = useQuery({ queryKey: NS_QK.wards, queryFn: async () => (await supabase.from("wards").select("id, name")).data ?? [] });

  const range = useMemo(() => {
    const d = new Date(date);
    if (period === "day") return { from: startOfDay(d), to: endOfDay(d) };
    if (period === "month") return { from: startOfMonth(d), to: endOfMonth(d) };
    return { from: startOfYear(d), to: endOfYear(d) };
  }, [date, period]);

  const { data: rows = [] } = useQuery({
    queryKey: ["ns-report", report, range.from.toISOString(), range.to.toISOString(), wardId],
    queryFn: async () => {
      const f = range.from.toISOString(); const t = range.to.toISOString();
      if (report === "Nursing Notes") {
        const { data } = await supabase.from("nursing_notes").select("created_at, shift, note, admissions(ward_id, patients(full_name, uhid), wards(name))")
          .gte("created_at", f).lte("created_at", t).order("created_at", { ascending: false });
        return (data ?? []).filter((r: any) => wardId === "all" || r.admissions?.ward_id === wardId);
      }
      if (report === "Medication Administration") {
        const { data } = await supabase.from("medication_administration").select("scheduled_at, administered_at, medicine_name, dosage, status, admissions(ward_id, patients(full_name, uhid), wards(name))")
          .gte("scheduled_at", f).lte("scheduled_at", t).order("scheduled_at", { ascending: false });
        return (data ?? []).filter((r: any) => wardId === "all" || r.admissions?.ward_id === wardId);
      }
      if (report === "Shift Handover") {
        let q: any = (supabase as any).from("shift_handovers").select("*, wards(name)").gte("created_at", f).lte("created_at", t).order("created_at", { ascending: false });
        if (wardId !== "all") q = q.eq("ward_id", wardId);
        return (await q).data ?? [];
      }
      const { data } = await supabase.from("vitals").select("recorded_at, systolic, diastolic, pulse, temperature, oxygen, respiratory_rate, admissions(ward_id, patients(full_name, uhid), wards(name))")
        .gte("recorded_at", f).lte("recorded_at", t).order("recorded_at", { ascending: false });
      return (data ?? []).filter((r: any) => wardId === "all" || r.admissions?.ward_id === wardId);
    },
  });

  const columns: { key: string; label: string; get: (r: any) => string }[] = useMemo(() => {
    if (report === "Nursing Notes") return [
      { key: "time", label: "Time", get: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { key: "patient", label: "Patient", get: (r) => r.admissions?.patients?.full_name ?? "" },
      { key: "uhid", label: "UHID", get: (r) => r.admissions?.patients?.uhid ?? "" },
      { key: "ward", label: "Ward", get: (r) => r.admissions?.wards?.name ?? "" },
      { key: "shift", label: "Shift", get: (r) => r.shift },
      { key: "note", label: "Note", get: (r) => r.note ?? "" },
    ];
    if (report === "Medication Administration") return [
      { key: "sch", label: "Scheduled", get: (r) => format(new Date(r.scheduled_at), "yyyy-MM-dd HH:mm") },
      { key: "given", label: "Given", get: (r) => r.administered_at ? format(new Date(r.administered_at), "HH:mm") : "" },
      { key: "patient", label: "Patient", get: (r) => r.admissions?.patients?.full_name ?? "" },
      { key: "ward", label: "Ward", get: (r) => r.admissions?.wards?.name ?? "" },
      { key: "med", label: "Medicine", get: (r) => `${r.medicine_name} ${r.dosage ?? ""}` },
      { key: "status", label: "Status", get: (r) => r.status },
    ];
    if (report === "Shift Handover") return [
      { key: "time", label: "Time", get: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { key: "shift", label: "Shift", get: (r) => r.shift },
      { key: "ward", label: "Ward", get: (r) => r.wards?.name ?? "" },
      { key: "from", label: "From", get: (r) => r.outgoing_nurse_name ?? "" },
      { key: "to", label: "To", get: (r) => r.incoming_nurse_name ?? "" },
      { key: "notes", label: "Notes", get: (r) => r.notes ?? "" },
    ];
    return [
      { key: "time", label: "Time", get: (r) => format(new Date(r.recorded_at), "yyyy-MM-dd HH:mm") },
      { key: "patient", label: "Patient", get: (r) => r.admissions?.patients?.full_name ?? "" },
      { key: "ward", label: "Ward", get: (r) => r.admissions?.wards?.name ?? "" },
      { key: "bp", label: "BP", get: (r) => `${r.systolic ?? "-"}/${r.diastolic ?? "-"}` },
      { key: "pulse", label: "Pulse", get: (r) => String(r.pulse ?? "") },
      { key: "spo2", label: "SpO₂", get: (r) => String(r.oxygen ?? "") },
      { key: "temp", label: "Temp", get: (r) => String(r.temperature ?? "") },
      { key: "rr", label: "RR", get: (r) => String(r.respiratory_rate ?? "") },
    ];
  }, [report]);

  const exportExcel = () => {
    const data = (rows as any[]).map((r) => Object.fromEntries(columns.map((c) => [c.label, c.get(r)])));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, report.slice(0, 30));
    XLSX.writeFile(wb, `nurse-${report.toLowerCase().replace(/\s+/g, "-")}-${date}.xlsx`);
  };

  const downloadCsv = () => {
    const csv = [columns.map((c) => c.label).join(","), ...(rows as any[]).map((r) => columns.map((c) => `"${c.get(r).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${report}-${date}.csv`; a.click();
  };

  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const hd = columns.map((c) => `<th>${c.label}</th>`).join("");
    const bd = (rows as any[]).map((r) => `<tr>${columns.map((c) => `<td>${c.get(r)}</td>`).join("")}</tr>`).join("");
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px"><h3>${report} — ${period} ${date}</h3><table border="1" cellspacing="0" cellpadding="6"><thead><tr>${hd}</tr></thead><tbody>${bd}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const whatsapp = () => {
    const summary = `${report} report — ${date} (${period})\nTotal records: ${rows.length}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={report} onValueChange={setReport}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{REPORTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <Select value={wardId} onValueChange={setWardId}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All wards</SelectItem>{(wards as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadCsv}><Download className="size-4 mr-1" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="size-4 mr-1" /> Excel</Button>
            <Button size="sm" variant="outline" onClick={print}><Printer className="size-4 mr-1" /> Print / PDF</Button>
            <Button size="sm" variant="outline" onClick={whatsapp}><Share2 className="size-4 mr-1" /> WhatsApp</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Records: {rows.length}</div>
      </CardContent></Card>

      <Card><CardContent className="p-2 overflow-auto">
        <Table>
          <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).length === 0 && <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>}
            {(rows as any[]).map((r, i) => (
              <TableRow key={i}>{columns.map((c) => <TableCell key={c.key} className="text-xs">{c.get(r)}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
