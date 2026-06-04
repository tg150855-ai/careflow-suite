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
import { Boxes, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/fhir")({ component: FHIRPage });

const RESOURCES = ["Patient","Practitioner","Appointment","Encounter","Observation","Medication","Procedure","DiagnosticReport","Condition"];

function FHIRPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ resource_type: "Patient", resource_id: "", payload: "{}" });

  const load = () => {
    let q: any = (supabase.from("fhir_resources" as any) as any).select("*").order("last_updated", { ascending: false }).limit(200);
    if (type !== "all") q = q.eq("resource_type", type);
    q.then(({ data }: any) => setRows(data ?? []));
  };
  useEffect(() => { load(); }, [type]);

  const save = async () => {
    let payload: any;
    try { payload = JSON.parse(form.payload); } catch { return toast.error("Invalid JSON"); }
    const { data: existing } = await (supabase.from("fhir_resources" as any) as any)
      .select("version_id").eq("resource_type", form.resource_type).eq("resource_id", form.resource_id).order("version_id", { ascending: false }).limit(1).maybeSingle();
    const version_id = ((existing as any)?.version_id ?? 0) + 1;
    const { error } = await (supabase.from("fhir_resources" as any) as any).insert({ ...form, payload, version_id });
    if (error) return toast.error(error.message);
    toast.success(`${form.resource_type} v${version_id} stored`);
    setOpen(false); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Boxes className="size-6 text-primary" /> FHIR Resources</h1>
          <p className="text-sm text-muted-foreground">FHIR-compliant resource registry with versioning.</p>
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add FHIR Resource</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Resource ID</Label><Input value={form.resource_id} onChange={(e) => setForm({ ...form, resource_id: e.target.value })} /></div>
                </div>
                <div><Label>Payload (FHIR JSON)</Label><Textarea rows={10} className="font-mono text-xs" value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} disabled={!form.resource_id}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="pt-4 text-xs text-muted-foreground">
        Endpoint: <code className="bg-muted px-1 py-0.5 rounded">/api/public/fhir/{`{ResourceType}`}/{`{id}`}</code> (configure OAuth scopes per resource).
      </CardContent></Card>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Type", cell: (r) => <Badge variant="outline">{r.resource_type}</Badge> },
          { header: "Resource ID", cell: (r) => <code className="text-xs">{r.resource_id}</code> },
          { header: "Version", cell: (r) => <span>v{r.version_id}</span> },
          { header: "Last updated", cell: (r) => <span className="text-xs">{format(new Date(r.last_updated), "dd MMM HH:mm")}</span> },
        ]}
      />
    </div>
  );
}
