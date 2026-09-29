-- Migration for patient tab handwritten notes
CREATE TABLE IF NOT EXISTS public.patient_tab_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  department text NOT NULL DEFAULT 'OPD',
  context_id uuid,
  title text NOT NULL DEFAULT 'Clinical Tab Note',
  hospital_name text,
  doctor_name text,
  notes text,
  medicines jsonb DEFAULT '[]'::jsonb,
  background_pattern text DEFAULT 'ruled',
  strokes jsonb DEFAULT '[]'::jsonb,
  image_data text NOT NULL,
  canvas_width int DEFAULT 800,
  canvas_height int DEFAULT 1000,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_tab_notes_patient ON public.patient_tab_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_tab_notes_dept ON public.patient_tab_notes(department);
CREATE INDEX IF NOT EXISTS idx_patient_tab_notes_created ON public.patient_tab_notes(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_tab_notes TO authenticated;
GRANT ALL ON public.patient_tab_notes TO service_role;

ALTER TABLE public.patient_tab_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view patient tab notes"
ON public.patient_tab_notes FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can insert patient tab notes"
ON public.patient_tab_notes FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update patient tab notes"
ON public.patient_tab_notes FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can delete patient tab notes"
ON public.patient_tab_notes FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid()));
