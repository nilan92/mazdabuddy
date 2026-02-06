-- Migration: Add Efficiency Tracking Columns to job_cards

ALTER TABLE job_cards 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_labor_time INTEGER DEFAULT 0; -- In minutes

-- Optional: Index on completed_at for faster reporting queries
CREATE INDEX IF NOT EXISTS idx_job_cards_completed_at ON job_cards(completed_at);
