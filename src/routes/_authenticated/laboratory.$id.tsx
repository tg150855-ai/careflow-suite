import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/_authenticated/laboratory/$id")({ component: LabOrderView });

const STATUSES = ["ordered", "sample_collected", "in_progress", "completed", "cancelled"] as const;

function LabOrderView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["lab-order", id],
    queryFn: async () => {
      const [order, results] = await Promise.all([
        supabase.from("lab_orders").select("*, patients(full_name, uhid, mobile, gender, dob), doctors(name, specialization)").eq("id", id).single(),
        supabase.from("lab_results").select("*").eq("order_id", id),
      ]);
      if (order.error) throw order.error;
      return { order: order.data, results: results.data ?? [] };
    },
  });

  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("ordered");

  useEffect(() => { if (data) { setRows(data.results); setStatus(data.order.status); } }, [data]);

  const saveResults = useMutation({
    mutationFn: async () => {
      for (const r of rows) {
        const { error } = await supabase.from("lab_results").update({
          result_value: r.result_value, unit: r.unit, reference_range: r.reference_range, flag: r.flag,
          result_entered_at: r.result_value ? new Date().toISOString() : null, result_entered_by: r.result_value ? user?.id : null,
        }).eq("id", r.id);
        if (error) throw error;
      }
      await supabase.from("lab_orders").update({ status: status as any }).eq("id", id);
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["lab-order", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const o = data.order;

  return (
    <div className="space-y-6 max-w-5xl print:max-w-none">
      <div className="flex items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/laboratory"><ArrowLeft className="size-4" /></Link></Button>
          <div><h1 className="text-2xl font-semibold tracking-tight">{o.order_no}</h1><p className="text-sm text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy · HH:mm")}</p></div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveResults.mutate()} disabled={saveResults.isPending}><Save className="size-4 mr-2" />{saveResults.isPending ? "Saving…" : "Save"}</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-2" />Print report</Button>
        </div>
      </div>

      <Card className="p-8 print:shadow-none print:border-0">
        <div className="flex justify-between items-start pb-6 border-b">
          <div>
            <div className="text-xl font-bold">SBG Arogya Plus Laboratory</div>
            <div className="text-sm text-muted-foreground">Pathology & Diagnostics</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Lab Report</div>
            <div className="font-mono font-semibold">{o.order_no}</div>
            <Badge variant="outline" className="capitalize mt-2">{o.status.replace("_"," ")}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 py-6 border-b text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Patient</div>
            <div className="font-medium">{o.patients?.full_name}</div>
            <div className="text-muted-foreground">{o.patients?.uhid} · {o.patients?.mobile}</div>
            <div className="text-muted-foreground capitalize">{o.patients?.gender}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Referred by</div>
            <div>{o.doctors?.name ?? "—"}</div>
            <div className="text-muted-foreground text-xs">{o.doctors?.specialization}</div>
            <div className="text-muted-foreground text-xs mt-1">Total: {inr(o.total_amount)}</div>
          </div>
        </div>

        <div className="mt-6 no-print">
          <label className="text-sm font-medium block mb-2">Order status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <table className="w-full text-sm my-6">
          <thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
            <th className="text-left py-2">Test</th><th className="text-left py-2">Result</th><th className="text-left py-2">Unit</th><th className="text-left py-2">Range</th><th className="text-left py-2">Flag</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b">
                <td className="py-3 font-medium">{r.test_name}</td>
                <td className="py-3"><Input className="h-9 print:border-0 print:p-0 print:h-auto" value={r.result_value ?? ""} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, result_value: e.target.value } : x))} /></td>
                <td className="py-3"><Input className="h-9 print:border-0 print:p-0 print:h-auto" value={r.unit ?? ""} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x))} /></td>
                <td className="py-3"><Input className="h-9 print:border-0 print:p-0 print:h-auto" value={r.reference_range ?? ""} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, reference_range: e.target.value } : x))} /></td>
                <td className="py-3"><Input className="h-9 print:border-0 print:p-0 print:h-auto w-16" placeholder="H/L/N" value={r.flag ?? ""} onChange={(e) => setRows(rows.map((x, idx) => idx === i ? { ...x, flag: e.target.value } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {o.notes && <div className="border-t pt-4 text-sm"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</div><div>{o.notes}</div></div>}
      </Card>
    </div>
  );
}
