import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/engagement")({ component: EngagementPage });

const TYPES = ["medication_reminder", "appointment_reminder", "health_tip", "wellness_check", "ai_assistant_chat"];
const CHANNELS = ["sms", "email", "whatsapp", "app_push"];

function EngagementPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", engagement_type: TYPES[0], channel: CHANNELS[0], content: "" });

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("patient_engagement_logs").select("*, patients(full_name)").order("created_at", { ascending: false }).limit(100);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  async function save() {
    if (!f.patient_id) return toast.error("Patient required");
    await insertRow("patient_engagement_logs", f);
    toast.success("Engagement logged"); setOpen(false); load();
  }

  const cols: Col<any>[] = [
    { header: "Time", cell: (r) => format(new Date(r.created_at), "dd MMM HH:mm") },
    { header: "Patient", cell: (r) => r.patients?.full_name ?? "—" },
    { header: "Type", cell: (r) => <Badge variant="outline">{r.engagement_type}</Badge> },
    { header: "Channel", cell: (r) => <Badge variant="secondary">{r.channel}</Badge> },
    { header: "Content", cell: (r) => <span className="text-xs">{r.content?.slice(0, 80)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={HeartHandshake} title="Smart Patient Engagement" subtitle="Reminders, tips, wellness and AI health assistant interactions." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Log Engagement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Engagement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={f.engagement_type} onValueChange={(v) => setF({ ...f, engagement_type: v })}>
                    <SelectTrigger /><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Channel</Label>
                  <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}>
                    <SelectTrigger /><SelectContent>{CHANNELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Content</Label><Textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <SimpleTable rows={rows} columns={cols} empty="No engagement logs yet." />
    </div>
  );
}
