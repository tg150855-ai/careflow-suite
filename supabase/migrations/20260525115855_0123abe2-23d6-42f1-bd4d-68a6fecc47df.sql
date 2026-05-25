
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin','doctor','receptionist','nurse','pharmacist','lab_technician','accountant');
CREATE TYPE public.appointment_status AS ENUM ('booked','checked_in','waiting','completed','cancelled');
CREATE TYPE public.gender_type AS ENUM ('male','female','other');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= DEPARTMENTS =============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ============= DOCTORS =============
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  specialization TEXT,
  department_id UUID REFERENCES public.departments(id),
  consultation_fee NUMERIC(10,2) DEFAULT 0,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_doctors_dept ON public.doctors(department_id);

-- ============= PATIENTS =============
CREATE SEQUENCE public.uhid_seq;

CREATE OR REPLACE FUNCTION public.generate_uhid()
RETURNS TEXT LANGUAGE SQL VOLATILE AS $$
  SELECT 'HMS-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.uhid_seq')::text, 6, '0')
$$;

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uhid TEXT NOT NULL UNIQUE DEFAULT public.generate_uhid(),
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  gender public.gender_type NOT NULL,
  dob DATE,
  blood_group TEXT,
  address_line TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  aadhaar TEXT,
  emergency_contact_name TEXT,
  emergency_contact_mobile TEXT,
  allergies TEXT,
  chronic_diseases TEXT,
  photo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_patients_mobile ON public.patients(mobile);
CREATE INDEX idx_patients_uhid ON public.patients(uhid);
CREATE INDEX idx_patients_name ON public.patients USING gin (to_tsvector('simple', full_name));

-- ============= APPOINTMENTS =============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  token_no INTEGER,
  status public.appointment_status NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appt_doctor_date ON public.appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appt_patient ON public.appointments(patient_id);
CREATE INDEX idx_appt_status ON public.appointments(status);

-- ============= OPD VISITS =============
CREATE TABLE public.opd_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  chief_complaints TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  clinical_findings TEXT,
  vitals JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  follow_up_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opd_visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_opd_patient ON public.opd_visits(patient_id);
CREATE INDEX idx_opd_created ON public.opd_visits(created_at DESC);

-- ============= PRESCRIPTIONS =============
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_visit_id UUID NOT NULL REFERENCES public.opd_visits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  timing TEXT,
  food_instruction TEXT,
  duration_days INTEGER,
  notes TEXT,
  position INTEGER DEFAULT 0
);
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rxitems_rx ON public.prescription_items(prescription_id);

-- ============= AUDIT LOG =============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- departments
CREATE POLICY "staff read departments" ON public.departments FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admins write departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- doctors
CREATE POLICY "staff read doctors" ON public.doctors FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admins write doctors" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- patients
CREATE POLICY "staff read patients" ON public.patients FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "staff create patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor')
);
CREATE POLICY "staff update patients" ON public.patients FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor')
);

-- appointments
CREATE POLICY "staff read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "staff write appointments" ON public.appointments FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'receptionist') OR public.has_role(auth.uid(),'doctor')
);

-- opd_visits
CREATE POLICY "staff read opd" ON public.opd_visits FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "doctors write opd" ON public.opd_visits FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
);

-- prescriptions
CREATE POLICY "staff read rx" ON public.prescriptions FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "doctors write rx" ON public.prescriptions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
);

CREATE POLICY "staff read rxitems" ON public.prescription_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "doctors write rxitems" ON public.prescription_items FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
);

-- audit logs - admins read all, users read own
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "system writes audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
