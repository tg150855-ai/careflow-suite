// Central registry of hospital modules/departments that can be enabled or
// disabled globally from Admin → Hospital Settings → Departments.
import { supabase } from "@/integrations/supabase/client";

export type ModuleKey =
  | "opd" | "ipd" | "icu" | "ot" | "emergency" | "nurse_station" | "discharge"
  | "laboratory" | "radiology" | "pharmacy" | "blood_bank" | "dialysis"
  | "ambulance" | "assets" | "vendors" | "procurement" | "biomedical"
  | "billing" | "insurance" | "finance" | "reports" | "hr" | "documents";

export type ModuleDef = {
  key: ModuleKey;
  name: string;
  /** Route prefixes owned by this module. */
  routes: string[];
};

export const MODULE_REGISTRY: ModuleDef[] = [
  { key: "opd", name: "OPD", routes: ["/opd"] },
  { key: "ipd", name: "IPD", routes: ["/ipd"] },
  { key: "icu", name: "ICU", routes: ["/icu"] },
  { key: "ot", name: "Operation Theatre", routes: ["/ot"] },
  { key: "emergency", name: "Emergency", routes: ["/emergency"] },
  { key: "nurse_station", name: "Nurse Station", routes: ["/nurse-station"] },
  { key: "discharge", name: "Discharge", routes: ["/discharge"] },
  { key: "laboratory", name: "Laboratory", routes: ["/laboratory"] },
  { key: "radiology", name: "Radiology", routes: ["/radiology"] },
  { key: "pharmacy", name: "Pharmacy", routes: ["/pharmacy"] },
  { key: "blood_bank", name: "Blood Bank", routes: ["/blood-bank"] },
  { key: "dialysis", name: "Dialysis", routes: ["/dialysis"] },
  { key: "ambulance", name: "Ambulance", routes: ["/ambulance"] },
  { key: "assets", name: "Assets", routes: ["/assets"] },
  { key: "vendors", name: "Vendors", routes: ["/vendors"] },
  { key: "procurement", name: "Procurement", routes: ["/procurement"] },
  { key: "biomedical", name: "Biomedical", routes: ["/biomedical"] },
  { key: "billing", name: "Billing", routes: ["/billing", "/billing-center"] },
  { key: "insurance", name: "Insurance", routes: ["/insurance"] },
  { key: "finance", name: "Accounts & Finance", routes: ["/finance"] },
  { key: "reports", name: "Reports & BI", routes: ["/reports", "/bi"] },
  { key: "hr", name: "HR & Payroll", routes: ["/hr", "/performance"] },
  { key: "documents", name: "Document Management", routes: ["/documents"] },
];

export const ALL_MODULE_KEYS = MODULE_REGISTRY.map((m) => m.key);

/** Ready-made access templates. */
export const MODULE_PRESETS: { key: string; name: string; description: string; modules: ModuleKey[] }[] = [
  {
    key: "opd_clinic",
    name: "OPD Clinic",
    description: "Small clinic: OPD, pharmacy, lab, billing and reports only.",
    modules: ["opd", "laboratory", "pharmacy", "billing", "reports", "documents"],
  },
  {
    key: "full_hospital",
    name: "Full Hospital",
    description: "Every module enabled.",
    modules: ALL_MODULE_KEYS,
  },
];

export type DeptSetting = { key?: string; name: string; enabled: boolean };

/** Normalises the stored `departments` jsonb into an enabled-key set. */
export function enabledKeysFrom(departments: unknown): Set<ModuleKey> {
  const rows = Array.isArray(departments) ? (departments as DeptSetting[]) : [];
  if (!rows.length) return new Set(ALL_MODULE_KEYS);
  const set = new Set<ModuleKey>(ALL_MODULE_KEYS);
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const match = MODULE_REGISTRY.find(
      (m) => m.key === row.key || m.name.toLowerCase() === String(row.name ?? "").toLowerCase(),
    );
    if (!match) continue;
    if (row.enabled === false) set.delete(match.key);
    else set.add(match.key);
  }
  return set;
}

/** Which module (if any) owns a pathname. */
export function moduleForPath(path: string): ModuleKey | null {
  let best: { key: ModuleKey; len: number } | null = null;
  for (const m of MODULE_REGISTRY) {
    for (const r of m.routes) {
      if ((path === r || path.startsWith(r + "/")) && (!best || r.length > best.len)) {
        best = { key: m.key, len: r.length };
      }
    }
  }
  return best?.key ?? null;
}

export async function fetchDepartmentSettings(): Promise<DeptSetting[]> {
  const { data } = await (supabase as any)
    .from("hospital_settings")
    .select("departments")
    .limit(1)
    .maybeSingle();
  return Array.isArray(data?.departments) ? (data.departments as DeptSetting[]) : [];
}
