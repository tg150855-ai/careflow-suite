import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NS_QK } from "./shared";

export function NSSettings() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: NS_QK.settings,
    queryFn: async () => (await (supabase as any).from("nurse_station_settings").select("*").maybeSingle()).data,
  });

  const [shiftTypes, setShiftTypes] = useState<string[]>([]);
  const [newShift, setNewShift] = useState("");
  const [freq, setFreq] = useState(4);
  const [medAlert, setMedAlert] = useState(15);
  const [spo2, setSpo2] = useState(92);
  const [pulseLow, setPulseLow] = useState(50);
  const [pulseHigh, setPulseHigh] = useState(130);
  const [sysLow, setSysLow] = useState(90);
  const [sysHigh, setSysHigh] = useState(180);

  useEffect(() => {
    if (!settings) return;
    setShiftTypes(settings.shift_types ?? []);
    setFreq(settings.vitals_frequency_hours);
    setMedAlert(settings.med_alert_minutes);
    setSpo2(Number(settings.critical_spo2)); setPulseLow(Number(settings.critical_pulse_low)); setPulseHigh(Number(settings.critical_pulse_high));
    setSysLow(Number(settings.critical_systolic_low)); setSysHigh(Number(settings.critical_systolic_high));
  }, [settings]);

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await (supabase as any).from("nurse_station_settings").update({
      shift_types: shiftTypes, vitals_frequency_hours: freq, med_alert_minutes: medAlert,
      critical_spo2: spo2, critical_pulse_low: pulseLow, critical_pulse_high: pulseHigh,
      critical_systolic_low: sysLow, critical_systolic_high: sysHigh,
    }).eq("id", settings.id);
    if (error) toast.error(error.message); else { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: NS_QK.settings }); }
  };

  // Catalog
  const { data: catalog = [] } = useQuery({
    queryKey: NS_QK.catalog,
    queryFn: async () => (await (supabase as any).from("nursing_service_catalog").select("*").order("name")).data ?? [],
  });
  const [cName, setCName] = useState(""); const [cCode, setCCode] = useState(""); const [cCharge, setCCharge] = useState("");

  const addCat = async () => {
    if (!cName) return;
    const { error } = await (supabase as any).from("nursing_service_catalog").insert({ name: cName, code: cCode, charge: Number(cCharge || 0) });
    if (error) toast.error(error.message); else { toast.success("Added"); setCName(""); setCCode(""); setCCharge(""); qc.invalidateQueries({ queryKey: NS_QK.catalog }); }
  };
  const toggleCat = async (id: string, active: boolean) => {
    await (supabase as any).from("nursing_service_catalog").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: NS_QK.catalog });
  };
  const removeCat = async (id: string) => {
    await (supabase as any).from("nursing_service_catalog").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: NS_QK.catalog });
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">Shift types</div>
        <div className="flex flex-wrap gap-2">
          {shiftTypes.map((s) => (
            <Badge key={s} className="cursor-pointer" onClick={() => setShiftTypes(shiftTypes.filter((x) => x !== s))}>{s} ×</Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Add shift (e.g. Night)" value={newShift} onChange={(e) => setNewShift(e.target.value)} />
          <Button onClick={() => { if (newShift && !shiftTypes.includes(newShift)) { setShiftTypes([...shiftTypes, newShift]); setNewShift(""); } }}><Plus className="size-4" /></Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">Frequencies & critical thresholds</div>
        <div className="grid md:grid-cols-4 gap-2">
          <label className="text-sm">Vitals every (hrs)<Input type="number" value={freq} onChange={(e) => setFreq(Number(e.target.value))} /></label>
          <label className="text-sm">Med alert (mins)<Input type="number" value={medAlert} onChange={(e) => setMedAlert(Number(e.target.value))} /></label>
          <label className="text-sm">Critical SpO₂ &lt;<Input type="number" value={spo2} onChange={(e) => setSpo2(Number(e.target.value))} /></label>
          <label className="text-sm">Pulse low/high<div className="flex gap-1"><Input type="number" value={pulseLow} onChange={(e) => setPulseLow(Number(e.target.value))} /><Input type="number" value={pulseHigh} onChange={(e) => setPulseHigh(Number(e.target.value))} /></div></label>
          <label className="text-sm">Systolic low/high<div className="flex gap-1"><Input type="number" value={sysLow} onChange={(e) => setSysLow(Number(e.target.value))} /><Input type="number" value={sysHigh} onChange={(e) => setSysHigh(Number(e.target.value))} /></div></label>
        </div>
        <div className="flex justify-end"><Button onClick={saveSettings}><Save className="size-4 mr-1" /> Save</Button></div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <div className="font-semibold">Billable nursing services</div>
        <div className="text-xs text-muted-foreground">Items added here can be billed to the patient's active IPD bill from the patient detail page.</div>
        <div className="grid md:grid-cols-4 gap-2">
          <Input placeholder="Service name" value={cName} onChange={(e) => setCName(e.target.value)} />
          <Input placeholder="Code" value={cCode} onChange={(e) => setCCode(e.target.value)} />
          <Input placeholder="Charge" type="number" value={cCharge} onChange={(e) => setCCharge(e.target.value)} />
          <Button onClick={addCat}><Plus className="size-4 mr-1" /> Add</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Charge</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {catalog.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="text-xs">{c.code}</TableCell>
                <TableCell>{Number(c.charge).toFixed(2)}</TableCell>
                <TableCell><Switch checked={c.active} onCheckedChange={(v) => toggleCat(c.id, v)} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => removeCat(c.id)}><Trash2 className="size-4 text-rose-600" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
