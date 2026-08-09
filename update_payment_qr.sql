-- Migration: Payment QR / payment link on tenants
-- Shown on the invoice PDF and included in the WhatsApp message.
-- payment_qr_url: image in the existing `logos` storage bucket (LankaQR or a bank QR)
-- payment_link:   any payment URL the shop wants customers to open

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS payment_qr_url text,
ADD COLUMN IF NOT EXISTS payment_link text;
