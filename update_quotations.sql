-- Quotations: quote -> customer accepts -> convert to job -> (existing) complete -> invoice.
-- ADDITIVE ONLY: three new tables, one new nullable column on job_cards, one new function.
-- Nothing existing is altered or dropped; safe to run twice.

begin;

-- 1. Quotations -----------------------------------------------------------
create table if not exists public.quotations (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null default public.get_my_tenant() references public.tenants(id) on delete cascade,
    vehicle_id      uuid not null references public.vehicles(id) on delete restrict,
    description     text,
    notes           text,
    valid_until     date,
    status          text not null default 'draft'
                    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
    discount_type   text not null default 'amount' check (discount_type in ('amount', 'percent')),
    discount_value  numeric not null default 0,
    total_amount_lkr numeric not null default 0,
    job_id          uuid references public.job_cards(id) on delete set null,
    created_by      uuid default auth.uid(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    sent_at         timestamptz,
    accepted_at     timestamptz,
    converted_at    timestamptz
);

create index if not exists quotations_tenant_created_idx on public.quotations (tenant_id, created_at desc);
create index if not exists quotations_vehicle_idx on public.quotations (vehicle_id);

-- Line items mirror job_parts / job_labor column-for-column, so the same
-- totals maths (calcInvoiceSummary) prices a quote exactly as it will bill.
create table if not exists public.quotation_parts (
    id                uuid primary key default gen_random_uuid(),
    quotation_id      uuid not null references public.quotations(id) on delete cascade,
    part_id           uuid references public.parts(id) on delete set null,
    is_custom         boolean not null default false,
    custom_name       text,
    quantity          numeric not null default 1,
    price_at_time_lkr numeric not null default 0,
    cost_at_time_lkr  numeric default 0,
    discount_type     text not null default 'amount' check (discount_type in ('amount', 'percent')),
    discount_value    numeric not null default 0,
    sort_order        integer not null default 0,
    created_at        timestamptz not null default now()
);
create index if not exists quotation_parts_quotation_idx on public.quotation_parts (quotation_id);

create table if not exists public.quotation_labor (
    id               uuid primary key default gen_random_uuid(),
    quotation_id     uuid not null references public.quotations(id) on delete cascade,
    description      text,
    quantity         numeric not null default 1,
    hours            numeric not null default 1,
    hourly_rate_lkr  numeric not null default 0,
    is_fixed         boolean not null default false,
    cost_at_time_lkr numeric,
    is_outsourced    boolean not null default false,
    outsourced_to    text,
    discount_type    text not null default 'amount' check (discount_type in ('amount', 'percent')),
    discount_value   numeric not null default 0,
    sort_order       integer not null default 0,
    created_at       timestamptz not null default now()
);
create index if not exists quotation_labor_quotation_idx on public.quotation_labor (quotation_id);

-- 2. Link a job back to the quote it came from (nullable, no default: instant).
alter table public.job_cards add column if not exists quotation_id uuid
    references public.quotations(id) on delete set null;
create index if not exists job_cards_quotation_idx on public.job_cards (quotation_id) where quotation_id is not null;

-- 3. Row level security — same rule as job_cards / invoices / job_parts.
alter table public.quotations      enable row level security;
alter table public.quotation_parts enable row level security;
alter table public.quotation_labor enable row level security;

drop policy if exists "Tenant isolation" on public.quotations;
create policy "Tenant isolation" on public.quotations for all
    using (tenant_id = public.get_my_tenant())
    with check (tenant_id = public.get_my_tenant());

drop policy if exists "Quotation Parts Tenant Access" on public.quotation_parts;
create policy "Quotation Parts Tenant Access" on public.quotation_parts for all
    using (quotation_id in (select q.id from public.quotations q where q.tenant_id = public.get_my_tenant()))
    with check (quotation_id in (select q.id from public.quotations q where q.tenant_id = public.get_my_tenant()));

drop policy if exists "Quotation Labor Tenant Access" on public.quotation_labor;
create policy "Quotation Labor Tenant Access" on public.quotation_labor for all
    using (quotation_id in (select q.id from public.quotations q where q.tenant_id = public.get_my_tenant()))
    with check (quotation_id in (select q.id from public.quotations q where q.tenant_id = public.get_my_tenant()));

grant select, insert, update, delete on public.quotations, public.quotation_parts, public.quotation_labor to authenticated;

-- 4. Housekeeping triggers (reuse existing functions).
create or replace function public.quotations_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists quotations_touch_updated_at on public.quotations;
create trigger quotations_touch_updated_at before update on public.quotations
    for each row execute function public.quotations_touch_updated_at();

drop trigger if exists audit_delete_quotations on public.quotations;
create trigger audit_delete_quotations after delete on public.quotations
    for each row execute function public.audit_deleted_row();
drop trigger if exists audit_delete_quotation_parts on public.quotation_parts;
create trigger audit_delete_quotation_parts after delete on public.quotation_parts
    for each row execute function public.audit_deleted_row();
drop trigger if exists audit_delete_quotation_labor on public.quotation_labor;
create trigger audit_delete_quotation_labor after delete on public.quotation_labor
    for each row execute function public.audit_deleted_row();

-- 5. Convert a quote into a job in one transaction.
-- Quoted prices are kept (not today's inventory price). Inventory parts take
-- stock exactly like adding them to a job does; a part that is short of stock
-- is added as a custom line with the same name and price and reported back,
-- so the conversion never fails half-way and stock never goes negative.
create or replace function public.convert_quotation_to_job(p_quotation_id uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_tenant uuid;
    v_quote  public.quotations%rowtype;
    v_job_id uuid;
    v_staff  uuid;
    v_part   record;
    v_stock  int;
    v_name   text;
    v_short  text[] := '{}';
begin
    v_tenant := public.get_my_tenant();
    if v_tenant is null then
        raise exception 'Not authorised';
    end if;

    select * into v_quote from public.quotations
     where id = p_quotation_id and tenant_id = v_tenant
     for update;
    if not found then
        raise exception 'Quotation not found';
    end if;

    if v_quote.job_id is not null or v_quote.status = 'converted' then
        return json_build_object('success', false, 'message', 'This quotation is already a job.', 'job_id', v_quote.job_id);
    end if;
    if v_quote.status in ('declined', 'expired') then
        return json_build_object('success', false, 'message', 'A ' || v_quote.status || ' quotation cannot become a job.');
    end if;

    select id into v_staff from public.staff where profile_id = auth.uid() and tenant_id = v_tenant limit 1;

    insert into public.job_cards (vehicle_id, description, status, tenant_id, assigned_staff_id,
                                  discount_type, discount_value, estimated_cost_lkr,
                                  technician_notes, quotation_id, is_outsourced)
    values (v_quote.vehicle_id, v_quote.description, 'pending', v_tenant, v_staff,
            v_quote.discount_type, v_quote.discount_value, v_quote.total_amount_lkr,
            nullif(v_quote.notes, ''), v_quote.id, false)
    returning id into v_job_id;

    for v_part in
        select qp.*, p.stock_quantity, p.name as part_name
          from public.quotation_parts qp
          left join public.parts p on p.id = qp.part_id and p.tenant_id = v_tenant
         where qp.quotation_id = v_quote.id
         order by qp.sort_order, qp.created_at
    loop
        if v_part.part_id is not null and v_part.part_name is not null and not coalesce(v_part.is_custom, false) then
            select stock_quantity into v_stock from public.parts where id = v_part.part_id for update;
            if v_stock >= v_part.quantity then
                update public.parts set stock_quantity = stock_quantity - v_part.quantity::int where id = v_part.part_id;
                insert into public.job_parts (job_id, part_id, quantity, price_at_time_lkr, cost_at_time_lkr,
                                              is_custom, custom_name, discount_type, discount_value)
                values (v_job_id, v_part.part_id, v_part.quantity, v_part.price_at_time_lkr, coalesce(v_part.cost_at_time_lkr, 0),
                        false, null, v_part.discount_type, v_part.discount_value);
                continue;
            end if;
            v_short := array_append(v_short, v_part.part_name);
        end if;

        v_name := coalesce(nullif(v_part.custom_name, ''), v_part.part_name, 'Part');
        insert into public.job_parts (job_id, part_id, quantity, price_at_time_lkr, cost_at_time_lkr,
                                      is_custom, custom_name, discount_type, discount_value)
        values (v_job_id, null, v_part.quantity, v_part.price_at_time_lkr, coalesce(v_part.cost_at_time_lkr, 0),
                true, v_name, v_part.discount_type, v_part.discount_value);
    end loop;

    insert into public.job_labor (job_id, description, quantity, hours, hourly_rate_lkr, is_fixed,
                                  cost_at_time_lkr, is_outsourced, outsourced_to, discount_type, discount_value)
    select v_job_id, ql.description, ql.quantity, ql.hours, ql.hourly_rate_lkr, ql.is_fixed,
           ql.cost_at_time_lkr, ql.is_outsourced, ql.outsourced_to, ql.discount_type, ql.discount_value
      from public.quotation_labor ql
     where ql.quotation_id = v_quote.id
     order by ql.sort_order, ql.created_at;

    update public.quotations
       set status = 'converted',
           job_id = v_job_id,
           converted_at = now(),
           accepted_at = coalesce(accepted_at, now())
     where id = v_quote.id;

    return json_build_object('success', true, 'job_id', v_job_id, 'out_of_stock', to_json(v_short));
end;
$function$;

revoke all on function public.convert_quotation_to_job(uuid) from public, anon;
grant execute on function public.convert_quotation_to_job(uuid) to authenticated;

commit;
