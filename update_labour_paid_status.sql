-- Migration: Add is_paid and paid_at to job_labor
--
-- Tracks payment / settlement of outsourced (sublet) contractor costs.
-- Default is_paid = false so all existing lines are unaffected.
-- When marked paid, paid_at records the settlement date and clears the trade payable.

alter table job_labor
  add column if not exists is_paid boolean not null default false,
  add column if not exists paid_at timestamptz default null;
