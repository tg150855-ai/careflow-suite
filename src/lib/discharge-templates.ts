import { supabase } from "@/integrations/supabase/client";

export interface DischargeMedicationItem {
  medicine_name: string;
  dose?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface DischargeTemplateItem {
  id: string;
  name: string;
  category?: string;
  primary_diagnosis: string;
  secondary_diagnosis?: string;
  doctor_notes?: string;
  hospital_course?: string;
  follow_up_instructions?: string;
  follow_up_days?: number;
  condition_at_discharge?: string;
  medicines: DischargeMedicationItem[];
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_DISCHARGE_TEMPLATES: DischargeTemplateItem[] = [
  {
    id: "dtpl-lap-surgery",
    name: "Post-Operative Laparoscopic Surgery (Appendectomy / Cholecystectomy)",
    category: "General Surgery",
    primary_diagnosis: "Acute Appendicitis / Symptomatic Cholelithiasis - Post Laparoscopic Procedure",
    secondary_diagnosis: "Mild localized post-operative pain, uneventful recovery",
    doctor_notes: "Patient underwent uncomplicated laparoscopic procedure under General Anesthesia. Post-operative period was uneventful. Surgical port sites are healthy with clean dressings. Oral liquids tolerated well, progressed to soft diet. Patient is ambulating well, afebrile, and hemodynamically stable. Advised to avoid heavy lifting or strenuous activity for 3 weeks.",
    hospital_course: "Admitted with abdominal pain. Pre-op workup and pre-anesthetic clearance completed. Underwent laparoscopic procedure. Post-op vitals stable. Wound inspection satisfactory. Discharged in stable condition.",
    follow_up_instructions: "Review in Surgical OPD after 7 days for port site suture removal and wound inspection. Report immediately in case of high fever, persistent vomiting, abdominal distension, or wound soakage/discharge.",
    follow_up_days: 7,
    condition_at_discharge: "Stable",
    medicines: [
      { medicine_name: "Tab Cefuroxime Axetil 500mg", dose: "500mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After meals" },
      { medicine_name: "Tab Metronidazole 400mg", dose: "400mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After meals" },
      { medicine_name: "Tab Paracetamol 650mg + Tramadol 37.5mg", dose: "1 tab", route: "Oral", frequency: "1-0-1 (BD) SOS", duration: "3-5 days", instructions: "After meals for pain" },
      { medicine_name: "Cap Pantoprazole 40mg + Domperidone 30mg", dose: "40/30mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "7 days", instructions: "Before breakfast empty stomach" },
      { medicine_name: "Syp Lactulose 15ml", dose: "15ml", route: "Oral", frequency: "0-0-1 (HS)", duration: "5 days", instructions: "At bedtime with warm water" },
    ],
  },
  {
    id: "dtpl-gastroenteritis",
    name: "Acute Gastroenteritis with Dehydration",
    category: "General Medicine",
    primary_diagnosis: "Acute Infective Gastroenteritis with Moderate Dehydration",
    secondary_diagnosis: "Hypokalemia (corrected), Mild Gastritis",
    doctor_notes: "Patient admitted with frequent loose watery stools, nausea, and vomiting. Successfully rehydrated with intravenous fluids (RL and DNS) and electrolyte replacement. Frequency of stools has subsided, hydration status normalized, oral diet well tolerated. Hemodynamically stable with normal bowel sounds.",
    hospital_course: "IV fluids, antiemetics, and broad-spectrum antimicrobial coverage initiated. Stool routine and serum electrolytes monitored. Marked improvement by Day 2. Transitioned to oral medications and soft bland diet.",
    follow_up_instructions: "Review in General Medicine OPD after 5 days. Drink plenty of clean boiled water, ORS, tender coconut water, and curd. Avoid spicy, raw, street food, and dairy for 1 week. Return immediately if dehydration signs recur.",
    follow_up_days: 5,
    condition_at_discharge: "Improved",
    medicines: [
      { medicine_name: "Tab Ofloxacin 200mg + Ornidazole 500mg", dose: "200/500mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After food" },
      { medicine_name: "Cap Racecadotril 100mg", dose: "100mg", route: "Oral", frequency: "1-1-1 (TDS)", duration: "3 days", instructions: "Before meals until stools form" },
      { medicine_name: "Cap Probiotic (Lactic Acid Bacillus + Saccharomyces)", dose: "1 cap", route: "Oral", frequency: "1-0-1 (BD)", duration: "7 days", instructions: "After meals" },
      { medicine_name: "Tab Pantoprazole 40mg", dose: "40mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "7 days", instructions: "Empty stomach in morning" },
      { medicine_name: "ORS Sachet (Oral Rehydration Salts)", dose: "1 sachet in 1L water", route: "Oral", frequency: "Frequent sips", duration: "3 days", instructions: "Sip throughout day" },
    ],
  },
  {
    id: "dtpl-respiratory-infection",
    name: "Community-Acquired Pneumonia / Severe Bronchitis",
    category: "Pulmonology",
    primary_diagnosis: "Community Acquired Lower Respiratory Tract Infection / Pneumonia",
    secondary_diagnosis: "Mild Reactive Airway Disease / Cough Variant Bronchospasm",
    doctor_notes: "Admitted with high-grade fever, productive cough, and mild shortness of breath. Chest auscultation revealed crepitations in bilateral lower zones. Treated with IV antibiotics, nebulization, and supportive oxygen therapy. Cough is resolving, afebrile for 48 hours, SpO2 maintaining > 97% on room air. Chest clear on discharge.",
    hospital_course: "Blood investigations, sputum culture, and chest X-ray performed. IV Ceftriaxone + Macrolide coverage administered alongside bronchodilator nebulizations. Clinical parameters normalized over stay.",
    follow_up_instructions: "Follow up in Pulmonology / Medicine OPD after 7 days with repeat Chest X-ray. Steam inhalation twice daily. Avoid exposure to cold air, smoke, dust, and chilled water.",
    follow_up_days: 7,
    condition_at_discharge: "Improved",
    medicines: [
      { medicine_name: "Tab Amoxicillin 500mg + Clavulanic Acid 125mg", dose: "625mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After meals" },
      { medicine_name: "Tab Azithromycin 500mg", dose: "500mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "3 days", instructions: "1 hour before food" },
      { medicine_name: "Syp Ambroxol + Levosalbutamol + Guaiphenesin", dose: "10ml", route: "Oral", frequency: "1-1-1 (TDS)", duration: "5 days", instructions: "After food" },
      { medicine_name: "Tab Levocetirizine 5mg + Montelukast 10mg", dose: "1 tab", route: "Oral", frequency: "0-0-1 (HS)", duration: "10 days", instructions: "At bedtime" },
      { medicine_name: "Tab Paracetamol 650mg", dose: "650mg", route: "Oral", frequency: "SOS (Max 3/day)", duration: "3 days", instructions: "Take only if body ache or fever > 100°F" },
    ],
  },
  {
    id: "dtpl-cardiology-cad",
    name: "Coronary Artery Disease / Angina / Hypertension",
    category: "Cardiology",
    primary_diagnosis: "Coronary Artery Disease (CAD) - Post Stabilization / Unstable Angina Subsided",
    secondary_diagnosis: "Essential Hypertension, Dyslipidemia",
    doctor_notes: "Admitted with retrosternal chest heaviness and palpitations. Serial cardiac enzymes (Troponin I) were negative. ECG showed ischemic T-wave changes, which resolved after anti-ischemic and antiplatelet management. BP stabilized on dual antihypertensive therapy. Echocardiogram shows preserved LVEF (55%). Currently asymptomatic.",
    hospital_course: "Patient kept on continuous cardiac monitoring. Started on dual antiplatelets, statin, beta-blocker, and ACE-I. Vitals monitored strictly. Treadmill test / Angiography advised for elective outpatient evaluation.",
    follow_up_instructions: "Review in Cardiology OPD after 10 days with fasting Lipid Profile, serum Creatinine, and blood pressure monitoring chart. Strict low-salt, low-fat diet. Walk 30 minutes daily. Contact emergency immediately if chest pain or breathlessness recurs.",
    follow_up_days: 10,
    condition_at_discharge: "Stable",
    medicines: [
      { medicine_name: "Tab Ecosprin 75mg (Aspirin)", dose: "75mg", route: "Oral", frequency: "0-1-0 (Noon)", duration: "30 days", instructions: "After lunch" },
      { medicine_name: "Tab Clopidogrel 75mg", dose: "75mg", route: "Oral", frequency: "0-0-1 (Night)", duration: "30 days", instructions: "After dinner" },
      { medicine_name: "Tab Atorvastatin 40mg", dose: "40mg", route: "Oral", frequency: "0-0-1 (Night)", duration: "30 days", instructions: "At bedtime" },
      { medicine_name: "Tab Metoprolol Succinate 25mg ER", dose: "25mg", route: "Oral", frequency: "1-0-0 (Morning)", duration: "30 days", instructions: "After breakfast" },
      { medicine_name: "Tab Telmisartan 40mg", dose: "40mg", route: "Oral", frequency: "1-0-0 (Morning)", duration: "30 days", instructions: "Morning with water" },
      { medicine_name: "Tab Sorbitrate 5mg (Isosorbide Dinitrate)", dose: "5mg", route: "Sublingual", frequency: "SOS", duration: "As needed", instructions: "Dissolve under tongue for acute chest tightness" },
    ],
  },
  {
    id: "dtpl-diabetes-hhs",
    name: "Type 2 Diabetes Mellitus with Uncontrolled Glycemia",
    category: "Endocrinology",
    primary_diagnosis: "Type 2 Diabetes Mellitus with Hyperglycemia and Dehydration",
    secondary_diagnosis: "Diabetic Neuropathy / Dyslipidemia",
    doctor_notes: "Admitted with severe weakness, polydipsia, polyuria, and random blood sugar > 380 mg/dL. Urine ketones were negative. Managed with subcutaneous insulin sliding scale and fluid rehydration. Sugars optimized to Fasting 110-130 mg/dL, Post-prandial 150-180 mg/dL. Patient and caregiver educated on insulin administration technique and glucometer usage.",
    hospital_course: "Frequent capillary blood glucose monitoring. Transitioned from intensive insulin protocol to maintenance basal-bolus regimen and oral hypoglycemics. Dietician consultation conducted.",
    follow_up_instructions: "Review in Diabetes / Endocrinology OPD after 7 days with daily 3-point blood sugar log (Fasting, PP, Pre-dinner). Maintain strict diabetic diet (no sugar, sweets, white bread). Never skip meals after taking insulin/medications.",
    follow_up_days: 7,
    condition_at_discharge: "Improved",
    medicines: [
      { medicine_name: "Tab Metformin 500mg SR", dose: "500mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "30 days", instructions: "With or immediately after meals" },
      { medicine_name: "Tab Glimepiride 1mg", dose: "1mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "30 days", instructions: "15 minutes before breakfast" },
      { medicine_name: "Tab Teneligliptin 20mg", dose: "20mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "30 days", instructions: "Before breakfast" },
      { medicine_name: "Tab Methylcobalamin 1500mcg + Pregabalin 75mg", dose: "1 tab", route: "Oral", frequency: "0-0-1 (HS)", duration: "30 days", instructions: "At bedtime" },
      { medicine_name: "Tab Atorvastatin 10mg", dose: "10mg", route: "Oral", frequency: "0-0-1 (HS)", duration: "30 days", instructions: "At bedtime" },
    ],
  },
  {
    id: "dtpl-ortho-fracture",
    name: "Closed Fracture / Post-Operative Orthopedic Care (ORIF)",
    category: "Orthopedics",
    primary_diagnosis: "Closed Fracture of Bone - Status Post Open Reduction & Internal Fixation (ORIF)",
    secondary_diagnosis: "Post-surgical soft tissue edema, resolving",
    doctor_notes: "Patient underwent Open Reduction and Internal Fixation (ORIF) with plate/screws or intramedullary nail under Spinal Anesthesia. Check X-ray confirms anatomical reduction and rigid fixation. Distal neurovascular status is intact (capillary refill < 2 sec, sensation and toe/finger movements normal). Surgical wound dry and healthy. Limb elevation maintained.",
    hospital_course: "Post-op analgesia, prophylactic antibiotics, and limb elevation provided. Physiotherapy initiated with active-assisted range of motion exercises. Patient mobilized non-weight bearing with walker support.",
    follow_up_instructions: "Review in Orthopedic OPD after 12 days for surgical staple/suture removal and repeat check X-ray. Keep operative limb elevated on pillow while resting. Do not wet the dressing. Non-weight bearing ambulation with walker only.",
    follow_up_days: 12,
    condition_at_discharge: "Stable",
    medicines: [
      { medicine_name: "Tab Cefuroxime Axetil 500mg", dose: "500mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After food" },
      { medicine_name: "Tab Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg", dose: "1 tab", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After meals" },
      { medicine_name: "Cap Pantoprazole 40mg", dose: "40mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "7 days", instructions: "Empty stomach morning" },
      { medicine_name: "Tab Calcium Citrate Maleate + Calcitriol (Vit D3)", dose: "1 tab", route: "Oral", frequency: "0-1-0 (OD)", duration: "30 days", instructions: "After lunch" },
      { medicine_name: "Syp Sodium Picosulfate 10ml", dose: "10ml", route: "Oral", frequency: "0-0-1 (HS) SOS", duration: "5 days", instructions: "At night if constipated" },
    ],
  },
  {
    id: "dtpl-obs-delivery",
    name: "Normal Vaginal Delivery / Postpartum Mother & Neonate",
    category: "Obstetrics & Gynecology",
    primary_diagnosis: "Term Pregnancy with Spontaneous Vaginal Delivery with Episiotomy",
    secondary_diagnosis: "Healthy live neonate, uneventful immediate postpartum period",
    doctor_notes: "Mother delivered a healthy baby spontaneously per vaginam without complications. Episiotomy repaired in layers with absorbable sutures; wound healthy with no hematoma. Lochia rubra moderate and normal. Uterus well contracted. Breastfeeding established comfortably with good latching. Neonate examined by pediatrician, active, passing urine and meconium.",
    hospital_course: "Monitored postpartum vitals, uterine tone, and perineal hygiene. Birth weight and newborn APGAR scores documented. Newborn vaccinated (BCG, OPV, Hep-B 0). Mother initiated on oral hematinics and calcium.",
    follow_up_instructions: "Review in Gynae & Pediatric OPD after 7 days for baby weight check and maternal episiotomy inspection. Maintain perineal hygiene with warm sitz baths twice daily. Exclusive breastfeeding for 6 months. Take prescribed iron and calcium supplements.",
    follow_up_days: 7,
    condition_at_discharge: "Stable",
    medicines: [
      { medicine_name: "Tab Amoxicillin + Clavulanic Acid 625mg", dose: "625mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "5 days", instructions: "After food" },
      { medicine_name: "Tab Paracetamol 650mg", dose: "650mg", route: "Oral", frequency: "1-0-1 (BD) SOS", duration: "3 days", instructions: "For perineal ache" },
      { medicine_name: "Tab Ferrous Ascorbate 100mg + Folic Acid 1.5mg", dose: "1 tab", route: "Oral", frequency: "0-1-0 (OD)", duration: "90 days", instructions: "After lunch with water (do not take with tea/milk)" },
      { medicine_name: "Tab Calcium 500mg + Vitamin D3", dose: "500mg", route: "Oral", frequency: "1-0-0 (OD)", duration: "90 days", instructions: "After breakfast" },
      { medicine_name: "Povidone Iodine 10% Ointment", dose: "Tube", route: "Topical", frequency: "Twice daily", duration: "7 days", instructions: "Apply gently to episiotomy stitches after sitz bath" },
    ],
  },
  {
    id: "dtpl-neuro-stroke",
    name: "Acute Ischemic Stroke / Cerebrovascular Accident (CVA)",
    category: "Neurology",
    primary_diagnosis: "Acute Ischemic Stroke (CVA) - Middle Cerebral Artery Territory",
    secondary_diagnosis: "Hypertension, Hyperlipidemia, Hemiparesis (improving)",
    doctor_notes: "Admitted with sudden onset weakness of right upper and lower limbs with mild speech dysarthria. Non-contrast CT / MRI Brain confirmed subacute infarct without hemorrhage. Patient received antiplatelet therapy, statins, neuro-supportive care, and aggressive bedside physiotherapy. Power has improved from 2/5 to 4/5. Swallowing intact. Hemodynamically stable.",
    hospital_course: "Strict blood pressure and blood glucose maintenance. Carotid Doppler and 2D Echocardiogram performed. Neuro-rehabilitation and speech therapy initiated. Patient able to ambulate with minimal support.",
    follow_up_instructions: "Review in Neurology OPD after 14 days. Continue home physiotherapy daily. Strict control of blood pressure and blood glucose. Seek immediate emergency evaluation if new weakness, facial droop, or speech slurring occurs.",
    follow_up_days: 14,
    condition_at_discharge: "Improved",
    medicines: [
      { medicine_name: "Tab Aspirin 75mg + Clopidogrel 75mg", dose: "75/75mg", route: "Oral", frequency: "0-1-0 (Noon)", duration: "30 days", instructions: "After lunch" },
      { medicine_name: "Tab Atorvastatin 40mg", dose: "40mg", route: "Oral", frequency: "0-0-1 (Night)", duration: "30 days", instructions: "At bedtime" },
      { medicine_name: "Tab Citicoline 500mg", dose: "500mg", route: "Oral", frequency: "1-0-1 (BD)", duration: "30 days", instructions: "After meals" },
      { medicine_name: "Tab Telmisartan 40mg + Amlodipine 5mg", dose: "40/5mg", route: "Oral", frequency: "1-0-0 (Morning)", duration: "30 days", instructions: "Morning after breakfast" },
      { medicine_name: "Tab Pantoprazole 40mg", dose: "40mg", route: "Oral", frequency: "1-0-0 (Morning)", duration: "14 days", instructions: "Empty stomach in morning" },
    ],
  },
];

function getStorageKey(hospitalId?: string | null, doctorId?: string | null): string {
  const hKey = hospitalId || "default_hospital";
  const dKey = doctorId || "all_doctors";
  return `hims_discharge_templates_${hKey}_${dKey}`;
}

export async function fetchDischargeTemplates(opts?: {
  hospitalId?: string | null;
  doctorId?: string | null;
}): Promise<DischargeTemplateItem[]> {
  const hospitalId = opts?.hospitalId;
  const doctorId = opts?.doctorId;
  const storageKey = getStorageKey(hospitalId, doctorId);

  let localTemplates: DischargeTemplateItem[] = [];
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        localTemplates = JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error("Failed reading discharge templates from localStorage", err);
  }

  // Also try database if custom table exists
  let dbTemplates: DischargeTemplateItem[] = [];
  try {
    const { data, error } = await (supabase as any)
      .from("discharge_summary_templates")
      .select("*")
      .order("name", { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) {
      dbTemplates = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category || "General",
        primary_diagnosis: d.primary_diagnosis || d.final_diagnosis || "",
        secondary_diagnosis: d.secondary_diagnosis || d.procedures_performed || "",
        doctor_notes: d.doctor_notes || d.advice || "",
        hospital_course: d.hospital_course || "",
        follow_up_instructions: d.follow_up_instructions || "",
        follow_up_days: d.follow_up_days || 7,
        condition_at_discharge: d.condition_at_discharge || "Stable",
        medicines: d.medicines || [],
      }));
    }
  } catch {
    // Database table might not exist in this environment, local fallback works seamlessly
  }

  // Combine default standard templates with user-saved templates
  const map = new Map<string, DischargeTemplateItem>();
  DEFAULT_DISCHARGE_TEMPLATES.forEach((tpl) => map.set(tpl.id, tpl));
  localTemplates.forEach((tpl) => map.set(tpl.id, tpl));
  dbTemplates.forEach((tpl) => map.set(tpl.id, tpl));

  const list = Array.from(map.values());
  return list;
}

export async function saveDischargeTemplate(
  template: Omit<DischargeTemplateItem, "id"> & { id?: string },
  opts?: { hospitalId?: string | null; doctorId?: string | null }
): Promise<DischargeTemplateItem> {
  const hospitalId = opts?.hospitalId;
  const doctorId = opts?.doctorId;
  const storageKey = getStorageKey(hospitalId, doctorId);

  const id = template.id || `dtpl-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const item: DischargeTemplateItem = {
    ...template,
    id,
    updated_at: new Date().toISOString(),
  };

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(storageKey);
      const existing: DischargeTemplateItem[] = raw ? JSON.parse(raw) : [];
      const idx = existing.findIndex((t) => t.id === id || t.name.toLowerCase() === item.name.toLowerCase());
      if (idx >= 0) {
        existing[idx] = item;
      } else {
        existing.unshift(item);
      }
      localStorage.setItem(storageKey, JSON.stringify(existing));
    }
  } catch (err) {
    console.error("Failed saving discharge template to localStorage", err);
  }

  // Attempt DB persist if table is available
  try {
    await (supabase as any).from("discharge_summary_templates").upsert({
      id: item.id,
      name: item.name,
      category: item.category,
      primary_diagnosis: item.primary_diagnosis,
      secondary_diagnosis: item.secondary_diagnosis,
      doctor_notes: item.doctor_notes,
      hospital_course: item.hospital_course,
      follow_up_instructions: item.follow_up_instructions,
      follow_up_days: item.follow_up_days,
      condition_at_discharge: item.condition_at_discharge,
      medicines: item.medicines,
      updated_at: item.updated_at,
    });
  } catch {
    // Ignore db write failure, local copy preserved
  }

  return item;
}

export async function deleteDischargeTemplate(
  id: string,
  opts?: { hospitalId?: string | null; doctorId?: string | null }
): Promise<void> {
  const hospitalId = opts?.hospitalId;
  const doctorId = opts?.doctorId;
  const storageKey = getStorageKey(hospitalId, doctorId);

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const existing: DischargeTemplateItem[] = JSON.parse(raw);
        const filtered = existing.filter((t) => t.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    }
  } catch (err) {
    console.error("Failed deleting discharge template from localStorage", err);
  }

  try {
    await (supabase as any).from("discharge_summary_templates").delete().eq("id", id);
  } catch {}
}
