-- Migration: admin staff management + block self-promotion
-- Applied 2026-08-10.
--
-- Two problems with one root cause. The only UPDATE policy on profiles was
-- "id = auth.uid()", which says which ROW you may change but nothing about
-- which COLUMNS, and `authenticated` holds a column grant on profiles.role.
--
--   1. Any logged-in user could set their own role to 'admin'.
--   2. There was no policy for an admin to edit or delete ANYONE ELSE, so
--      Settings' staff management silently affected 0 rows while reporting
--      success (the code only checks for an error; "changed nothing" is not
--      an error).
--
-- RLS cannot express "this column must not change" — a policy sees the old row
-- (USING) or the new row (WITH CHECK), never both. So the column rule needs a
-- trigger and the row rules need policies.

-- SECURITY DEFINER so that reading profiles from inside a policy ON profiles
-- does not recurse. Mirrors get_my_tenant() / get_my_tenant_id() exactly.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Admins may manage other staff inside their own workshop.
drop policy if exists "Admins manage tenant profiles" on profiles;
create policy "Admins manage tenant profiles" on profiles
for update to authenticated
using      (is_admin() and tenant_id = get_my_tenant_id())
with check (is_admin() and tenant_id = get_my_tenant_id());

-- id <> auth.uid() stops an admin deleting their own account and locking
-- themselves out of the workshop.
drop policy if exists "Admins delete tenant profiles" on profiles;
create policy "Admins delete tenant profiles" on profiles
for delete to authenticated
using (is_admin() and tenant_id = get_my_tenant_id() and id <> auth.uid());

-- The existing "Users can update own profile" policy is deliberately left in
-- place: it is on the login path, and changing it risks locking everyone out.
-- The trigger below is what stops it being abused.
create or replace function guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for service-role and SQL-editor access; anyone who can
  -- run SQL as the owner already controls the database, so only end-user
  -- requests are policed here.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
before update on profiles
for each row execute function guard_profile_role();
