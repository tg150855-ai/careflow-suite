-- OPD Doctor Consultation Templates Migration
CREATE TABLE IF NOT EXISTS public.opd_consultation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  chief_complaint TEXT,
  clinical_findings TEXT,
  diagnosis TEXT,
  advice TEXT,
  investigations JSONB DEFAULT '[]'::jsonb,
  medicines JSONB DEFAULT '[]'::jsonb,
  follow_up_days TEXT,
  follow_up_advice TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by doctor and hospital
CREATE INDEX IF NOT EXISTS idx_opd_templates_doc ON public.opd_consultation_templates(doctor_id, hospital_id);
CREATE INDEX IF NOT EXISTS idx_opd_templates_user ON public.opd_consultation_templates(user_id);

-- Enable RLS
ALTER TABLE public.opd_consultation_templates ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated staff / doctors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'opd_consultation_templates' AND policyname = 'authenticated manage opd templates'
  ) THEN
    CREATE POLICY "authenticated manage opd templates"
      ON public.opd_consultation_templates
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Restrictive multi-tenant isolation policy: strictly confines data to current_hospital_id()
DROP POLICY IF EXISTS tenant_isolation ON public.opd_consultation_templates;
CREATE POLICY tenant_isolation ON public.opd_consultation_templates AS RESTRICTIVE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR hospital_id IS NOT DISTINCT FROM public.current_hospital_id())
  WITH CHECK (public.is_super_admin(auth.uid()) OR hospital_id IS NOT DISTINCT FROM public.current_hospital_id());

-- Data API grants
GRANT ALL ON public.opd_consultation_templates TO authenticated, service_role, anon;

-- Add to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'opd_consultation_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.opd_consultation_templates;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- publication may not exist in all environments
  NULL;
END $$;
