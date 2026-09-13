-- Migration: settlement date on invoices
-- Applied 2026-09-13.
--
-- Double entry needs a date for the cash side of a settled invoice. status
-- recorded *whether* an invoice was paid but not *when*, so the receipt half of
-- the entry (Dr Bank, Cr Trade receivables) had no date to post to, and the
-- books could not distinguish accrual from cash.
--
-- Deliberately not backfilled: inventing settlement dates for historical
-- invoices would put fabricated figures into a document going to an auditor.
-- The posting engine falls back to the invoice date for older rows.

alter table invoices add column if not exists paid_on date;

create index if not exists invoices_paid_on_idx on invoices(tenant_id, paid_on);
