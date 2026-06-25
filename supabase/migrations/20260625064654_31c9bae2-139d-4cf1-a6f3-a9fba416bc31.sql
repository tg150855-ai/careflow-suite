
ALTER TYPE public.surgery_priority ADD VALUE IF NOT EXISTS 'planned';

ALTER TABLE public.surgeries
  ADD COLUMN IF NOT EXISTS assistant_surgeon_id uuid,
  ADD COLUMN IF NOT EXISTS ot_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surgeon_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assistant_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anesthesia_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumables_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed boolean DEFAULT false;

ALTER TABLE public.surgery_notes
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.ot_procedure_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  ot_charge numeric NOT NULL DEFAULT 0,
  surgeon_charge numeric NOT NULL DEFAULT 0,
  assistant_charge numeric NOT NULL DEFAULT 0,
  anesthesia_charge numeric NOT NULL DEFAULT 0,
  consumables_charge numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ot_procedure_catalog TO authenticated;
GRANT ALL ON public.ot_procedure_catalog TO service_role;

ALTER TABLE public.ot_procedure_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view procedures" ON public.ot_procedure_catalog
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage procedures" ON public.ot_procedure_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_ot_procedure_catalog_updated_at
  BEFORE UPDATE ON public.ot_procedure_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
