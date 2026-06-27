
-- 1) test_stage enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_stage') THEN
    CREATE TYPE public.test_stage AS ENUM ('patient', 'opd', 'ipd', 'icu');
  END IF;
END$$;

-- 2) lab_orders.test_stage column + backfill + auto-tag trigger
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS test_stage public.test_stage NOT NULL DEFAULT 'patient';

UPDATE public.lab_orders lo
SET test_stage = CASE
  WHEN lo.admission_id IS NOT NULL AND a.icu_status IS NOT NULL AND a.icu_status <> 'none' THEN 'icu'::public.test_stage
  WHEN lo.admission_id IS NOT NULL THEN 'ipd'::public.test_stage
  WHEN lo.opd_visit_id IS NOT NULL THEN 'opd'::public.test_stage
  ELSE 'patient'::public.test_stage
END
FROM public.admissions a
WHERE (lo.admission_id IS NULL OR a.id = lo.admission_id)
  AND lo.test_stage = 'patient';

CREATE OR REPLACE FUNCTION public.set_lab_order_test_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  adm_icu text;
BEGIN
  IF NEW.admission_id IS NOT NULL THEN
    SELECT icu_status::text INTO adm_icu FROM public.admissions WHERE id = NEW.admission_id;
    IF adm_icu IS NOT NULL AND adm_icu <> 'none' THEN
      NEW.test_stage := 'icu';
    ELSE
      NEW.test_stage := 'ipd';
    END IF;
  ELSIF NEW.opd_visit_id IS NOT NULL THEN
    NEW.test_stage := 'opd';
  ELSE
    NEW.test_stage := COALESCE(NEW.test_stage, 'patient');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lab_orders_test_stage ON public.lab_orders;
CREATE TRIGGER trg_lab_orders_test_stage
BEFORE INSERT ON public.lab_orders
FOR EACH ROW EXECUTE FUNCTION public.set_lab_order_test_stage();

-- 3) lab_schedules table
CREATE TABLE IF NOT EXISTS public.lab_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at timestamptz NOT NULL,
  title text NOT NULL,
  technician text,
  room text,
  notes text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_schedules TO authenticated;
GRANT ALL ON public.lab_schedules TO service_role;

ALTER TABLE public.lab_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view lab schedules" ON public.lab_schedules;
CREATE POLICY "Staff can view lab schedules"
  ON public.lab_schedules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage lab schedules" ON public.lab_schedules;
CREATE POLICY "Staff can manage lab schedules"
  ON public.lab_schedules FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_lab_schedules_updated_at ON public.lab_schedules;
CREATE TRIGGER trg_lab_schedules_updated_at
BEFORE UPDATE ON public.lab_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lab_schedules_when ON public.lab_schedules(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_orders_stage ON public.lab_orders(test_stage);
