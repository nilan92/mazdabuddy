-- Migration: public job status link
-- Applied 2026-08-10.
--
-- Lets a customer check whether their vehicle is ready without an account, via
-- an unguessable link: /#/status/<public_token>.
--
-- The table is NOT opened to anon. Access goes through one SECURITY DEFINER
-- function that returns a deliberately narrow row — no money, no technician
-- notes, no parts, no ids. Anyone holding the token sees only what you would
-- tell them on the phone.

alter table job_cards add column if not exists public_token uuid;
update job_cards set public_token = gen_random_uuid() where public_token is null;
alter table job_cards alter column public_token set default gen_random_uuid();
alter table job_cards alter column public_token set not null;
create unique index if not exists idx_job_cards_public_token on job_cards(public_token);

drop function if exists get_job_status(uuid);
create function get_job_status(p_token uuid)
returns table (
  status text,
  created_at timestamptz,
  completed_at timestamptz,
  make text,
  model text,
  license_plate text,
  customer_title text,
  customer_name text,
  shop_name text,
  shop_phone text,
  shop_logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select j.status, j.created_at, j.completed_at,
         v.make, v.model, v.license_plate,
         c.title, c.name,
         t.name, t.phone, t.logo_url
  from job_cards j
  join vehicles v on v.id = j.vehicle_id
  join tenants  t on t.id = j.tenant_id
  left join customers c on c.id = v.customer_id
  where j.public_token = p_token
    and coalesce(j.archived, false) = false;
$$;

-- Explicit: revoke the default PUBLIC execute, then grant only what is needed.
revoke all on function get_job_status(uuid) from public;
grant execute on function get_job_status(uuid) to anon, authenticated;
