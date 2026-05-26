
-- Sequences for human-readable numbers
CREATE SEQUENCE IF NOT EXISTS public.bill_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.pharm_invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.lab_order_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_bill_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.bill_no_seq')::text, 6, '0')
$$;
CREATE OR REPLACE FUNCTION public.gen_pharm_invoice_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'PH-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.pharm_invoice_seq')::text, 6, '0')
$$;
CREATE OR REPLACE FUNCTION public.gen_lab_order_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'LAB-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.lab_order_seq')::text, 6, '0')
$$;

-- ============ BILLING ============
CREATE TYPE public.bill_status AS ENUM ('draft','partial','paid','cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank_transfer','insurance','credit');

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text NOT NULL UNIQUE DEFAULT public.gen_bill_no(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id uuid REFERENCES public.doctors(id),
  opd_visit_id uuid REFERENCES public.opd_visits(id),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  gst numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid numeric(12,2) NOT NULL DEFAULT 0,
  pending numeric(12,2) NOT NULL DEFAULT 0,
  status public.bill_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_patient ON public.bills(patient_id);
CREATE INDEX idx_bills_created ON public.bills(created_at DESC);
CREATE TRIGGER bills_updated BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_bill_items_bill ON public.bill_items(bill_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_payments_bill ON public.payments(bill_id);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read bills" ON public.bills FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "billing write bills" ON public.bills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'));

CREATE POLICY "staff read bill_items" ON public.bill_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "billing write bill_items" ON public.bill_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'));

CREATE POLICY "staff read payments" ON public.payments FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "billing write payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'accountant'));

-- ============ PHARMACY ============
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  generic_name text,
  manufacturer text,
  unit text DEFAULT 'pcs',
  gst_percent numeric(5,2) NOT NULL DEFAULT 12,
  minimum_stock integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicines_name ON public.medicines(lower(name));
CREATE TRIGGER medicines_updated BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_no text NOT NULL,
  expiry_date date NOT NULL,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  mrp numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_medicine ON public.medicine_batches(medicine_id);
CREATE INDEX idx_batches_expiry ON public.medicine_batches(expiry_date);

CREATE TABLE public.pharmacy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE DEFAULT public.gen_pharm_invoice_no(),
  patient_id uuid REFERENCES public.patients(id),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  gst numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_psales_patient ON public.pharmacy_sales(patient_id);
CREATE INDEX idx_psales_created ON public.pharmacy_sales(created_at DESC);

CREATE TABLE public.pharmacy_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  batch_id uuid REFERENCES public.medicine_batches(id),
  medicine_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  gst_percent numeric(5,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL
);
CREATE INDEX idx_psale_items_sale ON public.pharmacy_sale_items(sale_id);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read medicines" ON public.medicines FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "pharm write medicines" ON public.medicines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));

CREATE POLICY "staff read batches" ON public.medicine_batches FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "pharm write batches" ON public.medicine_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist'));

CREATE POLICY "staff read psales" ON public.pharmacy_sales FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "pharm write psales" ON public.pharmacy_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist') OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist') OR public.has_role(auth.uid(),'receptionist'));

CREATE POLICY "staff read psale_items" ON public.pharmacy_sale_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "pharm write psale_items" ON public.pharmacy_sale_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist') OR public.has_role(auth.uid(),'receptionist'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacist') OR public.has_role(auth.uid(),'receptionist'));

-- ============ LABORATORY ============
CREATE TYPE public.lab_order_status AS ENUM ('ordered','sample_collected','in_progress','completed','cancelled');

CREATE TABLE public.lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  department text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  turnaround_hours integer NOT NULL DEFAULT 24,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE DEFAULT public.gen_lab_order_no(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id uuid REFERENCES public.doctors(id),
  opd_visit_id uuid REFERENCES public.opd_visits(id),
  status public.lab_order_status NOT NULL DEFAULT 'ordered',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_orders_patient ON public.lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status ON public.lab_orders(status);
CREATE TRIGGER lab_orders_updated BEFORE UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.lab_tests(id),
  test_name text NOT NULL,
  result_value text,
  unit text,
  reference_range text,
  flag text,
  report_url text,
  result_entered_at timestamptz,
  result_entered_by uuid
);
CREATE INDEX idx_lab_results_order ON public.lab_results(order_id);

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read lab_tests" ON public.lab_tests FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admin write lab_tests" ON public.lab_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read lab_orders" ON public.lab_orders FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "lab write orders" ON public.lab_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'lab_tech'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'lab_tech'));

CREATE POLICY "staff read lab_results" ON public.lab_results FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "lab write results" ON public.lab_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lab_tech') OR public.has_role(auth.uid(),'doctor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lab_tech') OR public.has_role(auth.uid(),'doctor'));
