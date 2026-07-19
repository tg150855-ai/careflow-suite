import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FlaskConical, Clock, CheckCircle2, TrendingUp, FileText, Share2, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { ModuleActionBar } from "@/components/common/action-bar";
import { SearchBox } from "@/components/common/search-box";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { exportCsv, downloadAsPdf, printPage } from "@/lib/export";
import { RecordActions } from "@/components/common/record-actions";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/laboratory/")({ component: LabDashboard });

const STATUS_TONE: Record<string, string> = {
  ordered: "outline", sample_collected: "secondary", in_progress: "secondary", completed: "default", cancelled: "destructive",
};
const STAGE_TONE: Record<string, string> = {
  patient: "outline", opd: "secondary", ipd: "default", icu: "destructive",
};

type StatusFilter = "all" | "pending" | "in_progress" | "complete";
type StageFilter = "all" | "patient" | "opd" | "ipd" | "icu";
type PriorityFilter = "all" | "urgent" | "normal";

function LabDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stage, setStage] = useState<StageFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data } = useQuery({
    queryKey: ["lab-dashboard"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [pending, completed, revenue, orders] = await Promise.all([
        supabase.from("lab_orders").select("id", { count: "exact" }).in("status", ["ordered", "sample_collected", "in_progress"]),
        supabase.from("lab_orders").select("id", { count: "exact" }).eq("status", "completed"),
        supabase.from("lab_orders").select("total_amount").gte("created_at", today.toISOString()),
        supabase.from("lab_orders").select("id, order_no, status, priority, total_amount, created_at, test_stage, notes, patients(full_name, uhid, phone), doctors(name), lab_results(id)").order("created_at", { ascending: false }).limit(200),
      ]);
      return {
        pending: pending.count ?? 0,
        completed: completed.count ?? 0,
        revenue: (revenue.data ?? []).reduce((s, r: any) => s + Number(r.total_amount), 0),
        orders: orders.data ?? [],
      };
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["lab-schedules"],
    queryFn: async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("lab_schedules")
        .select("id, title, scheduled_at, technician, room, notes, patient_id, patients(full_name, uhid, phone)")
        .gte("scheduled_at", since.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(20);
      return data ?? [];
    },
  });

  const createSchedule = useMutation({
    mutationFn: async (s: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("lab_schedules").insert({ ...s, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Schedule added"); qc.invalidateQueries({ queryKey: ["lab-schedules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredOrders = useMemo(() => {
    let rows = (data?.orders ?? []) as any[];
    if (status === "pending") rows = rows.filter((o) => ["ordered", "sample_collected"].includes(o.status));
    else if (status === "in_progress") rows = rows.filter((o) => o.status === "in_progress");
    else if (status === "complete") rows = rows.filter((o) => o.status === "completed");
    if (stage !== "all") rows = rows.filter((o) => o.test_stage === stage);
    if (priority !== "all") rows = rows.filter((o) => (o.priority ?? "normal") === priority);
    if (fromDate) rows = rows.filter((o) => new Date(o.created_at) >= new Date(fromDate));
    if (toDate) { const end = new Date(toDate); end.setHours(23,59,59,999); rows = rows.filter((o) => new Date(o.created_at) <= end); }
    if (q.trim().length >= 2) {
      const needle = q.toLowerCase();
      rows = rows.filter((o) =>
        (o.patients?.full_name ?? "").toLowerCase().includes(needle) ||
        (o.patients?.uhid ?? "").toLowerCase().includes(needle) ||
        (o.patients?.phone ?? "").toLowerCase().includes(needle) ||
        (o.order_no ?? "").toLowerCase().includes(needle) ||
        (o.doctors?.name ?? "").toLowerCase().includes(needle),
      );
    }
    // Urgent orders float to top
    rows = [...rows].sort((a, b) => {
      const ap = a.priority === "urgent" ? 0 : 1;
      const bp = b.priority === "urgent" ? 0 : 1;
      return ap - bp;
    });
    return rows.slice(0, 60);
  }, [data?.orders, status, stage, priority, fromDate, toDate, q]);

  const cards = [
    { label: "Pending tests", value: data?.pending ?? 0, icon: Clock },
    { label: "Completed", value: data?.completed ?? 0, icon: CheckCircle2 },
    { label: "Reports uploaded", value: (data?.orders ?? []).filter((o: any) => o.lab_results?.length).length, icon: FileText },
    { label: "Today's revenue", value: inr(data?.revenue ?? 0), icon: TrendingUp },
  ];

  function doExport() {
    exportCsv(
      filteredOrders.map((o) => ({
        order_no: o.order_no,
        patient: o.patients?.full_name ?? "",
        uhid: o.patients?.uhid ?? "",
        doctor: o.doctors?.name ?? "",
        status: o.status,
        stage: o.test_stage,
        amount: o.total_amount,
        created_at: o.created_at,
      })),
      `lab-orders-${format(new Date(), "yyyyMMdd")}`,
    );
  }
  function doShare() {
    const top = filteredOrders.slice(0, 5).map((o: any) => `• ${o.order_no} — ${o.patients?.full_name ?? "?"} (${o.status})`).join("\n");
    shareOnWhatsApp(`Lab summary — ${format(new Date(), "dd MMM yyyy")}\nPending: ${data?.pending ?? 0} · Completed: ${data?.completed ?? 0}\n\n${top}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-3xl font-semibold tracking-tight">Laboratory</h1><p className="text-muted-foreground mt-1">Test orders, samples and reports</p></div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/laboratory/tests"><FlaskConical className="size-4 mr-2" />Tests catalog</Link></Button>
          <Button asChild><Link to="/laboratory/new"><Plus className="size-4 mr-2" />New order</Link></Button>
        </div>
      </div>

      <ModuleActionBar
        leading={<SearchBox value={q} onChange={setQ} placeholder="Search order, patient, UHID or doctor…" />}
        onExport={doExport}
        onPrint={printPage}
        onDownloadReport={() => downloadAsPdf(`Lab-report-${format(new Date(), "yyyyMMdd")}`)}
        onWhatsAppShare={doShare}
        onSettings={() => toast.info("Lab settings coming soon")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6">
              <div className="size-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}><c.icon className="size-5" /></div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold">Recent orders</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs h-7 px-3">Pending</TabsTrigger>
                <TabsTrigger value="in_progress" className="text-xs h-7 px-3">In Progress</TabsTrigger>
                <TabsTrigger value="complete" className="text-xs h-7 px-3">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={stage} onValueChange={(v) => setStage(v as StageFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7 px-3">Any stage</TabsTrigger>
                <TabsTrigger value="patient" className="text-xs h-7 px-3">Patient</TabsTrigger>
                <TabsTrigger value="opd" className="text-xs h-7 px-3">OPD</TabsTrigger>
                <TabsTrigger value="ipd" className="text-xs h-7 px-3">IPD</TabsTrigger>
                <TabsTrigger value="icu" className="text-xs h-7 px-3">ICU</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={priority} onValueChange={(v) => setPriority(v as PriorityFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7 px-3">Any priority</TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs h-7 px-3 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">Urgent</TabsTrigger>
                <TabsTrigger value="normal" className="text-xs h-7 px-3">Normal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div><Label className="text-xs text-muted-foreground">From date</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-40" /></div>
          <div><Label className="text-xs text-muted-foreground">To date</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-40" /></div>
          <Button variant="outline" size="sm" onClick={() => { /* no-op: filters apply live */ }}>Apply</Button>
          <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); setStatus("all"); setStage("all"); setPriority("all"); setQ(""); }}>Reset</Button>
        </div>
        <div className="divide-y">
          {filteredOrders.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between py-3 hover:bg-surface-muted -mx-3 px-3 rounded-lg">
              <Link to="/laboratory/$id" params={{ id: o.id }} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{(o.patients?.full_name ?? "?").slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{o.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.order_no} · {o.patients?.uhid} · {o.doctors?.name ?? "—"}</div>
                </div>
              </Link>
              <div className="text-right shrink-0 flex items-center gap-3">
                <div>
                  <div className="text-sm tabular-nums">{inr(o.total_amount)}</div>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    <span className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd MMM")}</span>
                    {o.priority === "urgent" && <Badge variant="destructive" className="text-[10px] uppercase">Urgent</Badge>}
                    <Badge variant={(STAGE_TONE[o.test_stage] as any) ?? "outline"} className="text-[10px] uppercase">{o.test_stage}</Badge>
                    <Badge variant={(STATUS_TONE[o.status] as any) ?? "outline"} className="text-[10px] capitalize">{o.status.replace("_", " ")}</Badge>
                  </div>
                </div>
                <RecordActions
                  onEdit={() => navigate({ to: "/laboratory/$id", params: { id: o.id } })}
                  onWhatsApp={() =>
                    shareOnWhatsApp(
                      summarizeRecord(`Lab order ${o.order_no}`, {
                        Patient: o.patients?.full_name,
                        UHID: o.patients?.uhid,
                        Doctor: o.doctors?.name,
                        Status: o.status,
                        Stage: o.test_stage,
                        Amount: inr(o.total_amount),
                      }),
                      undefined,
                      o.patients?.phone,
                    )
                  }
                  onDelete={async () => {
                    const { error } = await supabase.from("lab_orders").delete().eq("id", o.id);
                    if (error) return toast.error(error.message);
                    toast.success("Lab order deleted");
                    qc.invalidateQueries({ queryKey: ["lab-dashboard"] });
                  }}
                  deleteLabel={`lab order ${o.order_no}`}
                />
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No matching lab orders.</div>}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> Lab schedule</h2>
          <NewScheduleDialog onSubmit={(s) => createSchedule.mutate(s)} />
        </div>
        <div className="divide-y">
          {schedules.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {format(new Date(s.scheduled_at), "EEE dd MMM, HH:mm")}
                  {s.technician ? ` · ${s.technician}` : ""}
                  {s.room ? ` · ${s.room}` : ""}
                  {s.patients?.full_name ? ` · ${s.patients.full_name}` : ""}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-emerald-700 gap-1.5"
                onClick={() =>
                  shareOnWhatsApp(
                    summarizeRecord(`Lab schedule: ${s.title}`, {
                      When: format(new Date(s.scheduled_at), "EEE dd MMM, HH:mm"),
                      Technician: s.technician,
                      Room: s.room,
                      Patient: s.patients?.full_name,
                      Notes: s.notes,
                    }),
                    undefined,
                    s.patients?.phone,
                  )
                }
              >
                <Share2 className="size-3.5" /> Share
              </Button>
            </div>
          ))}
          {schedules.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No upcoming lab schedules. Click "Add" to plan one.</div>}
        </div>
      </Card>
    </div>
  );
}

function NewScheduleDialog({ onSubmit }: { onSubmit: (s: any) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", scheduled_at: "", technician: "", room: "", notes: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New lab schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Morning sample collection" /></div>
          <div><Label>When *</Label><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Technician</Label><Input value={f.technician} onChange={(e) => setF({ ...f, technician: e.target.value })} /></div>
            <div><Label>Room</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button
            disabled={!f.title || !f.scheduled_at}
            onClick={() => {
              onSubmit({
                title: f.title,
                scheduled_at: new Date(f.scheduled_at).toISOString(),
                technician: f.technician || null,
                room: f.room || null,
                notes: f.notes || null,
              });
              setOpen(false);
              setF({ title: "", scheduled_at: "", technician: "", room: "", notes: "" });
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
