import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

export function EditAdmissionDialog({ admission, trigger }: { admission: any; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  useEffect(() => {
    if (open) {
      setF({
        doctor_id: admission.doctor_id ?? "",
        ward_id: admission.ward_id ?? "",
        bed_id: admission.bed_id ?? "",
        reason: admission.reason ?? "",
        initial_diagnosis: admission.initial_diagnosis ?? "",
        attender_name: admission.attender_name ?? "",
        attender_mobile: admission.attender_mobile ?? "",
        emergency_contact: admission.emergency_contact ?? "",
        insurance_provider: admission.insurance_provider ?? "",
        insurance_policy_no: admission.insurance_policy_no ?? "",
        estimated_stay_days: admission.estimated_stay_days ?? "",
        is_emergency: !!admission.is_emergency,
        notes: admission.notes ?? "",
        admitted_at: admission.admitted_at ? new Date(admission.admitted_at).toISOString().slice(0, 16) : "",
      });
    }
  }, [open, admission]);

  const set = (k: string) => (v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-list"],
    queryFn: async () => (await supabase.from("wards").select("id, name, type").order("name")).data ?? [],
    enabled: open,
  });
  const { data: beds = [] } = useQuery({
    queryKey: ["beds-in-ward", f.ward_id],
    enabled: open && !!f.ward_id,
    queryFn: async () =>
      (await supabase.from("beds").select("id, bed_number, status").eq("ward_id", f.ward_id).order("bed_number")).data ?? [],
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-active"],
    queryFn: async () => (await supabase.from("doctors").select("id, name").order("name")).data ?? [],
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        doctor_id: f.doctor_id || null,
        ward_id: f.ward_id || null,
        bed_id: f.bed_id || null,
        reason: f.reason || null,
        initial_diagnosis: f.initial_diagnosis || null,
        attender_name: f.attender_name || null,
        attender_mobile: f.attender_mobile || null,
        emergency_contact: f.emergency_contact || null,
        insurance_provider: f.insurance_provider || null,
        insurance_policy_no: f.insurance_policy_no || null,
        estimated_stay_days: f.estimated_stay_days ? Number(f.estimated_stay_days) : null,
        is_emergency: !!f.is_emergency,
        notes: f.notes || null,
        admitted_at: f.admitted_at ? new Date(f.admitted_at).toISOString() : admission.admitted_at,
      };
      // Bed swap: release previous, occupy new
      if (f.bed_id && f.bed_id !== admission.bed_id) {
        if (admission.bed_id) await supabase.from("beds").update({ status: "cleaning" }).eq("id", admission.bed_id);
        await supabase.from("beds").update({ status: "occupied" }).eq("id", f.bed_id);
      }
      const { error } = await supabase.from("admissions").update(payload).eq("id", admission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admission updated");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admission", admission.id] });
      qc.invalidateQueries({ queryKey: ["ipd-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Pencil className="size-4 mr-2" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit admission {admission.admission_no}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Admitted at</Label>
            <Input type="datetime-local" value={f.admitted_at ?? ""} onChange={(e) => set("admitted_at")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Attending doctor</Label>
            <Select value={f.doctor_id ?? ""} onValueChange={set("doctor_id")}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ward</Label>
            <Select value={f.ward_id ?? ""} onValueChange={(v) => { set("ward_id")(v); set("bed_id")(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {wards.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Bed</Label>
            <Select value={f.bed_id ?? ""} onValueChange={set("bed_id")} disabled={!f.ward_id}>
              <SelectTrigger>
                <SelectValue placeholder="Select bed" />
              </SelectTrigger>
              <SelectContent>
                {beds.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    Bed {b.bed_number} — {b.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Reason for admission</Label>
            <Input value={f.reason ?? ""} onChange={(e) => set("reason")(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Initial diagnosis</Label>
            <Textarea rows={2} value={f.initial_diagnosis ?? ""} onChange={(e) => set("initial_diagnosis")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Attender name</Label>
            <Input value={f.attender_name ?? ""} onChange={(e) => set("attender_name")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Attender mobile</Label>
            <Input value={f.attender_mobile ?? ""} onChange={(e) => set("attender_mobile")(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Emergency contact</Label>
            <Input value={f.emergency_contact ?? ""} onChange={(e) => set("emergency_contact")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Insurance provider</Label>
            <Input value={f.insurance_provider ?? ""} onChange={(e) => set("insurance_provider")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Insurance policy #</Label>
            <Input value={f.insurance_policy_no ?? ""} onChange={(e) => set("insurance_policy_no")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estimated stay (days)</Label>
            <Input type="number" value={f.estimated_stay_days ?? ""} onChange={(e) => set("estimated_stay_days")(e.target.value)} />
          </div>
          <div className="space-y-1 flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={!!f.is_emergency} onCheckedChange={set("is_emergency")} />
              <Label>Emergency admission</Label>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes")(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
