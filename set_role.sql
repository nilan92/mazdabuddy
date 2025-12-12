-- 1. Find the user by email and update their role
-- Replace 'target_email@example.com' with the actual user's email
-- Replace 'admin' with: 'manager', 'technician', or 'accountant'

UPDATE public.profiles
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'target_email@example.com'
);

-- 2. Verify the change
-- SELECT * FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'target_email@example.com');
