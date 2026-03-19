-- DSA Problem Bank: LeetCode-style problems decoupled from job descriptions
-- Supports public/private/edge test cases, multi-language starter code, and difficulty tiers

CREATE TABLE IF NOT EXISTS public.dsa_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,                      -- e.g. "two-sum", "reverse-linked-list"
  title text NOT NULL,                            -- e.g. "Two Sum"
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category text NOT NULL,                         -- e.g. "Arrays", "Trees", "Dynamic Programming"
  tags text[] DEFAULT '{}',                       -- e.g. {"hash-map", "two-pointer"}
  description text NOT NULL,                      -- Full problem statement (markdown)
  constraints text DEFAULT '',                    -- Constraint descriptions
  examples jsonb NOT NULL DEFAULT '[]',           -- Visual examples shown to candidate [{"input":"...","output":"...","explanation":"..."}]
  
  -- Starter code per language
  starter_code jsonb NOT NULL DEFAULT '{}',       -- {"python3":"def twoSum(...):\n    pass","java":"class Solution {...}","cpp":"class Solution {...}","javascript":"var twoSum = function(...) {}"}
  
  -- Solution wrapper templates per language (how to call the function and compare output)
  solution_wrappers jsonb NOT NULL DEFAULT '{}',  -- {"python3":"import sys,json\n...","java":"import java.util.*;\n..."}
  
  -- Test cases: structured with visibility levels
  test_cases jsonb NOT NULL DEFAULT '[]',         -- [{"id":"tc1","input":"...","expected_output":"...","visibility":"public|private|edge","time_limit_ms":5000,"memory_limit_kb":262144}]
  
  -- Scoring
  points integer NOT NULL DEFAULT 100,
  time_limit_seconds integer NOT NULL DEFAULT 5,
  memory_limit_kb integer NOT NULL DEFAULT 262144,
  
  -- Metadata
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying by difficulty and category
CREATE INDEX IF NOT EXISTS idx_dsa_problems_difficulty ON public.dsa_problems (difficulty) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dsa_problems_category ON public.dsa_problems (category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dsa_problems_slug ON public.dsa_problems (slug);

-- Add coding_problem_ids to assessment_sessions to track which problems were assigned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_sessions'
      AND column_name = 'coding_problem_ids'
  ) THEN
    ALTER TABLE public.assessment_sessions
      ADD COLUMN coding_problem_ids uuid[] DEFAULT '{}';
  END IF;
END $$;
