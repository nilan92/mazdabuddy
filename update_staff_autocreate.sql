-- Migration: give every joiner a staff row
-- Applied 2026-08-11.
--
-- update_staff.sql backfilled staff from the profiles that existed at the time,
-- but nothing created a row for anyone joining afterwards. Someone accepting an
-- invite therefore got a login and could sign in, yet never appeared in the job
-- assignment dropdown — a technician you could not give work to.
--
-- Fires when tenant_id becomes set, which covers both create_workshop() and
-- redeem_invite(). The name may still be blank at that moment (Register writes
-- it immediately afterwards); profiles_sync_staff_name then corrects it.

create or replace function ensure_staff_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is not null then
    insert into staff (tenant_id, profile_id, name)
    select new.tenant_id, new.id, coalesce(nullif(btrim(new.full_name), ''), 'New staff member')
    where not exists (select 1 from staff s where s.profile_id = new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_staff on profiles;
create trigger profiles_ensure_staff
after insert or update of tenant_id on profiles
for each row execute function ensure_staff_for_profile();

-- staff.profile_id is ON DELETE SET NULL so a departed person's name survives on
-- the job cards they worked. Left active, though, they stay in the assignment
-- dropdown forever. Deactivate instead: history intact, no longer assignable.
create or replace function deactivate_staff_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update staff set active = false where profile_id = old.id;
  return old;
end;
$$;

drop trigger if exists profiles_deactivate_staff on profiles;
create trigger profiles_deactivate_staff
before delete on profiles
for each row execute function deactivate_staff_for_deleted_profile();
