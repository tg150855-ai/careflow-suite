CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patient_insurance_patient_id_fkey'
      AND conrelid = 'public.patient_insurance'::regclass
  ) THEN
    ALTER TABLE public.patient_insurance
      ADD CONSTRAINT patient_insurance_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patients_uhid ON public.patients (uhid);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON public.patients (mobile);
CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm ON public.patients USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient_id ON public.patient_insurance (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_policy_number ON public.patient_insurance (policy_number);