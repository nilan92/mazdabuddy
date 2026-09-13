-- Migration: finance module — fixed assets, custom categories, balance-sheet inputs
-- Applied 2026-09-13.
--
-- Supports the rebuilt Finances tab: a fixed asset register with straight-line
-- depreciation, tenant-defined income/expense/asset categories alongside the
-- built-in ones, and the balance-sheet figures that no transaction in this
-- system can produce (bank, cash, payables, loans, capital, opening reserves).

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category text not null default 'equipment',
  purchase_date date not null,
  cost_lkr numeric not null check (cost_lkr >= 0),
  useful_life_years numeric not null default 5 check (useful_life_years > 0),
  residual_lkr numeric not null default 0 check (residual_lkr >= 0),
  disposal_date date,
  disposal_proceeds_lkr numeric check (disposal_proceeds_lkr >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'asset')),
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, name)
);

-- Keyed per financial year so each year's statement records what was true then,
-- rather than being overwritten by the next year's figures. Key-value rather
-- than columns: the set of lines differs between businesses and adding one
-- should not need a migration.
create table if not exists finance_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  fy_start date not null,
  key text not null,
  label text,
  amount_lkr numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, fy_start, key)
);

alter table assets enable row level security;
alter table finance_categories enable row level security;
alter table finance_positions enable row level security;

drop policy if exists "Tenant isolation for assets" on assets;
create policy "Tenant isolation for assets" on assets for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists "Tenant isolation for finance_categories" on finance_categories;
create policy "Tenant isolation for finance_categories" on finance_categories for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

drop policy if exists "Tenant isolation for finance_positions" on finance_positions;
create policy "Tenant isolation for finance_positions" on finance_positions for all
  using (tenant_id = get_my_tenant_id()) with check (tenant_id = get_my_tenant_id());

create index if not exists assets_tenant_idx on assets(tenant_id, purchase_date);
create index if not exists finance_categories_tenant_idx on finance_categories(tenant_id, kind);
create index if not exists finance_positions_tenant_fy_idx on finance_positions(tenant_id, fy_start);
