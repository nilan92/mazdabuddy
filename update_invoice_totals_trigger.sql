-- Migration: keep invoice totals in step with job line items
-- Applied 2026-08-10.
--
-- The invoice total used to be a snapshot taken the moment a job was marked
-- completed. In practice the shop completes the job first and adds parts and
-- labour afterwards, so the snapshot captured nothing and the invoice showed
-- LKR 0 while the job card showed the real figure.
--
-- This lives in the database rather than the client because parts are also
-- added through the add_job_part_transaction / remove_job_part_transaction
-- RPCs, which never touch client code. A trigger catches every path.

create or replace function recalc_invoice_total(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices i
  set subtotal_lkr = t.subtotal,
      total_amount_lkr = t.subtotal
                         - coalesce(i.discount_lkr, 0)
                         + coalesce(i.tax_lkr, 0)
  from (
    select
      coalesce((select sum(quantity * coalesce(price_at_time_lkr, 0))
                from job_parts where job_id = p_job_id), 0)
    + coalesce((select sum(hours * coalesce(hourly_rate_lkr, 0))
                from job_labor where job_id = p_job_id), 0) as subtotal
  ) t
  where i.job_id = p_job_id;
end;
$$;

create or replace function trg_recalc_invoice_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalc_invoice_total(coalesce(new.job_id, old.job_id));
  return null; -- AFTER trigger
end;
$$;

drop trigger if exists job_parts_recalc_invoice on job_parts;
create trigger job_parts_recalc_invoice
after insert or update or delete on job_parts
for each row execute function trg_recalc_invoice_total();

drop trigger if exists job_labor_recalc_invoice on job_labor;
create trigger job_labor_recalc_invoice
after insert or update or delete on job_labor
for each row execute function trg_recalc_invoice_total();

-- One-off repair of invoices raised before the trigger existed.
select recalc_invoice_total(job_id) from invoices;
