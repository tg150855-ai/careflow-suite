import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/emr")({ component: EMRPage });

function EMRPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [dept, setDept] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  useEffect(() => {
    if (!patientId) { setItems([]); return; }
    (supabase.from("emr_records" as any) as any).select("*").eq("patient_id", patientId).order("event_date", { ascending: false })
      .then(({ data }: any) => setItems(data ?? []));
  }, [patientId]);

  const filtered = items.filter((r) =>
    (!dept || r.department === dept) &&
    (!search || r.title.toLowerCase().includes(search.toLowerCase()))
  );
  const depts = Array.from(new Set(items.map((r) => r.department).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="size-6 text-primary" /> Enterprise EMR</h1>
        <p className="text-sm text-muted-foreground">Longitudinal clinical timeline — visits, admissions, surgeries, prescriptions, labs, imaging.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
          <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
        </Select>
        <Select value={dept || "all"} onValueChange={(v) => setDept(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-2" />
      </div>

      {!patientId ? (
        <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">Select a patient to view their EMR timeline.</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">No EMR entries yet.</CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-4 border-l-2 border-border ml-3">
          {filtered.map((r) => (
            <div key={r.id} className="relative">
              <div className="absolute -left-[31px] size-4 rounded-full bg-primary ring-4 ring-background" />
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.event_date), "dd MMM yyyy HH:mm")}</div>
                      <div className="font-semibold mt-0.5">{r.title}</div>
                      {r.summary && <div className="text-sm text-muted-foreground mt-1">{r.summary}</div>}
                      {r.department && <div className="text-xs text-muted-foreground mt-1">Dept: {r.department}</div>}
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0">{r.record_type.replace(/_/g, " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
