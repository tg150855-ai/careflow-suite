import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Settings as SettingsIcon, BedDouble } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/icu/settings")({ component: ICUSettings });

function ICUSettings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["icu-settings-row"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("icu_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = async () => {
    if (!form?.id) return;
    const { error } = await (supabase as any)
      .from("icu_settings")
      .update({
        bed_charge_per_day: Number(form.bed_charge_per_day) || 0,
        ventilator_charge_per_day: Number(form.ventilator_charge_per_day) || 0,
        nursing_charge_per_day: Number(form.nursing_charge_per_day) || 0,
        alert_spo2_min: Number(form.alert_spo2_min) || 0,
        alert_hr_min: Number(form.alert_hr_min) || 0,
        alert_hr_max: Number(form.alert_hr_max) || 0,
        alert_bp_sys_max: Number(form.alert_bp_sys_max) || 0,
        alert_temp_max: Number(form.alert_temp_max) || 0,
        alert_rr_max: Number(form.alert_rr_max) || 0,
        alert_gcs_min: Number(form.alert_gcs_min) || 0,
      })
      .eq("id", form.id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["icu-settings-row"] });
    qc.invalidateQueries({ queryKey: ["icu-settings"] });
  };

  const { data: icuBeds = [], refetch: refetchBeds } = useQuery({
    queryKey: ["icu-settings-beds"],
    queryFn: async () => {
      const { data: wards } = await supabase.from("wards").select("id, name").eq("type", "icu");
      const ids = (wards ?? []).map((w: any) => w.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("beds")
        .select("id, bed_number, status, charge_per_day, ward_id, wards(name)")
        .in("ward_id", ids)
        .order("bed_number");
      return data ?? [];
    },
  });

  const bulkUpdateBeds = async () => {
    const charge = Number(form.bed_charge_per_day) || 0;
    if (!charge) return toast.error("Set bed charge first");
    const ids = icuBeds.map((b: any) => b.id);
    if (!ids.length) return toast.error("No ICU beds");
    const { error } = await supabase.from("beds").update({ charge_per_day: charge }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${ids.length} ICU beds`);
    refetchBeds();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SettingsIcon className="size-6 text-primary" /> ICU Settings
        </h1>
        <Button asChild variant="ghost">
          <Link to="/icu">
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <div className="font-semibold">Charges</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="ICU bed charge / day" value={form.bed_charge_per_day} onChange={(v) => setForm({ ...form, bed_charge_per_day: v })} />
          <Field label="Ventilator charge / day" value={form.ventilator_charge_per_day} onChange={(v) => setForm({ ...form, ventilator_charge_per_day: v })} />
          <Field label="Nursing charge / day" value={form.nursing_charge_per_day} onChange={(v) => setForm({ ...form, nursing_charge_per_day: v })} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="font-semibold">Critical alert rules</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="SpO₂ min %" value={form.alert_spo2_min} onChange={(v) => setForm({ ...form, alert_spo2_min: v })} />
          <Field label="HR min" value={form.alert_hr_min} onChange={(v) => setForm({ ...form, alert_hr_min: v })} />
          <Field label="HR max" value={form.alert_hr_max} onChange={(v) => setForm({ ...form, alert_hr_max: v })} />
          <Field label="BP sys max" value={form.alert_bp_sys_max} onChange={(v) => setForm({ ...form, alert_bp_sys_max: v })} />
          <Field label="Temp max °C" value={form.alert_temp_max} onChange={(v) => setForm({ ...form, alert_temp_max: v })} />
          <Field label="RR max" value={form.alert_rr_max} onChange={(v) => setForm({ ...form, alert_rr_max: v })} />
          <Field label="GCS min" value={form.alert_gcs_min} onChange={(v) => setForm({ ...form, alert_gcs_min: v })} />
        </div>
        <Button onClick={save}>
          <Save className="size-4 mr-2" />
          Save settings
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BedDouble className="size-4" />
          <div className="font-semibold">ICU beds</div>
          <Badge variant="secondary">{icuBeds.length}</Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={bulkUpdateBeds}>
            Apply ICU bed charge to all
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/ipd/beds">Manage in IPD →</Link>
          </Button>
        </div>
        <div className="rounded-lg border divide-y text-sm">
          {icuBeds.map((b: any) => (
            <div key={b.id} className="grid grid-cols-4 gap-2 px-3 py-2">
              <div>{b.wards?.name}</div>
              <div className="font-mono">{b.bed_number}</div>
              <div className="capitalize">{b.status}</div>
              <div className="text-right">₹{Number(b.charge_per_day ?? 0).toLocaleString()}/day</div>
            </div>
          ))}
          {icuBeds.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No ICU beds. Create an ICU-type ward and beds in <Link to="/ipd/beds" className="underline">IPD bed map</Link>.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
