-- Migration: fixed-price labour
-- Applied 2026-08-11.
--
-- Some jobs are priced flat, not by the clock: a service is 6,500 whether it
-- takes one hour or three, and short repairs are often worth more than the
-- hours suggest.
--
-- A fixed charge is stored as hours = 1 and hourly_rate_lkr = the amount, so
-- every total that already multiplies the two keeps working — the invoice
-- trigger, calcInvoiceTotal and the customer-history figures all need no
-- change. is_fixed exists purely so the UI can say "Fixed" instead of
-- "1 hrs @ 6,500", which would be misleading.

alter table job_labor add column if not exists is_fixed boolean not null default false;
