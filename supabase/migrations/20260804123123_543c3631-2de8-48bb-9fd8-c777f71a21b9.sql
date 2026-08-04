ALTER TABLE public.discharge_summaries
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

ALTER TABLE public.consent_forms
  ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS patient_signature text,
  ADD COLUMN IF NOT EXISTS doctor_signature text,
  ADD COLUMN IF NOT EXISTS witness_signature text,
  ADD COLUMN IF NOT EXISTS witness_relation text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_consent_forms_patient ON public.consent_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_forms_created ON public.consent_forms(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_forms TO authenticated;
GRANT ALL ON public.consent_forms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discharge_summaries TO authenticated;
GRANT ALL ON public.discharge_summaries TO service_role;

DROP POLICY IF EXISTS "admin delete consent forms" ON public.consent_forms;
CREATE POLICY "admin delete consent forms" ON public.consent_forms
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));