-- Migration: atomic workshop creation
-- Applied 2026-08-10.
--
-- Onboarding did:
--     insert into tenants ... returning *      (supabase .insert().select())
--     update profiles set tenant_id = <new id>
--
-- Postgres applies the SELECT policy to rows produced by RETURNING, and that
-- policy is "id = get_my_tenant()". A brand-new user's profile has tenant_id
-- NULL, so they cannot see the workshop they just created:
--
--     42501 new row violates row-level security policy for table "tenants"
--
-- Chicken and egg. Doing it in one SECURITY DEFINER function sidesteps the
-- RETURNING visibility problem without widening the SELECT policy, and makes
-- the two writes atomic — previously a failure on the second step left an
-- orphan tenant with nobody in it.

create or replace function create_workshop(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Workshop name is required';
  end if;

  select tenant_id into v_existing from profiles where id = auth.uid();
  if v_existing is not null then
    raise exception 'You already belong to a workshop';
  end if;

  insert into tenants (name) values (btrim(p_name)) returning id into v_tenant;

  update profiles
     set tenant_id = v_tenant,
         role = 'admin'
   where id = auth.uid();

  return v_tenant;
end;
$$;

revoke all on function create_workshop(text) from public;
grant execute on function create_workshop(text) to authenticated;

-- The role guard must not block a tenant-less user becoming admin of the
-- workshop they are creating. Someone with no workshop has no data to escalate
-- into, so policing only starts once they actually belong to one.
create or replace function guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and old.tenant_id is not null
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end;
$$;
