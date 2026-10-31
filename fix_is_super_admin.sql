-- SECURITY FIX (found 2026-10-31 while testing usage tracking). Not applied; needs Nilan's OK.
--
-- Problem 1: public.is_super_admin() is SECURITY DEFINER and tested current_user IN ('postgres','supabase_admin').
-- Inside a SECURITY DEFINER function current_user is the function OWNER (postgres), so it returned TRUE for
-- every caller. Every "super admin only" rule therefore let any logged-in staff member through:
-- get_super_admin_users / _tenants / _metrics, super_admin_save_tenant, super_admin_update_user,
-- super_admin_switch_tenant, and the tenants/profiles super_admin_* RLS policies.
--
-- Problem 2: the "Users can update own profile" policy allows any column on your own row, and the
-- guard trigger only protected tenant_id and role, so anyone could set their own is_super_admin = true.
--
-- Problem 3: those super-admin functions are executable by the anonymous (not logged in) API role, and the
-- public site key is in the website, so with problem 1 anyone on the internet could call them.
-- Verified 2026-10-31: rpc/is_super_admin and rpc/get_super_admin_metrics answer an anonymous call with data.
--
-- This file replaces two existing functions (same names, same signatures) and adds one insert guard.
-- No table or data is changed. Rollback = re-create the two original functions (saved in the backup
-- folder) and drop the new trigger/function.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN true
    -- Direct database sessions (SQL editor, migrations) with no logged-in user.
    WHEN auth.uid() IS NULL AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated')
         AND session_user IN ('postgres', 'supabase_admin') THEN true
    ELSE COALESCE((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()), false)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.provisioning', true), '') <> 'on'
     and not public.is_super_admin() then

    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'Workshop membership cannot be changed';
    end if;

    if new.role is distinct from old.role
       and old.tenant_id is not null
       and not is_admin() then
      raise exception 'Only an admin can change a user role';
    end if;

    if coalesce(new.is_super_admin, false) is distinct from coalesce(old.is_super_admin, false) then
      raise exception 'Super admin status cannot be changed';
    end if;

  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_insert_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and coalesce(new.is_super_admin, false) and not public.is_super_admin() then
    new.is_super_admin := false;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS profiles_guard_super_admin_insert ON public.profiles;
CREATE TRIGGER profiles_guard_super_admin_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_insert_super_admin();

-- Not-logged-in callers can't run any super-admin function (logged-in calls still go through the check above).
REVOKE EXECUTE ON FUNCTION public.get_super_admin_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_tenants() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.super_admin_switch_tenant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.super_admin_update_user(uuid, text, boolean, uuid) FROM PUBLIC, anon;
DO $grant$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'super_admin_save_tenant' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $grant$;
GRANT EXECUTE ON FUNCTION public.get_super_admin_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_switch_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_user(uuid, text, boolean, uuid) TO authenticated;
