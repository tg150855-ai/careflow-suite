import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, Eye, Phone, Plus, Printer, Search,
  Users, UserPlus, CalendarDays, Activity, BedDouble, Siren, FileSpreadsheet,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { patientPhotoPublicUrl } from "@/components/patient-photo-field";
import { differenceInYears, format, startOfDay, startOfMonth } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/patients/")({ component: PatientsPage });

function PatientsDashboardCards() {
  const { data } = useQuery({
    queryKey: ["patients-dash"],
    queryFn: async () => {
      const todayIso = startOfDay(new Date()).toISOString();
      const monthIso = startOfMonth(new Date()).toISOString();
      const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
      const [total, today, month, ipd, opd, er, breakdown] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
        supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", monthIso),
        (supabase as any).from("admissions").select("id", { count: "exact", head: true }).is("discharge_at", null),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", todayIso).lte("scheduled_at", endToday.toISOString()),
        (supabase as any).from("emergency_cases").select("id", { count: "exact", head: true }).in("status", ["waiting", "in_treatment"]),
        supabase.from("patients").select("gender, dob, blood_group").limit(5000),
      ]);
      const rows = (breakdown.data ?? []) as any[];
      const gender = { male: 0, female: 0, other: 0 };
      const age = { "0-12": 0, "13-25": 0, "26-45": 0, "46-60": 0, "60+": 0 };
      const blood: Record<string, number> = {};
      const now = new Date();
      for (const r of rows) {
        const g = (r.gender ?? "").toLowerCase();
        if (g === "male" || g === "female") gender[g]++; else gender.other++;
        if (r.dob) {
          const y = differenceInYears(now, new Date(r.dob));
          if (y <= 12) age["0-12"]++;
          else if (y <= 25) age["13-25"]++;
          else if (y <= 45) age["26-45"]++;
          else if (y <= 60) age["46-60"]++;
          else age["60+"]++;
        }
        if (r.blood_group) blood[r.blood_group] = (blood[r.blood_group] ?? 0) + 1;
      }
      return {
        total: total.count ?? 0,
        today: today.count ?? 0,
        month: month.count ?? 0,
        ipd: ipd.count ?? 0,
        opd: opd.count ?? 0,
        er: er.count ?? 0,
        gender, age, blood,
      };
    },
  });
  const d = data;
  const stat = (label: string, value: React.ReactNode, Icon: any, tone: string) => (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value ?? "—"}</div>
        </div>
        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stat("Total Patients", d?.total, Users, "bg-primary/10 text-primary")}
        {stat("New Today", d?.today, UserPlus, "bg-emerald-100 text-emerald-700")}
        {stat("New This Month", d?.month, CalendarDays, "bg-blue-100 text-blue-700")}
        {stat("Active IPD", d?.ipd, BedDouble, "bg-purple-100 text-purple-700")}
        {stat("OPD Today", d?.opd, Activity, "bg-amber-100 text-amber-700")}
        {stat("Emergency Active", d?.er, Siren, "bg-red-100 text-red-700")}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Gender</div>
          <div className="flex justify-between text-sm">
            <span>Male: <b className="tabular-nums">{d?.gender.male ?? 0}</b></span>
            <span>Female: <b className="tabular-nums">{d?.gender.female ?? 0}</b></span>
            <span>Other: <b className="tabular-nums">{d?.gender.other ?? 0}</b></span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Age groups</div>
          <div className="grid grid-cols-5 gap-1 text-xs text-center">
            {d && Object.entries(d.age).map(([k, v]) => (
              <div key={k}><div className="font-semibold tabular-nums">{v}</div><div className="text-muted-foreground">{k}</div></div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Blood groups</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {d && Object.keys(d.blood).length === 0 && <span className="text-muted-foreground text-xs">—</span>}
            {d && Object.entries(d.blood).sort().map(([k, v]) => (
              <span key={k}>{k}: <b className="tabular-nums">{v}</b></span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PatientsPage() {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pageSize = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["patients", q, gender, page],
    queryFn: async () => {
      const safeTerm = q
        .trim()
        .replace(/[%,()]/g, " ")
        .replace(/\s+/g, " ");
      let query = supabase
        .from("patients")
        .select("id, uhid, full_name, mobile, gender, dob, blood_group, photo_url, created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (safeTerm.length >= 2)
        query = query.or(
          `full_name.ilike.%${safeTerm}%,mobile.ilike.%${safeTerm}%,uhid.ilike.%${safeTerm}%`,
        );
      if (gender !== "all") query = query.eq("gender", gender as any);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const patients = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function deletePatient(patient: any) {
    const { data: before } = await (supabase as any)
      .from("patients")
      .select("*")
      .eq("id", patient.id)
      .maybeSingle();
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "delete", entity: "patients", entityId: patient.id, before });
    toast.success("Patient record deleted");
    queryClient.invalidateQueries({ queryKey: ["patients"] });
  }

  async function downloadCsv() {
    const { data, error } = await supabase
      .from("patients")
      .select("uhid, full_name, mobile, email, gender, dob, blood_group, city, state, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = data ?? [];
    const headers = ["UHID", "Name", "Mobile", "Email", "Gender", "DOB", "Blood Group", "City", "State", "Registered"];
    const csv = [
      headers.join(","),
      ...rows.map((r: any) =>
        [r.uhid, r.full_name, r.mobile, r.email ?? "", r.gender, r.dob ?? "", r.blood_group ?? "", r.city ?? "", r.state ?? "", r.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} patients`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="text-muted-foreground mt-1">
            {total} record{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={downloadCsv}>
            <Download className="size-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" />
            Print
          </Button>
          <Button asChild size="lg">
            <Link to="/patients/new">
              <Plus className="size-4 mr-2" />
              New patient
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-2">
        <div className="p-3 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, mobile or UHID..."
              className="pl-10 h-11 border-transparent bg-surface-muted"
            />
          </div>
          <Select
            value={gender}
            onValueChange={(v) => {
              setGender(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 bg-surface-muted border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="divide-y">
          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {isError && (
            <div className="p-8 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Unable to load patients."}
            </div>
          )}
          {!isLoading && patients.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No patients found.</p>
              <Button asChild className="mt-4">
                <Link to="/patients/new">Register first patient</Link>
              </Button>
            </div>
          )}
          {patients.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 p-4 hover:bg-surface-muted transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <Avatar className="size-11 shrink-0 border">
                  {p.photo_url ? <AvatarImage src={patientPhotoPublicUrl(p.photo_url) ?? undefined} alt={p.full_name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {p.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <Link
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="font-medium truncate hover:text-primary"
                  >
                    {p.full_name}
                  </Link>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    <span className="font-mono">{p.uhid}</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {p.mobile}
                    </span>
                    <Badge variant="outline" className="capitalize text-[10px] h-5">
                      {p.gender}
                    </Badge>
                    {p.blood_group && <span>· {p.blood_group}</span>}
                    {p.dob && <span>· {differenceInYears(new Date(), new Date(p.dob))} yrs</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:block text-xs text-muted-foreground mr-2">
                  {format(new Date(p.created_at), "dd MMM yyyy")}
                </div>
                <Button asChild variant="ghost" size="icon" title="Open patient record">
                  <Link to="/patients/$id" params={{ id: p.id }}>
                    <Eye className="size-4" />
                  </Link>
                </Button>
                <RecordActions
                  onEdit={() => navigate({ to: "/patients/$id", params: { id: p.id }, search: { edit: "1" } as any })}
                  onPrint={() => window.open(`/patient-card/${p.id}/print`, "_blank")}
                  onWhatsApp={() =>
                    shareOnWhatsApp(
                      summarizeRecord(`Patient — ${p.full_name}`, {
                        UHID: p.uhid,
                        Mobile: p.mobile,
                        Gender: p.gender,
                        "Blood Group": p.blood_group,
                        Age: p.dob ? `${differenceInYears(new Date(), new Date(p.dob))} yrs` : null,
                      }),
                      undefined,
                      p.mobile,
                    )
                  }
                  onDelete={() => deletePatient(p)}
                  deleteLabel={`patient ${p.full_name}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3 border-t text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
