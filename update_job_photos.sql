-- Migration: job photos
-- Applied 2026-08-09.
--
-- The image objects live in Cloudflare R2 (bucket `mazdabuddy`), not in Postgres.
-- This table is the tenant-scoped index of them: R2 has no row-level security,
-- so the tenant boundary is enforced here and in the upload Worker, which
-- prefixes every object key with the caller's tenant id.

create table if not exists job_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references job_cards(id) on delete cascade,
  url text not null,
  object_key text not null,
  caption text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_photos_job on job_photos(job_id);
create index if not exists idx_job_photos_tenant on job_photos(tenant_id);

alter table job_photos enable row level security;

-- Mirrors the policy on job_cards. Note the function is get_my_tenant(),
-- not get_my_tenant_id() as CLAUDE.md states.
drop policy if exists "Tenant isolation" on job_photos;
create policy "Tenant isolation" on job_photos for all using (tenant_id = get_my_tenant());
