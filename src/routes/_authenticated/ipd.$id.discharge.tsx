import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Printer, Sparkles, Share2, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/ipd/$id/discharge")({ component: DischargeForm });

type Med = { id: string; medicine_name: string; dosage: string; duration: string; instructions: string };

function DischargeForm() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: adm } = useQuery({
    queryKey: ["adm-discharge", id],
    queryFn: async () => (await supabase.from("admissions").select("*, patients(*), doctors(name)").eq("id", id).single()).data,
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["adm-bills", id, adm?.patient_id],
    enabled: !!adm,
    queryFn: async () => (await supabase.from("bills").select("id, bill_no, total, paid, pending, status").eq("patient_id", adm!.patient_id)).data ?? [],
  });

  const [finalDx, setFinalDx] = useState("");
  const [procedures, setProcedures] = useState("");
  const [course, setCourse] = useState("");
  const [condition, setCondition] = useState("Stable");
  const [advice, setAdvice] = useState("");
  const [followUpInstr, setFollowUpInstr] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [meds, setMeds] = useState<Med[]>([]);

  const pendingTotal = bills.reduce((s: number, b: any) => s + Number(b.pending), 0);

  const save = useMutation({
    mutationFn: async () => {
      // Create discharge summary
      const { data: ds, error } = await supabase.from("discharge_summaries").insert({
        admission_id: id,
        final_diagnosis: finalDx || null, procedures_performed: procedures || null,
        hospital_course: course || null, condition_at_discharge: condition || null,
        follow_up_instructions: followUpInstr || null, follow_up_date: followUpDate || null,
        advice: advice || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      if (meds.length > 0) {
        const { error: e2 } = await supabase.from("discharge_medications").insert(meds.map((m, idx) => ({
          discharge_id: ds.id, medicine_name: m.medicine_name, dosage: m.dosage || null,
          duration: m.duration || null, instructions: m.instructions || null, position: idx,
        })));
        if (e2) throw e2;
      }
      // Update admission
      await supabase.from("admissions").update({ status: "discharged", discharged_at: new Date().toISOString() }).eq("id", id);
      // Free the bed
      if (adm?.bed_id) await supabase.from("beds").update({ status: "cleaning" }).eq("id", adm.bed_id);
      return ds;
    },
    onSuccess: (ds) => { toast.success("Patient discharged"); navigate({ to: "/discharge/$id/print", params: { id: ds.id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!adm) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd/$id" params={{ id }}><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Discharge {adm.patients?.full_name}</h1>
          <p className="text-sm text-muted-foreground">{adm.admission_no} · Treating: Dr. {adm.doctors?.name}</p>
        </div>
      </div>

      {pendingTotal > 0 && (
        <Card className="p-4 bg-warning/10 border-warning/30">
          <div className="text-sm font-medium">Pending payments: ₹{pendingTotal.toLocaleString("en-IN")}</div>
          <div className="text-xs text-muted-foreground mt-1">Please settle outstanding bills before completing discharge.</div>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Clinical summary</h2>
        <div className="space-y-1"><Label>Final diagnosis</Label><Textarea rows={2} value={finalDx} onChange={(e) => setFinalDx(e.target.value)} /></div>
        <div className="space-y-1"><Label>Procedures performed</Label><Textarea rows={2} value={procedures} onChange={(e) => setProcedures(e.target.value)} /></div>
        <div className="space-y-1"><Label>Hospital course</Label><Textarea rows={3} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Summary of stay, treatment given, response…" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Condition at discharge</Label><Input value={condition} onChange={(e) => setCondition(e.target.value)} /></div>
          <div className="space-y-1"><Label>Follow-up date</Label><Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label>Follow-up instructions</Label><Textarea rows={2} value={followUpInstr} onChange={(e) => setFollowUpInstr(e.target.value)} /></div>
        <div className="space-y-1"><Label>Advice on discharge</Label><Textarea rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} /></div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Take-home medicines</h2>
          <Button variant="outline" size="sm" onClick={() => setMeds([...meds, { id: crypto.randomUUID(), medicine_name: "", dosage: "", duration: "", instructions: "" }])}><Plus className="size-3.5 mr-1" />Add</Button>
        </div>
        <div className="space-y-2">
          {meds.map((m) => (
            <div key={m.id} className="grid grid-cols-12 gap-2">
              <Input className="col-span-4" placeholder="Medicine" value={m.medicine_name} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, medicine_name: e.target.value } : x))} />
              <Input className="col-span-2" placeholder="Dose" value={m.dosage} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, dosage: e.target.value } : x))} />
              <Input className="col-span-2" placeholder="Duration" value={m.duration} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, duration: e.target.value } : x))} />
              <Input className="col-span-3" placeholder="Instructions" value={m.instructions} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, instructions: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setMeds(meds.filter((x) => x.id !== m.id))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {meds.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No take-home medicines added.</div>}
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild><Link to="/ipd/$id" params={{ id }}>Cancel</Link></Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Printer className="size-4 mr-2" />{save.isPending ? "Saving…" : "Complete discharge"}</Button>
      </div>
    </div>
  );
}
