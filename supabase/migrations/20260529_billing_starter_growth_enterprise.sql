-- =====================================================
-- Migration: Update plan check constraints for Free, Starter, Growth, Enterprise
-- =====================================================

-- 1. Update subscriptions table constraints
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'starter', 'growth', 'enterprise'));

-- 2. Update profiles table constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_subscription_plan;
ALTER TABLE public.profiles ADD CONSTRAINT valid_subscription_plan CHECK (subscription_plan IN ('free', 'starter', 'growth', 'enterprise'));

-- 3. Reset existing counts to 0 to prepare for the new deployment counting logic
UPDATE public.profiles SET jobs_count = 0, assessments_count = 0, interviews_count = 0;
