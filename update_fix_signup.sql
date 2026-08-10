-- Migration: unbreak new-user signup
-- Applied 2026-08-10.
--
-- profiles.tenant_id defaulted to '00000000-0000-0000-0000-000000000000', a
-- tenant that has never existed. handle_new_user() (AFTER INSERT on auth.users)
-- inserts a profile without naming tenant_id, so the default applied and
-- profiles_tenant_id_fkey rejected it:
--
--   23503 insert on "profiles" violates foreign key "profiles_tenant_id_fkey"
--   Key (tenant_id)=(00000000-...-000000000000) is not present in table "tenants"
--
-- Auth reports that to the client as "Database error saving new user", which is
-- the message shown when creating a workshop. It also explains why first-time
-- Google sign-in bounced back to the login page while existing accounts worked:
-- existing users already have a profile row, so the trigger never runs for them.
--
-- A new user legitimately has no tenant until onboarding creates one, so the
-- correct default is NULL.

alter table profiles alter column tenant_id drop default;
