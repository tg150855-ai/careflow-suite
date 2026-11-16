import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

export interface SyncMedicineInput {
  name: string;
  generic_name?: string | null;
  unit?: string | null;
}

/**
 * Clean and normalize a medicine name.
 * Removes extraneous quotes, excessive spaces, and trims.
 */
export function normalizeMedicineName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, " ");
}

/**
 * Synchronizes medicines added by a doctor in OPD into the Pharmacy master (`medicines` table).
 * Deduplicates against existing pharmacy records (case-insensitive) and ensures the medicine
 * is stored with the hospital tenant ID so it can be reused across the hospital system
 * and managed in the Pharmacy module (Finance > Pharmacy).
 */
export async function syncPrescribedMedicinesToPharmacy(
  items: Array<SyncMedicineInput | string>,
  hospitalId?: string | null,
  qc?: QueryClient
): Promise<void> {
  if (!items || items.length === 0) return;

  // 1. Normalize inputs and deduplicate in-memory
  const candidates: Array<{ name: string; generic_name?: string | null; unit?: string | null }> = [];
  const seen = new Set<string>();

  for (const item of items) {
    const rawName = typeof item === "string" ? item : item?.name;
    const cleanName = normalizeMedicineName(rawName || "");
    if (!cleanName || cleanName.length < 2) continue;

    const lower = cleanName.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    candidates.push({
      name: cleanName,
      generic_name: typeof item === "object" && item.generic_name ? item.generic_name.trim() : null,
      unit: typeof item === "object" && item.unit ? item.unit.trim() : "pcs",
    });
  }

  if (candidates.length === 0) return;

  try {
    // 2. Fetch existing active medicines to avoid duplicate inserts
    let query = supabase
      .from("medicines")
      .select("id, name, hospital_id")
      .eq("active", true);

    if (hospitalId) {
      query = query.or(`hospital_id.eq.${hospitalId},hospital_id.is.null`);
    }

    const { data: existing, error: fetchErr } = await query;
    if (fetchErr) {
      console.warn("[pharmacy-sync] Warning fetching existing medicines:", fetchErr.message);
    }

    const existingNames = new Set<string>(
      (existing ?? []).map((m: any) => normalizeMedicineName(m.name ?? "").toLowerCase())
    );

    const toInsert = candidates.filter((c) => !existingNames.has(c.name.toLowerCase()));

    if (toInsert.length === 0) {
      return;
    }

    let insertedCount = 0;

    // 3. Insert newly discovered medicines into the pharmacy master
    for (const med of toInsert) {
      let inserted = false;

      // Method A: Call stored procedure if available (SECURITY DEFINER)
      try {
        const { data: rpcMedId, error: rpcErr } = await (supabase.rpc as any)("sync_opd_prescribed_medicine", {
          p_name: med.name,
          p_hospital_id: hospitalId || null,
          p_generic_name: med.generic_name || null,
          p_unit: med.unit || "pcs",
        });

        if (!rpcErr && rpcMedId) {
          inserted = true;
          insertedCount++;
        }
      } catch {
        // Fall back to direct table insert
      }

      // Method B: Direct insert fallback
      if (!inserted) {
        const { error: insertErr } = await supabase.from("medicines").insert({
          name: med.name,
          generic_name: med.generic_name || null,
          unit: med.unit || "pcs",
          gst_percent: 12,
          minimum_stock: 10,
          active: true,
          hospital_id: hospitalId || null,
        } as any);

        if (!insertErr) {
          insertedCount++;
        } else {
          console.warn(`[pharmacy-sync] Could not insert medicine "${med.name}":`, insertErr.message);
        }
      }
    }

    // 4. Invalidate caches so Pharmacy stock view & OPD autocomplete reflect new medicines immediately
    if (insertedCount > 0 && qc) {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["medicine-suggestions"] });
      qc.invalidateQueries({ queryKey: ["pharm-dashboard"] });
    }
  } catch (err: any) {
    // Non-fatal: do not block clinical prescription flow if sync runs into an unexpected issue
    console.warn("[pharmacy-sync] Non-fatal error during medicine sync:", err?.message || err);
  }
}

