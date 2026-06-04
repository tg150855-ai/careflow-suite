import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/research")({ component: ResearchPage });

function ResearchPage() {
  const [studies, setStudies] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [openS, setOpenS] = useState(false);
  const [openP, setOpenP] = useState<any>(null);
  const [sForm, setSForm] = useState<any>({ study_code: "", title: "", pi_name: "", department: "", phase: "Phase I", status: "planning", start_date: "", end_date: "", description: "", ethics_approval: "", target_enrollment: "" });
  const [pForm, setPForm] = useState<any>({ patient_id: "", arm: "", status: "enrolled", notes: "" });

  const load = () => {
    (supabase.from("research_studies" as any) as any).select("*").order("created_at", { ascending: false }).then(({ data }: any) => setStudies(data ?? []));
    (supabase.from("study_participants" as any) as any).select("*, patients(full_name, uhid), research_studies(study_code, title)").order("enrollment_date", { ascending: false }).then(({ data }: any) => setParticipants(data ?? []));
  };
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const saveStudy = async () => {
    const { error } = await (supabase.from("research_studies" as any) as any).insert({ ...sForm, target_enrollment: sForm.target_enrollment ? parseInt(sForm.target_enrollment) : null });
    if (error) return toast.error(error.message);
    toast.success("Study registered"); setOpenS(false); load();
  };
  const enroll = async () => {
    if (!openP) return;
    const { error } = await (supabase.from("study_participants" as any) as any).insert({ ...pForm, study_id: openP.id });
    if (error) return toast.error(error.message);
    toast.success("Patient enrolled"); setOpenP(null); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FlaskConical className="size-6 text-primary" /> Research & Clinical Studies</h1>
          <p className="text-sm text-muted-foreground">Study registry, patient enrollment, outcome tracking.</p>
        </div>
        <Dialog open={openS} onOpenChange={setOpenS}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Register study</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Research Study</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={sForm.study_code} onChange={(e) => setSForm({ ...sForm, study_code: e.target.value })} /></div>
              <div><Label>Phase</Label>
                <Select value={sForm.phase} onValueChange={(v) => setSForm({ ...sForm, phase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Phase I","Phase II","Phase III","Phase IV","Observational"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Title</Label><Input value={sForm.title} onChange={(e) => setSForm({ ...sForm, title: e.target.value })} /></div>
              <div><Label>Principal Investigator</Label><Input value={sForm.pi_name} onChange={(e) => setSForm({ ...sForm, pi_name: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={sForm.department} onChange={(e) => setSForm({ ...sForm, department: e.target.value })} /></div>
              <div><Label>Start</Label><Input type="date" value={sForm.start_date} onChange={(e) => setSForm({ ...sForm, start_date: e.target.value })} /></div>
              <div><Label>End</Label><Input type="date" value={sForm.end_date} onChange={(e) => setSForm({ ...sForm, end_date: e.target.value })} /></div>
              <div><Label>Ethics approval #</Label><Input value={sForm.ethics_approval} onChange={(e) => setSForm({ ...sForm, ethics_approval: e.target.value })} /></div>
              <div><Label>Target enrollment</Label><Input type="number" value={sForm.target_enrollment} onChange={(e) => setSForm({ ...sForm, target_enrollment: e.target.value })} /></div>
              <div className="col-span-2"><Label>Description</Label><Textarea value={sForm.description} onChange={(e) => setSForm({ ...sForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={saveStudy} disabled={!sForm.study_code || !sForm.title}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {studies.map((s) => {
          const enrolled = participants.filter((p) => p.study_id === s.id).length;
          return (
            <Card key={s.id}><CardContent className="pt-4 flex justify-between items-start">
              <div>
                <div className="flex gap-2 items-center"><code className="text-xs">{s.study_code}</code><Badge variant="outline">{s.phase}</Badge><Badge>{s.status}</Badge></div>
                <div className="font-semibold mt-1">{s.title}</div>
                <div className="text-xs text-muted-foreground">PI: {s.pi_name ?? "—"} · {s.department ?? "—"} · {s.start_date ?? "?"} → {s.end_date ?? "?"}</div>
                <div className="text-xs mt-1">Enrolled: {enrolled} / {s.target_enrollment ?? "—"}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setOpenP(s); setPForm({ patient_id: "", arm: "", status: "enrolled", notes: "" }); }}><UserPlus className="size-4 mr-1" /> Enroll</Button>
            </CardContent></Card>
          );
        })}
        {studies.length === 0 && <Card><CardContent className="pt-10 pb-10 text-center text-muted-foreground">No studies registered.</CardContent></Card>}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Participants</h2>
        <SimpleTable
          rows={participants}
          columns={[
            { header: "Study", cell: (r) => <span className="text-xs"><code>{r.research_studies?.study_code}</code> {r.research_studies?.title}</span> },
            { header: "Patient", cell: (r) => <>{r.patients?.full_name} <span className="text-xs text-muted-foreground">{r.patients?.uhid}</span></> },
            { header: "Arm", cell: (r) => r.arm ?? "—" },
            { header: "Enrolled", cell: (r) => r.enrollment_date },
            { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
            { header: "Outcome", cell: (r) => <span className="text-xs">{r.outcome ?? "—"}</span> },
          ]}
        />
      </div>

      <Dialog open={!!openP} onOpenChange={(v) => !v && setOpenP(null)}>
        <DialogContent>
          {openP && <>
            <DialogHeader><DialogTitle>Enroll in {openP.study_code}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={pForm.patient_id} onValueChange={(v) => setPForm({ ...pForm, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Study arm</Label><Input value={pForm.arm} onChange={(e) => setPForm({ ...pForm, arm: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={enroll} disabled={!pForm.patient_id}>Enroll</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
