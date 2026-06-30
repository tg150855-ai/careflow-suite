import { supabase } from "@/integrations/supabase/client";

export type DeptKey = "OPD" | "IPD" | "Emergency" | "ICU" | "OT" | "Pharmacy" | "Laboratory" | "Radiology" | "Other";

export type AggregatedBill = {
  id: string;
  bill_no: string;
  created_at: string;
  dept: DeptKey;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  paid: number;
  pending: number;
  status: string;
  opd_visit_id: string | null;
  admission_id: string | null;
};

export type BillingSummary = {
  patient: {
    id: string;
    uhid: string;
    full_name: string;
    mobile: string | null;
    gender: string | null;
    dob: string | null;
  } | null;
  admissions: Array<{
    id: string; admission_no: string; admitted_at: string; discharged_at: string | null;
    status: string; ward_id: string | null; bed_id: string | null;
  }>;
  bills: AggregatedBill[];
  byDept: Record<DeptKey, { count: number; total: number; paid: number; pending: number }>;
  totals: { subtotal: number; discount: number; gst: number; total: number; paid: number; pending: number };
  paymentStatus: "Paid" | "Partially Paid" | "Unpaid" | "No Bills";
};

const EMPTY_DEPT: BillingSummary["byDept"] = {
  OPD: { count: 0, total: 0, paid: 0, pending: 0 },
  IPD: { count: 0, total: 0, paid: 0, pending: 0 },
  Emergency: { count: 0, total: 0, paid: 0, pending: 0 },
  ICU: { count: 0, total: 0, paid: 0, pending: 0 },
  OT: { count: 0, total: 0, paid: 0, pending: 0 },
  Pharmacy: { count: 0, total: 0, paid: 0, pending: 0 },
  Laboratory: { count: 0, total: 0, paid: 0, pending: 0 },
  Radiology: { count: 0, total: 0, paid: 0, pending: 0 },
  Other: { count: 0, total: 0, paid: 0, pending: 0 },
};

function classifyBill(b: { admission_id: string | null; opd_visit_id: string | null; notes: string | null }, items: { category: string | null }[]): DeptKey {
  const cats = items.map((i) => (i.category ?? "").toLowerCase());
  if (cats.some((c) => c.includes("ot") || c.includes("surger"))) return "OT";
  if (cats.some((c) => c.includes("icu"))) return "ICU";
  if (cats.some((c) => c.includes("pharm") || c.includes("medicine"))) return "Pharmacy";
  if (cats.some((c) => c.includes("lab"))) return "Laboratory";
  if (cats.some((c) => c.includes("radio") || c.includes("xray") || c.includes("scan"))) return "Radiology";
  if (b.admission_id) return "IPD";
  if (b.opd_visit_id) return "OPD";
  if (b.notes?.toLowerCase().includes("emergency")) return "Emergency";
  return "Other";
}

/** Fetches a patient's complete billing picture across all departments. */
export async function getPatientBillingSummary(patientId: string): Promise<BillingSummary> {
  const [patientRes, billsRes, admissionsRes] = await Promise.all([
    supabase.from("patients").select("id, uhid, full_name, mobile, gender, dob").eq("id", patientId).maybeSingle(),
    supabase.from("bills").select("*, bill_items(category, description, quantity, unit_price, amount, position)").eq("patient_id", patientId).order("created_at", { ascending: false }),
    supabase.from("admissions").select("id, admission_no, admitted_at, discharged_at, status, ward_id, bed_id").eq("patient_id", patientId).order("admitted_at", { ascending: false }),
  ]);

  const rawBills = (billsRes.data ?? []) as any[];
  const bills: AggregatedBill[] = rawBills.map((b) => ({
    id: b.id,
    bill_no: b.bill_no,
    created_at: b.created_at,
    dept: classifyBill(b, b.bill_items ?? []),
    subtotal: Number(b.subtotal ?? 0),
    discount: Number(b.discount ?? 0),
    gst: Number(b.gst ?? 0),
    total: Number(b.total ?? 0),
    paid: Number(b.paid ?? 0),
    pending: Number(b.pending ?? 0),
    status: b.status,
    opd_visit_id: b.opd_visit_id,
    admission_id: b.admission_id,
  }));

  const byDept = JSON.parse(JSON.stringify(EMPTY_DEPT)) as BillingSummary["byDept"];
  const totals = { subtotal: 0, discount: 0, gst: 0, total: 0, paid: 0, pending: 0 };
  for (const b of bills) {
    byDept[b.dept].count += 1;
    byDept[b.dept].total += b.total;
    byDept[b.dept].paid += b.paid;
    byDept[b.dept].pending += b.pending;
    totals.subtotal += b.subtotal;
    totals.discount += b.discount;
    totals.gst += b.gst;
    totals.total += b.total;
    totals.paid += b.paid;
    totals.pending += b.pending;
  }

  let paymentStatus: BillingSummary["paymentStatus"];
  if (!bills.length) paymentStatus = "No Bills";
  else if (totals.pending <= 0.01) paymentStatus = "Paid";
  else if (totals.paid > 0.01) paymentStatus = "Partially Paid";
  else paymentStatus = "Unpaid";

  return {
    patient: patientRes.data ?? null,
    admissions: admissionsRes.data ?? [],
    bills,
    byDept,
    totals,
    paymentStatus,
  };
}
