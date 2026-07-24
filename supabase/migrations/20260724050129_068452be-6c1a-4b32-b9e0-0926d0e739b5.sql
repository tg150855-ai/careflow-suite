
-- Restrict employees SELECT to HR/admin roles
DROP POLICY IF EXISTS "staff read emp" ON public.employees;
CREATE POLICY "hr read emp" ON public.employees FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);

-- Restrict employee_documents SELECT to HR/admin roles
DROP POLICY IF EXISTS "staff read emp_docs" ON public.employee_documents;
DROP POLICY IF EXISTS "Staff can view employee documents" ON public.employee_documents;
CREATE POLICY "hr read emp_docs" ON public.employee_documents FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);
-- Also tighten insert/update on employee_documents to HR/admin
DROP POLICY IF EXISTS "Staff can insert employee documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Staff can update employee documents" ON public.employee_documents;
CREATE POLICY "hr insert emp_docs" ON public.employee_documents FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);
CREATE POLICY "hr update emp_docs" ON public.employee_documents FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);

-- Restrict patients SELECT to clinical / front-desk / billing roles
DROP POLICY IF EXISTS "staff read patients" ON public.patients;
CREATE POLICY "clinical read patients" ON public.patients FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'nurse'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'surgeon'::app_role)
  OR has_role(auth.uid(), 'lab_tech'::app_role)
  OR has_role(auth.uid(), 'pharmacist'::app_role)
  OR has_role(auth.uid(), 'ot_coordinator'::app_role)
  OR has_role(auth.uid(), 'insurance_officer'::app_role)
);

-- Restrict prescriptions SELECT to clinical / pharmacy roles
DROP POLICY IF EXISTS "staff read rx" ON public.prescriptions;
CREATE POLICY "clinical read rx" ON public.prescriptions FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'nurse'::app_role)
  OR has_role(auth.uid(), 'pharmacist'::app_role)
);
