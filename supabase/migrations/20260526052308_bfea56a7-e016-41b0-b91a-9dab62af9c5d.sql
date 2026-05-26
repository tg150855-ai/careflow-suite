
-- Add new roles to enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'pharmacist';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'lab_tech';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
