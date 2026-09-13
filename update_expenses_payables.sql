-- Migration: trade payables without a new module
-- Applied 2026-09-13.
--
-- A bill the workshop has not settled is just an expense that has not been paid,
-- so rather than a separate purchases/suppliers system the existing expense
-- entry grows three fields. The workshop already records expenses; this adds one
-- question — "have you paid it?" — and payables fall out of the answer. Anything
-- left unpaid feeds the balance sheet directly, so nothing is totted up by hand
-- at year end and there is no second ledger to keep in step.
--
-- Defaults to paid, so every existing row keeps its present meaning.

alter table user_expenses
  add column if not exists supplier text,
  add column if not exists due_date date,
  add column if not exists paid boolean not null default true,
  add column if not exists paid_on date;

create index if not exists user_expenses_unpaid_idx
  on user_expenses(tenant_id, paid) where paid = false;
