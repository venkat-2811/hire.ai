-- =====================================================
-- Migration: Rename razorpay_payment_id to stripe_payment_id
-- =====================================================

ALTER TABLE profiles
  RENAME COLUMN razorpay_payment_id TO stripe_payment_id;
