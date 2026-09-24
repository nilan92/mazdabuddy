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
  v_gross_parts numeric;
  v_parts_discount numeric;
  v_gross_labour numeric;
  v_labour_discount numeric;
  v_gross_subtotal numeric;
  v_lines_discount numeric;
  v_net_lines numeric;
  v_job_discount numeric;
  v_total_discount numeric;
  v_total_amount numeric;
begin
  -- Gross parts and line discounts on parts
  select
    coalesce(sum(quantity * coalesce(price_at_time_lkr, 0)), 0),
    coalesce(sum(least(
      case when coalesce(discount_type, 'amount') = 'percent'
           then round((quantity * coalesce(price_at_time_lkr, 0)) * coalesce(discount_value, 0) / 100, 2)
           else coalesce(discount_value, 0) end,
      quantity * coalesce(price_at_time_lkr, 0)
    )), 0)
  into v_gross_parts, v_parts_discount
  from job_parts where job_id = p_job_id;

  -- Gross labour and line discounts on labour
  select
    coalesce(sum(hours * coalesce(hourly_rate_lkr, 0)), 0),
    coalesce(sum(least(
      case when coalesce(discount_type, 'amount') = 'percent'
           then round((hours * coalesce(hourly_rate_lkr, 0)) * coalesce(discount_value, 0) / 100, 2)
           else coalesce(discount_value, 0) end,
      hours * coalesce(hourly_rate_lkr, 0)
    )), 0)
  into v_gross_labour, v_labour_discount
  from job_labor where job_id = p_job_id;

  v_gross_subtotal := v_gross_parts + v_gross_labour;
  v_lines_discount := v_parts_discount + v_labour_discount;
  v_net_lines := greatest(0, v_gross_subtotal - v_lines_discount);

  -- Job-level discount applies to the remainder after line discounts
  select case when coalesce(j.discount_type, 'amount') = 'percent'
              then round(v_net_lines * coalesce(j.discount_value, 0) / 100, 2)
              else coalesce(j.discount_value, 0)
         end
    into v_job_discount
  from job_cards j where j.id = p_job_id;

  v_job_discount := greatest(0, least(coalesce(v_job_discount, 0), v_net_lines));
  v_total_discount := v_lines_discount + v_job_discount;
  v_total_amount := greatest(0, v_gross_subtotal - v_total_discount + coalesce((select tax_lkr from invoices where job_id = p_job_id), 0));

  update invoices
  set subtotal_lkr = v_gross_subtotal,
      discount_lkr = v_total_discount,
      total_amount_lkr = v_total_amount
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
