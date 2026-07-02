import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HeartPulse,
  AlertTriangle,
  Activity,
  Wind,
  BedDouble,
  ArrowRightLeft,
  FileBarChart,
  Settings,
  Search,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICU_STATUS, ICU_STATUS_STYLES, loadICUAdmissions, loadICUSettings } from "@/components/icu/shared";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/icu/")({ component: ICUDashboard });

function ICUDashboard() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const { data: settings } = useQuery({ queryKey: ["icu-settings"], queryFn: loadICUSettings });
  const { data: admissions = [], refetch: refetchAdm } = useQuery({
    queryKey: ["icu-admissions"],
    queryFn: loadICUAdmissions,
  });

  const { data: bedStats } = useQuery({
    queryKey: ["icu-bed-stats"],
    queryFn: async () => {
      const { data: wards } = await supabase.from("wards").select("id").eq("type", "icu");
      const ids = (wards ?? []).map((w: any) => w.id);
      if (ids.length === 0) return { total: 0, occupied: 0, available: 0 };
      const { data: beds } = await supabase.from("beds").select("status, ward_id").in("ward_id", ids);
      const total = (beds ?? []).length;
      const occupied = (beds ?? []).filter((b: any) => b.status === "occupied").length;
      return { total, occupied, available: total - occupied };
    },
  });

  const { data: todayCounts } = useQuery({
    queryKey: ["icu-today"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [adm, disch] = await Promise.all([
        supabase
          .from("admissions")
          .select("id, wards!inner(type)", { count: "exact", head: true })
          .eq("wards.type", "icu")
          .gte("admitted_at", start.toISOString()),
        supabase
          .from("admissions")
          .select("id, wards!inner(type)", { count: "exact", head: true })
          .eq("wards.type", "icu")
          .eq("status", "discharged")
          .gte("discharged_at", start.toISOString()),
      ]);
      return { admissions: adm.count ?? 0, discharges: disch.count ?? 0 };
    },
  });

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["icu-alerts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("icu_alerts")
        .select("*, patients(full_name)")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("icu-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "admissions" }, () => refetchAdm())
      .on("postgres_changes", { event: "*", schema: "public", table: "icu_alerts" }, () => refetchAlerts())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetchAdm, refetchAlerts]);

  const counts = useMemo(() => {
    const r: Record<string, number> = { critical: 0, ventilator: 0, isolation: 0, improving: 0, stable: 0 };
    for (const a of admissions) r[a.icu_status ?? "stable"] = (r[a.icu_status ?? "stable"] ?? 0) + 1;
    return r;
  }, [admissions]);

  const filtered = admissions.filter((a: any) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      a.patients?.full_name?.toLowerCase().includes(t) ||
      a.patients?.uhid?.toLowerCase().includes(t) ||
      a.admission_no?.toLowerCase().includes(t) ||
      a.beds?.bed_number?.toLowerCase().includes(t)
    );
  });

  const kpis = [
    { label: "Total ICU beds", value: bedStats?.total ?? 0, icon: BedDouble },
    { label: "Occupied", value: bedStats?.occupied ?? 0, icon: BedDouble },
    { label: "Available", value: bedStats?.available ?? 0, icon: BedDouble },
    { label: "Critical patients", value: counts.critical, icon: AlertTriangle, accent: "destructive" },
    { label: "On ventilator", value: counts.ventilator, icon: Wind, accent: "info" },
    { label: "High-risk alerts", value: alerts.length, icon: AlertTriangle, accent: "warning" },
    { label: "Admissions today", value: todayCounts?.admissions ?? 0, icon: Activity },
    { label: "Discharges today", value: todayCounts?.discharges ?? 0, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <HeartPulse className="size-7 text-primary" /> ICU / Critical Care
          </h1>
          <p className="text-muted-foreground mt-1">Real-time critical care monitoring & workflow</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="ghost" size="lg">
            <Link to="/icu/reports">
              <FileBarChart className="size-4 mr-2" />
              Reports
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/icu/settings">
              <Settings className="size-4 mr-2" />
              Settings
            </Link>
          </Button>
          <TransferToICUDialog onDone={() => refetchAdm()} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <k.icon className="size-4 text-muted-foreground" />
              </div>
              <div
                className={`text-2xl font-semibold tabular-nums mt-2 ${
                  k.accent === "destructive" ? "text-destructive" : k.accent === "warning" ? "text-amber-600" : k.accent === "info" ? "text-blue-600" : ""
                }`}
              >
                {k.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {alerts.length > 0 && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-destructive" /> Critical alerts
          </div>
          <div className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <Badge variant="destructive" className="capitalize">
                  {a.severity}
                </Badge>
                <span className="font-medium">{a.patients?.full_name}</span>
                <span className="text-muted-foreground">{a.message}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={async () => {
                    await (supabase as any).from("icu_alerts").update({ resolved: true }).eq("id", a.id);
                    refetchAlerts();
                  }}
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-semibold">ICU patients</div>
          <Badge variant="secondary">{filtered.length}</Badge>
          <div className="relative ml-auto w-72">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="UHID, name, bed, admission no…" className="pl-9" />
          </div>
        </div>
        <div className="rounded-lg border divide-y">
          {filtered.map((a: any) => {
            const days = a.admitted_at ? differenceInDays(new Date(), new Date(a.admitted_at)) + 1 : 0;
            return (
              <div
                key={a.id}
                role="button"
                onClick={() => nav({ to: "/icu/$id", params: { id: a.id } })}
                className="p-3 grid grid-cols-12 gap-3 items-center hover:bg-muted/40 cursor-pointer"
              >
                <Avatar className="size-10 col-span-1">
                  <AvatarImage src={a.patients?.photo_url ?? undefined} />
                  <AvatarFallback>{a.patients?.full_name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="col-span-3">
                  <div className="font-medium">{a.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.patients?.uhid} · {a.patients?.dob ? new Date().getFullYear() - new Date(a.patients.dob).getFullYear() + "y" : "—"} · {a.patients?.gender ?? "—"}
                  </div>
                </div>
                <div className="col-span-2 text-sm">
                  <div className="text-muted-foreground text-xs">Bed / Ward</div>
                  <div>
                    {a.beds?.bed_number ?? "—"} · {a.wards?.name ?? "—"}
                  </div>
                </div>
                <div className="col-span-2 text-sm">
                  <div className="text-muted-foreground text-xs">Doctor</div>
                  <div>{a.doctors?.name ?? "—"}</div>
                </div>
                <div className="col-span-2 text-sm truncate">
                  <div className="text-muted-foreground text-xs">Diagnosis</div>
                  <div className="truncate" title={a.initial_diagnosis ?? ""}>
                    {a.initial_diagnosis ?? "—"}
                  </div>
                </div>
                <div className="col-span-1 text-sm">
                  <div className="text-muted-foreground text-xs">Day</div>
                  <div>{days}</div>
                </div>
                <div className="col-span-1 flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="outline" className={`capitalize ${ICU_STATUS_STYLES[a.icu_status ?? "stable"] ?? ""}`}>
                    {a.icu_status ?? "stable"}
                  </Badge>
                  <RecordActions
                    size="icon"
                    deleteLabel={`ICU admission ${a.admission_no}`}
                    onWhatsApp={() => shareOnWhatsApp(
                      `ICU Update — ${a.patients?.full_name ?? ""} (${a.patients?.uhid ?? ""})\nAdmission: ${a.admission_no}\nBed: ${a.beds?.bed_number ?? "—"} · ${a.wards?.name ?? "—"}\nStatus: ${a.icu_status ?? "stable"}\nDoctor: ${a.doctors?.name ?? "—"}`
                    )}
                  />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">No ICU patients yet. Use “Transfer to ICU” to admit a patient.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function TransferToICUDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [admissionId, setAdmissionId] = useState("");
  const [bedId, setBedId] = useState("");
  const [icuStatus, setIcuStatus] = useState<string>("critical");
  const [reason, setReason] = useState("");

  const { data: admissions = [] } = useQuery({
    queryKey: ["icu-tx-admissions", open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("admissions")
        .select("id, admission_no, patient_id, ward_id, bed_id, patients(full_name, uhid), wards(name, type)")
        .eq("status", "active")
        .order("admitted_at", { ascending: false });
      return (data ?? []).filter((a: any) => a.wards?.type !== "icu");
    },
  });

  const { data: icuBeds = [] } = useQuery({
    queryKey: ["icu-tx-beds", open],
    enabled: open,
    queryFn: async () => {
      const { data: wards } = await supabase.from("wards").select("id, name").eq("type", "icu");
      const ids = (wards ?? []).map((w: any) => w.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("beds")
        .select("id, bed_number, status, ward_id, wards(name)")
        .in("ward_id", ids)
        .eq("status", "available")
        .order("bed_number");
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!admissionId || !bedId) return toast.error("Select patient and ICU bed");
    const adm = admissions.find((a: any) => a.id === admissionId);
    const bed = icuBeds.find((b: any) => b.id === bedId);
    if (!adm || !bed) return;
    const user = (await supabase.auth.getUser()).data.user;

    // Move admission to ICU bed/ward; mark icu_status
    const { error: aerr } = await supabase
      .from("admissions")
      .update({ ward_id: bed.ward_id, bed_id: bed.id, icu_status: icuStatus as any })
      .eq("id", admissionId);
    if (aerr) return toast.error(aerr.message);

    // Free prior bed, occupy new one
    if (adm.bed_id)
      await supabase.from("beds").update({ status: "available" }).eq("id", adm.bed_id);
    await supabase.from("beds").update({ status: "occupied" }).eq("id", bed.id);

    // Audit via bed_transfers
    await (supabase as any).from("bed_transfers").insert({
      admission_id: admissionId,
      from_ward_id: adm.ward_id,
      to_ward_id: bed.ward_id,
      from_bed_id: adm.bed_id,
      to_bed_id: bed.id,
      reason: reason || `Ward → ICU (${icuStatus})`,
      created_by: user?.id,
    });

    toast.success("Patient transferred to ICU");
    setOpen(false);
    setAdmissionId("");
    setBedId("");
    setReason("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <ArrowRightLeft className="size-4 mr-2" />
          Transfer to ICU
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer patient to ICU</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Active admission</Label>
            <Select value={admissionId} onValueChange={setAdmissionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {admissions.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.patients?.full_name} ({a.patients?.uhid}) · {a.wards?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ICU bed</Label>
              <Select value={bedId} onValueChange={setBedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Available beds" />
                </SelectTrigger>
                <SelectContent>
                  {icuBeds.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.wards?.name} · {b.bed_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ICU status</Label>
              <Select value={icuStatus} onValueChange={setIcuStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICU_STATUS.filter((s) => s !== "discharged").map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reason / notes</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
