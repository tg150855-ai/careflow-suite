import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Users, CalendarDays, Stethoscope, Activity, TrendingUp, ArrowUpRight,
  BedDouble, IndianRupee, AlertTriangle, Pill, FlaskConical, Scan,
  HeartPulse, ShieldCheck, Wallet, ClipboardList, Building2, Crown,
  UserCog, Droplets, FileBarChart, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth, type AppRole } from "@/lib/auth-context";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardRouter });

/* ---------- ROUTER ---------- */
function DashboardRouter() {
  const { roles, profile, loading } = useAuth();
  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  // Role priority — pick the most specific dashboard for this user
  const priority: AppRole[] = [
    "super_admin", "dept_head", "admin", "surgeon", "doctor", "nurse",
    "pharmacist", "lab_tech", "finance_manager", "accountant",
    "insurance_officer", "hr_manager", "ot_coordinator", "ambulance_driver",
    "procurement_officer", "receptionist", "patient",
  ];
  const role = priority.find((r) => roles.includes(r)) ?? "admin";

  return (
    <div className="space-y-7">
      <Greeting name={profile?.full_name ?? null} role={role} />
      {role === "super_admin" && <SuperAdminDashboard />}
      {role === "dept_head" && <OwnerDashboard />}
      {role === "admin" && <AdminDashboard />}
      {(role === "doctor" || role === "surgeon") && <DoctorDashboard senior={role === "surgeon"} />}
      {role === "nurse" && <NurseDashboard />}
      {role === "receptionist" && <ReceptionistDashboard />}
      {role === "pharmacist" && <PharmacistDashboard />}
      {role === "lab_tech" && <LabDashboard />}
      {(role === "accountant" || role === "finance_manager") && <AccountsDashboard />}
      {role === "insurance_officer" && <InsuranceDashboard />}
      {role === "hr_manager" && <HRDashboard />}
      {role === "ot_coordinator" && <AdminDashboard />}
      {role === "ambulance_driver" && <ReceptionistDashboard />}
      {role === "procurement_officer" && <PharmacistDashboard />}
      {role === "patient" && <PatientDashboard />}
    </div>
  );
}

/* ---------- SHARED PRIMITIVES ---------- */
function Greeting({ name, role }: { name: string | null; role: AppRole }) {
  const labels: Record<AppRole, string> = {
    super_admin: "Super Admin Console", admin: "Hospital Operations", doctor: "Clinical Workspace",
    surgeon: "Surgical Workspace", nurse: "Nursing Station", receptionist: "Front Desk",
    pharmacist: "Pharmacy Console", lab_tech: "Laboratory Console", accountant: "Accounts Console",
    finance_manager: "Finance Command", insurance_officer: "Insurance Desk", ot_coordinator: "OT Coordination",
    ambulance_driver: "Ambulance Operations", hr_manager: "HR Console", dept_head: "Executive Overview",
    procurement_officer: "Procurement Console", patient: "Patient Portal",
  };
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{labels[role]}</div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1">
        Good {greeting()}{name ? `, ${name.split(" ")[0]}` : ""}
      </h1>
    </div>
  );
}

type KpiColor = "primary" | "accent" | "success" | "warning" | "danger";
function Kpi({ label, value, icon: Icon, color = "primary", hint }: {
  label: string; value: number | string; icon: any; color?: KpiColor; hint?: string;
}) {
  const bg: Record<KpiColor, string> = {
    primary: "color-mix(in oklch, var(--primary) 12%, transparent)",
    accent: "color-mix(in oklch, var(--accent) 14%, transparent)",
    success: "color-mix(in oklch, var(--success, var(--primary)) 14%, transparent)",
    warning: "color-mix(in oklch, var(--warning, var(--accent)) 18%, transparent)",
    danger: "color-mix(in oklch, var(--destructive) 16%, transparent)",
  };
  const fg: Record<KpiColor, string> = {
    primary: "var(--primary)", accent: "var(--accent)",
    success: "var(--success, var(--primary))",
    warning: "var(--warning-foreground, var(--accent))",
    danger: "var(--destructive)",
  };
  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-start justify-between">
        <div className="size-10 rounded-2xl flex items-center justify-center"
             style={{ background: bg[color], color: fg[color] }}>
          <Icon className="size-5" />
        </div>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

function Section({ title, action, children, span = 1 }: {
  title: string; action?: ReactNode; children: ReactNode; span?: 1 | 2 | 3;
}) {
  const cls = span === 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "";
  return (
    <Card className={`p-5 ${cls}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ActionLink({ href, label, icon: Icon }: { href: string; label: string; icon?: any }) {
  return (
    <Link to={href}
          className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group">
      <span className="text-sm font-medium inline-flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground group-hover:text-primary" />}
        {label}
      </span>
      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{text}</div>;
}

function MotionGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`grid grid-cols-1 ${c} gap-4`}>
      {children}
    </motion.div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function todayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function monthStartISO() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
}

async function countTable(table: string, filter?: (q: any) => any) {
  let q: any = supabase.from(table as any).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}
async function sumColumn(table: string, col: string, filter?: (q: any) => any): Promise<number> {
  let q: any = supabase.from(table as any).select(col);
  if (filter) q = filter(q);
  const { data, error } = await q;
  if (error || !data) return 0;
  return data.reduce((s: number, r: any) => s + Number(r[col] ?? 0), 0);
}

/* ---------- SUPER ADMIN ---------- */
function SuperAdminDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-super"],
    queryFn: async () => {
      const t = todayISO();
      const [patients, opd, ipd, revenue, pending, pharmacyRev, labCount, otCount,
        admissions, icuBeds, emergency, lowStock] = await Promise.all([
        countTable("patients"),
        countTable("opd_visits", (q) => q.gte("created_at", t)),
        countTable("admissions", (q) => q.gte("admission_date", t)),
        sumColumn("bills", "total", (q) => q.gte("created_at", t)),
        sumColumn("bills", "pending", (q) => q.gt("pending", 0)),
        sumColumn("pharmacy_sales", "total", (q) => q.gte("created_at", t)),
        countTable("lab_orders", (q) => q.gte("created_at", t)),
        countTable("surgeries", (q) => q.gte("scheduled_start", t)),
        countTable("admissions", (q) => q.is("discharged_at", null)),
        countTable("beds", (q) => q.eq("status", "occupied")),
        countTable("emergency_cases", (q) => q.gte("created_at", t)),
        countTable("medicine_batches", (q) => q.lt("quantity", 20)),
      ]);
      return { patients, opd, ipd, revenue, pending, pharmacyRev, labCount, otCount,
        admissions, icuBeds, emergency, lowStock };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Total Patients" value={d.patients ?? 0} icon={Users} />
        <Kpi label="Today's OPD" value={d.opd ?? 0} icon={Stethoscope} color="accent" />
        <Kpi label="Today's IPD" value={d.ipd ?? 0} icon={BedDouble} color="accent" />
        <Kpi label="Revenue Today" value={`₹${(d.revenue ?? 0).toLocaleString()}`} icon={IndianRupee} color="success" />
      </MotionGrid>
      <MotionGrid>
        <Kpi label="Pending Bills" value={`₹${(d.pending ?? 0).toLocaleString()}`} icon={Wallet} color="warning" />
        <Kpi label="Pharmacy Revenue" value={`₹${(d.pharmacyRev ?? 0).toLocaleString()}`} icon={Pill} />
        <Kpi label="Lab Orders Today" value={d.labCount ?? 0} icon={FlaskConical} />
        <Kpi label="OT Cases Today" value={d.otCount ?? 0} icon={Activity} />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="Live Hospital Status" span={2}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Current Admissions" value={d.admissions ?? 0} />
            <MiniStat label="Beds Occupied" value={d.icuBeds ?? 0} />
            <MiniStat label="Emergency Today" value={d.emergency ?? 0} color="danger" />
            <MiniStat label="OT Today" value={d.otCount ?? 0} />
          </div>
        </Section>
        <Section title="Alerts">
          <div className="space-y-2 text-sm">
            <AlertRow icon={Pill} label="Low medicine stock" value={d.lowStock ?? 0} tone="warning" />
            <AlertRow icon={AlertTriangle} label="Pending bills" value={`₹${(d.pending ?? 0).toLocaleString()}`} tone="danger" />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- HOSPITAL ADMIN ---------- */
function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-admin"],
    queryFn: async () => {
      const t = todayISO();
      const [opd, ipd, adm, dis, revenue, pending, bedsOcc, bedsTot, otToday, emerg] = await Promise.all([
        countTable("opd_visits", (q) => q.gte("created_at", t)),
        countTable("admissions", (q) => q.is("discharged_at", null)),
        countTable("admissions", (q) => q.gte("admitted_at", t)),
        countTable("admissions", (q) => q.gte("discharged_at", t)),
        sumColumn("bills", "total", (q) => q.gte("created_at", t)),
        sumColumn("bills", "pending", (q) => q.gt("pending", 0)),
        countTable("beds", (q) => q.eq("status", "occupied")),
        countTable("beds"),
        countTable("surgeries", (q) => q.gte("scheduled_start", t)),
        countTable("emergency_cases", (q) => q.gte("created_at", t)),
      ]);
      return { opd, ipd, adm, dis, revenue, pending, bedsOcc, bedsTot, otToday, emerg };
    },
  });
  const d = data ?? {} as any;
  const occupancy = d.bedsTot ? Math.round((d.bedsOcc / d.bedsTot) * 100) : 0;
  return (
    <>
      <MotionGrid>
        <Kpi label="OPD Today" value={d.opd ?? 0} icon={Stethoscope} />
        <Kpi label="IPD (Active)" value={d.ipd ?? 0} icon={BedDouble} color="accent" />
        <Kpi label="Admissions Today" value={d.adm ?? 0} icon={Users} />
        <Kpi label="Discharges Today" value={d.dis ?? 0} icon={ArrowUpRight} color="success" />
      </MotionGrid>
      <MotionGrid cols={3}>
        <Kpi label="Revenue Today" value={`₹${(d.revenue ?? 0).toLocaleString()}`} icon={IndianRupee} color="success" />
        <Kpi label="Pending Bills" value={`₹${(d.pending ?? 0).toLocaleString()}`} icon={Wallet} color="warning" />
        <Kpi label="Bed Occupancy" value={`${occupancy}%`} icon={BedDouble} hint={`${d.bedsOcc}/${d.bedsTot}`} />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="Operations" span={2}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MiniStat label="OT Today" value={d.otToday ?? 0} />
            <MiniStat label="Emergency Today" value={d.emerg ?? 0} color="danger" />
            <MiniStat label="Active IPD" value={d.ipd ?? 0} />
          </div>
        </Section>
        <Section title="Quick Actions">
          <div className="space-y-2">
            <ActionLink href="/staff" label="Register staff" icon={UserCog} />
            <ActionLink href="/reports" label="Generate reports" icon={FileBarChart} />
            <ActionLink href="/branches" label="Branches" icon={Building2} />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- DOCTOR ---------- */
function DoctorDashboard({ senior }: { senior: boolean }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["dash-doctor", user?.id, senior],
    queryFn: async () => {
      const t = todayISO();
      // try to find doctor record linked to this user
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user!.id).maybeSingle();
      const docId = doc?.id ?? null;
      const apptFilter = (q: any) => docId ? q.eq("doctor_id", docId).gte("scheduled_at", t) : q.gte("scheduled_at", t);
      const [appts, queue, critical] = await Promise.all([
        countTable("appointments", apptFilter),
        supabase.from("appointments")
          .select("id, scheduled_at, status, patients(full_name, uhid, dob)")
          .gte("scheduled_at", t).order("scheduled_at").limit(8)
          .then(r => r.data ?? []),
        countTable("clinical_alerts", (q) => q.eq("severity", "critical").eq("resolved", false)).catch(() => 0),
      ]);
      const waiting = queue.filter((a: any) => a.status === "waiting" || a.status === "booked").length;
      return { appts, queue, waiting, critical };
    },
    enabled: !!user,
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Today's Appointments" value={d.appts ?? 0} icon={CalendarDays} />
        <Kpi label="Waiting" value={d.waiting ?? 0} icon={Activity} color="warning" />
        <Kpi label="Critical Alerts" value={d.critical ?? 0} icon={AlertTriangle} color="danger" />
        <Kpi label="Mode" value={senior ? "Senior" : "Doctor"} icon={Stethoscope} color="accent" />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="My queue today" span={2}
                 action={<Link to="/appointments" className="text-xs text-primary">View all</Link>}>
          {(!d.queue || d.queue.length === 0) ? <Empty text="No appointments today" /> : (
            <div className="divide-y">
              {d.queue.map((a: any, i: number) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="font-mono">#{i + 1}</Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.patients?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.patients?.uhid}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm tabular-nums">{format(new Date(a.scheduled_at), "HH:mm")}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{a.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Quick actions">
          <div className="space-y-2">
            <ActionLink href="/opd" label="Start consultation" icon={Stethoscope} />
            <ActionLink href="/patients" label="Open patient record" icon={Users} />
            <ActionLink href="/laboratory" label="Order lab test" icon={FlaskConical} />
            <ActionLink href="/radiology" label="Order radiology" icon={Scan} />
            {senior && <ActionLink href="/ot" label="OT approvals" icon={ShieldCheck} />}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- NURSE ---------- */
function NurseDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-nurse"],
    queryFn: async () => {
      const t = todayISO();
      const [assigned, medsDue, vitalsPending, alerts] = await Promise.all([
        countTable("admissions", (q) => q.is("discharged_at", null)),
        countTable("medication_administration", (q) => q.eq("status", "pending")).catch(() => 0),
        countTable("vitals", (q) => q.gte("recorded_at", t)).catch(() => 0),
        countTable("clinical_alerts", (q) => q.eq("resolved", false)).catch(() => 0),
      ]);
      return { assigned, medsDue, vitalsPending, alerts };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Patients Assigned" value={d.assigned ?? 0} icon={Users} />
        <Kpi label="Medicines Due" value={d.medsDue ?? 0} icon={Pill} color="warning" />
        <Kpi label="Vitals Recorded Today" value={d.vitalsPending ?? 0} icon={HeartPulse} color="accent" />
        <Kpi label="Active Alerts" value={d.alerts ?? 0} icon={AlertTriangle} color="danger" />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Quick actions">
          <div className="space-y-2">
            <ActionLink href="/nurse-station" label="Open nurse station" icon={HeartPulse} />
            <ActionLink href="/ipd" label="IPD ward view" icon={BedDouble} />
            <ActionLink href="/patients" label="Find patient" icon={Users} />
          </div>
        </Section>
        <Section title="Critical">
          {d.alerts ? (
            <Empty text={`${d.alerts} unresolved alert(s) — open Nurse Station`} />
          ) : <Empty text="No critical alerts" />}
        </Section>
      </div>
    </>
  );
}

/* ---------- RECEPTIONIST ---------- */
function ReceptionistDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-recep"],
    queryFn: async () => {
      const t = todayISO();
      const [appts, registrations, queue] = await Promise.all([
        countTable("appointments", (q) => q.gte("scheduled_at", t)),
        countTable("patients", (q) => q.gte("created_at", t)),
        supabase.from("appointments")
          .select("id, scheduled_at, status, patients(full_name, uhid), doctors(name)")
          .gte("scheduled_at", t).order("scheduled_at").limit(10)
          .then(r => r.data ?? []),
      ]);
      const waiting = queue.filter((a: any) => a.status === "waiting" || a.status === "booked").length;
      return { appts, registrations, queue, waiting };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Today's Appointments" value={d.appts ?? 0} icon={CalendarDays} />
        <Kpi label="Waiting Patients" value={d.waiting ?? 0} icon={Activity} color="warning" />
        <Kpi label="New Registrations" value={d.registrations ?? 0} icon={Users} color="success" />
        <Kpi label="Total Tokens" value={d.queue?.length ?? 0} icon={ClipboardList} color="accent" />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="Live queue" span={2}>
          {(!d.queue || d.queue.length === 0) ? <Empty text="Queue is empty" /> : (
            <div className="divide-y">
              {d.queue.map((a: any, i: number) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="font-mono">T{i + 1}</Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.patients?.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.doctors?.name ?? "—"}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{a.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Quick actions">
          <div className="space-y-2">
            <ActionLink href="/patients/new" label="Register patient" icon={Users} />
            <ActionLink href="/appointments" label="Book appointment" icon={CalendarDays} />
            <ActionLink href="/billing/new" label="Collect fee" icon={Wallet} />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- PHARMACIST ---------- */
function PharmacistDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-pharm"],
    queryFn: async () => {
      const t = todayISO();
      const [scripts, sales, lowStock, expiring] = await Promise.all([
        countTable("prescriptions", (q) => q.gte("created_at", t)),
        sumColumn("pharmacy_sales", "total_amount", (q) => q.gte("created_at", t)),
        countTable("medicines", (q) => q.lt("current_stock", 20)),
        countTable("medicine_batches", (q) => q.lt("expiry_date",
          new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10))).catch(() => 0),
      ]);
      return { scripts, sales, lowStock, expiring };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Prescriptions Today" value={d.scripts ?? 0} icon={ClipboardList} />
        <Kpi label="Sales Today" value={`₹${(d.sales ?? 0).toLocaleString()}`} icon={IndianRupee} color="success" />
        <Kpi label="Low Stock" value={d.lowStock ?? 0} icon={AlertTriangle} color="warning" />
        <Kpi label="Expiring (60d)" value={d.expiring ?? 0} icon={Pill} color="danger" />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Quick actions">
          <div className="space-y-2">
            <ActionLink href="/pharmacy/sales/new" label="Dispense medicine" icon={Pill} />
            <ActionLink href="/pharmacy/medicines" label="Manage inventory" icon={ClipboardList} />
            <ActionLink href="/procurement" label="Purchase stock" icon={Building2} />
          </div>
        </Section>
        <Section title="Inventory health">
          <Empty text={`${d.lowStock ?? 0} low-stock SKUs · ${d.expiring ?? 0} expiring batches`} />
        </Section>
      </div>
    </>
  );
}

/* ---------- LAB ---------- */
function LabDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-lab"],
    queryFn: async () => {
      const t = todayISO();
      const [pending, collected, reportsPending, done] = await Promise.all([
        countTable("lab_orders", (q) => q.eq("status", "pending")),
        countTable("lab_orders", (q) => q.eq("status", "collected")),
        countTable("lab_orders", (q) => q.eq("status", "in_progress")).catch(() => 0),
        countTable("lab_orders", (q) => q.eq("status", "completed").gte("updated_at", t)).catch(() => 0),
      ]);
      return { pending, collected, reportsPending, done };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Tests Pending" value={d.pending ?? 0} icon={FlaskConical} color="warning" />
        <Kpi label="Samples Collected" value={d.collected ?? 0} icon={Droplets} color="accent" />
        <Kpi label="Reports In-Progress" value={d.reportsPending ?? 0} icon={ClipboardList} />
        <Kpi label="Completed Today" value={d.done ?? 0} icon={ShieldCheck} color="success" />
      </MotionGrid>
      <Section title="Quick actions">
        <div className="grid sm:grid-cols-3 gap-2">
          <ActionLink href="/laboratory" label="Sample queue" icon={Droplets} />
          <ActionLink href="/laboratory" label="Enter results" icon={FlaskConical} />
          <ActionLink href="/laboratory/tests" label="Test catalog" icon={ClipboardList} />
        </div>
      </Section>
    </>
  );
}

/* ---------- ACCOUNTS / FINANCE ---------- */
function AccountsDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-acct"],
    queryFn: async () => {
      const t = todayISO(); const m = monthStartISO();
      const [revDay, revMonth, pending, expenses] = await Promise.all([
        sumColumn("bills", "total_amount", (q) => q.gte("created_at", t)),
        sumColumn("bills", "total_amount", (q) => q.gte("created_at", m)),
        sumColumn("bills", "balance_amount", (q) => q.gt("balance_amount", 0)),
        sumColumn("transactions", "amount", (q) => q.eq("type", "debit").gte("created_at", m)).catch(() => 0),
      ]);
      return { revDay, revMonth, pending, expenses };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Revenue Today" value={`₹${(d.revDay ?? 0).toLocaleString()}`} icon={IndianRupee} color="success" />
        <Kpi label="Revenue MTD" value={`₹${(d.revMonth ?? 0).toLocaleString()}`} icon={TrendingUp} color="accent" />
        <Kpi label="Pending Payments" value={`₹${(d.pending ?? 0).toLocaleString()}`} icon={Wallet} color="warning" />
        <Kpi label="Expenses MTD" value={`₹${(d.expenses ?? 0).toLocaleString()}`} icon={ArrowUpRight} color="danger" />
      </MotionGrid>
      <Section title="Quick actions">
        <div className="grid sm:grid-cols-3 gap-2">
          <ActionLink href="/billing" label="Billing queue" icon={Wallet} />
          <ActionLink href="/finance" label="Finance ledger" icon={IndianRupee} />
          <ActionLink href="/reports" label="Export reports" icon={FileBarChart} />
        </div>
      </Section>
    </>
  );
}

/* ---------- INSURANCE ---------- */
function InsuranceDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-ins"],
    queryFn: async () => {
      const [pending, approved, rejected, revUnder] = await Promise.all([
        countTable("insurance_claims", (q) => q.eq("status", "pending")),
        countTable("insurance_claims", (q) => q.eq("status", "approved")),
        countTable("insurance_claims", (q) => q.eq("status", "rejected")),
        sumColumn("insurance_claims", "claim_amount", (q) => q.eq("status", "pending")).catch(() => 0),
      ]);
      return { pending, approved, rejected, revUnder };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Claims Pending" value={d.pending ?? 0} icon={ClipboardList} color="warning" />
        <Kpi label="Approved" value={d.approved ?? 0} icon={ShieldCheck} color="success" />
        <Kpi label="Rejected" value={d.rejected ?? 0} icon={AlertTriangle} color="danger" />
        <Kpi label="Revenue Under Claims" value={`₹${(d.revUnder ?? 0).toLocaleString()}`} icon={IndianRupee} color="accent" />
      </MotionGrid>
      <Section title="Quick actions">
        <ActionLink href="/insurance" label="Open claims workspace" icon={ShieldCheck} />
      </Section>
    </>
  );
}

/* ---------- HR ---------- */
function HRDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-hr"],
    queryFn: async () => {
      const t = todayISO();
      const [emps, present, leaves, payroll] = await Promise.all([
        countTable("employees"),
        countTable("attendance_records", (q) => q.gte("date", t.slice(0, 10)).eq("status", "present")).catch(() => 0),
        countTable("leave_requests", (q) => q.eq("status", "pending")),
        countTable("salary_slips", (q) => q.eq("status", "pending")).catch(() => 0),
      ]);
      return { emps, present, leaves, payroll };
    },
  });
  const d = data ?? {} as any;
  return (
    <>
      <MotionGrid>
        <Kpi label="Employees" value={d.emps ?? 0} icon={Users} />
        <Kpi label="Present Today" value={d.present ?? 0} icon={ShieldCheck} color="success" />
        <Kpi label="Leave Requests" value={d.leaves ?? 0} icon={CalendarDays} color="warning" />
        <Kpi label="Payroll Pending" value={d.payroll ?? 0} icon={Wallet} color="accent" />
      </MotionGrid>
      <Section title="Quick actions">
        <div className="grid sm:grid-cols-3 gap-2">
          <ActionLink href="/hr/employees" label="Employees" icon={Users} />
          <ActionLink href="/hr/leave" label="Leave approvals" icon={CalendarDays} />
          <ActionLink href="/hr/payroll" label="Payroll" icon={Wallet} />
        </div>
      </Section>
    </>
  );
}

/* ---------- OWNER / DIRECTOR ---------- */
function OwnerDashboard() {
  const { data } = useQuery({
    queryKey: ["dash-owner"],
    queryFn: async () => {
      const t = todayISO(); const m = monthStartISO();
      const [revDay, revMonth, opd, ipd, occ, occTot, otToday, emerg] = await Promise.all([
        sumColumn("bills", "total_amount", (q) => q.gte("created_at", t)),
        sumColumn("bills", "total_amount", (q) => q.gte("created_at", m)),
        countTable("opd_visits", (q) => q.gte("created_at", t)),
        countTable("admissions", (q) => q.is("discharge_date", null)),
        countTable("beds", (q) => q.eq("status", "occupied")),
        countTable("beds"),
        countTable("surgeries", (q) => q.gte("scheduled_at", t)),
        countTable("emergency_visits", (q) => q.gte("created_at", t)),
      ]);
      return { revDay, revMonth, opd, ipd, occ, occTot, otToday, emerg };
    },
  });
  const d = data ?? {} as any;
  const occRate = d.occTot ? Math.round((d.occ / d.occTot) * 100) : 0;
  return (
    <>
      <MotionGrid>
        <Kpi label="Revenue Today" value={`₹${(d.revDay ?? 0).toLocaleString()}`} icon={IndianRupee} color="success" />
        <Kpi label="Revenue MTD" value={`₹${(d.revMonth ?? 0).toLocaleString()}`} icon={TrendingUp} color="accent" />
        <Kpi label="Occupancy" value={`${occRate}%`} icon={BedDouble} hint={`${d.occ}/${d.occTot}`} />
        <Kpi label="OPD Today" value={d.opd ?? 0} icon={Stethoscope} />
      </MotionGrid>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="Hospital snapshot" span={2}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Active IPD" value={d.ipd ?? 0} />
            <MiniStat label="OT Today" value={d.otToday ?? 0} />
            <MiniStat label="Emergency" value={d.emerg ?? 0} color="danger" />
            <MiniStat label="Occupancy" value={`${occRate}%`} />
          </div>
        </Section>
        <Section title="AI Insights">
          <div className="space-y-2">
            <ActionLink href="/forecast" label="Revenue forecast" icon={TrendingUp} />
            <ActionLink href="/predictions" label="Growth predictions" icon={Crown} />
            <ActionLink href="/bi" label="BI dashboard" icon={FileBarChart} />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ---------- PATIENT ---------- */
function PatientDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Section title="My health" span={2}>
        <div className="space-y-2">
          <ActionLink href="/patient-portal" label="Open patient portal" icon={HeartPulse} />
          <ActionLink href="/appointments" label="Book appointment" icon={CalendarDays} />
          <ActionLink href="/telemedicine" label="Start telemedicine" icon={Stethoscope} />
        </div>
      </Section>
      <Section title="Records">
        <ActionLink href="/health-records" label="My medical records" icon={ClipboardList} />
      </Section>
    </div>
  );
}

/* ---------- helpers ---------- */
function MiniStat({ label, value, color = "primary" }: { label: string; value: number | string; color?: KpiColor }) {
  const fg: Record<KpiColor, string> = {
    primary: "var(--primary)", accent: "var(--accent)",
    success: "var(--success, var(--primary))",
    warning: "var(--warning-foreground, var(--accent))",
    danger: "var(--destructive)",
  };
  return (
    <div className="p-3 rounded-xl border border-border/60">
      <div className="text-xl font-semibold tabular-nums" style={{ color: fg[color] }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, value, tone = "warning" }:
  { icon: any; label: string; value: number | string; tone?: "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60">
      <span className="inline-flex items-center gap-2">
        <Icon className={`size-4 ${tone === "danger" ? "text-destructive" : "text-amber-500"}`} />
        <span className="text-sm">{label}</span>
      </span>
      <Badge variant={tone === "danger" ? "destructive" : "secondary"}>{value}</Badge>
    </div>
  );
}
