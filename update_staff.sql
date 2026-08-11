-- Migration: staff you can assign work to, without giving them a login
-- Applied 2026-08-11.
--
-- Jobs were assigned to profiles, and a profile requires an auth.users row —
-- so every technician needed an account. In this workshop they never sign in,
-- so that requirement bought nothing and made adding a name impossible.
--
-- staff is now the assignable list. Rows with profile_id set are people who do
-- have a login (so "my jobs" filtering still works); rows with profile_id null
-- are name-only staff added by an admin.
--
-- job_cards.assigned_technician_id is deliberately left in place and populated
-- for existing rows. Nothing reads it any more, but dropping it would make this
-- migration irreversible.

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_tenant on staff(tenant_id);
create unique index if not exists idx_staff_profile on staff(profile_id) where profile_id is not null;

alter table staff enable row level security;

drop policy if exists "Tenant isolation" on staff;
create policy "Tenant isolation" on staff for all to authenticated
using (tenant_id = get_my_tenant())
with check (tenant_id = get_my_tenant());

alter table job_cards add column if not exists assigned_staff_id uuid references staff(id) on delete set null;
create index if not exists idx_job_cards_assigned_staff on job_cards(assigned_staff_id);

-- Everyone who already has a login becomes a staff member, so the assignment
-- dropdown looks the same as before.
insert into staff (tenant_id, profile_id, name)
select p.tenant_id, p.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed')
from profiles p
where p.tenant_id is not null
  and not exists (select 1 from staff s where s.profile_id = p.id);

-- Carry existing job assignments across.
update job_cards j
set assigned_staff_id = s.id
from staff s
where s.profile_id = j.assigned_technician_id
  and j.assigned_staff_id is null
  and j.assigned_technician_id is not null;

-- Keep the staff name in step when someone with a login is renamed.
create or replace function sync_staff_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update staff
     set name = coalesce(nullif(btrim(new.full_name), ''), name)
   where profile_id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_staff_name on profiles;
create trigger profiles_sync_staff_name
after update of full_name on profiles
for each row execute function sync_staff_name();
