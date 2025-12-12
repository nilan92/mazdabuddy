-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Add new columns to job_cards
ALTER TABLE job_cards 
ADD COLUMN IF NOT EXISTS assigned_technician_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 0;

-- 2. Update user_expenses to ensure job_id is linked (if not already)
-- (It was in v2, but safely ensuring it exists here just in case)
-- ALTER TABLE user_expenses ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES job_cards(id) ON DELETE SET NULL;
