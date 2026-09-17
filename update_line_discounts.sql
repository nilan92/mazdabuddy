-- Migration: per-line discounts on parts and labour
-- Applied 2026-09-17.
--
-- Same shape as job_cards.discount_type/discount_value, so there is one way to
-- express a discount in this system rather than two. A line discount comes off
-- that line first, and the job-level discount then applies to the remainder —
-- the order a customer reads down an invoice.
--
-- recalc_invoice_total is rewritten to net line discounts off the subtotal.
-- Without that the invoice would keep billing the undiscounted figure while the
-- job card showed the discounted one. Each line is floored at zero so a mistyped
-- discount cannot turn a line negative and credit the customer.

alter table job_parts
  add column if not exists discount_type text not null default 'amount'
    check (discount_type in ('amount', 'percent')),
  add column if not exists discount_value numeric not null default 0
    check (discount_value >= 0);

alter table job_labor
  add column if not exists discount_type text not null default 'amount'
    check (discount_type in ('amount', 'percent')),
  add column if not exists discount_value numeric not null default 0
    check (discount_value >= 0);

create or replace function recalc_invoice_total(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parts numeric;
  v_labour numeric;
  v_subtotal numeric;
  v_discount numeric;
begin
  select coalesce(sum(greatest(0,
           (quantity * coalesce(price_at_time_lkr, 0))
           - least(
               case when coalesce(discount_type, 'amount') = 'percent'
                    then round((quantity * coalesce(price_at_time_lkr, 0)) * coalesce(discount_value, 0) / 100, 2)
                    else coalesce(discount_value, 0) end,
               quantity * coalesce(price_at_time_lkr, 0)))), 0)
    into v_parts
  from job_parts where job_id = p_job_id;

  select coalesce(sum(greatest(0,
           (hours * coalesce(hourly_rate_lkr, 0))
           - least(
               case when coalesce(discount_type, 'amount') = 'percent'
                    then round((hours * coalesce(hourly_rate_lkr, 0)) * coalesce(discount_value, 0) / 100, 2)
                    else coalesce(discount_value, 0) end,
               hours * coalesce(hourly_rate_lkr, 0)))), 0)
    into v_labour
  from job_labor where job_id = p_job_id;

  v_subtotal := coalesce(v_parts, 0) + coalesce(v_labour, 0);

  select case when coalesce(j.discount_type, 'amount') = 'percent'
              then round(v_subtotal * coalesce(j.discount_value, 0) / 100, 2)
              else coalesce(j.discount_value, 0)
         end
    into v_discount
  from job_cards j where j.id = p_job_id;

  v_discount := greatest(0, least(coalesce(v_discount, 0), v_subtotal));

  update invoices
  set subtotal_lkr = v_subtotal,
      discount_lkr = v_discount,
      total_amount_lkr = v_subtotal - v_discount + coalesce(tax_lkr, 0)
  where job_id = p_job_id;
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

select recalc_invoice_total(job_id) from invoices;
