-- Migration: stop users reassigning their own workshop membership
-- Applied 2026-08-10.
--
-- "Users can update own profile" (id = auth.uid()) constrains the row, not the
-- columns. tenant_id was therefore writable by the account holder, so any
-- signed-in user could do:
--
--     update profiles set tenant_id = '<someone else's workshop>' where id = me
--
-- and immediately read that workshop's customers, invoices and jobs — the
-- entire tenant boundary bypassed with one statement. Verified against live
-- before this migration: 12 customers and 22 invoices became readable.
--
-- Membership is only ever set during onboarding, so the trigger allows it
-- exclusively from inside create_workshop(), which flags the transaction.
-- There is no invite flow yet; when one is added it must set the same flag
-- rather than update profiles directly.
--
-- auth.uid() is null for service-role and SQL-editor access, which stays
-- unrestricted — anyone who can run SQL as the owner already controls the data.

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

  -- transaction-local flag; the guard below accepts the membership write only
  -- while this is set, so it cannot leak to any other statement.
  perform set_config('app.provisioning', 'on', true);

  update profiles
     set tenant_id = v_tenant,
         role = 'admin'
   where id = auth.uid();

  return v_tenant;
end;
$$;

create or replace function guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.provisioning', true), '') <> 'on' then

    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'Workshop membership cannot be changed';
    end if;

    if new.role is distinct from old.role
       and old.tenant_id is not null
       and not is_admin() then
      raise exception 'Only an admin can change a user role';
    end if;

  end if;
  return new;
end;
$$;
