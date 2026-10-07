-- Migration: Vehicle Health Inspection & Future Routine Maintenance Checklist
-- Applied 2026-10-07

-- 1. Add inspection toggle and next service recommendation columns to job_cards
ALTER TABLE job_cards 
  ADD COLUMN IF NOT EXISTS has_inspection BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_service_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS next_service_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT;

-- 2. Create job_inspections table
CREATE TABLE IF NOT EXISTS job_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('good', 'advisory', 'urgent')),
  notes TEXT,
  estimated_cost_lkr NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by job_id
CREATE INDEX IF NOT EXISTS idx_job_inspections_job_id ON job_inspections(job_id);
CREATE INDEX IF NOT EXISTS idx_job_inspections_tenant_id ON job_inspections(tenant_id);

-- Enable RLS
ALTER TABLE job_inspections ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DROP POLICY IF EXISTS "Users can view inspections in their tenant" ON job_inspections;
DROP POLICY IF EXISTS "Users can insert inspections in their tenant" ON job_inspections;
DROP POLICY IF EXISTS "Users can update inspections in their tenant" ON job_inspections;
DROP POLICY IF EXISTS "Users can delete inspections in their tenant" ON job_inspections;

-- RLS Policies
CREATE POLICY "Users can view inspections in their tenant"
  ON job_inspections FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert inspections in their tenant"
  ON job_inspections FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update inspections in their tenant"
  ON job_inspections FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete inspections in their tenant"
  ON job_inspections FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RPC function for public customer tracking page
CREATE OR REPLACE FUNCTION public.get_job_inspection(p_token uuid)
RETURNS TABLE (
  has_inspection boolean,
  next_service_mileage integer,
  next_service_date date,
  inspection_notes text,
  mileage integer,
  inspections jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select j.has_inspection,
         j.next_service_mileage,
         j.next_service_date,
         j.inspection_notes,
         j.mileage,
         coalesce(
           (select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'category', i.category,
                'item_name', i.item_name,
                'status', i.status,
                'notes', i.notes,
                'estimated_cost_lkr', i.estimated_cost_lkr
              ) order by i.created_at
            )
            from job_inspections i
            where i.job_id = j.id
           ),
           '[]'::jsonb
         ) as inspections
  from job_cards j
  where j.public_token = p_token
    and coalesce(j.archived, false) = false;
$function$;

GRANT EXECUTE ON FUNCTION public.get_job_inspection(uuid) TO anon, authenticated;

