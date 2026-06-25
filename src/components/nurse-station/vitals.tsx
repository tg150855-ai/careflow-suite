import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Printer, Save, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { NS_QK, loadActiveAdmissions } from "./shared";

const blank = { systolic: "", diastolic: "", pulse: "", temperature: "", oxygen: "", weight: "", respiratory_rate: "", sugar: "", notes: "" };

export function NSVitals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const [admissionId, setAdmissionId] = useState("");
  const [form, setForm] = useState<any>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["ns-vitals-rows", admissionId],
    enabled: !!admissionId,
    queryFn: async () => (await supabase.from("vitals").select("*").eq("admission_id", admissionId).order("recorded_at", { ascending: false }).limit(100)).data ?? [],
  });

  const upd = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!admissionId) { toast.error("Select patient"); return; }
    const adm = admissions.find((a: any) => a.id === admissionId);
    const num = (s: string) => (s === "" ? null : Number(s));
    const payload: any = {
      admission_id: admissionId, patient_id: adm?.patient_id,
      systolic: num(form.systolic), diastolic: num(form.diastolic),
      pulse: num(form.pulse), temperature: num(form.temperature),
      oxygen: num(form.oxygen), weight: num(form.weight),
      respiratory_rate: num(form.respiratory_rate), sugar: num(form.sugar),
      notes: form.notes || null, recorded_by: user?.id,
    };
    const res = editId
      ? await (supabase as any).from("vitals").update(payload).eq("id", editId)
      : await (supabase as any).from("vitals").insert({ ...payload, recorded_at: new Date().toISOString() });
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Updated" : "Saved");
    setForm(blank); setEditId(null);
    qc.invalidateQueries({ queryKey: ["ns-vitals-rows"] });
  };

  const editRow = (r: any) => { setEditId(r.id); setForm({
    systolic: r.systolic ?? "", diastolic: r.diastolic ?? "", pulse: r.pulse ?? "", temperature: r.temperature ?? "",
    oxygen: r.oxygen ?? "", weight: r.weight ?? "", respiratory_rate: r.respiratory_rate ?? "", sugar: r.sugar ?? "", notes: r.notes ?? "",
  }); };

  const print = () => {
    if (rows.length === 0) return;
    const adm = admissions.find((a: any) => a.id === admissionId);
    const w = window.open("", "_blank"); if (!w) return;
    const rowsHtml = rows.map((r: any) => `<tr><td>${format(new Date(r.recorded_at), "dd MMM HH:mm")}</td><td>${r.systolic ?? "-"}/${r.diastolic ?? "-"}</td><td>${r.pulse ?? "-"}</td><td>${r.temperature ?? "-"}</td><td>${r.oxygen ?? "-"}</td><td>${r.respiratory_rate ?? "-"}</td><td>${r.sugar ?? "-"}</td><td>${r.weight ?? "-"}</td></tr>`).join("");
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px"><h3>Vitals chart — ${adm?.patients?.full_name ?? ""}</h3><table border="1" cellspacing="0" cellpadding="6"><tr><th>Time</th><th>BP</th><th>Pulse</th><th>Temp</th><th>SpO₂</th><th>RR</th><th>Sugar</th><th>Wt</th></tr>${rowsHtml}</table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const chartData = [...rows].reverse().map((r: any) => ({
    t: format(new Date(r.recorded_at), "dd HH:mm"),
    pulse: r.pulse ?? null, sys: r.systolic ?? null, spo2: r.oxygen ?? null, temp: r.temperature ?? null,
  }));

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="font-semibold">{editId ? "Edit vitals" : "Record vitals"}</div>
          <Select value={admissionId} onValueChange={(v) => { setAdmissionId(v); setEditId(null); setForm(blank); }}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Patient" /></SelectTrigger>
            <SelectContent>{admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.patients?.full_name} · {a.beds?.bed_number}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="Systolic" value={form.systolic} onChange={(e) => upd("systolic", e.target.value)} />
          <Input placeholder="Diastolic" value={form.diastolic} onChange={(e) => upd("diastolic", e.target.value)} />
          <Input placeholder="Pulse" value={form.pulse} onChange={(e) => upd("pulse", e.target.value)} />
          <Input placeholder="Temp °F" value={form.temperature} onChange={(e) => upd("temperature", e.target.value)} />
          <Input placeholder="SpO₂ %" value={form.oxygen} onChange={(e) => upd("oxygen", e.target.value)} />
          <Input placeholder="Resp rate" value={form.respiratory_rate} onChange={(e) => upd("respiratory_rate", e.target.value)} />
          <Input placeholder="Sugar mg/dL" value={form.sugar} onChange={(e) => upd("sugar", e.target.value)} />
          <Input placeholder="Weight kg" value={form.weight} onChange={(e) => upd("weight", e.target.value)} />
        </div>
        <Input placeholder="Notes" value={form.notes} onChange={(e) => upd("notes", e.target.value)} />
        <div className="flex gap-2 justify-end">
          {editId && <Button variant="outline" size="sm" onClick={() => { setEditId(null); setForm(blank); }}>Cancel</Button>}
          <Button size="sm" onClick={save}><Save className="size-4 mr-1" /> Save</Button>
        </div>
      </CardContent></Card>

      {admissionId && (
        <Card><CardContent className="p-4">
          <div className="flex justify-between mb-2">
            <div className="font-semibold">Trends</div>
            <Button size="sm" variant="outline" onClick={print}><Printer className="size-4 mr-1" /> Print</Button>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}><XAxis dataKey="t" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="pulse" stroke="#ef4444" name="Pulse" />
                <Line type="monotone" dataKey="sys" stroke="#3b82f6" name="Systolic" />
                <Line type="monotone" dataKey="spo2" stroke="#10b981" name="SpO₂" />
                <Line type="monotone" dataKey="temp" stroke="#f59e0b" name="Temp" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>BP</TableHead><TableHead>Pulse</TableHead><TableHead>Temp</TableHead><TableHead>SpO₂</TableHead><TableHead>RR</TableHead><TableHead>Sugar</TableHead><TableHead>Wt</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.recorded_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell className="text-xs">{r.systolic ?? "-"}/{r.diastolic ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.pulse ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.temperature ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.oxygen ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.respiratory_rate ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.sugar ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.weight ?? "-"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => editRow(r)}><Pencil className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
