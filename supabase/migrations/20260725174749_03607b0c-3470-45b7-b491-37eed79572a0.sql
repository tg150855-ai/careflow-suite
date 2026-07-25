
-- Scope patients read policy to authenticated role
DROP POLICY IF EXISTS "clinical read patients" ON public.patients;
CREATE POLICY "clinical read patients" ON public.patients
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'nurse'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role) OR has_role(auth.uid(), 'surgeon'::app_role)
  OR has_role(auth.uid(), 'lab_tech'::app_role) OR has_role(auth.uid(), 'pharmacist'::app_role)
  OR has_role(auth.uid(), 'ot_coordinator'::app_role) OR has_role(auth.uid(), 'insurance_officer'::app_role)
);

-- Scope prescriptions read policy to authenticated role
DROP POLICY IF EXISTS "clinical read rx" ON public.prescriptions;
CREATE POLICY "clinical read rx" ON public.prescriptions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'nurse'::app_role)
  OR has_role(auth.uid(), 'pharmacist'::app_role)
);

-- Scope employee_documents policies to authenticated role
DROP POLICY IF EXISTS "hr read emp_docs" ON public.employee_documents;
CREATE POLICY "hr read emp_docs" ON public.employee_documents
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);

DROP POLICY IF EXISTS "hr insert emp_docs" ON public.employee_documents;
CREATE POLICY "hr insert emp_docs" ON public.employee_documents
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);

DROP POLICY IF EXISTS "hr update emp_docs" ON public.employee_documents;
CREATE POLICY "hr update emp_docs" ON public.employee_documents
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);
