
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent'));
CREATE INDEX IF NOT EXISTS idx_lab_orders_priority ON public.lab_orders(priority) WHERE priority = 'urgent';

ALTER TABLE public.radiology_orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent'));
CREATE INDEX IF NOT EXISTS idx_rad_orders_priority ON public.radiology_orders(priority) WHERE priority = 'urgent';

ALTER TABLE public.dialysis_sessions ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
ALTER TABLE public.dialysis_sessions ADD COLUMN IF NOT EXISTS follow_up_notes text;
