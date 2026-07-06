import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer, Share2 } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, startOfYear, format } from "date-fns";
import { exportXlsx } from "@/lib/export";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ot/reports")({ component: OtReports });

type R = "today" | "month" | "year";
function bounds(r: R) {
  const n = new Date();
  if (r === "today") return { from: startOfDay(n), to: endOfDay(n) };
  if (r === "month") return { from: startOfMonth(n), to: endOfDay(n) };
  return { from: startOfYear(n), to: endOfDay(n) };
}

function OtReports() {
  const [range, setRange] = useState<R>("month");
  const [surgeon, setSurgeon] = useState("all");
  const [procedure, setProcedure] = useState("all");
  const { from, to } = useMemo(() => bounds(range), [range]);

  const { data: doctors = [] } = useQuery({ queryKey: ["ot-rep-docs"], queryFn: async () => (await supabase.from("doctors").select("id, name").order("name")).data ?? [] });
  const { data: rows = [] } = useQuery({
    queryKey: ["ot-rep", range, surgeon, procedure],
    queryFn: async () => {
      let q: any = (supabase as any).from("surgeries")
        .select("id, surgery_no, procedure_name, priority, status, scheduled_start, actual_start, actual_end, ot_charge, surgeon_charge, assistant_charge, anesthesia_charge, consumables_charge, estimated_cost, billed, patients(full_name, uhid), primary:primary_surgeon_id(name), ot_rooms(name)")
        .gte("scheduled_start", from.toISOString()).lte("scheduled_start", to.toISOString())
        .order("scheduled_start", { ascending: false });
      if (surgeon !== "all") q = q.eq("primary_surgeon_id", surgeon);
      if (procedure !== "all") q = q.eq("procedure_name", procedure);
      return (await q).data ?? [];
    },
  });

  const procedures = Array.from(new Set(rows.map((r: any) => r.procedure_name).filter(Boolean)));
  const total = rows.reduce((s: number, r: any) => s + Number(r.estimated_cost ?? 0), 0);
  const completed = rows.filter((r: any) => r.status === "completed").length;
  const cancelled = rows.filter((r: any) => r.status === "cancelled").length;

  function exportExcel() {
    exportXlsx(
      rows.map((r: any) => ({
        "Surgery No": r.surgery_no, Patient: r.patients?.full_name, UHID: r.patients?.uhid, Procedure: r.procedure_name,
        Surgeon: r.primary?.name, "OT Room": r.ot_rooms?.name, Priority: r.priority, Status: r.status,
        "Scheduled": r.scheduled_start ? format(new Date(r.scheduled_start), "dd MMM yyyy HH:mm") : "",
        "OT": r.ot_charge, "Surgeon Fee": r.surgeon_charge, "Assistant": r.assistant_charge,
        "Anesthesia": r.anesthesia_charge, "Consumables": r.consumables_charge, "Total": r.estimated_cost,
      })),
      `ot-report-${range}-${Date.now()}.xlsx`,
    );
  }

  function shareWhatsApp() {
    const text = `OT Report (${range})\nTotal surgeries: ${rows.length}\nCompleted: ${completed}\nCancelled: ${cancelled}\nRevenue: ${inr(total)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>OT Reports</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button variant="outline" onClick={() => window.print()}><Download className="size-4" /> PDF</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="size-4" /> Excel</Button>
            <Button variant="outline" onClick={shareWhatsApp}><Share2 className="size-4" /> WhatsApp</Button>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div><Label>Period</Label>
            <Select value={range} onValueChange={(v) => setRange(v as R)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Day</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Surgeon</Label>
            <Select value={surgeon} onValueChange={setSurgeon}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Procedure</Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{procedures.map((p) => <SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <Stat l="Total" v={rows.length} />
            <Stat l="Done" v={completed} />
            <Stat l="Revenue" v={inr(total)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Surgery No</TableHead><TableHead>Date</TableHead><TableHead>Patient</TableHead>
              <TableHead>Procedure</TableHead><TableHead>Surgeon</TableHead><TableHead>Priority</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data for filters</TableCell></TableRow>}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.surgery_no}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.scheduled_start), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell>{r.patients?.full_name}</TableCell>
                  <TableCell>{r.procedure_name}</TableCell>
                  <TableCell>{r.primary?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.priority}</TableCell>
                  <TableCell className="capitalize">{r.status.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">{inr(r.estimated_cost ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: React.ReactNode }) {
  return <div className="p-2 rounded border bg-card"><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-semibold">{v}</div></div>;
}
