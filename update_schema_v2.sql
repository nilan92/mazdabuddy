-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Create Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone,
  full_name text,
  role text DEFAULT 'technician' CHECK (role IN ('admin', 'manager', 'technician', 'accountant'))
);

-- 2. Create User Expenses Table
CREATE TABLE IF NOT EXISTS user_expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  job_id uuid REFERENCES job_cards(id) ON DELETE SET NULL, -- Optional link to a job
  amount_lkr numeric NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'general',
  date date DEFAULT CURRENT_DATE
);

-- 3. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expenses ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- Profiles: Readable by everyone (so we can show names), Editable only by self (or trigger)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'technician');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Expenses: Users see only their own
CREATE POLICY "Users can view own expenses" ON user_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON user_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON user_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON user_expenses FOR DELETE USING (auth.uid() = user_id);

-- Admins/Accountants can view all expenses (Example of RBAC policy)
CREATE POLICY "Admins and Accountants can view all expenses" ON user_expenses FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND role IN ('admin', 'accountant')
  )
);
