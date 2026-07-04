
CREATE TABLE public.birth_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_patient_id uuid REFERENCES public.patients(id),
  admission_id uuid REFERENCES public.admissions(id),
  baby_name text,
  sex text CHECK (sex IN ('male','female','other')),
  weight_grams integer,
  born_at timestamptz NOT NULL DEFAULT now(),
  delivery_type text,
  attending_doctor_name text,
  place_of_birth text DEFAULT 'Hospital',
  remarks text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.birth_register TO authenticated;
GRANT ALL ON public.birth_register TO service_role;

ALTER TABLE public.birth_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view birth register" ON public.birth_register
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert birth register" ON public.birth_register
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update birth register" ON public.birth_register
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete birth register" ON public.birth_register
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
  );

CREATE TRIGGER birth_register_set_updated
  BEFORE UPDATE ON public.birth_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
