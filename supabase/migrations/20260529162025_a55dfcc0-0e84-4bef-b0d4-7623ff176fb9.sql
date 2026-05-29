
-- Enums
CREATE TYPE public.bed_status AS ENUM ('available','occupied','cleaning','reserved','maintenance');
CREATE TYPE public.ward_type AS ENUM ('icu','general','semi_private','private','emergency');
CREATE TYPE public.admission_status AS ENUM ('active','discharged','transferred','cancelled');
CREATE TYPE public.mar_status AS ENUM ('scheduled','administered','missed','held');

-- Sequence for admission numbers
CREATE SEQUENCE IF NOT EXISTS public.admission_no_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_admission_no()
RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'IPD-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.admission_no_seq')::text, 6, '0')
$$;

-- WARDS
CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.ward_type NOT NULL,
  floor text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wards TO authenticated;
GRANT ALL ON public.wards TO service_role;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read wards" ON public.wards FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write wards" ON public.wards FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- BEDS
CREATE TABLE public.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  bed_number text NOT NULL,
  status public.bed_status NOT NULL DEFAULT 'available',
  charge_per_day numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ward_id, bed_number)
);
CREATE INDEX idx_beds_ward ON public.beds(ward_id);
CREATE INDEX idx_beds_status ON public.beds(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beds TO authenticated;
GRANT ALL ON public.beds TO service_role;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read beds" ON public.beds FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write beds" ON public.beds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'nurse'));
CREATE TRIGGER beds_set_updated_at BEFORE UPDATE ON public.beds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ADMISSIONS
CREATE TABLE public.admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no text NOT NULL UNIQUE DEFAULT gen_admission_no(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  department_id uuid REFERENCES public.departments(id),
  ward_id uuid REFERENCES public.wards(id),
  bed_id uuid REFERENCES public.beds(id),
  admitted_at timestamptz NOT NULL DEFAULT now(),
  discharged_at timestamptz,
  reason text,
  initial_diagnosis text,
  attender_name text,
  attender_mobile text,
  emergency_contact text,
  insurance_provider text,
  insurance_policy_no text,
  estimated_stay_days integer,
  is_emergency boolean NOT NULL DEFAULT false,
  status public.admission_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissions_patient ON public.admissions(patient_id);
CREATE INDEX idx_admissions_status ON public.admissions(status);
CREATE INDEX idx_admissions_bed ON public.admissions(bed_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissions TO authenticated;
GRANT ALL ON public.admissions TO service_role;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read admissions" ON public.admissions FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write admissions" ON public.admissions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor'));
CREATE TRIGGER admissions_set_updated_at BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ADMISSION NOTES
CREATE TABLE public.admission_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admission_notes_adm ON public.admission_notes(admission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_notes TO authenticated;
GRANT ALL ON public.admission_notes TO service_role;
ALTER TABLE public.admission_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read adm notes" ON public.admission_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write adm notes" ON public.admission_notes FOR ALL TO authenticated
  USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

-- BED TRANSFERS
CREATE TABLE public.bed_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  from_bed_id uuid REFERENCES public.beds(id),
  to_bed_id uuid NOT NULL REFERENCES public.beds(id),
  reason text,
  transferred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_bed_transfers_adm ON public.bed_transfers(admission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bed_transfers TO authenticated;
GRANT ALL ON public.bed_transfers TO service_role;
ALTER TABLE public.bed_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read transfers" ON public.bed_transfers FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write transfers" ON public.bed_transfers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'doctor'));

-- VITALS
CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  systolic numeric,
  diastolic numeric,
  pulse numeric,
  temperature numeric,
  oxygen numeric,
  sugar numeric,
  weight numeric,
  notes text,
  recorded_by uuid
);
CREATE INDEX idx_vitals_adm ON public.vitals(admission_id);
CREATE INDEX idx_vitals_patient ON public.vitals(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitals TO authenticated;
GRANT ALL ON public.vitals TO service_role;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read vitals" ON public.vitals FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write vitals" ON public.vitals FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

-- NURSING NOTES
CREATE TABLE public.nursing_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  shift text,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nursing_notes_adm ON public.nursing_notes(admission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursing_notes TO authenticated;
GRANT ALL ON public.nursing_notes TO service_role;
ALTER TABLE public.nursing_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read nursing notes" ON public.nursing_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write nursing notes" ON public.nursing_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

-- MEDICATION ADMINISTRATION (MAR)
CREATE TABLE public.medication_administration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text,
  route text,
  scheduled_at timestamptz NOT NULL,
  administered_at timestamptz,
  status public.mar_status NOT NULL DEFAULT 'scheduled',
  administered_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mar_adm ON public.medication_administration(admission_id);
CREATE INDEX idx_mar_sched ON public.medication_administration(scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_administration TO authenticated;
GRANT ALL ON public.medication_administration TO service_role;
ALTER TABLE public.medication_administration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read mar" ON public.medication_administration FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write mar" ON public.medication_administration FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

-- DOCTOR ROUNDS
CREATE TABLE public.doctor_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id),
  rounded_at timestamptz NOT NULL DEFAULT now(),
  progress_notes text,
  clinical_findings text,
  updated_diagnosis text,
  follow_up_orders text,
  template_used text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rounds_adm ON public.doctor_rounds(admission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_rounds TO authenticated;
GRANT ALL ON public.doctor_rounds TO service_role;
ALTER TABLE public.doctor_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read rounds" ON public.doctor_rounds FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "doctor write rounds" ON public.doctor_rounds FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'));

-- DISCHARGE SUMMARIES
CREATE TABLE public.discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL UNIQUE REFERENCES public.admissions(id) ON DELETE CASCADE,
  discharge_date timestamptz NOT NULL DEFAULT now(),
  final_diagnosis text,
  procedures_performed text,
  hospital_course text,
  condition_at_discharge text,
  follow_up_instructions text,
  follow_up_date date,
  advice text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discharge_summaries TO authenticated;
GRANT ALL ON public.discharge_summaries TO service_role;
ALTER TABLE public.discharge_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read discharge" ON public.discharge_summaries FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "doctor write discharge" ON public.discharge_summaries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'));
CREATE TRIGGER discharge_set_updated_at BEFORE UPDATE ON public.discharge_summaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DISCHARGE MEDICATIONS
CREATE TABLE public.discharge_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discharge_id uuid NOT NULL REFERENCES public.discharge_summaries(id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text,
  duration text,
  instructions text,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_discharge_meds_disch ON public.discharge_medications(discharge_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discharge_medications TO authenticated;
GRANT ALL ON public.discharge_medications TO service_role;
ALTER TABLE public.discharge_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read disch meds" ON public.discharge_medications FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "doctor write disch meds" ON public.discharge_medications FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor'));
