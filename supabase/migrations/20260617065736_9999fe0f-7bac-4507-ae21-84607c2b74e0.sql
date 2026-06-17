
DROP POLICY IF EXISTS "hospital-assets staff read" ON storage.objects;
CREATE POLICY "hospital-assets staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hospital-assets');

DROP POLICY IF EXISTS "hospital-assets admin insert" ON storage.objects;
CREATE POLICY "hospital-assets admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hospital-assets'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

DROP POLICY IF EXISTS "hospital-assets admin update" ON storage.objects;
CREATE POLICY "hospital-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hospital-assets'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

DROP POLICY IF EXISTS "hospital-assets admin delete" ON storage.objects;
CREATE POLICY "hospital-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hospital-assets'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
