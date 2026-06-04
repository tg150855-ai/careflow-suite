import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Plus, PenTool } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/consents")({ component: ConsentPage });

const TYPES = ["treatment","surgery","blood_transfusion","telemedicine","research","anesthesia"];

function ConsentPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [signOpen, setSignOpen] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [form, setForm] = useState<any>({ patient_id: "", form_type: "treatment", procedure: "", content: "", witness_name: "" });

  const load = () => (supabase.from("consent_forms" as any) as any).select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const save = async () => {
    const { error } = await (supabase.from("consent_forms" as any) as any).insert(form);
    if (error) return toast.error(error.message);
    toast.success("Consent form created"); setOpen(false); load();
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  };
  const end = () => { drawing.current = false; };

  const sign = async () => {
    if (!signOpen) return;
    const data = canvasRef.current!.toDataURL("image/png");
    await (supabase.from("consent_forms" as any) as any).update({ signed: true, signed_at: new Date().toISOString(), signature_data: data }).eq("id", signOpen.id);
    toast.success("Signed"); setSignOpen(null); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FileSignature className="size-6 text-primary" /> Consent Management</h1>
          <p className="text-sm text-muted-foreground">Treatment, surgery, blood, telemedicine & research consents with digital signature.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New consent</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Consent Form</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.form_type} onValueChange={(v) => setForm({ ...form, form_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Procedure</Label><Input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} /></div>
              </div>
              <div><Label>Content</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
              <div><Label>Witness name</Label><Input value={form.witness_name} onChange={(e) => setForm({ ...form, witness_name: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.patient_id}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Patient", cell: (r) => <>{r.patients?.full_name} <span className="text-xs text-muted-foreground">{r.patients?.uhid}</span></> },
          { header: "Type", cell: (r) => <Badge variant="outline">{r.form_type?.replace(/_/g, " ")}</Badge> },
          { header: "Procedure", cell: (r) => <span className="text-xs">{r.procedure || "—"}</span> },
          { header: "Status", cell: (r) => r.signed ? <Badge>Signed {r.signed_at ? format(new Date(r.signed_at), "dd MMM") : ""}</Badge> : <Badge variant="secondary">Pending</Badge> },
          { header: "Action", cell: (r) => !r.signed && <Button size="sm" variant="outline" onClick={() => setSignOpen(r)}><PenTool className="size-3 mr-1" /> Sign</Button> },
        ]}
      />

      <Dialog open={!!signOpen} onOpenChange={(v) => !v && setSignOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Digital Signature</DialogTitle></DialogHeader>
          <Card><CardContent className="pt-4">
            <canvas ref={canvasRef} width={420} height={160} className="border rounded bg-background touch-none w-full" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
            <div className="text-xs text-muted-foreground mt-2">Sign in the box above with mouse or touch.</div>
          </CardContent></Card>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); }}>Clear</Button>
            <Button onClick={sign}>Save signature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
