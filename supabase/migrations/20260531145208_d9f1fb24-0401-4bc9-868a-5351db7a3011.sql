
-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  phone text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read branches" ON public.branches FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write branches" ON public.branches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- ============ EMPLOYEES ============
CREATE SEQUENCE IF NOT EXISTS public.employee_no_seq START 1001;
CREATE OR REPLACE FUNCTION public.gen_employee_no() RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'EMP-' || lpad(nextval('public.employee_no_seq')::text, 5, '0')
$$;

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE DEFAULT gen_employee_no(),
  user_id uuid,
  branch_id uuid,
  full_name text NOT NULL,
  department text NOT NULL,
  designation text,
  qualification text,
  joining_date date,
  email text,
  phone text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  dob date,
  gender text,
  pan text,
  aadhaar text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  status text NOT NULL DEFAULT 'active',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read emp" ON public.employees FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write emp" ON public.employees FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'hr_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'hr_manager'));

CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  doc_type text NOT NULL,
  doc_url text,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read emp_docs" ON public.employee_documents FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write emp_docs" ON public.employee_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager'));

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  working_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'present',
  method text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_attendance_emp_date ON public.attendance_records(employee_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read att" ON public.attendance_records FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write att" ON public.attendance_records FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'receptionist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'receptionist'));

-- ============ LEAVE ============
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  leave_type text NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read leave" ON public.leave_requests FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write leave" ON public.leave_requests FOR ALL TO authenticated
  USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

-- ============ PAYROLL ============
CREATE TABLE public.salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE,
  basic numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  da numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  pf numeric NOT NULL DEFAULT 0,
  esi numeric NOT NULL DEFAULT 0,
  professional_tax numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_structures TO authenticated;
GRANT ALL ON public.salary_structures TO service_role;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sal" ON public.salary_structures FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write sal" ON public.salary_structures FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month int NOT NULL,
  period_year int NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payroll_period ON public.payroll_runs(period_year, period_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read prun" ON public.payroll_runs FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write prun" ON public.payroll_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'));

CREATE TABLE public.salary_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  basic numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  da numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  overtime numeric NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0,
  pf numeric NOT NULL DEFAULT 0,
  esi numeric NOT NULL DEFAULT 0,
  professional_tax numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  leave_deduction numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  present_days numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_slips TO authenticated;
GRANT ALL ON public.salary_slips TO service_role;
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read slip" ON public.salary_slips FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "hr write slip" ON public.salary_slips FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr_manager') OR has_role(auth.uid(),'finance_manager'));

-- ============ ASSETS ============
CREATE SEQUENCE IF NOT EXISTS public.asset_no_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_asset_no() RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'AST-' || lpad(nextval('public.asset_no_seq')::text, 6, '0')
$$;

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_no text NOT NULL UNIQUE DEFAULT gen_asset_no(),
  name text NOT NULL,
  category text NOT NULL,
  serial_no text,
  purchase_date date,
  purchase_cost numeric NOT NULL DEFAULT 0,
  warranty_until date,
  amc_until date,
  vendor_id uuid,
  branch_id uuid,
  department text,
  location text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read assets" ON public.assets FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write assets" ON public.assets FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'));

CREATE TABLE public.asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  assigned_to_employee uuid,
  department text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read assn" ON public.asset_assignments FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write assn" ON public.asset_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'));

-- ============ VENDORS ============
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  gst_number text,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read vendors" ON public.vendors FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "proc write vendors" ON public.vendors FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer') OR has_role(auth.uid(),'accountant'));

-- ============ PROCUREMENT ============
CREATE SEQUENCE IF NOT EXISTS public.pr_no_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_pr_no() RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'PR-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.pr_no_seq')::text,5,'0')
$$;
CREATE SEQUENCE IF NOT EXISTS public.po_no_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_po_no() RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'PO-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.po_no_seq')::text,5,'0')
$$;
CREATE SEQUENCE IF NOT EXISTS public.grn_no_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_grn_no() RETURNS text LANGUAGE sql SET search_path = public AS $$
  SELECT 'GRN-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.grn_no_seq')::text,5,'0')
$$;

CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_no text NOT NULL UNIQUE DEFAULT gen_pr_no(),
  department text NOT NULL,
  requested_by uuid,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'pcs',
  estimated_cost numeric NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'normal',
  notes text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pr" ON public.purchase_requests FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write pr" ON public.purchase_requests FOR ALL TO authenticated
  USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no text NOT NULL UNIQUE DEFAULT gen_po_no(),
  pr_id uuid,
  vendor_id uuid NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read po" ON public.purchase_orders FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "proc write po" ON public.purchase_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'));

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'pcs',
  rate numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read poi" ON public.purchase_order_items FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "proc write poi" ON public.purchase_order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer'));

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_no text NOT NULL UNIQUE DEFAULT gen_grn_no(),
  po_id uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_quantity numeric NOT NULL DEFAULT 0,
  damaged_quantity numeric NOT NULL DEFAULT 0,
  accepted boolean NOT NULL DEFAULT true,
  notes text,
  received_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipts TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read grn" ON public.goods_receipts FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "proc write grn" ON public.goods_receipts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer') OR has_role(auth.uid(),'pharmacist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_officer') OR has_role(auth.uid(),'pharmacist'));

-- ============ FINANCE ============
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','income','expense','equity')),
  parent_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read acc" ON public.accounts FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "fin write acc" ON public.accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'));

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL,
  category text,
  amount numeric NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  account_id uuid,
  branch_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read txn" ON public.transactions FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "fin write txn" ON public.transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'));

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text,
  reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read je" ON public.journal_entries FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "fin write je" ON public.journal_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance_manager') OR has_role(auth.uid(),'accountant'));

-- ============ BACKUPS ============
CREATE TABLE public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'success',
  size_mb numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read bk" ON public.backup_logs FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin write bk" ON public.backup_logs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- updated_at triggers
CREATE TRIGGER trg_emp_upd BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assets_upd BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lr_upd BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sal_upd BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
