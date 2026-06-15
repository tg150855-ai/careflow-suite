DROP POLICY IF EXISTS "ins write pat_ins" ON public.patient_insurance;
CREATE POLICY "ins write pat_ins"
ON public.patient_insurance
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'insurance_officer')
  OR public.has_role(auth.uid(), 'receptionist')
  OR public.has_role(auth.uid(), 'doctor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'insurance_officer')
  OR public.has_role(auth.uid(), 'receptionist')
  OR public.has_role(auth.uid(), 'doctor')
);

DROP POLICY IF EXISTS "ins write ins_co" ON public.insurance_companies;
CREATE POLICY "ins write ins_co"
ON public.insurance_companies
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'insurance_officer')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'insurance_officer')
);