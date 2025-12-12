-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Add Mileage to Job Cards
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS mileage integer;

-- 2. Create Job Labor Table
CREATE TABLE IF NOT EXISTS job_labor (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  job_id uuid REFERENCES job_cards(id) ON DELETE CASCADE NOT NULL,
  mechanic_name text,
  hours numeric NOT NULL,
  description text,
  hourly_rate_lkr numeric NOT NULL
);

-- 3. Create Shop Settings Table
CREATE TABLE IF NOT EXISTS shop_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  key text UNIQUE NOT NULL,
  value text NOT NULL
);

-- 4. Enable RLS
ALTER TABLE job_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Open for now, consistent with existing setup)
CREATE POLICY "Enable all access for all users" ON job_labor FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON shop_settings FOR ALL USING (true);

-- 6. Insert Default Settings
INSERT INTO shop_settings (key, value) VALUES 
('default_labor_rate', '2500'),
('shop_name', 'MazdaBuddy Service Center'),
('shop_address', '123 Main St, Colombo')
ON CONFLICT (key) DO NOTHING;
