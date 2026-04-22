ALTER TABLE public.job_descriptions
ADD COLUMN resume_cutoff INT NOT NULL DEFAULT 0,
ADD COLUMN assessment_cutoff INT NOT NULL DEFAULT 0,
ADD COLUMN interview_cutoff INT NOT NULL DEFAULT 0;
