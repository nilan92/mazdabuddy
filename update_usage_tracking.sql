-- Usage tracking (page opens + main button taps) for the super-admin "Usage" page.
-- ADDITIVE ONLY: one new table, two indexes, RLS policies, three new functions.
-- Nothing existing is altered, replaced or dropped. Safe to re-run.
--
-- Rollback (removes only what this file adds, including all recorded usage):
--   DROP FUNCTION IF EXISTS public.get_usage_summary(integer, uuid);
--   DROP FUNCTION IF EXISTS public.cleanup_usage_events(integer);
--   DROP TABLE IF EXISTS public.usage_events;
--
-- Retention: cleanup_usage_events() deletes rows older than 90 days. pg_cron is NOT
-- installed on this project, so nothing runs it automatically; a super-admin can run
--   SELECT public.cleanup_usage_events(90);
-- now and then (rows are tiny: ~200 bytes each; 50k events/month is ~10 MB).

CREATE TABLE IF NOT EXISTS public.usage_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event       text NOT NULL CHECK (event IN ('page_view', 'click')),
    name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    meta        jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(meta) <= 1024),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_tenant_created_idx ON public.usage_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS usage_events_created_idx ON public.usage_events (created_at);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Staff may only add events for themselves in their own business. Nobody can edit or delete
-- through the app (no UPDATE/DELETE policies). Reading is super-admin only, checked on the
-- profile flag directly so it stays correct whether or not fix_is_super_admin.sql is applied.
DROP POLICY IF EXISTS usage_events_insert_own ON public.usage_events;
CREATE POLICY usage_events_insert_own ON public.usage_events
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND tenant_id = (SELECT public.get_my_tenant_id())
    );

DROP POLICY IF EXISTS usage_events_select_super_admin ON public.usage_events;
CREATE POLICY usage_events_select_super_admin ON public.usage_events
    FOR SELECT TO authenticated
    USING (COALESCE((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())), false));

REVOKE ALL ON public.usage_events FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.usage_events FROM authenticated;
GRANT SELECT, INSERT ON public.usage_events TO authenticated;

-- One call returns everything the Usage page shows. Days are counted in Sri Lanka time.
CREATE OR REPLACE FUNCTION public.get_usage_summary(p_days integer DEFAULT 7, p_tenant uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_days  integer := LEAST(GREATEST(COALESCE(p_days, 7), 1), 90);
    v_since timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Colombo') AT TIME ZONE 'Asia/Colombo'
                           - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 7), 1), 90) - 1);
    v_result jsonb;
BEGIN
    -- Checked directly on the profile, not via is_super_admin() (see fix_is_super_admin.sql).
    IF NOT COALESCE((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())), false) THEN
        RAISE EXCEPTION 'Access denied. Super Admin privileges required.';
    END IF;

    WITH ev AS (
        SELECT e.* FROM public.usage_events e
        WHERE e.created_at >= v_since
          AND (p_tenant IS NULL OR e.tenant_id = p_tenant)
    )
    SELECT jsonb_build_object(
        'days', v_days,
        'since', v_since,
        'total_events', (SELECT count(*) FROM ev),
        'total_users', (SELECT count(DISTINCT user_id) FROM ev),
        'screens', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.views DESC, x.name) FROM (
                SELECT name, count(*) AS views, count(DISTINCT user_id) AS users
                FROM ev WHERE event = 'page_view' GROUP BY name ORDER BY count(*) DESC LIMIT 25
            ) x), '[]'::jsonb),
        'clicks', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.clicks DESC, x.name) FROM (
                SELECT name, count(*) AS clicks, count(DISTINCT user_id) AS users
                FROM ev WHERE event = 'click' AND name NOT LIKE 'nav:%' GROUP BY name ORDER BY count(*) DESC LIMIT 25
            ) x), '[]'::jsonb),
        'nav', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.taps DESC, x.name) FROM (
                SELECT substr(name, 5) AS name, count(*) AS taps, count(DISTINCT user_id) AS users,
                       count(*) FILTER (WHERE meta->>'from' = 'sidebar') AS sidebar,
                       count(*) FILTER (WHERE meta->>'from' = 'bottom') AS bottom,
                       count(*) FILTER (WHERE meta->>'from' = 'more') AS more
                FROM ev WHERE event = 'click' AND name LIKE 'nav:%' GROUP BY name
            ) x), '[]'::jsonb),
        'daily', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'users', COALESCE(c.users, 0), 'events', COALESCE(c.events, 0)) ORDER BY d.day)
            FROM generate_series(
                (v_since AT TIME ZONE 'Asia/Colombo')::date,
                (now() AT TIME ZONE 'Asia/Colombo')::date,
                interval '1 day') AS d(day)
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Asia/Colombo')::date AS day,
                       count(DISTINCT user_id) AS users, count(*) AS events
                FROM ev GROUP BY 1
            ) c ON c.day = d.day::date), '[]'::jsonb),
        'users', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.last_active DESC) FROM (
                SELECT ev.user_id, COALESCE(p.full_name, p.username, 'Unknown user') AS full_name, p.role,
                       t.name AS tenant_name, max(ev.created_at) AS last_active, count(*) AS events,
                       count(DISTINCT (ev.created_at AT TIME ZONE 'Asia/Colombo')::date) AS active_days
                FROM ev
                LEFT JOIN public.profiles p ON p.id = ev.user_id
                LEFT JOIN public.tenants t ON t.id = ev.tenant_id
                GROUP BY ev.user_id, p.full_name, p.username, p.role, t.name
                ORDER BY max(ev.created_at) DESC LIMIT 100
            ) x), '[]'::jsonb),
        'tenants', COALESCE((
            SELECT jsonb_agg(x ORDER BY x.events DESC) FROM (
                SELECT ev.tenant_id, COALESCE(t.name, 'Unknown') AS tenant_name, count(*) AS events,
                       count(DISTINCT ev.user_id) AS users, max(ev.created_at) AS last_active
                FROM ev LEFT JOIN public.tenants t ON t.id = ev.tenant_id
                GROUP BY ev.tenant_id, t.name
            ) x), '[]'::jsonb),
        'businesses', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
            FROM public.tenants t), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_usage_events(p_keep_days integer DEFAULT 90)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_deleted bigint;
BEGIN
    -- Checked directly on the profile, not via is_super_admin() (see fix_is_super_admin.sql).
    IF NOT COALESCE((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())), false) THEN
        RAISE EXCEPTION 'Access denied. Super Admin privileges required.';
    END IF;
    DELETE FROM public.usage_events
    WHERE created_at < now() - make_interval(days => GREATEST(COALESCE(p_keep_days, 90), 30));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_usage_summary(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usage_summary(integer, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cleanup_usage_events(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_usage_events(integer) TO authenticated;
