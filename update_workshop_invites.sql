-- Migration: proper staff invites
-- Applied 2026-08-11.
--
-- The old flow put the workshop's raw UUID in a URL and had the browser do
-- "update profiles set tenant_id = <that uuid>". That is the same write the
-- membership guard now rejects, and for good reason: the link never expired,
-- could not be revoked, and anyone who obtained a workshop id could join it.
--
-- Replaced with single-use, expiring tokens redeemed server-side. The token is
-- unrelated to the tenant id, so sharing a link leaks nothing about the
-- workshop, and redemption is the only path allowed to set membership.

create table if not exists workshop_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  role text not null default 'technician'
    check (role in ('admin','manager','technician','accountant')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null
);

create unique index if not exists idx_workshop_invites_token on workshop_invites(token);
create index if not exists idx_workshop_invites_tenant on workshop_invites(tenant_id);

alter table workshop_invites enable row level security;

-- Admins manage invites for their own workshop. Nobody reads them by token:
-- redemption goes through the SECURITY DEFINER function below, so an invitee
-- never needs select rights.
drop policy if exists "Admins manage own invites" on workshop_invites;
create policy "Admins manage own invites" on workshop_invites
for all to authenticated
using (is_admin() and tenant_id = get_my_tenant_id())
with check (is_admin() and tenant_id = get_my_tenant_id());

create or replace function create_invite(p_role text default 'technician')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not is_admin() then
    raise exception 'Only an admin can invite staff';
  end if;
  if get_my_tenant_id() is null then
    raise exception 'You do not belong to a workshop';
  end if;
  if p_role not in ('admin','manager','technician','accountant') then
    raise exception 'Unknown role';
  end if;

  insert into workshop_invites (tenant_id, role, created_by)
  values (get_my_tenant_id(), p_role, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function redeem_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite workshop_invites;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if (select tenant_id from profiles where id = auth.uid()) is not null then
    raise exception 'You already belong to a workshop';
  end if;

  select * into v_invite from workshop_invites where token = p_token for update;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;
  if v_invite.used_at is not null then
    raise exception 'This invite has already been used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  -- Transaction-local flag; guard_profile_role accepts the membership write
  -- only while it is set.
  perform set_config('app.provisioning', 'on', true);

  update profiles
     set tenant_id = v_invite.tenant_id,
         role = v_invite.role
   where id = auth.uid();

  update workshop_invites
     set used_at = now(), used_by = auth.uid()
   where id = v_invite.id;

  return v_invite.tenant_id;
end;
$$;

revoke all on function create_invite(text) from public;
revoke all on function redeem_invite(uuid) from public;
grant execute on function create_invite(text) to authenticated;
grant execute on function redeem_invite(uuid) to authenticated;
