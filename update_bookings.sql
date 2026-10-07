-- Migration: Add customer booking system schema, policies, and RPCs

-- 1. Tenant booking configuration columns
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS booking_slot_duration integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS booking_start_time text DEFAULT '08:30',
ADD COLUMN IF NOT EXISTS booking_end_time text DEFAULT '17:30',
ADD COLUMN IF NOT EXISTS booking_max_concurrent integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS booking_working_days text[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

-- 2. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    customer_title text DEFAULT 'Mr.',
    vehicle_plate text NOT NULL,
    vehicle_make text,
    vehicle_model text,
    vehicle_year integer,
    mileage integer,
    service_type text NOT NULL DEFAULT 'routine_service',
    booking_date date NOT NULL,
    booking_time text NOT NULL,
    estimated_duration_minutes integer DEFAULT 60,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes text,
    internal_notes text,
    job_card_id uuid REFERENCES public.job_cards(id) ON DELETE SET NULL,
    public_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON public.bookings(tenant_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_public_token ON public.bookings(public_token);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_plate ON public.bookings(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);

-- 3. Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "bookings_member_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_public_insert" ON public.bookings;

-- Workshop members full access to their tenant's bookings
CREATE POLICY "bookings_member_all" ON public.bookings
    FOR ALL
    TO authenticated
    USING (tenant_id = get_my_tenant())
    WITH CHECK (tenant_id = get_my_tenant());

-- Anonymous / public users can create a booking
CREATE POLICY "bookings_public_insert" ON public.bookings
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (tenant_id IS NOT NULL);

-- 4. Helper RPC: Public tenant details for booking page
CREATE OR REPLACE FUNCTION public.get_public_tenant_booking_info(p_tenant_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    phone text,
    email text,
    address text,
    logo_url text,
    brand_color text,
    booking_enabled boolean,
    booking_slot_duration integer,
    booking_start_time text,
    booking_end_time text,
    booking_max_concurrent integer,
    booking_working_days text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        id, 
        name, 
        phone, 
        email, 
        address, 
        logo_url, 
        brand_color, 
        COALESCE(booking_enabled, true) as booking_enabled, 
        COALESCE(booking_slot_duration, 60) as booking_slot_duration, 
        COALESCE(booking_start_time, '08:30') as booking_start_time, 
        COALESCE(booking_end_time, '17:30') as booking_end_time, 
        COALESCE(booking_max_concurrent, 2) as booking_max_concurrent, 
        COALESCE(booking_working_days, ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat']) as booking_working_days
    FROM public.tenants
    WHERE id = p_tenant_id
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tenant_booking_info(uuid) TO anon, authenticated;

-- 5. Helper RPC: List public booking tenants
CREATE OR REPLACE FUNCTION public.list_public_booking_tenants()
RETURNS TABLE (
    id uuid,
    name text,
    address text,
    phone text,
    logo_url text,
    brand_color text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        id, 
        name, 
        address, 
        phone, 
        logo_url, 
        brand_color
    FROM public.tenants
    WHERE COALESCE(booking_enabled, true) = true
    ORDER BY name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_booking_tenants() TO anon, authenticated;

-- 6. Helper RPC: Get booking slot counts for a specific date
CREATE OR REPLACE FUNCTION public.get_booking_slot_counts(p_tenant_id uuid, p_date date)
RETURNS TABLE (
    booking_time text,
    booked_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        b.booking_time, 
        COUNT(*)::bigint as booked_count
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id 
      AND b.booking_date = p_date
      AND b.status NOT IN ('cancelled')
    GROUP BY b.booking_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_slot_counts(uuid, date) TO anon, authenticated;

-- 7. Helper RPC: Public booking details by public token
CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token uuid)
RETURNS TABLE (
    id uuid,
    public_token uuid,
    tenant_id uuid,
    tenant_name text,
    tenant_phone text,
    tenant_address text,
    tenant_logo_url text,
    tenant_brand_color text,
    customer_name text,
    customer_phone text,
    customer_email text,
    customer_title text,
    vehicle_plate text,
    vehicle_make text,
    vehicle_model text,
    vehicle_year integer,
    mileage integer,
    service_type text,
    booking_date date,
    booking_time text,
    status text,
    notes text,
    job_card_id uuid,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        b.id,
        b.public_token,
        b.tenant_id,
        t.name as tenant_name,
        t.phone as tenant_phone,
        t.address as tenant_address,
        t.logo_url as tenant_logo_url,
        t.brand_color as tenant_brand_color,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.customer_title,
        b.vehicle_plate,
        b.vehicle_make,
        b.vehicle_model,
        b.vehicle_year,
        b.mileage,
        b.service_type,
        b.booking_date,
        b.booking_time,
        b.status,
        b.notes,
        b.job_card_id,
        b.created_at
    FROM public.bookings b
    JOIN public.tenants t ON t.id = b.tenant_id
    WHERE b.public_token = p_token
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;
