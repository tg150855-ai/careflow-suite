import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt, Clock, CheckCircle2, TrendingUp, FileBarChart, Package, AlertTriangle, Eye, IndianRupee, MessageCircle, Printer, Search } from "lucide-react";
import { format, startOfDay, startOfMonth, subMonths } from "date-fns";
import { inr } from "@/lib/format";
import { motion } from "framer-motion";
import { shareOnWhatsApp } from "@/lib/share";
import { useHospitalProfile } from "@/components/print-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingCenterContent } from "@/routes/_authenticated/billing-center";

export const Route = createFileRoute("/_authenticated/billing/")({ component: BillingDashboard });

function BillingDashboard() {
  const { data } = useQuery({
    queryKey: ["billing-dashboard"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString();
      const monthAgo = subMonths(startOfMonth(new Date()), 5).toISOString();
      const [todayBills, pending, paidToday, all, recent] = await Promise.all([
        supabase.from("bills").select("total, paid, pending, status").gte("created_at", today),
        supabase.from("bills").select("id, total, pending", { count: "exact" }).gt("pending", 0),
        supabase.from("bills").select("total", { count: "exact" }).eq("status", "paid").gte("created_at", today),
        supabase.from("bills").select("created_at, total").gte("created_at", monthAgo),
        supabase.from("bills").select("id, bill_no, total, paid, pending, status, created_at, patients(full_name, uhid)").order("created_at", { ascending: false }).limit(10),
      ]);
      const todayRevenue = (todayBills.data ?? []).reduce((s, b: any) => s + Number(b.paid), 0);
      const pendingTotal = (pending.data ?? []).reduce((s, b: any) => s + Number(b.pending), 0);
      // monthly buckets
      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const k = format(subMonths(new Date(), i), "MMM");
        buckets[k] = 0;
      }
      (all.data ?? []).forEach((b: any) => {
        const k = format(new Date(b.created_at), "MMM");
        if (k in buckets) buckets[k] += Number(b.total);
      });
      return {
        todayRevenue,
        pendingCount: pending.count ?? 0,
        pendingTotal,
        paidTodayCount: paidToday.count ?? 0,
        chart: Object.entries(buckets).map(([m, v]) => ({ m, v })),
        recent: recent.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Today's revenue", value: inr(data?.todayRevenue ?? 0), icon: TrendingUp, tone: "primary" },
    { label: "Paid bills (today)", value: data?.paidTodayCount ?? 0, icon: CheckCircle2, tone: "accent" },
    { label: "Pending payments", value: data?.pendingCount ?? 0, icon: Clock, tone: "warning" },
    { label: "Outstanding", value: inr(data?.pendingTotal ?? 0), icon: Receipt, tone: "primary" },
  ];
  const max = Math.max(1, ...(data?.chart ?? []).map((c) => c.v));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Hospital Billing</h1>
          <p className="text-muted-foreground mt-1">One billing system for OPD, IPD, Emergency, Pharmacy, Lab, Radiology and OT</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline"><Link to="/billing/packages"><Package className="size-4 mr-2" />Packages</Link></Button>
          <Button asChild variant="outline"><Link to="/billing/reports"><FileBarChart className="size-4 mr-2" />Reports</Link></Button>
          <Button asChild size="lg"><Link to="/billing/new"><Plus className="size-4 mr-2" />New bill</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview & pending</TabsTrigger>
          <TabsTrigger value="patient">Patient ledger (all departments)</TabsTrigger>
        </TabsList>

        <TabsContent value="patient" className="mt-5">
          <BillingCenterContent />
        </TabsContent>

        <TabsContent value="overview" className="mt-5 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6">
              <div className={`size-11 rounded-2xl flex items-center justify-center mb-4 bg-${c.tone}/10 text-${c.tone}`}
                style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                <c.icon className="size-5" />
              </div>
              <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-5">Monthly revenue</h2>
          <div className="flex items-end gap-4 h-48">
            {(data?.chart ?? []).map((c) => (
              <div key={c.m} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs tabular-nums text-muted-foreground">{inr(c.v).replace(".00", "")}</div>
                <div className="w-full bg-primary/15 rounded-t-lg relative overflow-hidden" style={{ height: `${(c.v / max) * 100}%`, minHeight: 4 }}>
                  <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-lg" style={{ height: "100%" }} />
                </div>
                <div className="text-xs text-muted-foreground">{c.m}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent bills</h2>
          <div className="divide-y -my-2">
            {(data?.recent ?? []).map((b: any) => (
              <Link key={b.id} to="/billing/$id" params={{ id: b.id }} className="flex items-center justify-between py-3 hover:bg-surface-muted -mx-2 px-2 rounded-lg">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{b.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{b.bill_no}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium tabular-nums">{inr(b.total)}</div>
                  <Badge variant={b.status === "paid" ? "secondary" : "outline"} className="text-[10px] capitalize mt-0.5">{b.status}</Badge>
                </div>
              </Link>
            ))}
            {(data?.recent ?? []).length === 0 && <div className="py-8 text-sm text-muted-foreground text-center">No bills yet.</div>}
          </div>
        </Card>
      </div>

      <PendingBillsSection />
        </TabsContent>
      </Tabs>
    </div>

  );
}

type PendingBill = {
  id: string;
  bill_no: string;
  total: number;
  paid: number;
  pending: number;
  status: string;
  created_at: string;
  admission_id: string | null;
  opd_visit_id: string | null;
  patient_id: string;
  patients: { id: string; full_name: string; uhid: string; mobile: string | null } | null;
  bill_items: { category: string | null }[];
};

function classifyDept(b: PendingBill): string {
  const cats = (b.bill_items ?? []).map((i) => (i.category ?? "").toLowerCase());
  if (cats.some((c) => c.includes("ot") || c.includes("surger"))) return "OT";
  if (cats.some((c) => c.includes("icu"))) return "ICU";
  if (cats.some((c) => c.includes("pharm") || c.includes("medicine"))) return "Pharmacy";
  if (cats.some((c) => c.includes("lab"))) return "Laboratory";
  if (cats.some((c) => c.includes("radio") || c.includes("xray") || c.includes("scan"))) return "Radiology";
  if (b.admission_id) return "IPD";
  if (b.opd_visit_id) return "OPD";
  return "Other";
}

function PendingBillsSection() {
  const navigate = useNavigate();
  const { data: hospital } = useHospitalProfile();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["pending-bills-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id, bill_no, total, paid, pending, status, created_at, admission_id, opd_visit_id, patient_id, patients(id, full_name, uhid, mobile), bill_items(category)")
        .gt("pending", 0)
        .order("pending", { ascending: false })
        .limit(500);
      return (data ?? []) as unknown as PendingBill[];
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : 0;
    const toT = to ? new Date(to).getTime() + 86400000 : Infinity;
    return (data ?? []).filter((b) => {
      const t = new Date(b.created_at).getTime();
      if (t < fromT || t > toT) return false;
      if (!ql) return true;
      return (
        b.patients?.full_name?.toLowerCase().includes(ql) ||
        b.patients?.uhid?.toLowerCase().includes(ql) ||
        b.bill_no?.toLowerCase().includes(ql)
      );
    });
  }, [data, q, from, to]);

  // Aggregate by patient
  const rows = useMemo(() => {
    const map = new Map<string, {
      patient_id: string; name: string; uhid: string; mobile: string | null;
      total: number; paid: number; pending: number; bills: PendingBill[]; depts: Set<string>;
      lastBillStatus: string;
    }>();
    for (const b of filtered) {
      const pid = b.patient_id;
      if (!pid) continue;
      const existing = map.get(pid) ?? {
        patient_id: pid,
        name: b.patients?.full_name ?? "—",
        uhid: b.patients?.uhid ?? "—",
        mobile: b.patients?.mobile ?? null,
        total: 0, paid: 0, pending: 0, bills: [], depts: new Set<string>(),
        lastBillStatus: b.status,
      };
      existing.total += Number(b.total || 0);
      existing.paid += Number(b.paid || 0);
      existing.pending += Number(b.pending || 0);
      existing.bills.push(b);
      existing.depts.add(classifyDept(b));
      map.set(pid, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending);
  }, [filtered]);

  const totalOutstanding = rows.reduce((s, r) => s + r.pending, 0);

  const whatsAppRemind = (r: typeof rows[number]) => {
    const msg = `Payment Reminder — SBG Arogya Plus\n\nDear ${r.name} (${r.uhid}),\n\nYou have an outstanding balance of ${inr(r.pending)} on your hospital account (${r.bills.length} pending bill${r.bills.length > 1 ? "s" : ""}).\n\nDepartments: ${Array.from(r.depts).join(", ")}\n\nKindly clear the pending amount at your earliest. Thank you.`;
    shareOnWhatsApp(msg, undefined, r.mobile ?? undefined);
  };

  const printSummary = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const h = hospital;
    const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const contact = [h?.phone && `Ph: ${h.phone}`, h?.email && `Email: ${h.email}`, h?.website && `Web: ${h.website}`].filter(Boolean).join(" · ");
    const regLine = [h?.registration_no && `Reg. No: ${h.registration_no}`, h?.nabh_no && `NABH: ${h.nabh_no}`, h?.gst_no && `GSTIN: ${h.gst_no}`].filter(Boolean).join(" · ");
    const accent = h?.primary_color || "#0EA5E9";
    w.document.write(`<html><head><title>Pending Bills — ${esc(h?.hospital_name ?? "")}</title><style>
      @page { size: A4; margin: 14mm 12mm 16mm 12mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size:9pt; color:#666; } }
      body{font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;color:#111;margin:0;padding:0;font-size:11pt}
      .hdr{display:flex;align-items:flex-start;gap:16px;padding-bottom:10px}
      .hdr img{max-height:64px;max-width:130px;object-fit:contain}
      .hdr .mid{flex:1;text-align:center}
      .name{font-size:20px;font-weight:800;color:${accent};letter-spacing:-.01em}
      .tag{font-size:10px;font-style:italic;color:#555;margin-top:2px}
      .addr{font-size:10px;color:#444;margin-top:3px;white-space:pre-line}
      .contact{font-size:10px;color:#444;margin-top:2px}
      .reg{font-size:9px;color:#666;margin-top:2px}
      .bar{height:2px;background:${accent};width:100%}
      .title{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:12px}
      .title .t{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${accent}}
      .sum{color:#b91c1c;font-weight:600;margin:12px 0}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
      th{background:#f5f7fa;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#555}
      td.r{text-align:right;font-variant-numeric:tabular-nums}
      .pend{color:#b91c1c;font-weight:600}
      .foot{margin-top:24px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#666;display:flex;justify-content:space-between;gap:16px}
    </style></head><body>
      <div class="hdr">
        ${h?.logo_url ? `<img src="${esc(h.logo_url)}" alt="${esc(h.hospital_name)}"/>` : `<div style="width:130px"></div>`}
        <div class="mid">
          <div class="name">${esc(h?.hospital_name ?? "")}</div>
          ${h?.tagline ? `<div class="tag">${esc(h.tagline)}</div>` : ""}
          ${h?.address ? `<div class="addr">${esc(h.address)}</div>` : ""}
          ${contact ? `<div class="contact">${esc(contact)}</div>` : ""}
          ${regLine ? `<div class="reg">${esc(regLine)}</div>` : ""}
        </div>
        <div style="width:130px;text-align:right;font-size:10px;color:#666">
          Date: ${new Date().toLocaleDateString("en-GB")}<br/>Time: ${new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>
      <div class="bar"></div>
      <div class="title"><span class="t">Pending Bills Report</span><span style="color:#666">${rows.length} patient(s)</span></div>
      <div style="height:1px;background:#ddd"></div>
      <div class="sum">Total Outstanding: ${inr(totalOutstanding)}</div>
      <table><thead><tr><th>Patient</th><th>UHID</th><th>Mobile</th><th>Dept</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Pending</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.uhid)}</td><td>${esc(r.mobile ?? "—")}</td><td>${esc(Array.from(r.depts).join(", "))}</td><td class="r">${inr(r.total)}</td><td class="r">${inr(r.paid)}</td><td class="r pend">${inr(r.pending)}</td></tr>`).join("")}
      </tbody></table>
      <div class="foot">
        <div><div style="font-weight:600;color:#333">${esc(h?.hospital_name ?? "")}</div>${h?.address ? `<div>${esc(h.address)}</div>` : ""}${contact ? `<div>${esc(contact)}</div>` : ""}</div>
        <div style="text-align:right">Computer Generated Document<br/>Printed: ${new Date().toLocaleString("en-GB")}</div>
      </div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Card className="p-6 border-red-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Pending Bills</h2>
            <div className="text-sm">
              <span className="text-muted-foreground">Total Outstanding: </span>
              <span className="text-red-700 font-bold text-base tabular-nums">{inr(totalOutstanding)}</span>
              <span className="text-muted-foreground"> · {rows.length} patient{rows.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={printSummary}><Printer className="size-4 mr-2" />Print Report</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[240px]">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Patient name, UHID, bill no…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div><Label className="text-xs">From</Label><Input type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {(q || from || to) && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Reset</Button>}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>UHID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Total Bill</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const status = r.paid <= 0 ? "Unpaid" : "Partially Paid";
              const goPatient = () => navigate({ to: "/billing-center", search: { patient: r.patient_id } as any });
              return (
                <TableRow key={r.patient_id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.uhid}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{Array.from(r.depts).map((d) => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>)}</div></TableCell>
                  <TableCell className="text-right tabular-nums">{inr(r.total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">{inr(r.paid)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-red-600">{inr(r.pending)}</TableCell>
                  <TableCell><Badge className={status === "Unpaid" ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>{status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" title="View Bills" onClick={goPatient}><Eye className="size-4" /></Button>
                      <Button size="icon" variant="ghost" title="Collect Payment" onClick={goPatient}><IndianRupee className="size-4 text-emerald-600" /></Button>
                      <Button size="icon" variant="ghost" title="WhatsApp reminder" onClick={() => whatsAppRemind(r)}><MessageCircle className="size-4 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" title="Print" onClick={() => { const b = r.bills[0]; if (b) window.open(`/billing/${b.id}`, "_blank"); }}><Printer className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                {q || from || to ? "No pending bills match your filters." : "🎉 All bills are fully paid."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
