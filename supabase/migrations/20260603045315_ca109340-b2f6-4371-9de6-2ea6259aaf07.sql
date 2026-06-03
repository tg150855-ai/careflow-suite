
-- ============ RADIOLOGY ============
CREATE TABLE IF NOT EXISTS public.radiology_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id),
  modality TEXT NOT NULL,
  investigation TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'routine',
  instructions TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  technician_id UUID,
  amount NUMERIC(10,2) DEFAULT 0,
  performed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_orders TO authenticated;
GRANT ALL ON public.radiology_orders TO service_role;
ALTER TABLE public.radiology_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full radiology_orders" ON public.radiology_orders FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.radiology_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.radiology_orders(id) ON DELETE CASCADE,
  template_key TEXT,
  findings TEXT,
  impression TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  radiologist_id UUID,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_reports TO authenticated;
GRANT ALL ON public.radiology_reports TO service_role;
ALTER TABLE public.radiology_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full radiology_reports" ON public.radiology_reports FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ PACS / DICOM ============
CREATE TABLE IF NOT EXISTS public.imaging_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.radiology_orders(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  study_uid TEXT,
  modality TEXT,
  description TEXT,
  study_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imaging_studies TO authenticated;
GRANT ALL ON public.imaging_studies TO service_role;
ALTER TABLE public.imaging_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full imaging_studies" ON public.imaging_studies FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.imaging_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.imaging_studies(id) ON DELETE CASCADE,
  series_uid TEXT,
  description TEXT,
  image_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imaging_series TO authenticated;
GRANT ALL ON public.imaging_series TO service_role;
ALTER TABLE public.imaging_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full imaging_series" ON public.imaging_series FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.dicom_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.imaging_series(id) ON DELETE CASCADE,
  study_id UUID REFERENCES public.imaging_studies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  modality TEXT,
  acquisition_date TIMESTAMPTZ,
  size_bytes BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dicom_files TO authenticated;
GRANT ALL ON public.dicom_files TO service_role;
ALTER TABLE public.dicom_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full dicom_files" ON public.dicom_files FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.imaging_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  study_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.imaging_audit_logs TO authenticated;
GRANT ALL ON public.imaging_audit_logs TO service_role;
ALTER TABLE public.imaging_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read audit" ON public.imaging_audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert audit" ON public.imaging_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ============ BLOOD BANK ============
CREATE TABLE IF NOT EXISTS public.blood_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_no TEXT UNIQUE,
  full_name TEXT NOT NULL,
  blood_group TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  gender TEXT,
  dob DATE,
  address TEXT,
  last_donation_at TIMESTAMPTZ,
  total_donations INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_donors TO authenticated;
GRANT ALL ON public.blood_donors TO service_role;
ALTER TABLE public.blood_donors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full blood_donors" ON public.blood_donors FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES public.blood_donors(id) ON DELETE SET NULL,
  blood_group TEXT NOT NULL,
  component TEXT NOT NULL,
  bag_no TEXT,
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  volume_ml INT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_inventory TO authenticated;
GRANT ALL ON public.blood_inventory TO service_role;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full blood_inventory" ON public.blood_inventory FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  blood_group TEXT NOT NULL,
  component TEXT NOT NULL,
  units INT NOT NULL DEFAULT 1,
  priority TEXT DEFAULT 'routine',
  requested_by UUID,
  approved_by UUID,
  issued_inventory_id UUID REFERENCES public.blood_inventory(id),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_requests TO authenticated;
GRANT ALL ON public.blood_requests TO service_role;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full blood_requests" ON public.blood_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ DIALYSIS ============
CREATE TABLE IF NOT EXISTS public.dialysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  machine_no TEXT,
  doctor_id UUID REFERENCES public.doctors(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_min INT,
  pre_weight NUMERIC(5,2),
  post_weight NUMERIC(5,2),
  vitals JSONB,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dialysis_sessions TO authenticated;
GRANT ALL ON public.dialysis_sessions TO service_role;
ALTER TABLE public.dialysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full dialysis_sessions" ON public.dialysis_sessions FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ ICU ============
CREATE TABLE IF NOT EXISTS public.icu_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heart_rate INT,
  bp_sys INT,
  bp_dia INT,
  spo2 INT,
  temperature NUMERIC(4,1),
  resp_rate INT,
  on_ventilator BOOLEAN DEFAULT false,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_monitoring TO authenticated;
GRANT ALL ON public.icu_monitoring TO service_role;
ALTER TABLE public.icu_monitoring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full icu_monitoring" ON public.icu_monitoring FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.icu_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icu_alerts TO authenticated;
GRANT ALL ON public.icu_alerts TO service_role;
ALTER TABLE public.icu_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full icu_alerts" ON public.icu_alerts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ BIOMEDICAL ============
CREATE TABLE IF NOT EXISTS public.biomedical_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_no TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  serial_number TEXT,
  location TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  amc_expiry DATE,
  next_service_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biomedical_assets TO authenticated;
GRANT ALL ON public.biomedical_assets TO service_role;
ALTER TABLE public.biomedical_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full biomedical_assets" ON public.biomedical_assets FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.biomedical_assets(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'preventive',
  performed_by TEXT,
  description TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full maintenance_logs" ON public.maintenance_logs FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ RESOURCE SCHEDULES ============
CREATE TABLE IF NOT EXISTS public.resource_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_schedules TO authenticated;
GRANT ALL ON public.resource_schedules TO service_role;
ALTER TABLE public.resource_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff full resource_schedules" ON public.resource_schedules FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_rad_orders_uat BEFORE UPDATE ON public.radiology_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rad_reports_uat BEFORE UPDATE ON public.radiology_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_blood_donors_uat BEFORE UPDATE ON public.blood_donors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_blood_inv_uat BEFORE UPDATE ON public.blood_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_blood_req_uat BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_dialysis_uat BEFORE UPDATE ON public.dialysis_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_biomed_uat BEFORE UPDATE ON public.biomedical_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
