// AI-ready structured patient summary. Used by the 360 workspace and reserved
// for future AI Copilot / Assistant modules. Runs as the signed-in user, so
// RLS applies — the summary only includes data the caller is authorized for.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPatientSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const pid = data.patientId;
    const [patient, visits, admissions, surgeries, labs, meds, alerts] = await Promise.all([
      sb.from("patients").select("*").eq("id", pid).maybeSingle(),
      sb.from("opd_visits").select("id, diagnosis, chief_complaints, symptoms, created_at, doctors(name)").eq("patient_id", pid).order("created_at", { ascending: false }).limit(10),
      sb.from("admissions").select("id, admission_no, admitted_at, discharged_at, reason, initial_diagnosis, status, doctors(name)").eq("patient_id", pid).order("admitted_at", { ascending: false }).limit(10),
      sb.from("surgeries").select("id, procedure_name, status, scheduled_start, actual_start").eq("patient_id", pid).order("scheduled_start", { ascending: false }).limit(10),
      sb.from("lab_results").select("test_name, result_value, unit, reference_range, flag, result_entered_at, lab_orders!inner(patient_id)").eq("lab_orders.patient_id", pid).order("result_entered_at", { ascending: false }).limit(20),
      sb.from("prescription_items").select("medicine_name, dosage, timing, duration_days, prescriptions!inner(opd_visits!inner(patient_id, created_at))").eq("prescriptions.opd_visits.patient_id", pid).limit(30),
      sb.from("clinical_alerts").select("alert_type, severity, message, acknowledged, created_at").eq("patient_id", pid).order("created_at", { ascending: false }).limit(20),
    ]);
    const p = patient.data ?? {};
    return {
      demographics: {
        uhid: p.uhid, full_name: p.full_name, gender: p.gender, dob: p.dob,
        blood_group: p.blood_group, mobile: p.mobile,
        emergency_contact: p.emergency_contact_name ? `${p.emergency_contact_name} (${p.emergency_contact_mobile ?? ""})` : null,
      },
      allergies: p.allergies ?? null,
      chronic_diseases: p.chronic_diseases ?? null,
      diagnoses: (visits.data ?? []).map((v: any) => ({ date: v.created_at, diagnosis: v.diagnosis, doctor: v.doctors?.name })).filter((d: any) => d.diagnosis),
      admissions: admissions.data ?? [],
      surgeries: surgeries.data ?? [],
      recent_labs: labs.data ?? [],
      medications: meds.data ?? [],
      alerts: alerts.data ?? [],
    };
  });
