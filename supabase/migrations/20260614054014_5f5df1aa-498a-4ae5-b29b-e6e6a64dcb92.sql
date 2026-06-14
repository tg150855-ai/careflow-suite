
-- 1. Role × module × action permission matrix ----------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module, action)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read role permissions" ON public.role_permissions;
CREATE POLICY "staff read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Seed matrix (idempotent) ----------------------------------------------------
TRUNCATE public.role_permissions;

WITH modules(m) AS (VALUES
  ('dashboard'),('patients'),('appointments'),('opd'),('ipd'),('ot'),
  ('emergency'),('nurse_station'),('pharmacy'),('laboratory'),('radiology'),
  ('pacs'),('blood_bank'),('dialysis'),('icu'),('billing'),('insurance'),
  ('finance'),('accounts'),('ambulance'),('hrms'),('payroll'),('inventory'),
  ('procurement'),('assets'),('reports'),('bi'),('branches'),('audit'),
  ('backups'),('settings'),('staff_admin'),('telemedicine'),('patient_portal'),
  ('ai_assistant'),('whatsapp'),('crm'),('emr'),('ehr'),('compliance'),
  ('research'),('smart_os'),('iot'),('security_center')
),
actions(a) AS (VALUES ('view'),('create'),('edit'),('delete'),('approve'))
INSERT INTO public.role_permissions(role, module, action)
SELECT 'super_admin'::public.app_role, m, a FROM modules CROSS JOIN actions;

-- Helper to insert lists
CREATE OR REPLACE FUNCTION pg_temp.seed(_role public.app_role, _module text, _actions text[])
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.role_permissions(role, module, action)
  SELECT _role, _module, unnest(_actions)
  ON CONFLICT DO NOTHING;
$$;

-- admin (broad operational, mostly RW; read-only on finance/audit/etc.)
SELECT pg_temp.seed('admin', m, ARRAY['view','create','edit']) FROM (VALUES
  ('patients'),('appointments'),('opd'),('ipd'),('ot'),('emergency'),
  ('pharmacy'),('laboratory'),('radiology'),('blood_bank'),('dialysis'),
  ('icu'),('billing'),('insurance'),('ambulance'),('hrms'),('inventory'),
  ('procurement'),('assets'),('branches'),('settings'),('staff_admin'),
  ('whatsapp'),('crm'),('compliance')
) v(m);
SELECT pg_temp.seed('admin', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('nurse_station'),('pacs'),('finance'),('accounts'),
  ('payroll'),('reports'),('bi'),('audit'),('backups'),('telemedicine'),
  ('patient_portal'),('ai_assistant'),('emr'),('ehr'),('research'),
  ('smart_os'),('iot'),('security_center')
) v(m);

-- doctor
SELECT pg_temp.seed('doctor', m, ARRAY['view','create','edit']) FROM (VALUES
  ('patients'),('appointments'),('opd'),('ipd'),('emergency'),
  ('laboratory'),('radiology'),('icu'),('telemedicine'),('emr')
) v(m);
SELECT pg_temp.seed('doctor', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('pharmacy'),('pacs'),('ai_assistant'),('ehr'),('crm')
) v(m);
SELECT pg_temp.seed('doctor','blood_bank',ARRAY['view','create']);

-- surgeon
SELECT pg_temp.seed('surgeon', m, ARRAY['view','create','edit']) FROM (VALUES
  ('patients'),('opd'),('ipd'),('emergency'),('icu'),
  ('laboratory'),('radiology'),('emr')
) v(m);
SELECT pg_temp.seed('surgeon','ot',ARRAY['view','create','edit','approve']);
SELECT pg_temp.seed('surgeon', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('pacs'),('ai_assistant')
) v(m);

-- nurse
SELECT pg_temp.seed('nurse', m, ARRAY['view','create','edit']) FROM (VALUES
  ('ipd'),('nurse_station'),('emergency'),('icu')
) v(m);
SELECT pg_temp.seed('nurse', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('patients'),('opd'),('pharmacy'),('laboratory')
) v(m);

-- receptionist
SELECT pg_temp.seed('receptionist', m, ARRAY['view','create','edit']) FROM (VALUES
  ('patients'),('appointments')
) v(m);
SELECT pg_temp.seed('receptionist', m, ARRAY['view','create']) FROM (VALUES
  ('opd'),('billing'),('emergency'),('ambulance')
) v(m);
SELECT pg_temp.seed('receptionist','dashboard',ARRAY['view']);

-- pharmacist
SELECT pg_temp.seed('pharmacist','pharmacy',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('pharmacist', m, ARRAY['view','create','edit']) FROM (VALUES
  ('inventory'),('procurement')
) v(m);
SELECT pg_temp.seed('pharmacist', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('patients')
) v(m);

-- lab_tech
SELECT pg_temp.seed('lab_tech','laboratory',ARRAY['view','create','edit']);
SELECT pg_temp.seed('lab_tech', m, ARRAY['view']) FROM (VALUES ('dashboard'),('patients')) v(m);

-- accountant
SELECT pg_temp.seed('accountant', m, ARRAY['view','create','edit']) FROM (VALUES
  ('billing'),('finance'),('accounts')
) v(m);
SELECT pg_temp.seed('accountant', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('insurance'),('reports'),('payroll')
) v(m);

-- finance_manager
SELECT pg_temp.seed('finance_manager','finance',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('finance_manager','accounts',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('finance_manager', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('billing'),('reports'),('bi'),('payroll'),('procurement')
) v(m);

-- insurance_officer
SELECT pg_temp.seed('insurance_officer','insurance',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('insurance_officer', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('billing'),('patients'),('ipd')
) v(m);

-- ot_coordinator
SELECT pg_temp.seed('ot_coordinator','ot',ARRAY['view','create','edit']);
SELECT pg_temp.seed('ot_coordinator', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('ipd'),('patients')
) v(m);

-- ambulance_driver
SELECT pg_temp.seed('ambulance_driver','ambulance',ARRAY['view','create','edit']);
SELECT pg_temp.seed('ambulance_driver', m, ARRAY['view']) FROM (VALUES ('dashboard'),('emergency')) v(m);

-- hr_manager
SELECT pg_temp.seed('hr_manager','hrms',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('hr_manager','payroll',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('hr_manager','staff_admin',ARRAY['view','create','edit']);
SELECT pg_temp.seed('hr_manager', m, ARRAY['view']) FROM (VALUES ('dashboard'),('reports')) v(m);

-- dept_head
SELECT pg_temp.seed('dept_head', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('patients'),('opd'),('ipd'),('reports'),('bi'),
  ('compliance'),('hrms')
) v(m);

-- procurement_officer
SELECT pg_temp.seed('procurement_officer','procurement',ARRAY['view','create','edit','delete','approve']);
SELECT pg_temp.seed('procurement_officer','inventory',ARRAY['view','create','edit']);
SELECT pg_temp.seed('procurement_officer', m, ARRAY['view']) FROM (VALUES
  ('dashboard'),('assets'),('reports')
) v(m);

-- patient
SELECT pg_temp.seed('patient','patient_portal',ARRAY['view','create','edit']);
SELECT pg_temp.seed('patient','telemedicine',ARRAY['view','create','edit']);
SELECT pg_temp.seed('patient','appointments',ARRAY['view','create']);
SELECT pg_temp.seed('patient','billing',ARRAY['view']);

-- 2. has_module_permission --------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid,
  _module  text,
  _action  text DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND rp.action = _action
  );
$$;

-- 3. log_audit_event --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action   text,
  _entity   text,
  _entity_id text DEFAULT NULL,
  _before   jsonb DEFAULT NULL,
  _after    jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.enterprise_audit_logs(
    user_id, user_email, action, entity, entity_id, before, after
  ) VALUES (
    auth.uid(), _email, _action, _entity, _entity_id, _before, _after
  ) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) TO authenticated;
