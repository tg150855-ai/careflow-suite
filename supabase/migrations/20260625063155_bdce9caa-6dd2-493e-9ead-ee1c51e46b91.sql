
-- bed_transfers extensions
ALTER TABLE public.bed_transfers
  ADD COLUMN IF NOT EXISTS from_ward_id uuid REFERENCES public.wards(id),
  ADD COLUMN IF NOT EXISTS to_ward_id uuid REFERENCES public.wards(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

-- Link bills, lab_orders, radiology_orders to admissions
ALTER TABLE public.bills          ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id);
ALTER TABLE public.lab_orders     ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id);
ALTER TABLE public.radiology_orders ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id);
CREATE INDEX IF NOT EXISTS idx_bills_admission_id ON public.bills(admission_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_admission_id ON public.lab_orders(admission_id);
CREATE INDEX IF NOT EXISTS idx_radiology_orders_admission_id ON public.radiology_orders(admission_id);

-- Death register
CREATE TABLE IF NOT EXISTS public.death_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  admission_id uuid REFERENCES public.admissions(id),
  died_at timestamptz NOT NULL,
  cause_of_death text NOT NULL,
  immediate_cause text,
  underlying_cause text,
  certified_by uuid,
  certifying_doctor_name text,
  place_of_death text,
  remarks text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.death_register TO authenticated;
GRANT ALL ON public.death_register TO service_role;

ALTER TABLE public.death_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view death register"
  ON public.death_register FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert death register"
  ON public.death_register FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update death register"
  ON public.death_register FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete death register"
  ON public.death_register FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER death_register_set_updated_at
  BEFORE UPDATE ON public.death_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
