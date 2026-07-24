
-- Add missing FK constraints so PostgREST embedded joins (patients(...), doctors(...), ot_rooms(...)) resolve
-- across OT, Laboratory, Radiology, Insurance and Blood Bank listings.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='lab_orders_patient_id_fkey') THEN
    ALTER TABLE public.lab_orders ADD CONSTRAINT lab_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='lab_orders_doctor_id_fkey') THEN
    ALTER TABLE public.lab_orders ADD CONSTRAINT lab_orders_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='lab_results_order_id_fkey') THEN
    ALTER TABLE public.lab_results ADD CONSTRAINT lab_results_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='lab_schedules_patient_id_fkey') THEN
    ALTER TABLE public.lab_schedules ADD CONSTRAINT lab_schedules_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_patient_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_ot_room_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_ot_room_id_fkey FOREIGN KEY (ot_room_id) REFERENCES public.ot_rooms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_primary_surgeon_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_primary_surgeon_id_fkey FOREIGN KEY (primary_surgeon_id) REFERENCES public.doctors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_assistant_surgeon_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_assistant_surgeon_id_fkey FOREIGN KEY (assistant_surgeon_id) REFERENCES public.doctors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_anesthetist_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_anesthetist_id_fkey FOREIGN KEY (anesthetist_id) REFERENCES public.doctors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='surgeries_admission_id_fkey') THEN
    ALTER TABLE public.surgeries ADD CONSTRAINT surgeries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='insurance_claims_patient_id_fkey') THEN
    ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='insurance_claims_patient_insurance_id_fkey') THEN
    ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_patient_insurance_id_fkey FOREIGN KEY (patient_insurance_id) REFERENCES public.patient_insurance(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='radiology_orders_patient_id_fkey') THEN
    ALTER TABLE public.radiology_orders ADD CONSTRAINT radiology_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='radiology_orders_doctor_id_fkey') THEN
    ALTER TABLE public.radiology_orders ADD CONSTRAINT radiology_orders_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='radiology_reports_order_id_fkey') THEN
    ALTER TABLE public.radiology_reports ADD CONSTRAINT radiology_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.radiology_orders(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='blood_requests_patient_id_fkey') THEN
    ALTER TABLE public.blood_requests ADD CONSTRAINT blood_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_name='blood_inventory_donor_id_fkey') THEN
    ALTER TABLE public.blood_inventory ADD CONSTRAINT blood_inventory_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.blood_donors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Radiology test master (Fix 4)
CREATE TABLE IF NOT EXISTS public.radiology_test_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  body_part TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_test_master TO authenticated;
GRANT ALL ON public.radiology_test_master TO service_role;
ALTER TABLE public.radiology_test_master ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='radiology_test_master' AND policyname='rad_test_master_read') THEN
    CREATE POLICY rad_test_master_read ON public.radiology_test_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='radiology_test_master' AND policyname='rad_test_master_write') THEN
    CREATE POLICY rad_test_master_write ON public.radiology_test_master FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
  END IF;
END $$;

-- Radiology report templates (Fix 5)
CREATE TABLE IF NOT EXISTS public.radiology_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  body_part TEXT,
  findings TEXT,
  impression TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_report_templates TO authenticated;
GRANT ALL ON public.radiology_report_templates TO service_role;
ALTER TABLE public.radiology_report_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='radiology_report_templates' AND policyname='rad_templates_read') THEN
    CREATE POLICY rad_templates_read ON public.radiology_report_templates FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='radiology_report_templates' AND policyname='rad_templates_write') THEN
    CREATE POLICY rad_templates_write ON public.radiology_report_templates FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
  END IF;
END $$;
