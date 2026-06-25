import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { NS_QK, loadActiveAdmissions } from "./shared";

export function NSBoard() {
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const ids = admissions.map((a: any) => a.id);

  const { data: nextMeds = [] } = useQuery({
    queryKey: ["ns-board-meds", ids.length],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("medication_administration")
      .select("admission_id, medicine_name, scheduled_at")
      .in("admission_id", ids).eq("status", "scheduled").order("scheduled_at")).data ?? [],
  });

  const { data: vitals = [] } = useQuery({
    queryKey: ["ns-board-vitals", ids.length],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("vitals")
      .select("admission_id, systolic, diastolic, pulse, oxygen, temperature, recorded_at")
      .in("admission_id", ids).order("recorded_at", { ascending: false }).limit(500)).data ?? [],
  });

  const nextMedByAdm: Record<string, any> = {};
  nextMeds.forEach((m: any) => { if (!nextMedByAdm[m.admission_id]) nextMedByAdm[m.admission_id] = m; });
  const latestVitalsByAdm: Record<string, any> = {};
  vitals.forEach((v: any) => { if (!latestVitalsByAdm[v.admission_id]) latestVitalsByAdm[v.admission_id] = v; });

  const [search, setSearch] = useState("");
  const [ward, setWard] = useState("all");
  const [doctor, setDoctor] = useState("all");
  const [status, setStatus] = useState("all");

  const wards = useMemo(() => Array.from(new Set(admissions.map((a: any) => a.wards?.name).filter(Boolean))), [admissions]);
  const doctors = useMemo(() => Array.from(new Set(admissions.map((a: any) => a.doctors?.name).filter(Boolean))), [admissions]);

  const rows = admissions.filter((a: any) => {
    if (search && !`${a.patients?.full_name ?? ""} ${a.patients?.uhid ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (ward !== "all" && a.wards?.name !== ward) return false;
    if (doctor !== "all" && a.doctors?.name !== doctor) return false;
    if (status !== "all" && a.status !== status) return false;
    return true;
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search patient / UHID" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
          <Select value={ward} onValueChange={setWard}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All wards</SelectItem>{wards.map((w) => <SelectItem key={w as string} value={w as string}>{w as string}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={doctor} onValueChange={setDoctor}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All doctors</SelectItem>{doctors.map((d) => <SelectItem key={d as string} value={d as string}>{d as string}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>UHID</TableHead>
              <TableHead>Ward / Bed</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next Med</TableHead>
              <TableHead>Latest Vitals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No patients match</TableCell></TableRow>}
            {rows.map((a: any) => {
              const nm = nextMedByAdm[a.id];
              const v = latestVitalsByAdm[a.id];
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.patients?.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.patients?.uhid}</TableCell>
                  <TableCell className="text-xs">{a.wards?.name ?? "—"} / {a.beds?.bed_number ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a.doctors?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{a.status}</Badge></TableCell>
                  <TableCell className="text-xs">{nm ? `${nm.medicine_name} · ${format(new Date(nm.scheduled_at), "dd HH:mm")}` : "—"}</TableCell>
                  <TableCell className="text-xs">{v ? `BP ${v.systolic ?? "-"}/${v.diastolic ?? "-"} · P ${v.pulse ?? "-"} · SpO₂ ${v.oxygen ?? "-"}` : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
