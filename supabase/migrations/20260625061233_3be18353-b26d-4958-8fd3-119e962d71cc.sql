-- RLS policies for patient-photos bucket. Only authenticated staff can read/write.
CREATE POLICY "patient_photos_staff_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "patient_photos_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "patient_photos_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "patient_photos_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_staff(auth.uid()));