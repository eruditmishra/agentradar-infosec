-- 009_model_approval_flow.sql

-- Add columns to track model approval requests
ALTER TABLE discovered_models 
  ADD COLUMN requested_status TEXT CHECK (requested_status IN ('approved', 'flagged', NULL)),
  ADD COLUMN previous_status TEXT;
