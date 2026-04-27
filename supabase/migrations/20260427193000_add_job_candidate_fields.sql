ALTER TABLE job_descriptions 
ADD COLUMN location text,
ADD COLUMN "endCustomer" text CHECK ("endCustomer" IN ('your_own_company', 'end_customer'));

ALTER TABLE candidates 
ADD COLUMN location text,
ADD COLUMN "vendorName" text,
ADD COLUMN "mainSkillset" text;