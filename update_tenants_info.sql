-- Add contact info columns to tenants table for Invoice headers
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS website text;

-- Optional: Migrate data from shop_settings if it exists (Best effort)
-- This assumes shop_settings was a key-value table. 
-- We can't easily map it in SQL purely without knowing the structure perfectly, 
-- but we can set defaults or let the user fill it in a Settings UI later.
