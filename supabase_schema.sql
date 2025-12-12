-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Customers Table
create table customers (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  phone text,
  email text,
  address text
);

-- Vehicles Table
create table vehicles (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_id uuid references customers(id) on delete cascade not null,
  license_plate text not null,
  make text not null,
  model text not null,
  year text,
  color text,
  vin text
);

-- Inventory / Parts Table
create table parts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  part_number text,
  stock_quantity integer default 0 not null,
  min_stock_level integer default 5,
  price_lkr numeric not null, -- Selling Price
  cost_lkr numeric not null, -- Buying Price
  location text -- Shelf location
);

-- Job Cards Table
create table job_cards (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  status text check (status in ('pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled')) default 'pending',
  description text,
  technician_notes text,
  estimated_cost_lkr numeric
);

-- Job Parts (Parts specific to a job)
create table job_parts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  job_id uuid references job_cards(id) on delete cascade not null,
  part_id uuid references parts(id) not null,
  quantity integer default 1 not null,
  price_at_time_lkr numeric not null -- Capture price at time of usage
);

-- Invoices Table
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  job_id uuid references job_cards(id) on delete cascade not null,
  subtotal_lkr numeric not null,
  discount_lkr numeric default 0,
  tax_lkr numeric default 0,
  total_amount_lkr numeric not null,
  status text check (status in ('draft', 'unpaid', 'paid', 'overdue')) default 'draft',
  payment_method text
);

-- Enable Row Level Security (RLS)
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table parts enable row level security;
alter table job_cards enable row level security;
alter table job_parts enable row level security;
alter table invoices enable row level security;

-- Create policies (Open access for simplicity in this demo, usually would be authenticated users only)
create policy "Enable all access for all users" on customers for all using (true);
create policy "Enable all access for all users" on vehicles for all using (true);
create policy "Enable all access for all users" on parts for all using (true);
create policy "Enable all access for all users" on job_cards for all using (true);
create policy "Enable all access for all users" on job_parts for all using (true);
create policy "Enable all access for all users" on invoices for all using (true);
