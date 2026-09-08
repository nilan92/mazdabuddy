-- Security fix: 12 leftover backup tables were world-readable
-- Applied 2026-09-06.
--
-- Snapshots taken during the 2026-08-10 name-tidying and the 2026-08-11
-- migrations, then never cleaned up. CREATE TABLE does not enable RLS, and the
-- anon role holds SELECT on the public schema by default, so anyone with the
-- publishable key — which ships inside the frontend bundle and is public by
-- design — could read real customer names, phone numbers, invoices and profile
-- rows straight out of them. Every other table in the schema has RLS; these
-- were the only twelve without it.
--
-- Nothing in the application references them (grep across src/, worker/ and the
-- migration files). RLS with zero policies denies every role except
-- service_role; the grants are revoked too, so the tables also drop out of the
-- exposed PostgREST and GraphQL schemas.
--
-- The rows are retained rather than dropped: destroying a backup is
-- irreversible and is the owner's decision, not something a fix should do
-- silently. Drop them separately once they are confirmed redundant.

do $$
declare t text;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (c.relname like '\_bk\_%' or c.relname like '\_backup\_%')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
