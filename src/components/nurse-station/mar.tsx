import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, AlertTriangle, Plus, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NS_QK, loadActiveAdmissions } from "./shared";

const MAR_STATUS = ["scheduled", "administered", "missed", "refused"];

export function NSMar() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const [admissionId, setAdmissionId] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const ids = admissions.map((a: any) => a.id);
  const { data: rows = [] } = useQuery({
    queryKey: ["ns-mar-rows", admissionId, filterStatus, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      let q: any = supabase.from("medication_administration").select("*, admissions(patient_id, patients(full_name, uhid))").order("scheduled_at", { ascending: false }).limit(300);
      if (admissionId) q = q.eq("admission_id", admissionId);
      else q = q.in("admission_id", ids);
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      return (await q).data ?? [];
    },
    refetchInterval: 60000,
  });

  // Quick add form
  const [med, setMed] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("PO");
  const [when, setWhen] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const addRow = async () => {
    if (!admissionId) { toast.error("Select patient"); return; }
    if (!med) { toast.error("Medicine name required"); return; }
    const adm = admissions.find((a: any) => a.id === admissionId);
    const { error } = await (supabase as any).from("medication_administration").insert({
      admission_id: admissionId, patient_id: adm?.patient_id,
      medicine_name: med, dosage: dose, route, scheduled_at: new Date(when).toISOString(), status: "scheduled",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Scheduled"); setMed(""); setDose("");
    qc.invalidateQueries({ queryKey: ["ns-mar-rows"] });
  };

  const pullFromRx = async () => {
    if (!admissionId) { toast.error("Select patient"); return; }
    const adm = admissions.find((a: any) => a.id === admissionId); if (!adm) return;
    // Find prescription_items for this patient's recent OPD visits
    const { data: visits } = await supabase.from("opd_visits").select("id").eq("patient_id", adm.patient_id).order("created_at", { ascending: false }).limit(5);
    const visitIds = (visits ?? []).map((v) => v.id);
    if (visitIds.length === 0) { toast.info("No prescriptions found"); return; }
    const { data: rxs } = await supabase.from("prescriptions").select("id").in("opd_visit_id", visitIds);
    const rxIds = (rxs ?? []).map((r) => r.id);
    if (rxIds.length === 0) { toast.info("No prescriptions found"); return; }
    const { data: items } = await supabase.from("prescription_items").select("*").in("prescription_id", rxIds);
    if (!items || items.length === 0) { toast.info("No items"); return; }
    const now = new Date();
    const inserts = items.map((it: any, i: number) => ({
      admission_id: admissionId, patient_id: adm.patient_id,
      medicine_name: it.medicine_name, dosage: it.dosage ?? "", route: "PO",
      scheduled_at: new Date(now.getTime() + i * 30 * 60000).toISOString(),
      status: "scheduled", notes: it.timing ?? null,
    }));
    const { error } = await (supabase as any).from("medication_administration").insert(inserts);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pulled ${inserts.length} medications`);
    qc.invalidateQueries({ queryKey: ["ns-mar-rows"] });
  };

  const setStatus = async (id: string, status: string) => {
    const payload: any = { status };
    if (status === "administered") { payload.administered_at = new Date().toISOString(); payload.administered_by = user?.id; }
    const { error } = await (supabase as any).from("medication_administration").update(payload).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(status); qc.invalidateQueries({ queryKey: ["ns-mar-rows"] }); }
  };

  const exportCsv = () => {
    const csv = ["Time,Patient,Medicine,Dose,Route,Status,Given At,By", ...rows.map((r: any) => `"${format(new Date(r.scheduled_at), "yyyy-MM-dd HH:mm")}","${r.admissions?.patients?.full_name ?? ""}","${r.medicine_name}","${r.dosage ?? ""}","${r.route ?? ""}","${r.status}","${r.administered_at ? format(new Date(r.administered_at), "yyyy-MM-dd HH:mm") : ""}","${profile?.full_name ?? ""}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mar.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">Schedule / Add medication</div>
        <div className="grid md:grid-cols-6 gap-2">
          <Select value={admissionId} onValueChange={setAdmissionId}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Patient" /></SelectTrigger>
            <SelectContent>{admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.patients?.full_name} · {a.beds?.bed_number}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Medicine" value={med} onChange={(e) => setMed(e.target.value)} />
          <Input placeholder="Dose" value={dose} onChange={(e) => setDose(e.target.value)} />
          <Input placeholder="Route" value={route} onChange={(e) => setRoute(e.target.value)} />
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={addRow}><Plus className="size-4 mr-1" /> Schedule</Button>
          <Button size="sm" variant="outline" onClick={pullFromRx}>Pull from OPD prescriptions</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex justify-between mb-3">
          <div className="flex gap-2 items-center">
            <div className="font-semibold">Medication Administration Record</div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MAR_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" /> CSV</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Scheduled</TableHead><TableHead>Patient</TableHead><TableHead>Medicine</TableHead><TableHead>Dose</TableHead><TableHead>Status</TableHead><TableHead>Given</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nothing yet</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.scheduled_at), "dd MMM HH:mm")}</TableCell>
                <TableCell className="text-xs">{r.admissions?.patients?.full_name}</TableCell>
                <TableCell>{r.medicine_name}</TableCell>
                <TableCell className="text-xs">{r.dosage} {r.route}</TableCell>
                <TableCell><Badge variant={r.status === "administered" ? "default" : r.status === "missed" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.administered_at ? format(new Date(r.administered_at), "HH:mm") : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Administered" onClick={() => setStatus(r.id, "administered")}><Check className="size-4 text-green-600" /></Button>
                  <Button variant="ghost" size="icon" title="Missed" onClick={() => setStatus(r.id, "missed")}><AlertTriangle className="size-4 text-amber-600" /></Button>
                  <Button variant="ghost" size="icon" title="Refused" onClick={() => setStatus(r.id, "refused")}><X className="size-4 text-rose-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
