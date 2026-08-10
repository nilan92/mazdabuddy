-- Migration: customer title (Mr. / Ms. / Dr. / Prof.)
-- Applied 2026-08-10.
--
-- Deliberately a short closed list, per the shop's request. The CHECK enforces that
-- in the database rather than trusting the form, so a stray value cannot arrive
-- through the API. NULL is allowed for records created before this existed.

alter table customers add column if not exists title text;

alter table customers drop constraint if exists customers_title_check;
alter table customers add constraint customers_title_check
  check (title is null or title in ('Mr.', 'Ms.', 'Dr.', 'Prof.'));

-- Backfill: every existing customer is Mr. except Nishani.
update customers set title = 'Mr.' where title is null;
update customers set title = 'Ms.' where name ilike '%nishani%';
