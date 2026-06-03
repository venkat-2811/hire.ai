-- Migration: Snapshot and fix invalid enum values for level and role in job_descriptions
-- NOTE: This migration alters live data and may hold row locks. 
-- It is recommended to run this during a maintenance window or use a NOT VALID constraint approach for zero-downtime deploys.

-- 1. Snapshot bad level values for audit
CREATE TABLE IF NOT EXISTS _migration_bad_level_values AS 
SELECT id, level 
FROM public.job_descriptions 
WHERE lower(level) NOT IN ('intern', 'junior', 'mid', 'senior');

-- 2. Snapshot bad role values for audit
CREATE TABLE IF NOT EXISTS _migration_bad_role_values AS 
SELECT id, role 
FROM public.job_descriptions 
WHERE lower(role) NOT IN (
    'software_engineer', 'frontend_developer', 'backend_developer', 
    'fullstack_developer', 'salesforce_developer', 'data_scientist', 
    'devops_engineer', 'qa_engineer', 'product_manager', 'designer',
    'business_analyst', 'salesforce_admin'
);

-- 3. Update bad level values to a safe fallback ('mid')
UPDATE public.job_descriptions
SET level = 'mid'
WHERE lower(level) NOT IN ('intern', 'junior', 'mid', 'senior');

-- 4. Update bad role values to a safe fallback ('software_engineer')
UPDATE public.job_descriptions
SET role = 'software_engineer'
WHERE lower(role) NOT IN (
    'software_engineer', 'frontend_developer', 'backend_developer', 
    'fullstack_developer', 'salesforce_developer', 'data_scientist', 
    'devops_engineer', 'qa_engineer', 'product_manager', 'designer',
    'business_analyst', 'salesforce_admin'
);
