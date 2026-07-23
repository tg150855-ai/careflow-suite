
-- Extend employee_documents to match patient_documents functionality
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Ensure grants (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employee_documents' AND policyname='Staff can view employee documents') THEN
    CREATE POLICY "Staff can view employee documents" ON public.employee_documents
      FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employee_documents' AND policyname='Staff can insert employee documents') THEN
    CREATE POLICY "Staff can insert employee documents" ON public.employee_documents
      FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employee_documents' AND policyname='Staff can update employee documents') THEN
    CREATE POLICY "Staff can update employee documents" ON public.employee_documents
      FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employee_documents' AND policyname='Admins can delete employee documents') THEN
    CREATE POLICY "Admins can delete employee documents" ON public.employee_documents
      FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr_manager'));
  END IF;
END $$;
