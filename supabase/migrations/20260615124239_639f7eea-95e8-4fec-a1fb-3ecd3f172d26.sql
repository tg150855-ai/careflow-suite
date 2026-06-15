GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_insurance TO authenticated;
GRANT ALL ON public.patient_insurance TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_companies TO authenticated;
GRANT ALL ON public.insurance_companies TO service_role;