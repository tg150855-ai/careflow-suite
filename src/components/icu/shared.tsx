import { supabase } from "@/integrations/supabase/client";

export const ICU_STATUS = ["stable", "critical", "ventilator", "isolation", "improving", "discharged"] as const;
export type ICUStatus = (typeof ICU_STATUS)[number];

export const ICU_STATUS_STYLES: Record<string, string> = {
  stable: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  ventilator: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  isolation: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  improving: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  discharged: "bg-muted text-muted-foreground border-border",
};

export async function loadICUSettings() {
  const { data } = await (supabase as any).from("icu_settings").select("*").limit(1).maybeSingle();
  return data;
}

/**
 * Identify ICU admissions: patients admitted to a ward with type='icu' OR whose
 * icu_status indicates active ICU care.
 */
export async function loadICUAdmissions() {
  const { data } = await supabase
    .from("admissions")
    .select(
      "id, admission_no, admitted_at, status, icu_status, initial_diagnosis, patients(id, full_name, uhid, mobile, age, gender, photo_url), doctors(id, name), beds(id, bed_number), wards(id, name, type)"
    )
    .eq("status", "active")
    .order("admitted_at", { ascending: false });
  return (data ?? []).filter(
    (a: any) => a.wards?.type === "icu" || (a.icu_status && a.icu_status !== "stable" && a.icu_status !== "discharged"),
  );
}

/** Push an ICU-related charge into the patient's active draft/partial IPD bill. */
export async function pushICUChargeToBill(opts: {
  admission_id: string;
  patient_id: string;
  category: string;
  description: string;
  amount: number;
  quantity?: number;
}) {
  const { admission_id, patient_id, category, description, amount, quantity = 1 } = opts;
  let { data: bill } = await (supabase as any)
    .from("bills")
    .select("id, subtotal, total, pending")
    .eq("admission_id", admission_id)
    .in("status", ["draft", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const user = (await supabase.auth.getUser()).data.user;
  if (!bill) {
    const { data: created, error } = await (supabase as any)
      .from("bills")
      .insert({
        patient_id,
        admission_id,
        subtotal: 0,
        discount: 0,
        gst: 0,
        total: 0,
        paid: 0,
        pending: 0,
        status: "draft",
        created_by: user?.id,
      })
      .select()
      .single();
    if (error) throw error;
    bill = created;
  }
  await (supabase as any).from("bill_items").insert({
    bill_id: bill.id,
    category,
    description,
    quantity,
    unit_price: amount,
    amount: amount * quantity,
    position: 1,
  });
  const add = amount * quantity;
  await (supabase as any)
    .from("bills")
    .update({
      subtotal: Number(bill.subtotal ?? 0) + add,
      total: Number(bill.total ?? 0) + add,
      pending: Number(bill.pending ?? 0) + add,
    })
    .eq("id", bill.id);
  return bill.id;
}
