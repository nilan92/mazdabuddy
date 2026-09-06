-- Migration: bank account details on the invoice
-- Applied 2026-09-06.
--
-- Free text rather than structured columns (bank, branch, account no, name):
-- account formats vary between banks and the workshop simply wants the block
-- reproduced on the invoice exactly as they type it. Same shape as
-- terms_and_conditions, and edited in the same place in Settings.

alter table tenants add column if not exists bank_details text;
