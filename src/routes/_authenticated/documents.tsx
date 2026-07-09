import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Files, Search, Upload, FileText, Building2, Users as UsersIcon, CalendarClock, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { PatientAttachments } from "@/components/patient-attachments";

export const Route = createFileRoute("/_authenticated/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [openPatient, setOpenPatient] = useState<any | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["patient-documents-index"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_documents")
        .select("patient_id, department, created_at, patients(id, full_name, uhid, mobile)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["patient-documents-stats"],
    queryFn: async () => {
      const { count: total } = await (supabase as any).from("patient_documents").select("*", { count: "exact", head: true });
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const { count: today } = await (supabase as any)
        .from("patient_documents").select("*", { count: "exact", head: true })
        .gte("created_at", startToday.toISOString());
      return { total: total ?? 0, today: today ?? 0 };
    },
    refetchInterval: 30000,
  });

  const patients = useMemo(() => {
    const map = new Map<string, { patient: any; count: number; last: string; deptCount: Map<string, number> }>();
    for (const r of rows as any[]) {
      if (!r.patients) continue;
      const key = r.patient_id;
      const cur = map.get(key) ?? { patient: r.patients, count: 0, last: r.created_at, deptCount: new Map() };
      cur.count += 1;
      if (new Date(r.created_at) > new Date(cur.last)) cur.last = r.created_at;
      cur.deptCount.set(r.department, (cur.deptCount.get(r.department) ?? 0) + 1);
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return patients;
    return patients.filter((p) =>
      p.patient.full_name?.toLowerCase().includes(s) ||
      p.patient.uhid?.toLowerCase().includes(s) ||
      p.patient.mobile?.toLowerCase().includes(s));
  }, [patients, search]);

  const deptTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows as any[]) m.set(r.department, (m.get(r.department) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Files className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Document Management</h1>
          <p className="text-sm text-muted-foreground">Manage and access all patient documents across departments.</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="size-4 mr-1.5" />Upload Document</Button>
          </DialogTrigger>
          <UploadDialog onDone={() => setUploadOpen(false)} />
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total documents" value={stats?.total ?? 0} icon={FileText} />
        <StatCard label="Uploaded today" value={stats?.today ?? 0} icon={CalendarClock} />
        <StatCard label="Patients with docs" value={patients.length} icon={UsersIcon} />
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">By department</div>
              <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto pr-1">
                {deptTotals.length === 0 ? <div className="text-xs text-muted-foreground">—</div> :
                  deptTotals.map(([d, n]) => (
                    <div key={d} className="flex items-center justify-between text-xs">
                      <span className="truncate">{d}</span>
                      <span className="tabular-nums text-muted-foreground">{n}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="size-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Building2 className="size-4 text-muted-foreground" />
            </div>
          </div>
        </Card>
      </div>

      {openPatient ? (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpenPatient(null)}>
              <ArrowLeft className="size-4 mr-1.5" />Back
            </Button>
            <div className="min-w-0">
              <div className="font-semibold truncate">{openPatient.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{openPatient.uhid ?? "—"} · {openPatient.mobile ?? "—"}</div>
            </div>
          </div>
          <PatientAttachments patientId={openPatient.id} patient={openPatient} />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient name, UHID, or mobile…" className="h-9 pl-8" />
            </div>
            <Badge variant="secondary" className="ml-auto">{filtered.length} patient{filtered.length === 1 ? "" : "s"}</Badge>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Files className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => (
                <div key={p.patient.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.patient.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      UHID {p.patient.uhid ?? "—"} · {p.patient.mobile ?? "—"} · Last upload {format(new Date(p.last), "dd MMM yyyy HH:mm")}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{p.count} doc{p.count === 1 ? "" : "s"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setOpenPatient(p.patient)}>View Documents</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
        </div>
        <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}

function UploadDialog({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const term = q.trim();

  const { data: results = [] } = useQuery({
    queryKey: ["docs-upload-patient-search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const { data } = await (supabase as any)
        .from("patients")
        .select("id, full_name, uhid, mobile")
        .or(`full_name.ilike.${like},mobile.ilike.${like},uhid.ilike.${like}`)
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Upload document</DialogTitle>
      </DialogHeader>
      {!selected ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient by name, UHID or mobile…" className="h-9 pl-8" />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y rounded-lg border">
            {term.length < 2 && <div className="p-4 text-xs text-muted-foreground text-center">Type at least 2 characters.</div>}
            {term.length >= 2 && results.length === 0 && <div className="p-4 text-xs text-muted-foreground text-center">No matches.</div>}
            {results.map((p: any) => (
              <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left p-3 hover:bg-muted/50">
                <div className="font-medium text-sm">{p.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{p.uhid ?? "—"} · {p.mobile ?? "—"}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{selected.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{selected.uhid ?? "—"} · {selected.mobile ?? "—"}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
          </div>
          <PatientAttachments patientId={selected.id} patient={selected} defaultDepartment="General" />
          <div className="flex justify-end">
            <Button variant="outline" onClick={onDone}>Done</Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
