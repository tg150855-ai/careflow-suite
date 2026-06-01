import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/health-records")({ component: HRPage });

function HRPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  useEffect(() => {
    if (!patientId) { setRecords([]); return; }
    supabase.from("health_records").select("*").eq("patient_id", patientId).order("record_date", { ascending: false })
      .then(({ data }) => setRecords(data ?? []));
  }, [patientId]);

  const filtered = records.filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="size-6 text-primary" /> Digital Health Records</h1>
        <p className="text-sm text-muted-foreground">Unified timeline of prescriptions, lab reports, admissions, surgeries, allergies, vaccinations.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
          <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Search records…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!patientId ? (
        <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">Select a patient to view their complete medical timeline.</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">No records yet for this patient.</CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-4 border-l-2 border-border ml-3">
          {filtered.map((r) => (
            <div key={r.id} className="relative">
              <div className="absolute -left-[31px] size-4 rounded-full bg-primary ring-4 ring-background" />
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.record_date), "dd MMM yyyy")}</div>
                      <div className="font-semibold mt-0.5">{r.title}</div>
                      {r.summary && <div className="text-sm text-muted-foreground mt-1">{r.summary}</div>}
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
