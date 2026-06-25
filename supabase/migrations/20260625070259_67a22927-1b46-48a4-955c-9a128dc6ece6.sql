
-- vitals: add respiratory rate
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS respiratory_rate numeric;

-- Shift handovers
CREATE TABLE IF NOT EXISTS public.shift_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift text NOT NULL,
  shift_date date NOT NULL DEFAULT current_date,
  outgoing_nurse_id uuid,
  outgoing_nurse_name text,
  incoming_nurse_id uuid,
  incoming_nurse_name text,
  ward_id uuid REFERENCES public.wards(id) ON DELETE SET NULL,
  notes text,
  critical_patients jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_handovers TO authenticated;
GRANT ALL ON public.shift_handovers TO service_role;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read handovers" ON public.shift_handovers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write handovers" ON public.shift_handovers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_shift_handovers_upd BEFORE UPDATE ON public.shift_handovers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Doctor orders (tracked & completed by nursing)
CREATE TABLE IF NOT EXISTS public.doctor_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  order_text text NOT NULL,
  priority text NOT NULL DEFAULT 'routine',
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid,
  completion_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doctor_orders_admission ON public.doctor_orders(admission_id);
CREATE INDEX IF NOT EXISTS idx_doctor_orders_status ON public.doctor_orders(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_orders TO authenticated;
GRANT ALL ON public.doctor_orders TO service_role;
ALTER TABLE public.doctor_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read doctor_orders" ON public.doctor_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write doctor_orders" ON public.doctor_orders FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_doctor_orders_upd BEFORE UPDATE ON public.doctor_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nursing service catalog (billable items)
CREATE TABLE IF NOT EXISTS public.nursing_service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  charge numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Nursing',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursing_service_catalog TO authenticated;
GRANT ALL ON public.nursing_service_catalog TO service_role;
ALTER TABLE public.nursing_service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read nursing_catalog" ON public.nursing_service_catalog FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write nursing_catalog" ON public.nursing_service_catalog FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_nursing_catalog_upd BEFORE UPDATE ON public.nursing_service_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nurse station settings (singleton)
CREATE TABLE IF NOT EXISTS public.nurse_station_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_types jsonb NOT NULL DEFAULT '["Morning","Evening","Night"]'::jsonb,
  vitals_frequency_hours integer NOT NULL DEFAULT 4,
  med_alert_minutes integer NOT NULL DEFAULT 15,
  critical_spo2 numeric NOT NULL DEFAULT 92,
  critical_pulse_low numeric NOT NULL DEFAULT 50,
  critical_pulse_high numeric NOT NULL DEFAULT 130,
  critical_systolic_low numeric NOT NULL DEFAULT 90,
  critical_systolic_high numeric NOT NULL DEFAULT 180,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_station_settings TO authenticated;
GRANT ALL ON public.nurse_station_settings TO service_role;
ALTER TABLE public.nurse_station_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ns_settings" ON public.nurse_station_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write ns_settings" ON public.nurse_station_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_ns_settings_upd BEFORE UPDATE ON public.nurse_station_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.nurse_station_settings (id) SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM public.nurse_station_settings);
