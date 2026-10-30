-- Migration: Add quantity and cost_at_time_lkr to job_labor
--
-- 1) quantity: allows labour items to specify multiple units (e.g. 2 x wheel alignment, 4 x valve adjustment).
--    Default is 1 so all existing lines are unaffected.
--
-- 2) cost_at_time_lkr: enables two-price tracking for outsourced/sublet tasks:
--    - Customer price is stored in hourly_rate_lkr (what the customer is billed).
--    - Cost price is stored in cost_at_time_lkr (what the workshop pays the external contractor).
--    The difference between customer price and cost price is the workshop's gross margin/profit.
--
-- 3) Updates recalc_invoice_total(p_job_id) trigger function to factor in coalesce(quantity, 1).

alter table job_labor
  add column if not exists quantity numeric not null default 1
    check (quantity > 0),
  add column if not exists cost_at_time_lkr numeric default null
    check (cost_at_time_lkr is null or cost_at_time_lkr >= 0);

-- Update the invoice recalculation trigger to incorporate labor quantity
create or replace function public.recalc_invoice_total(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Gross labour and line discounts on labour (accounting for quantity)
  select
    coalesce(sum(coalesce(quantity, 1) * hours * coalesce(hourly_rate_lkr, 0)), 0),
    coalesce(sum(least(
      case when coalesce(discount_type, 'amount') = 'percent'
           then round((coalesce(quantity, 1) * hours * coalesce(hourly_rate_lkr, 0)) * coalesce(discount_value, 0) / 100, 2)
           else coalesce(discount_value, 0) end,
      coalesce(quantity, 1) * hours * coalesce(hourly_rate_lkr, 0)
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
$function$;
