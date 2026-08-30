import { supabase } from "@/integrations/supabase/client";

export interface ConsultationTemplateItem {
  id?: string;
  hospital_id?: string | null;
  doctor_id?: string | null;
  user_id?: string | null;
  name: string;
  chief_complaint?: string;
  clinical_findings?: string;
  diagnosis?: string;
  advice?: string;
  investigations?: Array<{ name: string; priority?: string; price?: string; notes?: string }> | string[];
  medicines?: Array<{
    medicine_name: string;
    strength?: string;
    route?: string;
    dosage?: string; // or frequency e.g. "1-0-1"
    frequency?: string;
    food_instruction?: string;
    duration_days?: string;
    quantity?: string;
    instructions?: string;
  }>;
  follow_up_days?: string;
  follow_up_advice?: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_DOCTOR_TEMPLATES: ConsultationTemplateItem[] = [
  {
    name: "Fever / Cold / Cough (Acute URI)",
    chief_complaint: "Fever with chills for 3 days, dry/productive cough, running nose, throat irritation.",
    clinical_findings: "Throat congested (+), bilateral chest clear, no wheezing, soft abdomen, temp 100.4°F.",
    diagnosis: "Acute Upper Respiratory Tract Infection / Viral Fever",
    advice: "Warm water gargles 3-4 times daily. Steam inhalation twice a day. Adequate hydration and rest.",
    investigations: [
      { name: "CBC with ESR", priority: "Routine", price: "300", notes: "Check for viral vs bacterial etiology" },
      { name: "Urine Routine & Microscopic", priority: "Routine", price: "150", notes: "" },
    ],
    medicines: [
      { medicine_name: "Paracetamol 650mg", strength: "650mg", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "After meal", duration_days: "5", instructions: "Take SOS for fever > 100°F" },
      { medicine_name: "Cetirizine 10mg", strength: "10mg", route: "Oral", frequency: "0-0-1", dosage: "0-0-1", food_instruction: "After meal", duration_days: "5", instructions: "At bedtime" },
      { medicine_name: "Azithromycin 500mg", strength: "500mg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "Before meal", duration_days: "3", instructions: "Once daily 1 hr before breakfast" },
      { medicine_name: "Dextromethorphan / Chlorpheniramine Syrup", strength: "100ml", route: "Oral", frequency: "1-1-1", dosage: "1-1-1", food_instruction: "After meal", duration_days: "5", instructions: "10ml thrice daily" },
      { medicine_name: "Pantoprazole 40mg", strength: "40mg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "Empty stomach", duration_days: "5", instructions: "Morning empty stomach" },
    ],
    follow_up_days: "5",
    follow_up_advice: "Review after 5 days with CBC reports or immediately if high fever persists / breathing difficulty occurs.",
  },
  {
    name: "Acute Gastroenteritis / Diarrhea",
    chief_complaint: "Watery loose stools 5-6 episodes, abdominal cramps, mild nausea.",
    clinical_findings: "Mild dehydration, tongue dry, abdomen soft, generalized mild tenderness, bowel sounds hyperactive.",
    diagnosis: "Acute Gastroenteritis with Mild Dehydration",
    advice: "Drink plenty of ORS, coconut water, and light khichdi/curd rice. Avoid oily, spicy, and raw foods.",
    investigations: [
      { name: "Stool Routine & Microscopy", priority: "Routine", price: "200", notes: "" },
      { name: "Serum Electrolytes", priority: "Routine", price: "450", notes: "" },
    ],
    medicines: [
      { medicine_name: "ORS (Oral Rehydration Salts)", strength: "1 sachet", route: "Oral", frequency: "SOS", dosage: "SOS", food_instruction: "With meal", duration_days: "3", instructions: "Dissolve 1 sachet in 1 liter clean water, sip frequently" },
      { medicine_name: "Ofloxacin + Ornidazole (O2)", strength: "200/500mg", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "After meal", duration_days: "5", instructions: "Take twice daily after meals" },
      { medicine_name: "Probiotic (Lactic Acid Bacillus / Saccharomyces)", strength: "Capsule", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "After meal", duration_days: "5", instructions: "Twice daily" },
      { medicine_name: "Dicyclomine + Paracetamol (Spasmo-Proxyvon / Meftal-Spas)", strength: "Tablet", route: "Oral", frequency: "SOS", dosage: "SOS", food_instruction: "After meal", duration_days: "3", instructions: "Take for severe abdominal cramps" },
      { medicine_name: "Ondansetron 4mg", strength: "4mg", route: "Oral", frequency: "SOS", dosage: "SOS", food_instruction: "Before meal", duration_days: "3", instructions: "1 tab 30 mins before food if nausea/vomiting" },
    ],
    follow_up_days: "3",
    follow_up_advice: "Review after 3 days or report to emergency immediately if unable to retain fluids or signs of severe dehydration.",
  },
  {
    name: "Essential Hypertension (Follow-up)",
    chief_complaint: "Routine blood pressure checkup. Occasional morning heaviness in head.",
    clinical_findings: "BP 148/92 mmHg, PR 76 bpm regular, S1 S2 heard normal, no pedal edema, chest clear.",
    diagnosis: "Essential Hypertension (Suboptimally controlled)",
    advice: "Low salt diet (< 5g/day), regular 30 mins aerobic walking 5 days/week, avoid tobacco/alcohol, daily BP monitoring log.",
    investigations: [
      { name: "ECG", priority: "Routine", price: "250", notes: "Annual cardiac check" },
      { name: "Lipid Profile", priority: "Routine", price: "550", notes: "" },
      { name: "KFT (Kidney Function Test)", priority: "Routine", price: "600", notes: "Check Creatinine & GFR" },
    ],
    medicines: [
      { medicine_name: "Telmisartan 40mg", strength: "40mg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "After meal", duration_days: "30", instructions: "Take daily in the morning at the same time" },
      { medicine_name: "Amlodipine 5mg", strength: "5mg", route: "Oral", frequency: "0-0-1", dosage: "0-0-1", food_instruction: "After meal", duration_days: "30", instructions: "Night time after dinner" },
    ],
    follow_up_days: "30",
    follow_up_advice: "Check BP weekly at nearby clinic and review in OPD with BP log after 1 month.",
  },
  {
    name: "Type 2 Diabetes Mellitus (Follow-up)",
    chief_complaint: "Routine diabetes follow-up. Mild fatigue, no polyuria or visual blurring.",
    clinical_findings: "Foot examination: sensations intact, pulses palpable, no ulcers. BP 130/84 mmHg, BMI 26.4.",
    diagnosis: "Type 2 Diabetes Mellitus on Oral Hypoglycemic Agents",
    advice: "Diabetic diet (strict no sugar/sweets, high fiber, complex carbs), daily 40 mins brisk walking, inspect feet daily.",
    investigations: [
      { name: "Blood Sugar (FBS / PPBS)", priority: "Routine", price: "200", notes: "Fast 8-10 hrs" },
      { name: "HbA1c (Glycated Hemoglobin)", priority: "Routine", price: "450", notes: "" },
      { name: "Urine Microalbumin", priority: "Routine", price: "400", notes: "Diabetic nephropathy screen" },
    ],
    medicines: [
      { medicine_name: "Metformin 500mg SR", strength: "500mg", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "With meal", duration_days: "30", instructions: "Take with or immediately after meals" },
      { medicine_name: "Glimepiride 1mg", strength: "1mg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "Before meal", duration_days: "30", instructions: "Take 15 minutes before breakfast" },
      { medicine_name: "Methylcobalamin (B12) 1500mcg", strength: "1500mcg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "After meal", duration_days: "30", instructions: "Once daily" },
    ],
    follow_up_days: "30",
    follow_up_advice: "Follow up with FBS/PPBS and HbA1c reports in 1 month.",
  },
  {
    name: "Acid Peptic Disease / GERD / Gastritis",
    chief_complaint: "Burning sensation in epigastrium and retrosternal area, sour belching, bloating after meals.",
    clinical_findings: "Epigastric tenderness (+), no guarding or rigidity, bowel sounds normal.",
    diagnosis: "Gastroesophageal Reflux Disease (GERD) / Acute Gastritis",
    advice: "Avoid spicy, fried, citrus, caffeine, and carbonated beverages. Do not lie down immediately after meals. Elevate head end of bed.",
    investigations: [],
    medicines: [
      { medicine_name: "Rabeprazole 20mg + Domperidone 30mg SR", strength: "20/30mg", route: "Oral", frequency: "1-0-0", dosage: "1-0-0", food_instruction: "Empty stomach", duration_days: "14", instructions: "Take 30 mins before breakfast" },
      { medicine_name: "Antacid Gel (Magaldrate + Simethicone)", strength: "200ml", route: "Oral", frequency: "1-1-1", dosage: "1-1-1", food_instruction: "After meal", duration_days: "10", instructions: "10ml after each meal and before sleep" },
      { medicine_name: "Sucralfate Suspension", strength: "100ml", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "Empty stomach", duration_days: "7", instructions: "10ml twice daily 1 hr before meals" },
    ],
    follow_up_days: "14",
    follow_up_advice: "Review after 2 weeks if symptoms persist for Upper GI Endoscopy evaluation.",
  },
];

function getStorageKey(hospitalId?: string | null, doctorId?: string | null, userId?: string | null): string {
  const hKey = hospitalId || "default_hospital";
  const dKey = doctorId || userId || "default_doctor";
  return `hims_opd_templates_${hKey}_${dKey}`;
}

export async function fetchDoctorTemplates(opts: {
  hospitalId?: string | null;
  doctorId?: string | null;
  userId?: string | null;
}): Promise<ConsultationTemplateItem[]> {
  const { hospitalId, doctorId, userId } = opts;
  const storageKey = getStorageKey(hospitalId, doctorId, userId);

  let dbTemplates: ConsultationTemplateItem[] = [];

  try {
    let query = (supabase as any).from("opd_consultation_templates").select("*");
    if (hospitalId) query = query.eq("hospital_id", hospitalId);
    if (doctorId && userId) {
      query = query.or(`doctor_id.eq.${doctorId},user_id.eq.${userId}`);
    } else if (doctorId) {
      query = query.eq("doctor_id", doctorId);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("name", { ascending: true });
    if (!error && Array.isArray(data)) {
      dbTemplates = data;
    }
  } catch {
    // Database table might not be loaded yet; use local fallback
  }

  // Check local offline storage
  let localTemplates: ConsultationTemplateItem[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      localTemplates = JSON.parse(raw);
    }
  } catch {}

  // Merge unique by name or id
  const map = new Map<string, ConsultationTemplateItem>();
  
  // Seed with default templates if nothing exists yet
  if (dbTemplates.length === 0 && localTemplates.length === 0) {
    DEFAULT_DOCTOR_TEMPLATES.forEach((tpl) => {
      const seeded = {
        ...tpl,
        id: `tpl-seed-${tpl.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        hospital_id: hospitalId ?? null,
        doctor_id: doctorId ?? null,
        user_id: userId ?? null,
      };
      map.set(tpl.name, seeded);
    });
  }

  localTemplates.forEach((t) => map.set(t.name, t));
  dbTemplates.forEach((t) => map.set(t.name, t));

  const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  try {
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {}

  return merged;
}

export async function saveDoctorTemplate(
  template: ConsultationTemplateItem,
  opts: { hospitalId?: string | null; doctorId?: string | null; userId?: string | null }
): Promise<ConsultationTemplateItem> {
  const { hospitalId, doctorId, userId } = opts;
  const storageKey = getStorageKey(hospitalId, doctorId, userId);

  const payload: any = {
    name: template.name.trim(),
    chief_complaint: template.chief_complaint || null,
    clinical_findings: template.clinical_findings || null,
    diagnosis: template.diagnosis || null,
    advice: template.advice || null,
    investigations: template.investigations || [],
    medicines: template.medicines || [],
    follow_up_days: template.follow_up_days || null,
    follow_up_advice: template.follow_up_advice || null,
    hospital_id: hospitalId || null,
    doctor_id: doctorId || null,
    user_id: userId || null,
    updated_at: new Date().toISOString(),
  };

  let savedItem = { ...template, ...payload };

  // Attempt DB write
  try {
    if (template.id && !template.id.startsWith("tpl-")) {
      const { data, error } = await (supabase as any)
        .from("opd_consultation_templates")
        .update(payload)
        .eq("id", template.id)
        .select("*")
        .single();
      if (!error && data) savedItem = data;
    } else {
      const { data, error } = await (supabase as any)
        .from("opd_consultation_templates")
        .insert(payload)
        .select("*")
        .single();
      if (!error && data) savedItem = data;
    }
  } catch {
    // offline fallback
  }

  if (!savedItem.id) {
    savedItem.id = `tpl-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Update local storage
  try {
    const raw = localStorage.getItem(storageKey);
    const existing: ConsultationTemplateItem[] = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex((t) => t.id === savedItem.id || t.name.toLowerCase() === savedItem.name.toLowerCase());
    if (idx >= 0) {
      existing[idx] = savedItem;
    } else {
      existing.push(savedItem);
    }
    localStorage.setItem(storageKey, JSON.stringify(existing));
  } catch {}

  return savedItem;
}

export async function deleteDoctorTemplate(
  templateId: string,
  templateName: string,
  opts: { hospitalId?: string | null; doctorId?: string | null; userId?: string | null }
): Promise<void> {
  const { hospitalId, doctorId, userId } = opts;
  const storageKey = getStorageKey(hospitalId, doctorId, userId);

  try {
    if (templateId && !templateId.startsWith("tpl-")) {
      await (supabase as any).from("opd_consultation_templates").delete().eq("id", templateId);
    }
  } catch {}

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const existing: ConsultationTemplateItem[] = JSON.parse(raw);
      const filtered = existing.filter((t) => t.id !== templateId && t.name !== templateName);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    }
  } catch {}
}
