import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModuleActionBar } from "@/components/common/action-bar";
import { RecordActions } from "@/components/common/record-actions";
import { getPatientBillingSummary, type BillingSummary } from "@/lib/billing-aggregator";
import { inr } from "@/lib/format";
import { format } from "date-fns";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { Search, Receipt, Users, AlertTriangle, CheckCircle2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing-center")({
  component: BillingCenter,
});

function BillingCenter() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const searchRes = useQuery({
    queryKey: ["billing-center-search", query],
    queryFn: async () => {
      const q = query.trim();
      if (!q) {
        const { data } = await supabase
          .from("patients")
          .select("id, uhid, full_name, mobile")
          .order("created_at", { ascending: false })
          .limit(15);
        return data ?? [];
      }
      const { data } = await supabase
        .from("patients")
        .select("id, uhid, full_name, mobile")
        .or(`uhid.ilike.%${q}%,full_name.ilike.%${q}%,mobile.ilike.%${q}%`)
        .limit(25);
      // also accept admission_no lookup
      if ((data?.length ?? 0) === 0 && q.toLowerCase().startsWith("ipd")) {
        const { data: adm } = await supabase
          .from("admissions")
          .select("patient_id, patients!inner(id, uhid, full_name, mobile)")
          .ilike("admission_no", `%${q}%`)
          .limit(10);
        return (adm ?? []).map((a: any) => a.patients);
      }
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Centralized Billing</h1>
        <p className="text-sm text-muted-foreground">Search a patient by UHID, name, mobile, or IPD admission number to view consolidated charges across every department.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search className="size-4" />Find patient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="UHID, name, mobile, or IPD-YYYYMM-XXXXXX"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xl"
          />
          {(searchRes.data?.length ?? 0) > 0 && (
            <div className="rounded-md border max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UHID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchRes.data!.map((p: any) => (
                    <TableRow key={p.id} className={selectedId === p.id ? "bg-muted/50" : ""}>
                      <TableCell className="font-mono text-xs">{p.uhid}</TableCell>
                      <TableCell>{p.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.mobile ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={selectedId === p.id ? "default" : "outline"} onClick={() => setSelectedId(p.id)}>
                          {selectedId === p.id ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && <PatientBillingPanel patientId={selectedId} />}
    </div>
  );
}

function PatientBillingPanel({ patientId }: { patientId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["billing-summary", patientId],
    queryFn: () => getPatientBillingSummary(patientId),
    refetchInterval: 15000,
  });

  const deptRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byDept)
      .filter(([, v]) => v.count > 0)
      .map(([k, v]) => ({ Department: k, Bills: v.count, Total: v.total, Paid: v.paid, Pending: v.pending }));
  }, [data]);

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading billing summary…</div>;

  const { patient, admissions, totals, paymentStatus, bills } = data;
  if (!patient) return <div className="text-sm text-destructive">Patient not found.</div>;

  const statusVariant: Record<string, string> = {
    Paid: "bg-emerald-100 text-emerald-800",
    "Partially Paid": "bg-amber-100 text-amber-800",
    Unpaid: "bg-red-100 text-red-800",
    "No Bills": "bg-muted text-muted-foreground",
  };

  const onExport = () => {
    const lines = bills.map((b) => ({
      "Bill No": b.bill_no,
      Date: format(new Date(b.created_at), "dd MMM yyyy HH:mm"),
      Dept: b.dept,
      Subtotal: b.subtotal,
      Discount: b.discount,
      GST: b.gst,
      Total: b.total,
      Paid: b.paid,
      Pending: b.pending,
      Status: b.status,
    }));
    exportXlsx({ Summary: deptRows as any, Bills: lines as any }, `billing-${patient.uhid}.xlsx`);
  };

  const onWhatsApp = () => {
    const summary = summarizeRecord(`Billing summary — ${patient.full_name} (${patient.uhid})`, {
      Total: inr(totals.total),
      Paid: inr(totals.paid),
      Pending: inr(totals.pending),
      Status: paymentStatus,
      Bills: bills.length,
    });
    shareOnWhatsApp(summary, undefined, patient.mobile ?? undefined);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Users className="size-5" /></div>
            <div>
              <div className="text-lg font-semibold">{patient.full_name}</div>
              <div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile ?? "no mobile"} · {patient.gender ?? "—"}</div>
              {admissions[0] && (
                <div className="text-xs text-muted-foreground mt-1">
                  Latest admission {admissions[0].admission_no} · Admitted {format(new Date(admissions[0].admitted_at), "dd MMM yyyy")}
                  {admissions[0].discharged_at ? ` · Discharged ${format(new Date(admissions[0].discharged_at), "dd MMM yyyy")}` : " · Active"}
                </div>
              )}
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 ${statusVariant[paymentStatus]}`}>
            {paymentStatus === "Paid" ? <CheckCircle2 className="size-4 mr-1 inline" /> : <AlertTriangle className="size-4 mr-1 inline" />}
            {paymentStatus}
          </Badge>
        </CardContent>
      </Card>

      <ModuleActionBar onExport={onExport} onPrint={() => window.print()} onWhatsAppShare={onWhatsApp} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" value={inr(totals.total)} />
        <KpiCard label="Discount" value={inr(totals.discount)} />
        <KpiCard label="Paid" value={inr(totals.paid)} tone="ok" />
        <KpiCard label="Pending" value={inr(totals.pending)} tone={totals.pending > 0 ? "warn" : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Department-wise charges</CardTitle></CardHeader>
        <CardContent>
          {deptRows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No bills generated yet for this patient.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptRows.map((r) => (
                  <TableRow key={r.Department}>
                    <TableCell><Badge variant="outline">{r.Department}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.Bills}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(r.Total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{inr(r.Paid)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">{inr(r.Pending)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="size-4" />All bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No bills.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs"><Link to="/billing/$id" params={{ id: b.id }} className="hover:underline">{b.bill_no}</Link></TableCell>
                    <TableCell className="text-xs">{format(new Date(b.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{b.dept}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{inr(b.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{inr(b.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">{inr(b.pending)}</TableCell>
                    <TableCell><Badge variant={b.status === "paid" ? "secondary" : "outline"} className="capitalize">{b.status}</Badge></TableCell>
                    <TableCell>
                      <RecordActions
                        size="icon"
                        onPrint={() => window.open(`/billing/${b.id}`, "_blank")}
                        onWhatsApp={() => shareOnWhatsApp(`Bill ${b.bill_no} — ${inr(b.total)} (Pending ${inr(b.pending)})`, `${window.location.origin}/billing/${b.id}`, patient.mobile ?? undefined)}
                        deleteLabel={`bill ${b.bill_no}`}
                        onDelete={async () => {
                          await supabase.from("bills").delete().eq("id", b.id);
                          refetch();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totals.pending > 0.01 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-4 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5" />
            <div>
              Pending balance of <strong>{inr(totals.pending)}</strong> must be cleared before this patient can be discharged.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
