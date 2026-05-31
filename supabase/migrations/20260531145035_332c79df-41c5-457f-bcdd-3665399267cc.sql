
-- New roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'dept_head';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'procurement_officer';
