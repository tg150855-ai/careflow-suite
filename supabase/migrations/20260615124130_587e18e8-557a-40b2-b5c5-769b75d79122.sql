GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

DROP POLICY IF EXISTS "staff delete patients" ON public.patients;
CREATE POLICY "staff delete patients"
ON public.patients
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "staff create patients" ON public.patients;
CREATE POLICY "staff create patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'receptionist')
  OR public.has_role(auth.uid(), 'doctor')
);

DROP POLICY IF EXISTS "staff read patients" ON public.patients;
CREATE POLICY "staff read patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "staff update patients" ON public.patients;
CREATE POLICY "staff update patients"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'receptionist')
  OR public.has_role(auth.uid(), 'doctor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'receptionist')
  OR public.has_role(auth.uid(), 'doctor')
);