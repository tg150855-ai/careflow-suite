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
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { VoiceDictate } from "@/components/voice-dictate";
import { NS_QK, SHIFTS, loadActiveAdmissions } from "./shared";
import { can } from "@/lib/permissions";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export function NSNotes() {
  const qc = useQueryClient();
  const { user, profile, roles } = useAuth();
  const canEdit = can(roles as any, "nurse_station", "edit") || can(roles as any, "nurse_station", "create") || roles?.includes("doctor") || roles?.includes("admin");
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const [admissionId, setAdmissionId] = useState("");
  const [shift, setShift] = useState("Morning");
  const [nurseName, setNurseName] = useState(profile?.full_name ?? "");
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: NS_QK.notes,
    queryFn: async () => (await supabase.from("nursing_notes")
      .select("id, admission_id, shift, note, created_at, created_by, admissions(patient_id, patients(full_name, uhid))")
      .order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const save = async () => {
    if (!admissionId) { toast.error("Choose patient"); return; }
    if (!note.trim()) { toast.error("Enter a note"); return; }
    const payload: any = { admission_id: admissionId, shift, note: `${nurseName ? nurseName + ": " : ""}${note}`, created_by: user?.id };
    const res = editId
      ? await supabase.from("nursing_notes").update({ note: payload.note, shift }).eq("id", editId)
      : await supabase.from("nursing_notes").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Updated" : "Saved");
    setNote(""); setEditId(null);
    qc.invalidateQueries({ queryKey: NS_QK.notes });
  };

  const startEdit = (n: any) => { setEditId(n.id); setAdmissionId(n.admission_id); setShift(n.shift); setNote(n.note); };

  const printOne = (n: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<pre style="font-family:sans-serif;padding:24px;white-space:pre-wrap">Nursing Note
Patient: ${n.admissions?.patients?.full_name ?? ""} (${n.admissions?.patients?.uhid ?? ""})
Shift: ${n.shift}
Time: ${format(new Date(n.created_at), "dd MMM yyyy HH:mm")}

${n.note}</pre>`);
    w.document.close(); w.focus(); w.print();
  };

  const download = () => {
    const csv = ["Patient,UHID,Shift,Time,Note", ...notes.map((n: any) => `"${n.admissions?.patients?.full_name ?? ""}","${n.admissions?.patients?.uhid ?? ""}","${n.shift}","${format(new Date(n.created_at), "yyyy-MM-dd HH:mm")}","${(n.note || "").replace(/"/g, '""')}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nursing-notes.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">{editId ? "Edit nursing note" : "New nursing note"}</div>
        <div className="grid md:grid-cols-3 gap-2">
          <Select value={admissionId} onValueChange={setAdmissionId}>
            <SelectTrigger><SelectValue placeholder="Patient" /></SelectTrigger>
            <SelectContent>{admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.patients?.full_name} · {a.beds?.bed_number}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Nurse name" value={nurseName} onChange={(e) => setNurseName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation, intervention, response..." />
          <div className="flex justify-between">
            <VoiceDictate onTranscript={(t: string) => setNote((n) => (n ? n + " " : "") + t)} />
            <div className="flex gap-2">
              {editId && <Button variant="outline" size="sm" onClick={() => { setEditId(null); setNote(""); }}>Cancel</Button>}
              <Button size="sm" onClick={save} disabled={!canEdit}><Save className="size-4 mr-1" /> Save</Button>
            </div>
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex justify-between mb-3">
          <div className="font-semibold">History ({notes.length})</div>
          <Button size="sm" variant="outline" onClick={download}><Download className="size-4 mr-1" /> CSV</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Patient</TableHead><TableHead>Shift</TableHead><TableHead>Note</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {notes.map((n: any) => (
              <TableRow key={n.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(n.created_at), "dd MMM HH:mm")}</TableCell>
                <TableCell className="text-xs">{n.admissions?.patients?.full_name}</TableCell>
                <TableCell><Badge variant="outline">{n.shift}</Badge></TableCell>
                <TableCell className="text-xs max-w-md truncate">{n.note}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(n)} disabled={!canEdit}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => printOne(n)}><Printer className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
