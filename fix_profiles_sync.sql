-- Enable the Trigger to auto-create profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'technician'); -- Default to technician
  return new;
end;
$$;

-- Trigger logic
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users who don't have a profile
insert into public.profiles (id, full_name, role)
select id, raw_user_meta_data ->> 'full_name', 'technician'
from auth.users
where id not in (select id from public.profiles);
