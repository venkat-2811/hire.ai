-- Migration: Add stripe_event_id to invoices for webhook idempotency protection
-- This prevents duplicate invoice records when Stripe retries webhook events.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Create a unique index so duplicate Stripe events are rejected at DB level
CREATE UNIQUE INDEX IF NOT EXISTS invoices_stripe_event_id_unique
  ON invoices (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- Create a regular index for faster lookup during idempotency checks
CREATE INDEX IF NOT EXISTS invoices_stripe_event_id_idx
  ON invoices (stripe_event_id);

COMMENT ON COLUMN invoices.stripe_event_id IS
  'Stripe webhook event ID for idempotency protection. Prevents duplicate invoice records on webhook retries.';
