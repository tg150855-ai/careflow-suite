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
import { Network, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/hl7")({ component: HL7Page });

const TYPES = ["ADT","ORM","ORU","SIU","DFT","MDM","RAS"];

function HL7Page() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ message_type: "ADT", hl7_version: "2.5", direction: "inbound", source_system: "", destination_system: "", raw_message: "" });

  const load = () =>
    (supabase.from("hl7_messages" as any) as any).select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }: any) => setRows(data ?? []));

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.raw_message.trim()) return toast.error("Raw message required");
    const parsed: any = {};
    form.raw_message.split(/\r?\n/).forEach((seg: string) => {
      const [name, ...rest] = seg.split("|");
      if (name) parsed[name] = rest;
    });
    const status = form.raw_message.startsWith("MSH|") ? "processed" : "error";
    const error = status === "error" ? "Missing MSH segment" : null;
    const { error: err } = await (supabase.from("hl7_messages" as any) as any).insert({
      ...form, parsed, status, error, processed_at: new Date().toISOString(),
    });
    if (err) return toast.error(err.message);
    toast.success("HL7 message ingested");
    setOpen(false); setForm({ ...form, raw_message: "" }); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Network className="size-6 text-primary" /> HL7 Integration Engine</h1>
          <p className="text-sm text-muted-foreground">HL7 v2.x / v3 messages — ADT, ORM, ORU, SIU, DFT with validation & queue.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Ingest message</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Ingest HL7 Message</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.message_type} onValueChange={(v) => setForm({ ...form, message_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Direction</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="inbound">Inbound</SelectItem><SelectItem value="outbound">Outbound</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Source</Label><Input value={form.source_system} onChange={(e) => setForm({ ...form, source_system: e.target.value })} /></div>
                <div><Label>Destination</Label><Input value={form.destination_system} onChange={(e) => setForm({ ...form, destination_system: e.target.value })} /></div>
              </div>
              <div><Label>Raw HL7 (pipe-delimited)</Label>
                <Textarea rows={8} className="font-mono text-xs" value={form.raw_message} onChange={(e) => setForm({ ...form, raw_message: e.target.value })} placeholder="MSH|^~\&|SENDER|...&#10;PID|1||12345..." />
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Ingest</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Type", cell: (r) => <Badge variant="outline">{r.message_type}</Badge> },
          { header: "Direction", cell: (r) => <span className="capitalize">{r.direction}</span> },
          { header: "Source → Dest", cell: (r) => <span className="text-xs">{r.source_system || "—"} → {r.destination_system || "—"}</span> },
          { header: "Status", cell: (r) => <Badge variant={r.status === "processed" ? "default" : r.status === "error" ? "destructive" : "secondary"}>{r.status}</Badge> },
          { header: "Time", cell: (r) => <span className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</span> },
        ]}
      />
    </div>
  );
}
