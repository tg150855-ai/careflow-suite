
-- Add ICU vitals fields
ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS cvp numeric,
  ADD COLUMN IF NOT EXISTS gcs_score integer;

-- Admission ICU status
ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS icu_status text DEFAULT 'stable';

-- Ventilator records
CREATE TABLE IF NOT EXISTS public.icu_ventilator_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  vent_type text,
  mode text,
  fio2 numeric,
  peep numeric,
  resp_rate numeric,
  tidal_volume numeric,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  notes text,
  charge_per_day numeric DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_ventilator_records TO authenticated;
GRANT ALL ON public.icu_ventilator_records TO service_role;
ALTER TABLE public.icu_ventilator_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icu vent staff read" ON public.icu_ventilator_records FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "icu vent staff write" ON public.icu_ventilator_records FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_icu_vent_updated BEFORE UPDATE ON public.icu_ventilator_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ICU Procedures
CREATE TABLE IF NOT EXISTS public.icu_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  procedure_type text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  doctor_id uuid,
  notes text,
  charges numeric DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_procedures TO authenticated;
GRANT ALL ON public.icu_procedures TO service_role;
ALTER TABLE public.icu_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icu proc staff read" ON public.icu_procedures FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "icu proc staff write" ON public.icu_procedures FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_icu_proc_updated BEFORE UPDATE ON public.icu_procedures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ICU Doctor notes
CREATE TABLE IF NOT EXISTS public.icu_doctor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid,
  doctor_name text,
  note text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_doctor_notes TO authenticated;
GRANT ALL ON public.icu_doctor_notes TO service_role;
ALTER TABLE public.icu_doctor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icu dn staff read" ON public.icu_doctor_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "icu dn staff write" ON public.icu_doctor_notes FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_icu_dn_updated BEFORE UPDATE ON public.icu_doctor_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ICU settings (singleton)
CREATE TABLE IF NOT EXISTS public.icu_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_charge_per_day numeric NOT NULL DEFAULT 5000,
  ventilator_charge_per_day numeric NOT NULL DEFAULT 3000,
  nursing_charge_per_day numeric NOT NULL DEFAULT 1000,
  alert_spo2_min numeric DEFAULT 92,
  alert_hr_min numeric DEFAULT 50,
  alert_hr_max numeric DEFAULT 120,
  alert_bp_sys_max numeric DEFAULT 180,
  alert_temp_max numeric DEFAULT 38.5,
  alert_rr_max numeric DEFAULT 25,
  alert_gcs_min numeric DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_settings TO authenticated;
GRANT ALL ON public.icu_settings TO service_role;
ALTER TABLE public.icu_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icu settings staff read" ON public.icu_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "icu settings staff write" ON public.icu_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_icu_settings_updated BEFORE UPDATE ON public.icu_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.icu_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;
