import { supabase } from "@/integrations/supabase/client";

export const NS_QK = {
  dashboard: ["ns-dashboard"],
  board: ["ns-board"],
  notes: ["ns-notes"],
  mar: ["ns-mar"],
  vitals: ["ns-vitals"],
  orders: ["ns-orders"],
  handovers: ["ns-handovers"],
  reports: ["ns-reports"],
  settings: ["ns-settings"],
  catalog: ["ns-catalog"],
  wards: ["ns-wards"],
  doctors: ["ns-doctors"],
  admissions: ["ns-admissions"],
};

export async function loadActiveAdmissions() {
  const { data } = await supabase.from("admissions")
    .select("id, admission_no, patient_id, doctor_id, ward_id, bed_id, status, patients(id, full_name, uhid, mobile), wards(id, name, type), beds(id, bed_number), doctors(id, name)")
    .eq("status", "active").order("admitted_at", { ascending: false });
  return data ?? [];
}

export const SHIFTS = ["Morning", "Evening", "Night"];
export const PRIORITIES = ["routine", "urgent", "stat"];
export const ORDER_STATUS = ["pending", "in_progress", "completed"];

export async function pushNursingChargeToIPDBill(opts: {
  admission_id: string;
  patient_id: string;
  description: string;
  amount: number;
  category?: string;
}) {
  const { admission_id, patient_id, description, amount, category = "Nursing" } = opts;
  let { data: bill } = await (supabase as any).from("bills")
    .select("id, subtotal, total, pending")
    .eq("admission_id", admission_id).in("status", ["draft", "partial"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const user = (await supabase.auth.getUser()).data.user;
  if (!bill) {
    const { data: created, error } = await (supabase as any).from("bills").insert({
      patient_id, admission_id,
      subtotal: 0, discount: 0, gst: 0, total: 0, paid: 0, pending: 0,
      status: "draft", created_by: user?.id,
    }).select().single();
    if (error) throw error;
    bill = created;
  }
  const { error: itemErr } = await (supabase as any).from("bill_items").insert({
    bill_id: bill.id, category, description, quantity: 1, unit_price: amount, amount, position: 1,
  });
  if (itemErr) throw itemErr;
  const newSubtotal = Number(bill.subtotal ?? 0) + amount;
  const newTotal = Number(bill.total ?? 0) + amount;
  const newPending = Number(bill.pending ?? 0) + amount;
  await (supabase as any).from("bills").update({ subtotal: newSubtotal, total: newTotal, pending: newPending }).eq("id", bill.id);
  return bill.id;
}
