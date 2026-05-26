import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/laboratory/new")({ component: NewLabOrder });

function NewLabOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<any | null>(null);
  const [patientQ, setPatientQ] = useState("");
  const [testQ, setTestQ] = useState("");
  const [selected, setSelected] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data: patients = [] } = useQuery({
    queryKey: ["pat-q", patientQ], enabled: patientQ.length >= 2 && !patientId,
    queryFn: async () => (await supabase.from("patients").select("id, full_name, uhid, mobile").or(`full_name.ilike.%${patientQ}%,mobile.ilike.%${patientQ}%,uhid.ilike.%${patientQ}%`).limit(6)).data ?? [],
  });
  const { data: tests = [] } = useQuery({
    queryKey: ["tests-q", testQ], enabled: testQ.length >= 1,
    queryFn: async () => {
      let q = supabase.from("lab_tests").select("*").eq("active", true).limit(10);
      if (testQ.length >= 2) q = q.or(`name.ilike.%${testQ}%,code.ilike.%${testQ}%`);
      return (await q).data ?? [];
    },
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => (await supabase.from("doctors").select("id, name, specialization").eq("active", true).order("name")).data ?? [],
  });

  useEffect(() => {
    if (!patientId) { setPatient(null); return; }
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setPatient(data));
  }, [patientId]);

  const total = useMemo(() => selected.reduce((s, t) => s + Number(t.price), 0), [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Select patient");
      if (selected.length === 0) throw new Error("Select at least one test");
      const { data: order, error } = await supabase.from("lab_orders").insert({
        patient_id: patientId, doctor_id: doctorId, total_amount: total, notes: notes || null, created_by: user?.id ?? null,
      }).select("id, order_no").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("lab_results").insert(selected.map((t) => ({ order_id: order.id, test_id: t.id, test_name: t.name })));
      if (e2) throw e2;
      return order;
    },
    onSuccess: (o) => { toast.success(`Order ${o.order_no} created`); navigate({ to: "/laboratory/$id", params: { id: o.id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/laboratory"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-2xl font-semibold tracking-tight">New lab order</h1><p className="text-sm text-muted-foreground">Order tests for a patient</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold mb-3">Patient</h2>
            {!patient ? (
              <div className="space-y-3">
                <Input value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Search by name, mobile or UHID..." />
                {patients.length > 0 && <div className="border rounded-xl divide-y">{patients.map((p: any) => <button key={p.id} onClick={() => { setPatientId(p.id); setPatientQ(""); }} className="w-full text-left p-3 hover:bg-surface-muted flex items-center justify-between"><span>{p.full_name}</span><span className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</span></button>)}</div>}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted">
                <div><div className="font-medium">{patient.full_name}</div><div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile}</div></div>
                <Button variant="ghost" size="sm" onClick={() => { setPatientId(null); }}>Change</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-3">Referring doctor</h2>
            <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={doctorId ?? ""} onChange={(e) => setDoctorId(e.target.value || null)}>
              <option value="">— Select doctor —</option>
              {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.name} {d.specialization ? `· ${d.specialization}` : ""}</option>)}
            </select>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-3">Tests</h2>
            <Input value={testQ} onChange={(e) => setTestQ(e.target.value)} placeholder="Search tests..." />
            {testQ.length >= 1 && (
              <div className="mt-2 border rounded-xl divide-y max-h-56 overflow-y-auto">
                {tests.map((t: any) => {
                  const taken = selected.find((s) => s.id === t.id);
                  return (
                    <button key={t.id} disabled={!!taken} onClick={() => { setSelected([...selected, t]); setTestQ(""); }} className="w-full text-left p-3 hover:bg-surface-muted disabled:opacity-50 flex items-center justify-between">
                      <div><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.department ?? "—"} · TAT {t.turnaround_hours}h</div></div>
                      <div className="text-sm tabular-nums">{inr(t.price)}</div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 space-y-2">
              {selected.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No tests selected.</div>}
              {selected.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border">
                  <div><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.code ?? ""}</div></div>
                  <div className="flex items-center gap-3"><div className="tabular-nums text-sm">{inr(t.price)}</div><Button variant="ghost" size="icon" onClick={() => setSelected(selected.filter((x) => x.id !== t.id))}><Trash2 className="size-4" /></Button></div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6"><label className="text-sm font-medium block mb-2">Notes</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sample collection instructions..." /></Card>
        </div>

        <Card className="p-6 h-fit lg:sticky lg:top-20 space-y-4">
          <h2 className="font-semibold">Order summary</h2>
          <div className="flex justify-between text-sm text-muted-foreground"><span>Tests</span><span>{selected.length}</span></div>
          <div className="flex justify-between text-lg font-semibold border-t pt-3"><span>Total</span><span className="tabular-nums">{inr(total)}</span></div>
          <Button className="w-full" size="lg" disabled={save.isPending || !patientId || selected.length === 0} onClick={() => save.mutate()}><Plus className="size-4 mr-2" />{save.isPending ? "Saving…" : "Create order"}</Button>
        </Card>
      </div>
    </div>
  );
}
