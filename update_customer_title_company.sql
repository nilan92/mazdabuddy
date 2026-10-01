-- Migration: Add 'Company' to customer title constraint
-- Run this in your Supabase SQL Editor to allow 'Company' in customers.title

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_title_check;
ALTER TABLE customers ADD CONSTRAINT customers_title_check
  CHECK (title IS NULL OR title IN ('Mr.', 'Ms.', 'Dr.', 'Prof.', 'Company'));
