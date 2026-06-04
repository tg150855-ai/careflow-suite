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
import { AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/incidents")({ component: IncidentsPage });

const TYPES = ["medication_error","patient_fall","near_miss","equipment_failure","adverse_event","other"];
const SEV = ["low","medium","high","critical"];

function IncidentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [actionText, setActionText] = useState("");
  const [actions, setActions] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ incident_type: "medication_error", severity: "low", location: "", description: "", immediate_action: "" });

  const load = () => (supabase.from("incidents" as any) as any).select("*").order("occurred_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const incident_no = `INC-${Date.now().toString().slice(-8)}`;
    const { error } = await (supabase.from("incidents" as any) as any).insert({ ...form, incident_no, reported_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Incident filed"); setOpen(false); load();
  };

  const openIncident = async (r: any) => {
    setSelected(r);
    const { data } = await (supabase.from("corrective_actions" as any) as any).select("*").eq("incident_id", r.id).order("created_at");
    setActions((data as any) ?? []);
  };

  const addAction = async () => {
    if (!actionText.trim() || !selected) return;
    await (supabase.from("corrective_actions" as any) as any).insert({ incident_id: selected.id, action: actionText });
    setActionText("");
    openIncident(selected);
  };

  const updateStatus = async (status: string, rootCause?: string) => {
    if (!selected) return;
    const patch: any = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    if (rootCause !== undefined) patch.root_cause = rootCause;
    await (supabase.from("incidents" as any) as any).update(patch).eq("id", selected.id);
    setSelected({ ...selected, ...patch });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><AlertTriangle className="size-6 text-primary" /> Incident & Risk Management</h1>
          <p className="text-sm text-muted-foreground">Report → investigate → RCA → corrective action → closure.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Report incident</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.incident_type} onValueChange={(v) => setForm({ ...form, incident_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Immediate action</Label><Textarea value={form.immediate_action} onChange={(e) => setForm({ ...form, immediate_action: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!form.description}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Incident #", cell: (r) => <button className="text-primary text-xs font-mono" onClick={() => openIncident(r)}>{r.incident_no}</button> },
          { header: "Type", cell: (r) => <span className="capitalize text-xs">{r.incident_type?.replace(/_/g, " ")}</span> },
          { header: "Severity", cell: (r) => <Badge variant={r.severity === "critical" ? "destructive" : r.severity === "high" ? "secondary" : "outline"}>{r.severity}</Badge> },
          { header: "When", cell: (r) => <span className="text-xs">{format(new Date(r.occurred_at), "dd MMM HH:mm")}</span> },
          { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
        ]}
      />

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && <>
            <DialogHeader><DialogTitle>{selected.incident_no}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><b>Description:</b> {selected.description}</div>
              {selected.immediate_action && <div><b>Immediate action:</b> {selected.immediate_action}</div>}
              <div><Label>Root cause analysis</Label>
                <Textarea defaultValue={selected.root_cause ?? ""} onBlur={(e) => updateStatus(selected.status, e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => updateStatus("investigating")}>Investigating</Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus("rca")}>RCA</Button>
                <Button size="sm" onClick={() => updateStatus("closed")}>Close</Button>
              </div>
              <div>
                <Label>Corrective actions</Label>
                <ul className="text-sm space-y-1 mt-1">
                  {actions.map((a) => <li key={a.id} className="flex justify-between"><span>• {a.action}</span><Badge variant="outline">{a.status}</Badge></li>)}
                </ul>
                <div className="flex gap-2 mt-2">
                  <Input value={actionText} onChange={(e) => setActionText(e.target.value)} placeholder="Add corrective action…" />
                  <Button onClick={addAction}>Add</Button>
                </div>
              </div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
