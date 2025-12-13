-- 1. Add username column to profiles if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'username') then
        alter table public.profiles add column username text unique;
    end if;
end $$;

-- 2. Create a secure function to lookup email by username
-- This is SECURITY DEFINER so it can access auth.users (which normal users can't see)
-- It returns the email ONLY if the username exists in public.profiles and links to that user.

create or replace function public.get_email_by_username(input_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    found_email text;
begin
    select u.email into found_email
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(p.username) = lower(input_username);

    return found_email;
end;
$$;

-- Grant execution to everyone (authenticated and anon) so login page can use it
grant execute on function public.get_email_by_username(text) to anon, authenticated, service_role;
