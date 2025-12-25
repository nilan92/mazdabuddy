-- 1. Create Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create a Default Tenant (to keep existing data safe)
INSERT INTO tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Original Garage')
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to all tables with RLS
DO $$ 
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tenant_id') THEN
    ALTER TABLE profiles ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;

  -- customers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    ALTER TABLE customers ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;

  -- vehicles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='tenant_id') THEN
    ALTER TABLE vehicles ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;

  -- job_cards
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_cards' AND column_name='tenant_id') THEN
    ALTER TABLE job_cards ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;

  -- parts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parts' AND column_name='tenant_id') THEN
    ALTER TABLE parts ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;

  -- user_expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_expenses' AND column_name='tenant_id') THEN
    ALTER TABLE user_expenses ADD COLUMN tenant_id uuid REFERENCES tenants(id) DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;
END $$;

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expenses ENABLE ROW LEVEL SECURITY;

-- 5. Create the Global Tenant Policy Function
-- This function gets the tenant_id of the currently logged-in user
CREATE OR REPLACE FUNCTION get_my_tenant() 
RETURNS uuid AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Apply RLS Policies (Drop existing if any to avoid errors)
-- Note: Replace 'authenticated' with 'public' if you want even stricter controls, but 'authenticated' is standard.

DROP POLICY IF EXISTS "Tenant isolation" ON customers;
CREATE POLICY "Tenant isolation" ON customers FOR ALL USING (tenant_id = get_my_tenant());

DROP POLICY IF EXISTS "Tenant isolation" ON vehicles;
CREATE POLICY "Tenant isolation" ON vehicles FOR ALL USING (tenant_id = get_my_tenant());

DROP POLICY IF EXISTS "Tenant isolation" ON job_cards;
CREATE POLICY "Tenant isolation" ON job_cards FOR ALL USING (tenant_id = get_my_tenant());

DROP POLICY IF EXISTS "Tenant isolation" ON parts;
CREATE POLICY "Tenant isolation" ON parts FOR ALL USING (tenant_id = get_my_tenant());

DROP POLICY IF EXISTS "Tenant isolation" ON user_expenses;
CREATE POLICY "Tenant isolation" ON user_expenses FOR ALL USING (tenant_id = get_my_tenant());

DROP POLICY IF EXISTS "Tenant isolation" ON profiles;
CREATE POLICY "Tenant isolation" ON profiles FOR SELECT USING (tenant_id = get_my_tenant());
CREATE POLICY "Profile update" ON profiles FOR UPDATE USING (id = auth.uid());

-- 7. Add Storage for Logos (Run this in Supabase Dashboard manually or via API if possible)
-- Instructions: Create a public bucket called 'logos' in the Storage section.
