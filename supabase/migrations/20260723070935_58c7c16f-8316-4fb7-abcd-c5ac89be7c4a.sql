
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='emp_docs_select') THEN
    CREATE POLICY "emp_docs_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'employee-documents' AND public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='emp_docs_insert') THEN
    CREATE POLICY "emp_docs_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'employee-documents' AND public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='emp_docs_update') THEN
    CREATE POLICY "emp_docs_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'employee-documents' AND public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='emp_docs_delete') THEN
    CREATE POLICY "emp_docs_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'employee-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr_manager')));
  END IF;
END $$;
