import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { VoiceDictate } from "@/components/voice-dictate";
import { NS_QK, SHIFTS, loadActiveAdmissions } from "./shared";

export function NSHandover() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const { data: wards = [] } = useQuery({ queryKey: NS_QK.wards, queryFn: async () => (await supabase.from("wards").select("id, name")).data ?? [] });

  const [shift, setShift] = useState("Morning");
  const [outgoing, setOutgoing] = useState(profile?.full_name ?? "");
  const [incoming, setIncoming] = useState("");
  const [wardId, setWardId] = useState("");
  const [notes, setNotes] = useState("");
  const [crit, setCrit] = useState<string[]>([]);
  const [tasks, setTasks] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: NS_QK.handovers,
    queryFn: async () => (await (supabase as any).from("shift_handovers").select("*, wards(name)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const save = async () => {
    if (!outgoing || !incoming) { toast.error("Outgoing & incoming nurse required"); return; }
    const { error } = await (supabase as any).from("shift_handovers").insert({
      shift, outgoing_nurse_name: outgoing, incoming_nurse_name: incoming, ward_id: wardId || null,
      notes, critical_patients: crit, pending_tasks: tasks.split("\n").map((t) => t.trim()).filter(Boolean),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Handover saved");
    setIncoming(""); setNotes(""); setCrit([]); setTasks("");
    qc.invalidateQueries({ queryKey: NS_QK.handovers });
  };

  const printOne = (h: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<pre style="font-family:sans-serif;padding:24px;white-space:pre-wrap">SHIFT HANDOVER
Shift: ${h.shift}    Ward: ${h.wards?.name ?? "All"}
From: ${h.outgoing_nurse_name ?? ""} → To: ${h.incoming_nurse_name ?? ""}
Time: ${format(new Date(h.created_at), "dd MMM yyyy HH:mm")}

Notes:
${h.notes || "—"}

Critical patients: ${(h.critical_patients || []).length}
${(h.critical_patients || []).map((id: string) => "• " + (admissions.find((a: any) => a.id === id)?.patients?.full_name ?? id)).join("\n")}

Pending tasks:
${(h.pending_tasks || []).map((t: string) => "• " + t).join("\n")}
</pre>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">New shift handover</div>
        <div className="grid md:grid-cols-4 gap-2">
          <Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Outgoing nurse" value={outgoing} onChange={(e) => setOutgoing(e.target.value)} />
          <Input placeholder="Incoming nurse" value={incoming} onChange={(e) => setIncoming(e.target.value)} />
          <Select value={wardId} onValueChange={setWardId}>
            <SelectTrigger><SelectValue placeholder="Ward (optional)" /></SelectTrigger>
            <SelectContent>{(wards as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Textarea rows={4} placeholder="Handover notes — summary of shift, alerts, pending decisions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="mt-1"><VoiceDictate onTranscript={(t: string) => setNotes((n) => (n ? n + " " : "") + t)} /></div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Critical patients</div>
          <Select value="" onValueChange={(v) => { if (v && !crit.includes(v)) setCrit([...crit, v]); }}>
            <SelectTrigger><SelectValue placeholder="Add patient" /></SelectTrigger>
            <SelectContent>{admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.patients?.full_name} · {a.beds?.bed_number}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1 mt-2">
            {crit.map((id) => {
              const a = admissions.find((x: any) => x.id === id);
              return <Badge key={id} className="cursor-pointer" onClick={() => setCrit(crit.filter((x) => x !== id))}>{a?.patients?.full_name ?? id} ×</Badge>;
            })}
          </div>
        </div>
        <Textarea rows={3} placeholder="Pending tasks (one per line)" value={tasks} onChange={(e) => setTasks(e.target.value)} />
        <div className="flex justify-end"><Button onClick={save}><Save className="size-4 mr-1" /> Save handover</Button></div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="font-semibold mb-3">History ({history.length})</div>
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Shift</TableHead><TableHead>Ward</TableHead><TableHead>Out → In</TableHead><TableHead>Critical</TableHead><TableHead>Tasks</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {history.map((h: any) => (
              <TableRow key={h.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(h.created_at), "dd MMM HH:mm")}</TableCell>
                <TableCell><Badge variant="outline">{h.shift}</Badge></TableCell>
                <TableCell className="text-xs">{h.wards?.name ?? "All"}</TableCell>
                <TableCell className="text-xs">{h.outgoing_nurse_name} → {h.incoming_nurse_name}</TableCell>
                <TableCell className="text-xs">{(h.critical_patients || []).length}</TableCell>
                <TableCell className="text-xs">{(h.pending_tasks || []).length}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => printOne(h)}><Printer className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
