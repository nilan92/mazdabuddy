-- Migration: cancelled invoices no longer count as revenue
-- Written 2026-10-31 (branch fix/cancelled-invoice-revenue). NOT yet applied.
--
-- Why: a workshop marked a duplicate invoice "Cancelled" (the status saved fine),
-- but the dashboard's Monthly Revenue still included it, because
-- get_dashboard_stats() summed every invoice of the month whatever its status.
--
-- Changes:
--  * get_dashboard_stats: monthly revenue skips Cancelled invoices; the month
--    now starts at midnight Colombo time and includes invoices stamped exactly
--    at 00:00 on the 1st (migrated invoices carry 00:00:00 timestamps, and the
--    old strict ">" dropped them).
--  * get_super_admin_metrics / get_super_admin_tenants: Invoiced and Revenue
--    totals skip Cancelled invoices; the 'paid' check is now case-insensitive
--    (statuses are stored as 'Paid').
-- Function signatures, security and grants are unchanged (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_total_customers int;
  v_active_jobs int;
  v_completed_jobs int;
  v_monthly_revenue numeric;
  v_low_stock_count int;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

  SELECT count(*) INTO v_total_customers FROM public.customers
  WHERE tenant_id = v_tenant_id;

  SELECT count(*) INTO v_active_jobs FROM public.job_cards 
  WHERE status IN ('pending', 'in_progress') AND tenant_id = v_tenant_id;

  SELECT count(*) INTO v_completed_jobs FROM public.job_cards 
  WHERE status = 'completed' 
  AND completed_at > date_trunc('month', CURRENT_DATE)
  AND tenant_id = v_tenant_id;

  SELECT COALESCE(SUM(total_amount_lkr), 0) INTO v_monthly_revenue 
  FROM public.invoices
  WHERE created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Colombo') AT TIME ZONE 'Asia/Colombo')
  AND tenant_id = v_tenant_id
  AND COALESCE(status, '') <> 'Cancelled';

  SELECT count(*) INTO v_low_stock_count 
  FROM public.parts 
  WHERE stock_quantity <= min_stock_level
  AND tenant_id = v_tenant_id;

  RETURN json_build_object(
    'total_customers', v_total_customers,
    'active_jobs', v_active_jobs,
    'completed_jobs_month', v_completed_jobs,
    'monthly_revenue', v_monthly_revenue,
    'low_stock_alert', v_low_stock_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_super_admin_metrics()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result JSON;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Super Admin privileges required.';
    END IF;

    SELECT json_build_object(
        'total_tenants', (SELECT COUNT(*) FROM tenants),
        'total_staff', (SELECT COUNT(*) FROM profiles),
        'total_jobs', (SELECT COUNT(*) FROM job_cards),
        'total_active_jobs', (SELECT COUNT(*) FROM job_cards WHERE status NOT IN ('completed', 'cancelled')),
        'total_completed_jobs', (SELECT COUNT(*) FROM job_cards WHERE status = 'completed'),
        'total_customers', (SELECT COUNT(*) FROM customers),
        'total_vehicles', (SELECT COUNT(*) FROM vehicles),
        'total_revenue', COALESCE((SELECT SUM(COALESCE(paid_amount_lkr, CASE WHEN lower(status) = 'paid' THEN total_amount_lkr ELSE 0 END, 0)) FROM invoices WHERE COALESCE(status, '') <> 'Cancelled'), 0),
        'total_invoiced', COALESCE((SELECT SUM(COALESCE(total_amount_lkr, 0)) FROM invoices WHERE COALESCE(status, '') <> 'Cancelled'), 0)
    ) INTO result;

    RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_super_admin_tenants()
 RETURNS TABLE(id uuid, name text, address text, phone text, email text, currency text, brand_color text, logo_url text, created_at timestamp with time zone, default_labor_rate numeric, booking_enabled boolean, staff_count bigint, jobs_count bigint, active_jobs_count bigint, completed_jobs_count bigint, customers_count bigint, vehicles_count bigint, total_revenue numeric, total_invoiced numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied. Super Admin privileges required.';
    END IF;

    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.address,
        t.phone,
        t.email,
        COALESCE(t.currency, 'LKR') AS currency,
        t.brand_color,
        t.logo_url,
        t.created_at,
        t.default_labor_rate,
        COALESCE(t.booking_enabled, false) AS booking_enabled,
        (SELECT COUNT(*)::bigint FROM profiles p WHERE p.tenant_id = t.id) AS staff_count,
        (SELECT COUNT(*)::bigint FROM job_cards j WHERE j.tenant_id = t.id) AS jobs_count,
        (SELECT COUNT(*)::bigint FROM job_cards j WHERE j.tenant_id = t.id AND j.status NOT IN ('completed', 'cancelled')) AS active_jobs_count,
        (SELECT COUNT(*)::bigint FROM job_cards j WHERE j.tenant_id = t.id AND j.status = 'completed') AS completed_jobs_count,
        (SELECT COUNT(*)::bigint FROM customers c WHERE c.tenant_id = t.id) AS customers_count,
        (SELECT COUNT(*)::bigint FROM vehicles v WHERE v.tenant_id = t.id) AS vehicles_count,
        COALESCE((SELECT SUM(COALESCE(i.paid_amount_lkr, CASE WHEN lower(i.status) = 'paid' THEN i.total_amount_lkr ELSE 0 END, 0))::numeric FROM invoices i WHERE i.tenant_id = t.id AND COALESCE(i.status, '') <> 'Cancelled'), 0) AS total_revenue,
        COALESCE((SELECT SUM(COALESCE(i.total_amount_lkr, 0))::numeric FROM invoices i WHERE i.tenant_id = t.id AND COALESCE(i.status, '') <> 'Cancelled'), 0) AS total_invoiced
    FROM tenants t
    ORDER BY t.created_at DESC;
END;
$function$;
