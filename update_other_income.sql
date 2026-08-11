-- Migration: income that does not come from a job
-- Applied 2026-08-11.
--
-- A workshop earns from more than repairs: scrap metal and waste oil are sold
-- on. There was nowhere to record that, so it never reached the profit figure.
--
-- Stored in user_expenses with is_income = true rather than in a new table:
-- the search, filtering, listing and report code all already operate on that
-- table, and an income row carries exactly the same fields as an expense.
-- (The table name is now a slight misnomer; renaming it would touch far more
-- than this is worth.)

alter table user_expenses add column if not exists is_income boolean not null default false;
create index if not exists idx_user_expenses_is_income on user_expenses(tenant_id, is_income);
