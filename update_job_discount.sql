-- Migration: per-job discount (percentage or flat amount)
-- Applied 2026-09-04.
--
-- The discount lives on the job card, not the invoice, because that is where
-- the shop agrees it with the customer — and because parts and labour are
-- routinely added after the invoice exists, so a percentage has to be
-- re-applied every time the subtotal moves. recalc_invoice_total already runs
-- on every line-item change, so it is the one place that has to know.

alter table job_cards
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
  v_subtotal numeric;
  v_discount numeric;
begin
  select coalesce((select sum(quantity * coalesce(price_at_time_lkr, 0))
                   from job_parts where job_id = p_job_id), 0)
       + coalesce((select sum(hours * coalesce(hourly_rate_lkr, 0))
                   from job_labor where job_id = p_job_id), 0)
    into v_subtotal;

  select case when coalesce(j.discount_type, 'amount') = 'percent'
              then round(v_subtotal * coalesce(j.discount_value, 0) / 100, 2)
              else coalesce(j.discount_value, 0)
         end
    into v_discount
  from job_cards j
  where j.id = p_job_id;

  -- A discount can never exceed the bill: a flat amount entered before the
  -- parts were added would otherwise produce a negative total.
  v_discount := greatest(0, least(coalesce(v_discount, 0), v_subtotal));

  update invoices
  set subtotal_lkr = v_subtotal,
      discount_lkr = v_discount,
      total_amount_lkr = v_subtotal - v_discount + coalesce(tax_lkr, 0)
  where job_id = p_job_id;
end;
$$;

create or replace function trg_job_card_recalc_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalc_invoice_total(new.id);
  return null;
end;
$$;

drop trigger if exists job_cards_recalc_invoice on job_cards;
create trigger job_cards_recalc_invoice
after update of discount_type, discount_value on job_cards
for each row execute function trg_job_card_recalc_invoice();

-- Backfill: rewrites subtotal/discount on existing invoices with the new rules.
select recalc_invoice_total(job_id) from invoices;
