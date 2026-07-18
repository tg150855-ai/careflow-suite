import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, TrendingUp, Receipt, Clock, CheckCircle2 } from "lucide-react";
import { format, startOfDay, startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
import { inr } from "@/lib/format";
import { exportXlsx, exportCsv, printPage } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/billing/reports")({ component: BillingReports });

const quick = (k: "today" | "week" | "month" | "30d") => {
  const now = new Date();
  if (k === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (k === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
  if (k === "month") return { from: startOfMonth(now), to: endOfDay(now) };
  return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
};

function BillingReports() {
  const [range, setRange] = useState<{ from: Date; to: Date }>(quick("month"));
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data: bills = [] } = useQuery({
    queryKey: ["billing-reports", range.from.toISOString(), range.to.toISOString(), status],
    queryFn: async () => {
      let query = supabase
        .from("bills")
        .select("id, bill_no, total, paid, pending, status, created_at, notes, patients(full_name, uhid, mobile)")
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString())
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status as "paid" | "partial" | "draft" | "cancelled");
      const { data } = await query;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bills;
    return bills.filter((b: any) =>
      [b.bill_no, b.patients?.full_name, b.patients?.uhid, b.patients?.mobile]
        .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(term))
    );
  }, [bills, q]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, b: any) => s + Number(b.total || 0), 0);
    const paid = filtered.reduce((s, b: any) => s + Number(b.paid || 0), 0);
    const pending = filtered.reduce((s, b: any) => s + Number(b.pending || 0), 0);
    return { total, paid, pending, count: filtered.length };
  }, [filtered]);

  const cards = [
    { label: "Bills", value: totals.count, icon: Receipt },
    { label: "Gross revenue", value: inr(totals.total), icon: TrendingUp },
    { label: "Collected", value: inr(totals.paid), icon: CheckCircle2 },
    { label: "Outstanding", value: inr(totals.pending), icon: Clock },
  ];

  function rowsForExport() {
    return filtered.map((b: any) => ({
      "Bill No": b.bill_no,
      Date: format(new Date(b.created_at), "yyyy-MM-dd HH:mm"),
      Patient: b.patients?.full_name ?? "",
      UHID: b.patients?.uhid ?? "",
      Mobile: b.patients?.mobile ?? "",
      Status: b.status,
      Total: Number(b.total || 0),
      Paid: Number(b.paid || 0),
      Pending: Number(b.pending || 0),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon"><Link to="/billing"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Billing Reports</h1>
          <p className="text-sm text-muted-foreground">Filter, export and print revenue reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportXlsx(rowsForExport(), `billing-report-${format(new Date(), "yyyyMMdd-HHmm")}`)}>
            <Download className="size-4 mr-2" />Excel
          </Button>
          <Button variant="outline" onClick={() => exportCsv(rowsForExport(), `billing-report-${format(new Date(), "yyyyMMdd-HHmm")}`)}>
            <Download className="size-4 mr-2" />CSV
          </Button>
          <Button variant="outline" onClick={printPage}><Printer className="size-4 mr-2" />Print</Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {(["today", "week", "month", "30d"] as const).map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setRange(quick(k))} className="capitalize">
              {k === "30d" ? "Last 30d" : k}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={format(range.from, "yyyy-MM-dd")} onChange={(e) => setRange((r) => ({ ...r, from: startOfDay(new Date(e.target.value)) }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={format(range.to, "yyyy-MM-dd")} onChange={(e) => setRange((r) => ({ ...r, to: endOfDay(new Date(e.target.value)) }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm">
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no, patient, UHID, mobile" />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <c.icon className="size-5 text-primary mb-3" />
            <div className="text-2xl font-semibold tracking-tight tabular-nums">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-3">Bill No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Patient</th>
                <th className="p-3">UHID</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b: any) => (
                <tr key={b.id} className="hover:bg-surface-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link to="/billing/$id" params={{ id: b.id }} className="text-primary hover:underline">{b.bill_no}</Link>
                  </td>
                  <td className="p-3 text-xs">{format(new Date(b.created_at), "dd MMM yyyy HH:mm")}</td>
                  <td className="p-3">{b.patients?.full_name ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{b.patients?.uhid ?? "—"}</td>
                  <td className="p-3"><Badge variant={b.status === "paid" ? "secondary" : "outline"} className="capitalize">{b.status}</Badge></td>
                  <td className="p-3 text-right tabular-nums">{inr(b.total)}</td>
                  <td className="p-3 text-right tabular-nums">{inr(b.paid)}</td>
                  <td className="p-3 text-right tabular-nums">{inr(b.pending)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No bills in this range.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-surface-muted font-medium">
                <tr>
                  <td className="p-3" colSpan={5}>Totals ({totals.count})</td>
                  <td className="p-3 text-right tabular-nums">{inr(totals.total)}</td>
                  <td className="p-3 text-right tabular-nums">{inr(totals.paid)}</td>
                  <td className="p-3 text-right tabular-nums">{inr(totals.pending)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
