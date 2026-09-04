-- Migration: expose job photos on the public status link
-- Applied 2026-09-04.
--
-- A separate function rather than widening get_job_status(): that one returns a
-- single row and photos are many, and changing its return type would mean
-- dropping and re-granting a function the customer-facing page depends on.
--
-- Same contract as get_job_status: the token is the only credential, and an
-- archived job returns nothing. Only url and taken_at are exposed — object_key
-- is the delete handle and tenant_id/uploaded_by are nobody's business.

create or replace function get_job_photos(p_token uuid)
returns table(url text, taken_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.url, p.created_at
  from job_photos p
  join job_cards j on j.id = p.job_id
  where j.public_token = p_token
    and coalesce(j.archived, false) = false
  order by p.created_at;
$$;

revoke all on function get_job_photos(uuid) from public;
grant execute on function get_job_photos(uuid) to anon, authenticated, service_role;
