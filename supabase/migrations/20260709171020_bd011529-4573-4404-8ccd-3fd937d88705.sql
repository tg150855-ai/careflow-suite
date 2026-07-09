
-- patient_documents table
CREATE TABLE public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  department text NOT NULL DEFAULT 'General',
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  storage_path text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_documents_patient ON public.patient_documents(patient_id);
CREATE INDEX idx_patient_documents_created ON public.patient_documents(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_documents TO authenticated;
GRANT ALL ON public.patient_documents TO service_role;

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view patient documents"
ON public.patient_documents FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can insert patient documents"
ON public.patient_documents FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update patient documents"
ON public.patient_documents FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admins can delete patient documents"
ON public.patient_documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Storage policies for patient-documents bucket
CREATE POLICY "Staff can view patient documents storage"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-documents' AND public.has_any_role(auth.uid()));

CREATE POLICY "Staff can upload patient documents storage"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-documents' AND public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update patient documents storage"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-documents' AND public.has_any_role(auth.uid()));

CREATE POLICY "Admins can delete patient documents storage"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-documents' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
