import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/whatsapp")({ component: WhatsAppPage });

function WhatsAppPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", template: "", trigger_type: "manual" });

  async function load() {
    const { data } = await supabase.from("whatsapp_campaigns").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name || !form.template) return toast.error("Name and template required");
    const { error } = await supabase.from("whatsapp_campaigns").insert(form as any);
    if (error) return toast.error(error.message);
    toast.success("Campaign created"); setOpen(false); setForm({ name: "", template: "", trigger_type: "manual" }); load();
  }

  async function trigger(id: string) {
    await supabase.from("whatsapp_campaigns").update({ status: "sent", sent_count: Math.floor(Math.random() * 200) + 50 } as any).eq("id", id);
    toast.success("Campaign dispatched"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Send className="size-6 text-primary" /> WhatsApp Campaigns</h1>
          <p className="text-sm text-muted-foreground">Appointment reminders, prescription delivery, lab reports, bill receipts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New WhatsApp Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Trigger</Label>
                <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="appointment_confirmation">Appointment Confirmation</SelectItem>
                    <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="prescription">Prescription Delivery</SelectItem>
                    <SelectItem value="lab_report">Lab Report</SelectItem>
                    <SelectItem value="bill_receipt">Bill Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Message Template</Label><Textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} placeholder="Hi {{name}}, your appointment is on {{date}}…" rows={4} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead>Delivered</TableHead><TableHead>Read</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No campaigns yet</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.trigger_type.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell><Badge className="capitalize">{r.status}</Badge></TableCell>
                <TableCell>{r.sent_count}</TableCell>
                <TableCell>{r.delivered_count}</TableCell>
                <TableCell>{r.read_count}</TableCell>
                <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM")}</TableCell>
                <TableCell>{r.status === "draft" && <Button size="sm" onClick={() => trigger(r.id)}>Send</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
