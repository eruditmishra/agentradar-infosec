-- 011_agent_approval_flow.sql

-- 1. Drop existing constraint
ALTER TABLE discovered_agents
  DROP CONSTRAINT IF EXISTS discovered_agents_status_check;

-- 2. Add new columns
ALTER TABLE discovered_agents
  ADD COLUMN IF NOT EXISTS requested_status TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS request_remark TEXT,
  ADD COLUMN IF NOT EXISTS approval_remark TEXT;

-- 3. Recreate constraint with new statuses
ALTER TABLE discovered_agents
  ADD CONSTRAINT discovered_agents_status_check 
  CHECK (status IN ('shadow', 'reviewed', 'approved', 'flagged', 'conditionally_approved', 'conditionally_shadow', 'under_review'));
