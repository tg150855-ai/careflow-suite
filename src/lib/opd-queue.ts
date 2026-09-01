// Helper: create (or return) today's OPD appointment for a patient, and
// rely on the existing `sync_opd_queue_from_appointment` DB trigger to
// materialise a queue_tokens row automatically.
import { supabase } from "@/integrations/supabase/client";

export type EnqueueResult = { appointmentId: string; created: boolean };

/**
 * Ensures the given patient has an active OPD appointment today. If none exists
 * a new one is created (status = "waiting") and the DB trigger enqueues it.
 * Returns the appointment id so callers can navigate straight to consultation.
 */
export async function ensureOpdAppointment(opts: {
  patientId: string;
  doctorId?: string | null;
  createdBy?: string | null;
}): Promise<EnqueueResult> {
  const { patientId, doctorId, createdBy } = opts;

  // Look for an active appointment scheduled today so we don't create dupes.
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString())
    .not("status", "in", "(completed,cancelled)")
    .maybeSingle();
  if (existing?.id) return { appointmentId: existing.id, created: false };

  // Resolve a doctor if none was passed — use any active doctor.
  let doc = doctorId ?? null;
  if (!doc) {
    const { data: docs } = await supabase
      .from("doctors")
      .select("id, active")
      .order("name")
      .limit(10);
    const activeDoc = (docs ?? []).find((d: any) => d.active !== false);
    if (activeDoc?.id) {
      doc = activeDoc.id;
    } else if (docs && docs.length > 0) {
      doc = docs[0].id;
    }
  }

  // Fallback: auto-seed duty doctor if none exists in hospital
  if (!doc) {
    try {
      const { data: seeded } = await (supabase as any)
        .from("doctors")
        .insert({
          name: "Duty Doctor (OPD)",
          specialization: "General Medicine",
          department: "OPD",
          active: true,
        })
        .select("id")
        .maybeSingle();
      if (seeded?.id) doc = seeded.id;
    } catch {
      // Ignored if insertion fails
    }
  }

  const { data, error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    doctor_id: (doc ?? "") as any,
    scheduled_at: new Date().toISOString(),
    status: "waiting" as any,
    created_by: createdBy ?? null,
  }).select("id").single();
  if (error) throw error;
  return { appointmentId: data.id, created: true };
}
